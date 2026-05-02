-- ============================================================
-- 체육관 코드 시스템 — 데이터 마이그레이션 (Phase 2 / 7)
-- 사전 조건: sql/57 + sql/58 적용 완료
--
-- ── 무엇을 하는가 ──
-- A) 사전 점검 — sql/58 객체 존재 확인. 없으면 즉시 실패.
-- B) 현재 상태 미리보기 (NOTICE 로 출력)
-- C) 체육관 region 부여 → 트리거가 자동 코드 발급
--    체육관이 1개면 자동 진행, 2개 이상이면 EXCEPTION 으로 멈춤(안전).
-- D) matches.gym_user_id_at_match 백필
--    user_id 의 현재 gym_user_id 로 채움 (best effort — 매치 시점 정확 보존 못 함)
--    회원이 체육관 변경 이력 없다면 100% 정확.
-- E) user_gym_history 백필
--    회원당 "현재 소속" row 1개 INSERT (joined_at=users.created_at, left_at=NULL)
-- F) 사후 검증 — 검증 실패 시 RAISE WARNING (자동 롤백 X, 사용자 판단)
--
-- ── 절대 건드리지 않는 데이터 (매우 중요) ──
--   ❌ matches 행 자체 — DELETE 없음. 컬럼만 채움.
--   ❌ 회원의 gym_user_id, gym_name 등 — UPDATE 안 함.
--   ❌ 출석·승단·스킬 진행도·랭킹 — 무관.
--   ❌ skill_promotion_requests — 무관.
--
-- ── 안전 장치 ──
--   - BEGIN/COMMIT 트랜잭션 — 중간 실패 시 자동 롤백
--   - 사전 점검 (A) — sql/58 미적용 시 즉시 실패
--   - 멱등성 — IS DISTINCT FROM / NOT EXISTS 가드로 두 번 실행 안전
--   - 마지막 줄 COMMIT 을 ROLLBACK 으로 바꾸면 → 모든 변경 취소
--     ▶ 권장: 첫 실행은 ROLLBACK 으로 NOTICE 만 확인 → 결과 OK 면 COMMIT 으로 재실행
--
-- ⚠️ Supabase SQL Editor 에서 실행. Phase 2 부터는 백업 스냅샷 권장.
-- ============================================================

BEGIN;


-- ============================================================
-- A) 사전 점검 — sql/58 객체 존재 확인
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users'
       AND column_name IN ('region','gym_code')
    HAVING count(*) = 2
  ) THEN
    RAISE EXCEPTION '[sql/59-A] sql/58 미적용. users.region/gym_code 컬럼 없음. sql/58 먼저 실행 필요.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='user_gym_history'
  ) THEN
    RAISE EXCEPTION '[sql/59-A] sql/58 미적용. user_gym_history 테이블 없음.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='matches'
       AND column_name='gym_user_id_at_match'
  ) THEN
    RAISE EXCEPTION '[sql/59-A] sql/58 미적용. matches.gym_user_id_at_match 컬럼 없음.';
  END IF;

  RAISE NOTICE '[sql/59-A] 사전 점검 통과 — sql/58 적용 확인됨.';
END $$;


-- ============================================================
-- B) 현재 상태 미리보기
-- ============================================================
DO $$
DECLARE
  _gym_total          INTEGER;
  _gym_no_code        INTEGER;
  _matches_total      INTEGER;
  _matches_no_snap    INTEGER;
  _ugh_total          INTEGER;
  _members_no_history INTEGER;
BEGIN
  SELECT count(*) INTO _gym_total       FROM public.users WHERE role='gym';
  SELECT count(*) INTO _gym_no_code     FROM public.users WHERE role='gym' AND gym_code IS NULL;
  SELECT count(*) INTO _matches_total   FROM public.matches;
  SELECT count(*) INTO _matches_no_snap FROM public.matches WHERE gym_user_id_at_match IS NULL;
  SELECT count(*) INTO _ugh_total       FROM public.user_gym_history;
  SELECT count(*) INTO _members_no_history
    FROM public.users m
   WHERE m.role IN ('player_common','player_athlete')
     AND m.gym_user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.user_gym_history h
                      WHERE h.user_id = m.id AND h.left_at IS NULL);

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/59-B] 마이그레이션 직전 상태:';
  RAISE NOTICE '  체육관 총수            : %', _gym_total;
  RAISE NOTICE '  └ 코드 없는 체육관      : %  ← C 단계가 처리할 대상', _gym_no_code;
  RAISE NOTICE '  매치 총수              : %  ← DELETE 안 함, 그대로 보존', _matches_total;
  RAISE NOTICE '  └ 백필 필요 매치       : %  ← D 단계가 컬럼만 채움', _matches_no_snap;
  RAISE NOTICE '  user_gym_history 총수  : %', _ugh_total;
  RAISE NOTICE '  └ 백필 필요 회원       : %  ← E 단계가 새 row INSERT', _members_no_history;
  RAISE NOTICE '────────────────────────────────────────';
END $$;


-- ============================================================
-- C) 체육관 region 부여 → 트리거가 자동 코드 발급
--    - 1개: 'gyeonggi' 자동 적용 (사용자 합의: 번800 → GG0001)
--    - 2개 이상: 자동 일괄 처리 불가 → EXCEPTION 으로 멈춤 (안전)
--    - 0개: 스킵
-- ============================================================
DO $$
DECLARE
  _gym_count INTEGER;
  _affected  INTEGER;
  _new_code  TEXT;
  _gym_id    UUID;
BEGIN
  SELECT count(*) INTO _gym_count
    FROM public.users
   WHERE role = 'gym' AND region IS NULL;

  IF _gym_count = 0 THEN
    RAISE NOTICE '[sql/59-C] region 없는 체육관 없음. 스킵.';

  ELSIF _gym_count = 1 THEN
    -- region UPDATE → trg_users_gym_code_autoset_upd 발화 → gym_code 자동 발급
    UPDATE public.users
       SET region = 'gyeonggi'
     WHERE role = 'gym' AND region IS NULL
    RETURNING id, gym_code INTO _gym_id, _new_code;

    GET DIAGNOSTICS _affected = ROW_COUNT;
    RAISE NOTICE '[sql/59-C] 체육관 1개 처리: id=% → 코드 발급=%', _gym_id, _new_code;
    RAISE NOTICE '[sql/59-C] 영향 행 수: %', _affected;

  ELSE
    -- 2개 이상이면 자동으로 모두 'gyeonggi' 박는 건 위험. 운영자 매핑 필요.
    RAISE EXCEPTION '[sql/59-C] 체육관이 %개 — 자동 일괄 처리 불가. 운영자가 매핑 직접 작성 필요. 트랜잭션 ROLLBACK 됨.', _gym_count;
  END IF;
END $$;


-- ============================================================
-- D) matches 백필 — gym_user_id_at_match 가 NULL 인 행만 채움
--    DELETE 없음. UPDATE 만. 매치 행 수는 변하지 않음.
--    user_id 의 현재 gym_user_id 로 채움 (best effort — 매치 시점 정보 없음)
-- ============================================================
DO $$
DECLARE
  _before  INTEGER;
  _after   INTEGER;
  _affected INTEGER;
BEGIN
  SELECT count(*) INTO _before FROM public.matches;

  UPDATE public.matches m
     SET gym_user_id_at_match = u.gym_user_id
    FROM public.users u
   WHERE m.user_id = u.id
     AND m.gym_user_id_at_match IS NULL
     AND u.gym_user_id IS NOT NULL;

  GET DIAGNOSTICS _affected = ROW_COUNT;

  SELECT count(*) INTO _after FROM public.matches;

  IF _before <> _after THEN
    RAISE EXCEPTION '[sql/59-D] 매치 행 수 변경 감지! before=% after=% — 의도치 않은 DELETE 가능성. ROLLBACK.', _before, _after;
  END IF;

  RAISE NOTICE '[sql/59-D] 매치 행 수 변동 없음 (% → %)', _before, _after;
  RAISE NOTICE '[sql/59-D] gym_user_id_at_match 백필된 행 수: %', _affected;
END $$;


-- ============================================================
-- E) user_gym_history 백필 — 회원당 "현재 소속" row 1개 INSERT
--    이미 left_at IS NULL row 가 있는 회원은 스킵 (멱등)
--    joined_at = users.created_at (정확한 가입 시점은 모름 — 보수적 추정)
-- ============================================================
DO $$
DECLARE
  _affected INTEGER;
BEGIN
  INSERT INTO public.user_gym_history
    (user_id, gym_user_id, gym_name, gym_code, joined_at, left_at)
  SELECT m.id,
         m.gym_user_id,
         g.gym_name,
         g.gym_code,
         m.created_at,
         NULL
    FROM public.users m
    JOIN public.users g ON g.id = m.gym_user_id AND g.role = 'gym'
   WHERE m.role IN ('player_common', 'player_athlete')
     AND m.gym_user_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_gym_history h
        WHERE h.user_id = m.id AND h.left_at IS NULL
     );

  GET DIAGNOSTICS _affected = ROW_COUNT;
  RAISE NOTICE '[sql/59-E] user_gym_history 백필된 회원 수: %', _affected;
END $$;


-- ============================================================
-- F) 사후 검증 — 위 단계 결과가 예상대로인지 검사
--    실패해도 자동 ROLLBACK 안 함 (사용자 판단). WARNING 출력 후 진행.
-- ============================================================
DO $$
DECLARE
  _gym_no_code        INTEGER;
  _matches_no_snap    INTEGER;
  _members_no_history INTEGER;
  _ugh_total          INTEGER;
BEGIN
  -- 1) region 채워졌는데 code 없는 체육관 (=0이어야 정상)
  SELECT count(*) INTO _gym_no_code
    FROM public.users
   WHERE role='gym' AND region IS NOT NULL AND gym_code IS NULL;

  -- 2) user 의 gym 은 있는데 매치 백필 안 된 행 (=0이어야 정상)
  SELECT count(*) INTO _matches_no_snap
    FROM public.matches m
    JOIN public.users u ON u.id = m.user_id
   WHERE m.gym_user_id_at_match IS NULL AND u.gym_user_id IS NOT NULL;

  -- 3) gym 있는 회원 중 history 없는 사람 (=0이어야 정상)
  SELECT count(*) INTO _members_no_history
    FROM public.users m
   WHERE m.role IN ('player_common','player_athlete')
     AND m.gym_user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.user_gym_history h
                      WHERE h.user_id = m.id AND h.left_at IS NULL);

  SELECT count(*) INTO _ugh_total FROM public.user_gym_history;

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/59-F] 사후 검증 결과 (모두 0이어야 정상):';
  RAISE NOTICE '  region 있고 code 없는 체육관   : %', _gym_no_code;
  RAISE NOTICE '  user 의 gym 있고 매치 미백필 : %', _matches_no_snap;
  RAISE NOTICE '  gym 있고 history 없는 회원   : %', _members_no_history;
  RAISE NOTICE '  현재 user_gym_history 총수    : %', _ugh_total;
  RAISE NOTICE '────────────────────────────────────────';

  IF _gym_no_code > 0 OR _matches_no_snap > 0 OR _members_no_history > 0 THEN
    RAISE WARNING '[sql/59-F] 검증 실패 항목 있음 — 위 NOTICE 확인 후 ROLLBACK 결정 필요.';
  ELSE
    RAISE NOTICE '[sql/59-F] ✅ 모든 검증 통과';
  END IF;
END $$;


COMMIT;
-- ↑ 첫 실행은 이 줄을 ROLLBACK 으로 바꾸면 모든 변경 취소됨.
--   NOTICE 만 보고 안전 확인 → COMMIT 으로 재실행 권장.


-- ============================================================
-- ── 사후 확인 쿼리 (선택, 주석 해제 후 실행) ──
--
-- -- 1) 체육관에 발급된 코드
-- SELECT id, gym_name, region, gym_code, created_at
--   FROM public.users
--  WHERE role='gym'
--  ORDER BY created_at;
--
-- -- 2) 회원별 user_gym_history (현재 소속만)
-- SELECT m.id AS user_id, m.nickname, h.gym_name, h.gym_code, h.joined_at
--   FROM public.user_gym_history h
--   JOIN public.users m ON m.id = h.user_id
--  WHERE h.left_at IS NULL
--  ORDER BY h.joined_at;
--
-- -- 3) 매치 백필 결과
-- SELECT count(*) AS total,
--        count(gym_user_id_at_match) AS backfilled,
--        count(*) - count(gym_user_id_at_match) AS still_null
--   FROM public.matches;
--
-- -- 4) 매치 행 수 (마이그레이션 전후 동일해야)
-- SELECT count(*) AS matches_after_migration FROM public.matches;
-- ============================================================

-- ============================================================
-- 깨진 회원 가입 복구 — 일회성 운영 스크립트
-- 사전 조건: sql/58 + sql/61 + sql/62 적용 완료
--
-- ── 배경 ──
-- 회원가입 폼에서 gym_code 를 입력하면 sql/61 트리거가
-- gym_user_id, gym_name 을 채우지만, 그 직후 클라이언트의 fallback
-- upsert (lib/supabase.js signUp 안) 가 두 컬럼을 NULL 로 덮어써왔다.
-- 그 결과 user_gym_history 에는 "방금 가입했는데 즉시 left_at 채워진" row 만 남음.
-- 클라이언트 코드는 오늘 수정됨 — 이 파일은 이미 깨진 회원 일괄 복구.
--
-- ── 무엇을 하는가 ──
-- A) 사전 점검 — 필수 객체 존재 확인. 없으면 즉시 실패.
-- B) 영향 범위 미리보기 — 깨진 회원 수, 각 회원별 추정 복구 체육관 (NOTICE).
-- C) 복구 — user_gym_history.left_at NULL 로 되돌림 + users.gym_user_id/gym_name 복원.
--          사이드 이펙트(중복 history row 생성) 방지 위해 사용 history 트리거만 일시 무효화.
-- D) 사후 검증 — 남은 깨진 회원 수 (NOTICE).
--
-- ── 깨진 회원 식별 기준 ──
-- 1) role IN ('player_common', 'player_athlete')
-- 2) users.gym_user_id IS NULL          (현재 소속 없음)
-- 3) user_gym_history 에 다음 row 존재:
--    - gym_user_id IS NOT NULL          (당시 resolve 됐던 체육관 정보)
--    - left_at IS NOT NULL              (닫혀버린 row)
--    - left_at - joined_at < 1 minute   (가입과 동시에 닫힘 — 사용자가 나간 게 아님)
--
-- 1 분 임계값은 보수적으로 선택. 실제 sql/61 → 클라 upsert 사이는 보통 1초 미만이지만
-- 네트워크 지연·DB 부하·시계 차이를 감안. 정상 케이스(회원이 1분 안에 가입→탈퇴) 는
-- 실질적으로 발생 안 함.
--
-- ── 절대 건드리지 않는 데이터 ──
--   ❌ 정상적으로 가입 후 체육관 변경한 회원 (left_at - joined_at >= 1 minute)
--   ❌ 현재 gym_user_id 가 채워져 있는 회원 (이미 본인이 복구 시도했거나 다른 경로로 정상)
--   ❌ history 가 아예 없는 회원 (복구 단서 없음 — 별도 수동 안내 필요)
--   ❌ 매치·출석·스킬 진행도·기타 모든 활동 데이터
--
-- ── 멱등성 / 안전 ──
--   - BEGIN/COMMIT 트랜잭션 — 중간 실패 시 자동 롤백
--   - DISABLE TRIGGER → UPDATE → ENABLE TRIGGER 가 트랜잭션 안에서 묶임
--     (커넥션 단위가 아니라 트랜잭션 안에서 안전하게 처리)
--   - 두 번째 실행 시: B 단계의 깨진 회원 수가 0 으로 표시되며 C 단계가 no-op
--
-- ⚠️ Supabase SQL Editor 에서 실행. 백업 스냅샷 권장.
--    첫 실행은 마지막 줄을 ROLLBACK 으로 바꿔 NOTICE 만 확인 → COMMIT 으로 재실행 권장.
-- ============================================================

BEGIN;


-- ============================================================
-- A) 사전 점검
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='user_gym_history'
  ) THEN
    RAISE EXCEPTION '[sql/63-A] user_gym_history 테이블 없음. sql/58 먼저 적용 필요.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
     WHERE trigger_schema='public'
       AND trigger_name='trg_user_gym_history_upd'
  ) THEN
    RAISE EXCEPTION '[sql/63-A] trg_user_gym_history_upd 트리거 없음. sql/58 먼저 적용 필요.';
  END IF;

  RAISE NOTICE '[sql/63-A] 사전 점검 통과';
END $$;


-- ============================================================
-- B) 영향 범위 미리보기
-- ============================================================
DO $$
DECLARE
  _broken_count INTEGER;
  _r            RECORD;
BEGIN
  SELECT count(DISTINCT u.id) INTO _broken_count
    FROM public.users u
   WHERE u.role IN ('player_common', 'player_athlete')
     AND u.gym_user_id IS NULL
     AND EXISTS (
       SELECT 1 FROM public.user_gym_history h
        WHERE h.user_id = u.id
          AND h.gym_user_id IS NOT NULL
          AND h.left_at IS NOT NULL
          AND (h.left_at - h.joined_at) < INTERVAL '1 minute'
     );

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/63-B] 복구 대상 회원 수: %', _broken_count;
  RAISE NOTICE '────────────────────────────────────────';

  -- 회원별 추정 체육관 미리보기 (최대 50명까지 NOTICE 출력)
  FOR _r IN
    WITH broken AS (
      SELECT DISTINCT ON (h.user_id)
             h.user_id,
             h.gym_user_id  AS recover_gym_id,
             h.gym_name     AS recover_gym_name,
             h.gym_code     AS recover_gym_code,
             h.joined_at,
             h.left_at
        FROM public.user_gym_history h
        JOIN public.users u ON u.id = h.user_id
       WHERE u.role IN ('player_common', 'player_athlete')
         AND u.gym_user_id IS NULL
         AND h.gym_user_id IS NOT NULL
         AND h.left_at IS NOT NULL
         AND (h.left_at - h.joined_at) < INTERVAL '1 minute'
       ORDER BY h.user_id, h.joined_at DESC
    )
    SELECT b.user_id,
           u.nickname,
           u.email,
           b.recover_gym_name,
           b.recover_gym_code
      FROM broken b
      JOIN public.users u ON u.id = b.user_id
     ORDER BY u.nickname
     LIMIT 50
  LOOP
    RAISE NOTICE '  → % (%) → % (%)',
      _r.nickname, _r.email, _r.recover_gym_name, _r.recover_gym_code;
  END LOOP;
END $$;


-- ============================================================
-- C) 복구
--
-- C1) 닫혀버린 history row 의 left_at NULL 로 되돌리기
-- C2) users.gym_user_id, gym_name 복원
--
-- 트리거 일시 무효화 이유:
--   sql/58 의 trg_user_gym_history_upd (AFTER UPDATE OF gym_user_id) 가
--   users UPDATE 때마다 새 history row 를 INSERT 해버림.
--   우리는 기존 row 를 재사용하려는 것이므로 이 트리거만 잠시 끔.
--
--   sql/57 의 trg_users_gym_user_id_autoset (BEFORE UPDATE OF gym_name) 은
--   sql/62 가 가드를 추가했음 (NEW.gym_user_id IS DISTINCT FROM OLD → return) →
--   우리 UPDATE 가 gym_user_id 도 함께 명시적으로 바꾸므로 가드에 걸려 무해. 끄지 않음.
--
--   sql/57 의 trg_sync_promotion_requests_gym (AFTER UPDATE OF gym_name, gym_user_id)
--   는 진행 중 승단 신청을 새 체육관 기준으로 재정렬 — 의도된 동작이라 끄지 않음.
-- ============================================================
ALTER TABLE public.users DISABLE TRIGGER trg_user_gym_history_upd;

DO $$
DECLARE
  _history_reopened INTEGER;
  _users_fixed      INTEGER;
BEGIN
  -- C1) 닫힌 history row 재오픈 (회원당 가장 최근의 broken row 1개만)
  WITH target AS (
    SELECT DISTINCT ON (h.user_id) h.id
      FROM public.user_gym_history h
      JOIN public.users u ON u.id = h.user_id
     WHERE u.role IN ('player_common', 'player_athlete')
       AND u.gym_user_id IS NULL
       AND h.gym_user_id IS NOT NULL
       AND h.left_at IS NOT NULL
       AND (h.left_at - h.joined_at) < INTERVAL '1 minute'
     ORDER BY h.user_id, h.joined_at DESC
  )
  UPDATE public.user_gym_history h
     SET left_at = NULL
    FROM target t
   WHERE h.id = t.id;

  GET DIAGNOSTICS _history_reopened = ROW_COUNT;

  -- C2) users.gym_user_id, gym_name 복원
  --     C1 직후라 user_gym_history 의 left_at IS NULL row 가 복구 단서.
  WITH recovery AS (
    SELECT DISTINCT ON (h.user_id)
           h.user_id,
           h.gym_user_id  AS recover_gym_id,
           h.gym_name     AS recover_gym_name
      FROM public.user_gym_history h
      JOIN public.users u ON u.id = h.user_id
     WHERE u.role IN ('player_common', 'player_athlete')
       AND u.gym_user_id IS NULL
       AND h.left_at IS NULL                  -- C1 에서 방금 reopen 한 row
       AND h.gym_user_id IS NOT NULL
     ORDER BY h.user_id, h.joined_at DESC
  )
  UPDATE public.users u
     SET gym_user_id = r.recover_gym_id,
         gym_name    = r.recover_gym_name
    FROM recovery r
   WHERE u.id = r.user_id;

  GET DIAGNOSTICS _users_fixed = ROW_COUNT;

  RAISE NOTICE '[sql/63-C] history 재오픈: % rows', _history_reopened;
  RAISE NOTICE '[sql/63-C] users 복원      : % rows', _users_fixed;

  IF _history_reopened <> _users_fixed THEN
    RAISE WARNING '[sql/63-C] history 재오픈 수와 users 복원 수가 다름 (% vs %) — 데이터 점검 필요',
      _history_reopened, _users_fixed;
  END IF;
END $$;

ALTER TABLE public.users ENABLE TRIGGER trg_user_gym_history_upd;


-- ============================================================
-- D) 사후 검증
-- ============================================================
DO $$
DECLARE
  _still_broken         INTEGER;
  _orphan_no_history    INTEGER;
  _multi_open_history   INTEGER;
BEGIN
  -- 1) 같은 패턴으로 여전히 깨진 회원 (=0이어야 정상)
  SELECT count(*) INTO _still_broken
    FROM public.users u
   WHERE u.role IN ('player_common', 'player_athlete')
     AND u.gym_user_id IS NULL
     AND EXISTS (
       SELECT 1 FROM public.user_gym_history h
        WHERE h.user_id = u.id
          AND h.gym_user_id IS NOT NULL
          AND h.left_at IS NOT NULL
          AND (h.left_at - h.joined_at) < INTERVAL '1 minute'
     );

  -- 2) gym_user_id 는 NULL 인데 history 자체가 없는 회원 (이번 SQL 로 복구 불가 — 안내 필요)
  SELECT count(*) INTO _orphan_no_history
    FROM public.users u
   WHERE u.role IN ('player_common', 'player_athlete')
     AND u.gym_user_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_gym_history h WHERE h.user_id = u.id
     );

  -- 3) "현재 소속" history 가 회원당 2 개 이상인 경우 (uq_ugh_one_current_per_user 위반 가능성)
  SELECT count(*) INTO _multi_open_history
    FROM (
      SELECT user_id
        FROM public.user_gym_history
       WHERE left_at IS NULL
       GROUP BY user_id
      HAVING count(*) > 1
    ) x;

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/63-D] 사후 검증:';
  RAISE NOTICE '  여전히 깨진 회원 (=0)              : %', _still_broken;
  RAISE NOTICE '  history 없는 NULL 소속 회원 (참고) : %', _orphan_no_history;
  RAISE NOTICE '  현재소속 history 중복 회원 (=0)    : %', _multi_open_history;
  RAISE NOTICE '────────────────────────────────────────';

  IF _still_broken > 0 OR _multi_open_history > 0 THEN
    RAISE WARNING '[sql/63-D] 검증 실패 항목 있음 — 위 NOTICE 확인 후 ROLLBACK 결정 필요.';
  ELSE
    RAISE NOTICE '[sql/63-D] ✅ 모든 검증 통과';
  END IF;
END $$;


COMMIT;
-- ↑ 첫 실행은 이 줄을 ROLLBACK 으로 바꿔 NOTICE 만 확인 → COMMIT 으로 재실행 권장.


-- ============================================================
-- ── 사후 확인 쿼리 (선택, 주석 해제 후 실행) ──
--
-- -- 1) 복구된 회원 목록
-- SELECT u.id, u.nickname, u.email, u.gym_user_id, u.gym_name,
--        h.gym_code, h.joined_at
--   FROM public.users u
--   JOIN public.user_gym_history h
--     ON h.user_id = u.id AND h.left_at IS NULL
--  WHERE u.role IN ('player_common', 'player_athlete')
--  ORDER BY h.joined_at DESC;
--
-- -- 2) 아직 history 없는 NULL 소속 회원 (수동 안내 대상)
-- SELECT u.id, u.nickname, u.email, u.created_at
--   FROM public.users u
--  WHERE u.role IN ('player_common', 'player_athlete')
--    AND u.gym_user_id IS NULL
--    AND NOT EXISTS (
--      SELECT 1 FROM public.user_gym_history h WHERE h.user_id = u.id
--    )
--  ORDER BY u.created_at DESC;
-- ============================================================

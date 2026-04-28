-- ============================================================
-- 회원 체육관 변경 시 gym_user_id 까지 자동 동기화 — 견고화 패치 (sql/53 보강)
--
-- ── 배경 ──
-- 회원이 마이페이지에서 체육관을 바꾸면 클라이언트는 users.gym_name 만 보냄.
-- (components/views/mypage.js:178-186 — gym_user_id 는 안 보냄.)
-- sql/53 의 트리거는 skill_promotion_requests.gym_name 만 동기화함.
-- 그 결과 다음 4가지가 모두 깨짐:
--   (a) submit_skill_promotion_request 가 옛 gym_user_id 로 INSERT → already_pending 충돌
--   (b) RLS gym_can_read_promotion_row 는 gym_user_id 우선 매칭 → 새 체육관 관장에게 안 보임
--   (c) 승인 받지 못해 user_skill_node_progress.promotion_status='passed' 가 안 됨 → 다음 노드 잠금
--   (d) (b) 로 인한 무한 로딩 → UI 먹통
--
-- ── 해결 ──
-- A) users BEFORE UPDATE 트리거 — gym_name 변경 시 gym_user_id 도 자동 매핑.
--    클라이언트(mypage) 수정 없이 DB 안에서 끝남. 회원은 마이페이지에서 저장만 누르면 됨.
-- B) sql/53 의 AFTER UPDATE 트리거 함수를 보강 — gym_user_id 도 함께 동기화.
--    트리거 부착도 AFTER UPDATE OF gym_name, gym_user_id 로 확장.
-- C) 일회성 정합성 — 이미 어긋난 진행 중 신청을 현재 users 기준으로 정리.
-- D) 일회성 정합성 — users.gym_user_id 자체가 옛 값으로 남은 회원도 정리.
--
-- ── 절대 건드리지 않는 데이터 (안전 보장) ──
--   - skill_promotion_requests 의 status NOT IN ('pending','reviewing') 행
--     (approved / rejected / cancelled 등 — 당시 그 체육관의 역사적 기록)
--   - role NOT IN ('player_common','player_athlete') 인 회원 행
--     (gym / admin 계정 자신은 보호)
--   - 회원의 gym_name, name, nickname 등 다른 컬럼 (이번 패치 범위 밖)
--   - user_skill_node_progress, user_skill_unlocks 등 스킬 진행 데이터
--     (이미 받은 승단 결과는 그대로 보존됨 — 옛 체육관에서 받은 승인이라도 회원의 노드 잠금 해제는 유지)
--
-- ── 멱등성 / 안전 ──
--   - CREATE OR REPLACE / DROP IF EXISTS / IS DISTINCT FROM 가드로 여러 번 실행해도 안전.
--   - BEGIN/COMMIT 트랜잭션 — 중간 실패 시 자동 롤백.
--   - 트리거가 다른 트리거를 재발화시키지 않음 (BEFORE 는 NEW 만 수정, AFTER 는 다른 테이블만 UPDATE).
--   - RAISE NOTICE 로 영향받은 행 수 출력.
--
-- ⚠️ Supabase SQL Editor 에 실행. sql/53 적용 후.
--    한 번만 실행하면 이후 회원이 마이페이지에서 체육관을 옮길 때마다 모두 자동 처리됨.
-- ============================================================

BEGIN;

-- ============================================================
-- 0) 드라이런 — 일회성 보정이 영향줄 행 미리 보기 (선택, 실행 전에 주석 해제)
-- ============================================================
-- SELECT r.id, r.user_id, r.status,
--        r.gym_name AS req_gym_name, u.gym_name AS user_gym_name,
--        r.gym_user_id AS req_gym_user_id, u.gym_user_id AS user_gym_user_id
--   FROM public.skill_promotion_requests r
--   JOIN public.users u ON u.id = r.user_id
--  WHERE r.status IN ('pending','reviewing')
--    AND (
--      r.gym_user_id IS DISTINCT FROM u.gym_user_id
--      OR COALESCE(NULLIF(btrim(r.gym_name),''),'') IS DISTINCT FROM COALESCE(NULLIF(btrim(u.gym_name),''),'')
--    );


-- ============================================================
-- A) users.gym_name 변경 시 users.gym_user_id 자동 매핑 (BEFORE UPDATE)
--    회원이 마이페이지에서 gym_name 만 보내도 DB 가 알아서 gym_user_id 까지 맞춰줌.
-- ============================================================
CREATE OR REPLACE FUNCTION public.users_gym_user_id_autoset()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_name TEXT;
  _mapped UUID;
BEGIN
  -- 회원(선수) 행만 처리. gym/admin 계정 본인은 절대 건드리지 않음.
  IF NEW.role NOT IN ('player_common', 'player_athlete') THEN
    RETURN NEW;
  END IF;

  -- gym_name 이 실제로 변경됐을 때만 동작
  IF NEW.gym_name IS NOT DISTINCT FROM OLD.gym_name THEN
    RETURN NEW;
  END IF;

  _new_name := NULLIF(btrim(COALESCE(NEW.gym_name, '')), '');

  IF _new_name IS NULL THEN
    -- 체육관 비움 → gym_user_id 도 NULL
    NEW.gym_user_id := NULL;
    RETURN NEW;
  END IF;

  -- 새 gym_name 에 대응하는 role='gym' 계정 찾기
  SELECT g.id INTO _mapped
    FROM public.users g
   WHERE g.role = 'gym'
     AND g.gym_name IS NOT NULL
     AND btrim(g.gym_name) = _new_name
   LIMIT 1;

  -- 매칭되면 새 값, 안 되면 NULL (관장 계정이 아직 등록 안 된 상태 — RLS 는 gym_name 폴백으로 동작)
  NEW.gym_user_id := _mapped;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_gym_user_id_autoset ON public.users;

CREATE TRIGGER trg_users_gym_user_id_autoset
  BEFORE UPDATE OF gym_name ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_gym_user_id_autoset();


-- ============================================================
-- B) sql/53 의 트리거 함수 보강 — gym_user_id 도 동기화
--    (같은 함수 이름 CREATE OR REPLACE — sql/53 를 자연스럽게 덮음)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_promotion_requests_on_gym_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_gym_name TEXT;
  _new_gym_user_id UUID;
  _affected INTEGER;
BEGIN
  -- gym_name 또는 gym_user_id 둘 중 하나라도 바뀌었을 때만 동작
  IF NEW.gym_name IS NOT DISTINCT FROM OLD.gym_name
     AND NEW.gym_user_id IS NOT DISTINCT FROM OLD.gym_user_id THEN
    RETURN NEW;
  END IF;

  _new_gym_name    := NULLIF(btrim(COALESCE(NEW.gym_name, '')), '');
  _new_gym_user_id := NEW.gym_user_id;  -- A) BEFORE 트리거가 이미 매핑해 둔 값

  -- 진행 중인 신청만 갱신.
  -- ⚠️ status NOT IN ('pending','reviewing') 행은 절대 건드리지 않음
  --    — approved / rejected / cancelled 등은 당시 그 체육관의 역사적 기록.
  UPDATE public.skill_promotion_requests
     SET gym_name          = COALESCE(_new_gym_name, ''),
         gym_user_id       = _new_gym_user_id,
         -- reviewing → pending 리셋: 새 체육관이 처음부터 보도록 (sql/53 동작 유지)
         status            = CASE WHEN status = 'reviewing' THEN 'pending' ELSE status END,
         review_started_at = CASE WHEN status = 'reviewing' THEN NULL ELSE review_started_at END,
         reviewer_id       = CASE WHEN status = 'reviewing' THEN NULL ELSE reviewer_id END
   WHERE user_id = NEW.id
     AND status IN ('pending', 'reviewing')
     AND (
       gym_name    IS DISTINCT FROM COALESCE(_new_gym_name, '')
       OR gym_user_id IS DISTINCT FROM _new_gym_user_id
       OR status = 'reviewing'
     );

  GET DIAGNOSTICS _affected = ROW_COUNT;
  IF _affected > 0 THEN
    RAISE NOTICE 'sync_promotion_requests_on_gym_change: user=% rows=%', NEW.id, _affected;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- B') 트리거 부착 — gym_name 또는 gym_user_id 변경 시 발화
--      (sql/53 의 트리거를 새 컬럼 목록으로 재부착)
-- ============================================================
DROP TRIGGER IF EXISTS trg_sync_promotion_requests_gym ON public.users;

CREATE TRIGGER trg_sync_promotion_requests_gym
  AFTER UPDATE OF gym_name, gym_user_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_promotion_requests_on_gym_change();


-- ============================================================
-- C) 일회성 정합성 — 이미 어긋난 pending/reviewing 신청을 현재 users 기준으로 정리
-- ============================================================
DO $$
DECLARE
  _rows INTEGER;
BEGIN
  WITH upd AS (
    UPDATE public.skill_promotion_requests r
       SET gym_name    = COALESCE(NULLIF(btrim(u.gym_name), ''), ''),
           gym_user_id = COALESCE(
             u.gym_user_id,
             (SELECT g.id FROM public.users g
               WHERE g.role = 'gym'
                 AND g.gym_name IS NOT NULL
                 AND NULLIF(btrim(u.gym_name), '') IS NOT NULL
                 AND btrim(g.gym_name) = btrim(u.gym_name)
               LIMIT 1)
           )
      FROM public.users u
     WHERE r.user_id = u.id
       AND r.status IN ('pending', 'reviewing')
       AND (
         r.gym_user_id IS DISTINCT FROM u.gym_user_id
         OR COALESCE(NULLIF(btrim(r.gym_name),''),'') IS DISTINCT FROM COALESCE(NULLIF(btrim(u.gym_name),''),'')
       )
     RETURNING 1
  )
  SELECT count(*) INTO _rows FROM upd;
  RAISE NOTICE 'one-shot reconcile (skill_promotion_requests, pending/reviewing only): % rows', _rows;
END $$;


-- ============================================================
-- D) 일회성 정합성 — 회원의 users.gym_user_id 자체가 옛 값으로 남은 케이스 정리
--    (마이페이지가 gym_name 만 바꿔온 결과 누적된 잔여 mismatch)
--    role IN ('player_common','player_athlete') 한정. gym/admin 계정은 절대 건드리지 않음.
-- ============================================================
DO $$
DECLARE
  _rows INTEGER;
BEGIN
  WITH mapping AS (
    SELECT m.id AS user_id,
           (SELECT g.id FROM public.users g
             WHERE g.role = 'gym'
               AND g.gym_name IS NOT NULL
               AND NULLIF(btrim(m.gym_name), '') IS NOT NULL
               AND btrim(g.gym_name) = btrim(m.gym_name)
             LIMIT 1) AS mapped_gym_id
      FROM public.users m
     WHERE m.role IN ('player_common', 'player_athlete')
  ),
  upd AS (
    UPDATE public.users u
       SET gym_user_id = mapping.mapped_gym_id
      FROM mapping
     WHERE u.id = mapping.user_id
       AND u.gym_user_id IS DISTINCT FROM mapping.mapped_gym_id
     RETURNING 1
  )
  SELECT count(*) INTO _rows FROM upd;
  RAISE NOTICE 'one-shot reconcile (users.gym_user_id, players only): % rows', _rows;
END $$;

COMMIT;


-- ============================================================
-- ── 사후 검증 (선택, 주석 해제 후 실행) ──
-- 두 쿼리 모두 0행이어야 정합 상태:
--
-- -- 1) 회원의 gym_user_id 가 gym_name 과 일치하는가
-- SELECT m.id, m.gym_name, m.gym_user_id, g.gym_name AS mapped_gym
--   FROM public.users m
--   LEFT JOIN public.users g ON g.id = m.gym_user_id AND g.role = 'gym'
--  WHERE m.role IN ('player_common', 'player_athlete')
--    AND NULLIF(btrim(m.gym_name), '') IS NOT NULL
--    AND (g.id IS NULL OR btrim(g.gym_name) IS DISTINCT FROM btrim(m.gym_name));
--
-- -- 2) 진행 중인 신청이 회원 현재 체육관과 일치하는가
-- SELECT r.id, r.user_id, r.gym_user_id, u.gym_user_id, r.gym_name, u.gym_name, r.status
--   FROM public.skill_promotion_requests r
--   JOIN public.users u ON u.id = r.user_id
--  WHERE r.status IN ('pending','reviewing')
--    AND (
--      r.gym_user_id IS DISTINCT FROM u.gym_user_id
--      OR COALESCE(NULLIF(btrim(r.gym_name),''),'') IS DISTINCT FROM COALESCE(NULLIF(btrim(u.gym_name),''),'')
--    );
-- ============================================================

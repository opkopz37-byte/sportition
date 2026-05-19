-- ============================================================
-- 체육관 연결 필드 DB 차원 잠금 — 정리 + 보안 강화
-- 사전 조건: sql/57 + sql/58 + sql/61 + sql/62 + sql/64 적용 완료
--
-- ── 배경 ──
-- 코드 시스템(sql/58~62) 도입 후 sql/57 의 gym_name 기반 fuzzy 매칭은
-- 더 이상 필요 없는 dead code. 오히려 동명 체육관 가입 시 잘못된 매칭의
-- 잠재 위험원이 됨.
--
-- 또한 회원의 gym_user_id, gym_name 은 RPC 를 통해서만 변경되어야 하는데,
-- 현재는 mypage 에 "주석 가드" 만 있는 상태. 누군가 코드 수정 시 회귀 위험.
--
-- ── 무엇을 하는가 ──
-- A) 사전 점검 — 필수 객체 존재 확인
-- B) sql/57 의 fuzzy 매칭 트리거·함수 제거
--    - trg_users_gym_user_id_autoset
--    - users_gym_user_id_autoset()
--    (sync_promotion_requests_gym 트리거·함수는 별개라 그대로 유지)
-- C) 회원 gym 필드 잠금 트리거 추가
--    - members 의 gym_user_id, gym_name 직접 UPDATE 차단
--    - 통과 조건:
--      1) 세션 플래그 'app.gym_change_via_rpc' 가 'on' 인 경우 (RPC/트리거 내부)
--      2) 호출자가 admin 인 경우
--      3) NEW.role 이 회원이 아닌 경우 (gym/admin 자기 행은 자유)
--      4) gym_user_id, gym_name 모두 변경 없는 경우 (no-op)
-- D) change_my_gym_by_code RPC 에 세션 플래그 셋팅 추가
-- E) handle_new_user_gym_code 트리거에 세션 플래그 셋팅 추가
-- F) 사후 검증
--
-- ── 안전 ──
--   - DROP IF EXISTS 사용 — 두 번 실행해도 무해
--   - 정상 RPC/트리거 경로는 세션 플래그로 통과 보장
--   - 잠재적 회귀 차단: mypage 등에서 잘못 gym_name UPDATE 시 즉시 EXCEPTION
--   - admin 은 모든 회원 행 자유 수정 가능 (운영 보조 보장)
--
-- ── 멱등성 ──
--   - CREATE OR REPLACE / DROP IF EXISTS — 여러 번 실행 안전
--   - 세션 플래그는 트랜잭션 단위 (COMMIT/ROLLBACK 시 자동 해제)
--
-- ⚠️ Supabase SQL Editor 에서 실행. 클라이언트 배포 전이든 후든 무방.
--    (회원의 직접 gym_name UPDATE 시도가 없는 한 영향 없음)
-- ============================================================

BEGIN;


-- ============================================================
-- A) 사전 점검
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'change_my_gym_by_code'
  ) THEN
    RAISE EXCEPTION '[sql/65-A] change_my_gym_by_code 함수 없음. sql/62 먼저.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user_gym_code'
  ) THEN
    RAISE EXCEPTION '[sql/65-A] handle_new_user_gym_code 함수 없음. sql/61 먼저.';
  END IF;

  RAISE NOTICE '[sql/65-A] 사전 점검 통과';
END $$;


-- ============================================================
-- B) sql/57 의 fuzzy 매칭 트리거·함수 제거 (dead code)
-- ============================================================
DROP TRIGGER IF EXISTS trg_users_gym_user_id_autoset ON public.users;
DROP FUNCTION IF EXISTS public.users_gym_user_id_autoset() CASCADE;

DO $$
BEGIN
  RAISE NOTICE '[sql/65-B] fuzzy 매칭 트리거·함수 제거 완료';
END $$;


-- ============================================================
-- C) 회원 gym 필드 잠금 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_member_gym_connection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _flag        TEXT;
  _is_admin    BOOLEAN;
BEGIN
  -- (1) 회원 행이 아니면 통과 (gym 본인 / admin 본인 행은 자유)
  IF NEW.role NOT IN ('player_common', 'player_athlete') THEN
    RETURN NEW;
  END IF;

  -- (2) gym_user_id, gym_name 모두 변경 없으면 통과 (no-op UPDATE)
  IF NEW.gym_user_id IS NOT DISTINCT FROM OLD.gym_user_id
     AND NEW.gym_name IS NOT DISTINCT FROM OLD.gym_name THEN
    RETURN NEW;
  END IF;

  -- (3) 세션 플래그 확인 — RPC/가입 트리거 내부에서 셋팅했으면 통과
  _flag := current_setting('app.gym_change_via_rpc', true);
  IF _flag = 'on' THEN
    RETURN NEW;
  END IF;

  -- (4) 호출자가 admin 이면 통과
  SELECT EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid() AND role = 'admin'
  ) INTO _is_admin;

  IF _is_admin THEN
    RETURN NEW;
  END IF;

  -- 모두 해당 없음 → 거부
  RAISE EXCEPTION
    '회원의 체육관 연결은 change_my_gym_by_code RPC 로만 변경 가능합니다. '
    '직접 UPDATE 는 차단됨. (user_id=%, role=%)', NEW.id, NEW.role
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_member_gym_lockdown ON public.users;

CREATE TRIGGER trg_member_gym_lockdown
  BEFORE UPDATE OF gym_user_id, gym_name ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_member_gym_connection();


-- ============================================================
-- D) change_my_gym_by_code RPC — 세션 플래그 셋팅 추가
--    (sql/64 의 lower() 정규화 그대로 유지)
-- ============================================================
CREATE OR REPLACE FUNCTION public.change_my_gym_by_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id        UUID;
  _user_role      TEXT;
  _normalized     TEXT;
  _gym_id         UUID;
  _gym_name       TEXT;
  _old_gym_id     UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT role, gym_user_id INTO _user_role, _old_gym_id
    FROM public.users
   WHERE id = _user_id;

  IF _user_role NOT IN ('player_common', 'player_athlete') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
  END IF;

  _normalized := lower(btrim(COALESCE(p_code, '')));

  -- ⚡ 세션 플래그 — 잠금 트리거가 이 UPDATE 를 통과시킴 (트랜잭션 끝나면 자동 해제)
  PERFORM set_config('app.gym_change_via_rpc', 'on', true);

  -- 빈 코드 → 체육관 비움
  IF _normalized = '' THEN
    UPDATE public.users
       SET gym_user_id = NULL,
           gym_name    = NULL
     WHERE id = _user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'left_gym', true,
      'old_gym_user_id', _old_gym_id
    );
  END IF;

  -- 코드 형식 검증 (소문자)
  IF _normalized !~ '^(se|gg|gw|cc|jl|gs|jj)\d{4}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code_format');
  END IF;

  -- 코드로 체육관 찾기
  SELECT g.id, g.gym_name INTO _gym_id, _gym_name
    FROM public.users g
   WHERE g.role = 'gym' AND g.gym_code = _normalized
   LIMIT 1;

  IF _gym_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_not_found');
  END IF;

  -- 같은 체육관이면 noop
  IF _gym_id = _old_gym_id THEN
    RETURN jsonb_build_object(
      'ok', true,
      'no_change', true,
      'gym_user_id', _gym_id,
      'gym_name', _gym_name,
      'gym_code', _normalized
    );
  END IF;

  -- 변경
  UPDATE public.users
     SET gym_user_id = _gym_id,
         gym_name    = _gym_name
   WHERE id = _user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'old_gym_user_id', _old_gym_id,
    'gym_user_id', _gym_id,
    'gym_name', _gym_name,
    'gym_code', _normalized
  );
END;
$$;


-- ============================================================
-- E) handle_new_user_gym_code 트리거 — 세션 플래그 셋팅 추가
--    (sql/64 의 lower() 정규화 그대로 유지)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_gym_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _meta                JSONB;
  _region              TEXT;
  _gym_code            TEXT;
  _resolved_gym_id     UUID;
  _resolved_gym_name   TEXT;
BEGIN
  SELECT raw_user_meta_data INTO _meta
    FROM auth.users
   WHERE id = NEW.id;

  IF _meta IS NULL THEN
    RETURN NEW;
  END IF;

  -- ⚡ 세션 플래그 — 가입 트리거가 하는 UPDATE 도 잠금 트리거 통과 (트랜잭션 끝나면 해제)
  PERFORM set_config('app.gym_change_via_rpc', 'on', true);

  -- (a) 체육관 신규 가입 — region 처리
  IF NEW.role = 'gym' THEN
    _region := NULLIF(btrim(_meta->>'region'), '');
    IF _region IS NOT NULL
       AND _region IN ('seoul','gyeonggi','gangwon','chungcheong','jeolla','gyeongsang','jeju')
       AND NEW.region IS NULL
    THEN
      UPDATE public.users
         SET region = _region
       WHERE id = NEW.id;
      RAISE NOTICE '[handle_new_user_gym_code] gym % region=% 설정 완료', NEW.id, _region;
    ELSIF _region IS NOT NULL THEN
      RAISE WARNING '[handle_new_user_gym_code] gym % 의 region=% 이 화이트리스트 외 — 코드 미발급', NEW.id, _region;
    END IF;
  END IF;

  -- (b) 회원 신규 가입 — gym_code → gym_user_id resolve
  IF NEW.role IN ('player_common', 'player_athlete') THEN
    _gym_code := lower(btrim(NULLIF(_meta->>'gym_code', '')));

    IF _gym_code IS NOT NULL AND NEW.gym_user_id IS NULL THEN
      SELECT g.id, g.gym_name
        INTO _resolved_gym_id, _resolved_gym_name
        FROM public.users g
       WHERE g.role = 'gym' AND g.gym_code = _gym_code
       LIMIT 1;

      IF _resolved_gym_id IS NOT NULL THEN
        UPDATE public.users
           SET gym_user_id = _resolved_gym_id,
               gym_name    = _resolved_gym_name
         WHERE id = NEW.id;
        RAISE NOTICE '[handle_new_user_gym_code] member % → gym_code=% (gym=%)', NEW.id, _gym_code, _resolved_gym_id;
      ELSE
        RAISE WARNING '[handle_new_user_gym_code] member % 의 gym_code=% 를 찾을 수 없음', NEW.id, _gym_code;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- F) 사후 검증
-- ============================================================
DO $$
DECLARE
  _has_lockdown_trigger  BOOLEAN;
  _has_old_fuzzy_trigger BOOLEAN;
  _has_lockdown_func     BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
     WHERE trigger_schema = 'public'
       AND trigger_name = 'trg_member_gym_lockdown'
  ) INTO _has_lockdown_trigger;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
     WHERE trigger_schema = 'public'
       AND trigger_name = 'trg_users_gym_user_id_autoset'
  ) INTO _has_old_fuzzy_trigger;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'protect_member_gym_connection'
  ) INTO _has_lockdown_func;

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/65-F] 사후 검증:';
  RAISE NOTICE '  잠금 트리거 부착 (=true)         : %', _has_lockdown_trigger;
  RAISE NOTICE '  옛 fuzzy 트리거 제거됨 (=false)  : %', _has_old_fuzzy_trigger;
  RAISE NOTICE '  잠금 함수 존재 (=true)           : %', _has_lockdown_func;
  RAISE NOTICE '────────────────────────────────────────';

  IF _has_lockdown_trigger AND NOT _has_old_fuzzy_trigger AND _has_lockdown_func THEN
    RAISE NOTICE '[sql/65-F] ✅ 잠금 적용 완료';
  ELSE
    RAISE WARNING '[sql/65-F] 검증 실패 항목 있음 — 위 NOTICE 확인 필요';
  END IF;
END $$;


COMMIT;


-- ============================================================
-- ── 동작 검증 (선택, 주석 해제 후 실행) ──
--
-- -- 1) RPC 통한 변경 — 통과해야 정상
-- -- (회원 본인 로그인 상태에서 실행)
-- -- SELECT public.change_my_gym_by_code('gg0001');
--
-- -- 2) 직접 UPDATE 시도 — EXCEPTION 떠야 정상
-- -- (회원 본인 로그인 상태에서 실행)
-- -- UPDATE public.users SET gym_name = '다른체육관' WHERE id = auth.uid();
-- -- 예상 에러: "회원의 체육관 연결은 change_my_gym_by_code RPC 로만 변경 가능합니다"
--
-- -- 3) admin 으로 직접 UPDATE — 통과해야 정상 (운영 보조)
-- -- (admin 로그인 상태에서)
-- -- UPDATE public.users SET gym_user_id = '...' WHERE id = '회원id';
--
-- -- 4) gym 본인이 자기 gym_name 수정 — 통과해야 정상
-- -- (gym 본인 로그인 상태에서)
-- -- UPDATE public.users SET gym_name = '새이름' WHERE id = auth.uid();
-- ============================================================

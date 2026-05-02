-- ============================================================
-- 체육관 코드 기반 변경 RPC + sql/57 트리거 보강 — Phase 6 백엔드
-- 사전 조건: sql/57 + sql/58 + sql/61 적용 완료
--
-- ── 무엇을 하는가 ──
-- A) sql/57 의 트리거 함수 users_gym_user_id_autoset() 보강 —
--    gym_user_id 가 명시적으로 변경되고 있을 땐 트리거가 끼어들지 않음.
--    이유: 코드 기반 RPC 가 (gym_user_id, gym_name) 을 함께 보낼 때
--    트리거의 fuzzy 이름 매칭이 RPC 가 결정한 gym_user_id 를 덮어쓰는 걸 방지.
--    체육관 이름 중복이 미래에 생겨도 RPC 결과가 진실이 되도록.
--
-- B) change_my_gym_by_code(p_code) RPC 신설 —
--    회원이 마이페이지에서 코드로 체육관 변경 시 호출.
--    빈 문자열 → 체육관 비움. 유효 코드 → 체육관 이전.
--    SECURITY DEFINER + auth.uid() 검증.
--
-- ── 절대 건드리지 않는 데이터 ──
--   - 기존 회원·체육관 행 (이 SQL 자체는 함수만 새로 정의/교체)
--   - sql/58 의 트리거·테이블·sequence 들
--
-- ── 안전성 ──
--   - sql/57 트리거 보강은 옛 동작(이름만 변경 시 자동 매핑) 그대로 유지
--   - change_my_gym_by_code 는 회원 본인만 자기 행 갱신
--   - gym/admin 계정이 잘못 호출해도 'not_a_member' 에러 반환 (안전)
--
-- ── 멱등성 ──
--   - CREATE OR REPLACE / DROP IF EXISTS — 여러 번 실행 안전
--
-- ⚠️ Supabase SQL Editor 에서 실행. sql/61 적용 후.
-- ============================================================

BEGIN;


-- ============================================================
-- 사전 점검
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'users_gym_user_id_autoset'
  ) THEN
    RAISE EXCEPTION '[sql/62] sql/57 미적용. users_gym_user_id_autoset 함수 없음.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users' AND column_name='gym_code'
  ) THEN
    RAISE EXCEPTION '[sql/62] sql/58 미적용. users.gym_code 컬럼 없음.';
  END IF;
END $$;


-- ============================================================
-- A) sql/57 의 트리거 함수 보강 — gym_user_id 명시 변경 시 스킵
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

  -- ⚡ 새 가드: 호출자가 gym_user_id 도 명시적으로 바꾸고 있다면 그 값을 신뢰하고 트리거는 스킵.
  --    (코드 기반 변경은 RPC 가 gym_user_id + gym_name 을 함께 보냄.
  --     이름 중복으로 인한 잘못된 매핑 방지.)
  IF NEW.gym_user_id IS DISTINCT FROM OLD.gym_user_id THEN
    RETURN NEW;
  END IF;

  -- gym_name 이 실제로 변경됐을 때만 동작
  IF NEW.gym_name IS NOT DISTINCT FROM OLD.gym_name THEN
    RETURN NEW;
  END IF;

  _new_name := NULLIF(btrim(COALESCE(NEW.gym_name, '')), '');

  IF _new_name IS NULL THEN
    NEW.gym_user_id := NULL;
    RETURN NEW;
  END IF;

  SELECT g.id INTO _mapped
    FROM public.users g
   WHERE g.role = 'gym'
     AND g.gym_name IS NOT NULL
     AND btrim(g.gym_name) = _new_name
   LIMIT 1;

  NEW.gym_user_id := _mapped;
  RETURN NEW;
END;
$$;


-- ============================================================
-- B) change_my_gym_by_code RPC — 마이페이지에서 호출
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

  _normalized := upper(btrim(COALESCE(p_code, '')));

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

  -- 코드 검증
  IF _normalized !~ '^(SE|GG|GW|CC|JL|GS|JJ)\d{4}$' THEN
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

  -- 같은 체육관이면 noop (성공으로 처리)
  IF _gym_id = _old_gym_id THEN
    RETURN jsonb_build_object(
      'ok', true,
      'no_change', true,
      'gym_user_id', _gym_id,
      'gym_name', _gym_name,
      'gym_code', _normalized
    );
  END IF;

  -- 변경 — gym_user_id 와 gym_name 함께 UPDATE
  -- (보강된 sql/57 트리거가 RPC 의 gym_user_id 를 존중함)
  -- AFTER UPDATE OF gym_user_id 트리거가 user_gym_history 자동 갱신
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

GRANT EXECUTE ON FUNCTION public.change_my_gym_by_code(TEXT) TO authenticated;


-- ============================================================
-- C) 회원 자기 이력 조회 RPC (간편 helper)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_gym_history()
RETURNS TABLE (
  gym_user_id UUID,
  gym_name    TEXT,
  gym_code    TEXT,
  joined_at   TIMESTAMPTZ,
  left_at     TIMESTAMPTZ,
  is_current  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT h.gym_user_id, h.gym_name, h.gym_code, h.joined_at, h.left_at,
         (h.left_at IS NULL) AS is_current
    FROM public.user_gym_history h
   WHERE h.user_id = _user_id
   ORDER BY h.joined_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_gym_history() TO authenticated;


-- ============================================================
-- 사후 보고
-- ============================================================
DO $$
DECLARE
  _changed BOOLEAN;
  _has_change_rpc BOOLEAN;
  _has_history_rpc BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'users_gym_user_id_autoset'
  ) INTO _changed;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'change_my_gym_by_code'
  ) INTO _has_change_rpc;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_my_gym_history'
  ) INTO _has_history_rpc;

  RAISE NOTICE '[sql/62] users_gym_user_id_autoset 보강: %', _changed;
  RAISE NOTICE '[sql/62] change_my_gym_by_code RPC: %', _has_change_rpc;
  RAISE NOTICE '[sql/62] get_my_gym_history RPC: %', _has_history_rpc;
END $$;

COMMIT;


-- ============================================================
-- ── 사후 검증 (선택) ──
--
-- -- 본인 이력 조회 (로그인 상태에서)
-- SELECT * FROM public.get_my_gym_history();
--
-- -- 코드로 체육관 변경 (로그인 상태에서, 회원만)
-- SELECT public.change_my_gym_by_code('GG0001');
-- SELECT public.change_my_gym_by_code('');  -- 체육관 비움
-- ============================================================

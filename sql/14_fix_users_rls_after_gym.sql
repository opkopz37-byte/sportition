-- ============================================================
-- sql/12·13 적용 후 "프로필을 불러오지 못했습니다" 복구용
--
-- 원인: public.users / user_private_profiles 에 대해
--   - 04_rls_policies.sql(본인 SELECT·INSERT·UPDATE)가 없거나,
--   - 체육관용 정책만 있어 본인 행이 허용되지 않는 경우
--
-- 처리: 04의 본인 정책을 먼저 재적용한 뒤, 13과 동일한 체육관 정책(본인 OR 포함)을 다시 만듭니다.
-- Supabase SQL Editor에서 한 번 실행하세요.
--
-- 그래도 앱에서 프로필이 안 읽히면 sql/15_get_my_profile_rpc.sql 을 실행하세요.
-- (SECURITY DEFINER RPC로 본인 프로필만 조회 — RLS와 무관)
--
-- "infinite recursion detected in policy for relation users" 발생 시:
--   아래 섹션 0 실행 후 3 적용, 또는 sql/16_fix_users_rls_recursion.sql 전체 실행.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 0) RLS 무한 재귀 방지 헬퍼 (sql/16과 동일 — EXISTS(users) 제거)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gym_can_view_member(member_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  viewer uuid := auth.uid();
  vrole text;
  vgname text;
  mrole text;
  mgname text;
  mg_user uuid;
BEGIN
  IF viewer IS NULL OR member_uuid IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, gym_name INTO vrole, vgname
  FROM public.users WHERE id = viewer;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF vrole = 'admin' THEN
    RETURN true;
  END IF;

  IF vrole <> 'gym' THEN
    RETURN false;
  END IF;

  IF vgname IS NULL OR btrim(vgname) = '' THEN
    RETURN false;
  END IF;

  SELECT role, gym_name, gym_user_id INTO mrole, mgname, mg_user
  FROM public.users WHERE id = member_uuid;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF mrole NOT IN ('player_common', 'player_athlete') THEN
    RETURN false;
  END IF;

  IF mg_user IS NOT NULL AND mg_user = viewer THEN
    RETURN true;
  END IF;

  IF mg_user IS NULL AND mgname IS NOT DISTINCT FROM vgname THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.gym_can_read_promotion_row(
  p_gym_user_id uuid,
  p_gym_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  viewer uuid := auth.uid();
  vrole text;
  vgname text;
BEGIN
  IF viewer IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, gym_name INTO vrole, vgname
  FROM public.users WHERE id = viewer;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF vrole = 'admin' THEN
    RETURN true;
  END IF;

  IF vrole <> 'gym' THEN
    RETURN false;
  END IF;

  IF p_gym_user_id IS NOT NULL AND p_gym_user_id = viewer THEN
    RETURN true;
  END IF;

  IF vgname IS NOT NULL AND btrim(vgname) <> '' AND p_gym_name IS NOT NULL
     AND btrim(p_gym_name) = btrim(vgname) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.gym_can_view_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gym_can_view_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.gym_can_read_promotion_row(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gym_can_read_promotion_row(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 1) 본인 users (04와 동일)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2) 본인 user_private_profiles (04와 동일)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own private profile" ON public.user_private_profiles;
DROP POLICY IF EXISTS "Users can insert own private profile" ON public.user_private_profiles;
DROP POLICY IF EXISTS "Users can update own private profile" ON public.user_private_profiles;

CREATE POLICY "Users can view own private profile"
  ON public.user_private_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own private profile"
  ON public.user_private_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own private profile"
  ON public.user_private_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3) 체육관·관리자 조회 (함수 기반 — users RLS 재귀 없음)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Gym reads gym promotion requests" ON public.skill_promotion_requests;
CREATE POLICY "Gym reads gym promotion requests"
  ON public.skill_promotion_requests FOR SELECT TO authenticated
  USING (
    public.gym_can_read_promotion_row(
      skill_promotion_requests.gym_user_id,
      skill_promotion_requests.gym_name
    )
  );

DROP POLICY IF EXISTS "Gym staff can view same-gym players" ON public.users;
CREATE POLICY "Gym staff can view same-gym players"
  ON public.users FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.gym_can_view_member(id)
  );

DROP POLICY IF EXISTS "Gym staff can view same-gym member private profiles" ON public.user_private_profiles;
CREATE POLICY "Gym staff can view same-gym member private profiles"
  ON public.user_private_profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.gym_can_view_member(user_id)
  );

-- ============================================================
-- users RLS 무한 재귀(infinite recursion) 수정
--
-- 원인: 정책 안에서 EXISTS (SELECT ... FROM public.users ...) 가
--       같은 테이블의 RLS를 다시 타며 재귀가 발생함.
--
-- 처리: SECURITY DEFINER 함수로 users 를 읽어 판별 (RLS 비적용).
-- Supabase SQL Editor에서 한 번 실행하세요.
-- ============================================================

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

  -- 체육관: (1) 신청 행의 gym_user_id 가 본인 id 이거나 (2) gym_name 이 동일하면 표시
  -- (gym_user_id 백필 오류·레거시 혼재 시에도 gym_name 으로 매칭)
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

-- skill_promotion_requests: 체육관 조회 (EXISTS users 제거)
DROP POLICY IF EXISTS "Gym reads gym promotion requests" ON public.skill_promotion_requests;
CREATE POLICY "Gym reads gym promotion requests"
  ON public.skill_promotion_requests FOR SELECT TO authenticated
  USING (
    public.gym_can_read_promotion_row(
      skill_promotion_requests.gym_user_id,
      skill_promotion_requests.gym_name
    )
  );

-- users: 체육관·관리자가 소속 회원 조회
DROP POLICY IF EXISTS "Gym staff can view same-gym players" ON public.users;
CREATE POLICY "Gym staff can view same-gym players"
  ON public.users FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.gym_can_view_member(id)
  );

-- user_private_profiles
DROP POLICY IF EXISTS "Gym staff can view same-gym member private profiles" ON public.user_private_profiles;
CREATE POLICY "Gym staff can view same-gym member private profiles"
  ON public.user_private_profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.gym_can_view_member(user_id)
  );

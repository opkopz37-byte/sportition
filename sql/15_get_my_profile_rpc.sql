-- ============================================================
-- 본인 프로필 조회 RPC (RLS 우회)
--
-- users / user_private_profiles 에 대한 RLS·정책 조합 때문에
-- 직접 SELECT가 실패하는 환경에서도 로그인 직후 프로필을 읽을 수 있게 합니다.
-- SECURITY DEFINER 로 본인(auth.uid()) 행만 반환합니다.
--
-- Supabase SQL Editor에서 실행 후, 앱은 getUserProfile()이 RPC를 우선 호출합니다.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  uid uuid := auth.uid();
  r jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'user', to_jsonb(u.*),
    'private', (
      SELECT to_jsonb(p.*)
      FROM public.user_private_profiles p
      WHERE p.user_id = uid
    )
  )
  INTO r
  FROM public.users u
  WHERE u.id = uid;

  IF r IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_user_row');
  END IF;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

COMMENT ON FUNCTION public.get_my_profile() IS '로그인 사용자 본인 users + user_private_profiles JSON (RLS와 무관)';

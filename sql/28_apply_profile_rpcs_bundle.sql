-- ============================================================
-- 프로필 RPC 일괄 적용 (한 번에 실행)
--
-- 배경: sql/15·sql/24를 개별 실행하지 않으면 앱의 get_my_profile /
-- ensure_my_profile_from_auth 호출이 실패해 "프로필을 불러오지 못했습니다"가 납니다.
-- 폴더에 sql/24_skill_tree_*.sql 과 번호가 겹치지 않도록 주의하세요.
--
-- Supabase SQL Editor에서 이 파일 전체를 1회 실행하세요.
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

CREATE OR REPLACE FUNCTION public.ensure_my_profile_from_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  au auth.users%ROWTYPE;
  user_role text;
  user_name text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = uid) THEN
    RETURN public.get_my_profile();
  END IF;

  SELECT * INTO au FROM auth.users WHERE id = uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_user_missing');
  END IF;

  user_role := CASE COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'player_common')
    WHEN 'athlete' THEN 'player_common'
    WHEN 'coach' THEN 'player_athlete'
    WHEN 'player_common' THEN 'player_common'
    WHEN 'player_athlete' THEN 'player_athlete'
    WHEN 'gym' THEN 'gym'
    WHEN 'admin' THEN 'admin'
    ELSE 'player_common'
  END;
  user_name := COALESCE(
    NULLIF(au.raw_user_meta_data->>'nickname', ''),
    NULLIF(au.raw_user_meta_data->>'name', ''),
    '사용자'
  );

  INSERT INTO public.users (
    id,
    email,
    name,
    nickname,
    gender,
    role,
    membership_type,
    height,
    weight,
    boxing_style,
    gym_name,
    gym_location,
    gym_user_id,
    tier,
    tier_points,
    skill_points
  ) VALUES (
    au.id,
    au.email,
    user_name,
    user_name,
    CASE
      WHEN NULLIF(au.raw_user_meta_data->>'gender', '') IN ('male', 'female')
        THEN au.raw_user_meta_data->>'gender'
      ELSE NULL
    END,
    user_role,
    CASE
      WHEN user_role IN ('player_common', 'player_athlete') THEN
        CASE COALESCE(NULLIF(au.raw_user_meta_data->>'membership_type', ''), 'basic')
          WHEN 'basic' THEN 'basic'
          WHEN 'standard' THEN 'standard'
          WHEN 'premium' THEN 'premium'
          ELSE 'basic'
        END
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(au.raw_user_meta_data->>'height', '') ~ '^[0-9]+$'
      THEN (au.raw_user_meta_data->>'height')::INTEGER
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(au.raw_user_meta_data->>'weight', '') ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN (au.raw_user_meta_data->>'weight')::NUMERIC(5,1)
      ELSE NULL
    END,
    NULLIF(au.raw_user_meta_data->>'boxing_style', ''),
    NULLIF(au.raw_user_meta_data->>'gym_name', ''),
    NULLIF(au.raw_user_meta_data->>'gym_location', ''),
    CASE
      WHEN NULLIF(au.raw_user_meta_data->>'gym_user_id', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN (au.raw_user_meta_data->>'gym_user_id')::uuid
      ELSE NULL
    END,
    CASE WHEN user_role IN ('player_common', 'player_athlete') THEN 'Bronze III' ELSE NULL END,
    CASE WHEN user_role IN ('player_common', 'player_athlete') THEN 0 ELSE NULL END,
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    nickname = EXCLUDED.nickname,
    gender = EXCLUDED.gender,
    role = EXCLUDED.role,
    membership_type = EXCLUDED.membership_type,
    height = EXCLUDED.height,
    weight = EXCLUDED.weight,
    boxing_style = EXCLUDED.boxing_style,
    gym_name = EXCLUDED.gym_name,
    gym_location = EXCLUDED.gym_location,
    gym_user_id = EXCLUDED.gym_user_id;

  INSERT INTO public.user_private_profiles (
    user_id,
    phone,
    birth_date,
    representative_phone
  ) VALUES (
    au.id,
    NULLIF(au.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN COALESCE(au.raw_user_meta_data->>'birth_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN (au.raw_user_meta_data->>'birth_date')::DATE
      ELSE NULL
    END,
    NULLIF(au.raw_user_meta_data->>'representative_phone', '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, public.user_private_profiles.phone),
    birth_date = COALESCE(EXCLUDED.birth_date, public.user_private_profiles.birth_date),
    representative_phone = COALESCE(EXCLUDED.representative_phone, public.user_private_profiles.representative_phone);

  RETURN public.get_my_profile();
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_profile_from_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile_from_auth() TO authenticated;

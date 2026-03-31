-- ============================================================
-- SPORTITION MVP3 AUTH AND TRIGGERS
-- Signup synchronization, default inventory/statistics, timestamps.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS user_private_profiles_updated_at ON public.user_private_profiles;
CREATE TRIGGER user_private_profiles_updated_at
  BEFORE UPDATE ON public.user_private_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_name TEXT;
BEGIN
  user_role := CASE COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'player_common')
    WHEN 'athlete' THEN 'player_common'
    WHEN 'coach' THEN 'player_athlete'
    WHEN 'player_common' THEN 'player_common'
    WHEN 'player_athlete' THEN 'player_athlete'
    WHEN 'gym' THEN 'gym'
    WHEN 'admin' THEN 'admin'
    ELSE 'player_common'
  END;
  user_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'nickname', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
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
    tier,
    tier_points,
    skill_points
  ) VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_name,
    CASE
      WHEN NULLIF(NEW.raw_user_meta_data->>'gender', '') IN ('male', 'female')
        THEN NEW.raw_user_meta_data->>'gender'
      ELSE NULL
    END,
    user_role,
    CASE
      WHEN user_role IN ('player_common', 'player_athlete') THEN
        CASE COALESCE(NULLIF(NEW.raw_user_meta_data->>'membership_type', ''), 'basic')
          WHEN 'basic' THEN 'basic'
          WHEN 'standard' THEN 'standard'
          WHEN 'premium' THEN 'premium'
          ELSE 'basic'
        END
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'height', '') ~ '^[0-9]+$'
      THEN (NEW.raw_user_meta_data->>'height')::INTEGER
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'weight', '') ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN (NEW.raw_user_meta_data->>'weight')::NUMERIC(5,1)
      ELSE NULL
    END,
    NULLIF(NEW.raw_user_meta_data->>'boxing_style', ''),
    NULLIF(NEW.raw_user_meta_data->>'gym_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'gym_location', ''),
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
    gym_location = EXCLUDED.gym_location;

  INSERT INTO public.user_private_profiles (
    user_id,
    phone,
    birth_date,
    representative_phone
  ) VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'birth_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN (NEW.raw_user_meta_data->>'birth_date')::DATE
      ELSE NULL
    END,
    NULLIF(NEW.raw_user_meta_data->>'representative_phone', '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, public.user_private_profiles.phone),
    birth_date = COALESCE(EXCLUDED.birth_date, public.user_private_profiles.birth_date),
    representative_phone = COALESCE(EXCLUDED.representative_phone, public.user_private_profiles.representative_phone);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.initialize_user_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_inventory (user_id, coins, free_pulls, pity_counter)
  VALUES (NEW.id, 1000, 5, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_init_inventory ON public.users;
CREATE TRIGGER on_user_created_init_inventory
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_user_inventory();

CREATE OR REPLACE FUNCTION public.initialize_user_statistics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.statistics (
    user_id,
    total_matches,
    wins,
    losses,
    draws,
    ko_wins,
    win_streak,
    total_attendance,
    current_streak,
    longest_streak
  ) VALUES (
    NEW.id,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.role IN ('player_common', 'player_athlete') THEN
    INSERT INTO public.tier_rankings (user_id, rank, previous_rank, rank_change)
    VALUES (NEW.id, NULL, NULL, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_init_statistics ON public.users;
CREATE TRIGGER on_user_created_init_statistics
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_user_statistics();

CREATE OR REPLACE FUNCTION public.handle_attendance_recorded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_attendance_date DATE;
  previous_current_streak INTEGER;
  new_current_streak INTEGER;
BEGIN
  UPDATE public.users
  SET skill_points = skill_points + CASE
    WHEN role IN ('player_common', 'player_athlete') THEN 1
    ELSE 0
  END
  WHERE id = NEW.user_id;

  SELECT MAX(attendance_date)
  INTO previous_attendance_date
  FROM public.attendance
  WHERE user_id = NEW.user_id
    AND attendance_date < NEW.attendance_date;

  SELECT current_streak
  INTO previous_current_streak
  FROM public.statistics
  WHERE user_id = NEW.user_id;

  new_current_streak := CASE
    WHEN previous_attendance_date = NEW.attendance_date - 1
      THEN COALESCE(previous_current_streak, 0) + 1
    ELSE 1
  END;

  INSERT INTO public.statistics (
    user_id,
    total_attendance,
    current_streak,
    longest_streak
  )
  VALUES (
    NEW.user_id,
    1,
    new_current_streak,
    new_current_streak
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_attendance = public.statistics.total_attendance + 1,
    current_streak = new_current_streak,
    longest_streak = GREATEST(public.statistics.longest_streak, new_current_streak),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_attendance_recorded_update_stats ON public.attendance;
CREATE TRIGGER on_attendance_recorded_update_stats
  AFTER INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.handle_attendance_recorded();

CREATE OR REPLACE FUNCTION public.search_members_by_phone_last4(phone_last_four TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  nickname TEXT,
  birth_date DATE,
  membership_type TEXT,
  role TEXT,
  phone TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    COALESCE(u.name, u.nickname, '사용자') AS full_name,
    COALESCE(u.nickname, u.name, '사용자') AS nickname,
    upp.birth_date,
    u.membership_type,
    u.role,
    upp.phone
  FROM public.user_private_profiles upp
  JOIN public.users u ON u.id = upp.user_id
  WHERE char_length(COALESCE(phone_last_four, '')) = 4
    AND u.role IN ('player_common', 'player_athlete')
    AND upp.phone ILIKE '%' || phone_last_four
  ORDER BY u.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_members_by_phone_last4(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.search_members_by_phone_last4(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_check_attendance(target_user_id UUID, location_text TEXT DEFAULT NULL)
RETURNS TABLE (
  attendance_id UUID,
  attendance_date DATE,
  check_in_time TIMESTAMPTZ,
  total_skill_points INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_record public.attendance%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = target_user_id
      AND role IN ('player_common', 'player_athlete')
  ) THEN
    RAISE EXCEPTION 'Attendance is only available for player accounts.';
  END IF;

  SELECT *
  INTO existing_record
  FROM public.attendance
  WHERE user_id = target_user_id
    AND attendance_date = CURRENT_DATE;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      existing_record.id,
      existing_record.attendance_date,
      existing_record.check_in_time,
      COALESCE(u.skill_points, 0),
      '이미 출석 체크되었습니다.'
    FROM public.users u
    WHERE u.id = target_user_id;
    RETURN;
  END IF;

  INSERT INTO public.attendance (user_id, location, attendance_date)
  VALUES (target_user_id, location_text, CURRENT_DATE);

  RETURN QUERY
  SELECT
    a.id,
    a.attendance_date,
    a.check_in_time,
    COALESCE(u.skill_points, 0),
    '출석 체크 완료!'
  FROM public.attendance a
  JOIN public.users u ON u.id = a.user_id
  WHERE a.user_id = target_user_id
    AND a.attendance_date = CURRENT_DATE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_check_attendance(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.kiosk_check_attendance(UUID, TEXT) TO authenticated;

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
  tier,
  tier_points,
  skill_points
)
SELECT
  au.id,
  au.email,
  COALESCE(NULLIF(au.raw_user_meta_data->>'nickname', ''), NULLIF(au.raw_user_meta_data->>'name', ''), '사용자'),
  COALESCE(NULLIF(au.raw_user_meta_data->>'nickname', ''), NULLIF(au.raw_user_meta_data->>'name', ''), '사용자'),
  CASE
    WHEN NULLIF(au.raw_user_meta_data->>'gender', '') IN ('male', 'female')
      THEN au.raw_user_meta_data->>'gender'
    ELSE NULL
  END,
  CASE
    WHEN COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'player_common') = 'athlete' THEN 'player_common'
    WHEN COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'player_common') = 'coach' THEN 'player_athlete'
    WHEN COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'player_common') = 'player_common' THEN 'player_common'
    WHEN COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'player_common') = 'player_athlete' THEN 'player_athlete'
    WHEN COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'player_common') = 'gym' THEN 'gym'
    WHEN COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'player_common') = 'admin' THEN 'admin'
    ELSE 'player_common'
  END,
  CASE
    WHEN COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'player_common') IN ('player_common', 'player_athlete', 'athlete', 'coach')
      THEN CASE COALESCE(NULLIF(au.raw_user_meta_data->>'membership_type', ''), 'basic')
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
    WHEN COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'player_common') IN ('player_common', 'player_athlete', 'athlete', 'coach')
      THEN 'Bronze III'
    ELSE NULL
  END,
  CASE
    WHEN COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'player_common') IN ('player_common', 'player_athlete', 'athlete', 'coach')
      THEN 0
    ELSE NULL
  END,
  0
FROM auth.users au
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
  gym_location = EXCLUDED.gym_location;

INSERT INTO public.user_private_profiles (
  user_id,
  phone,
  birth_date,
  representative_phone
)
SELECT
  au.id,
  NULLIF(au.raw_user_meta_data->>'phone', ''),
  CASE
    WHEN COALESCE(au.raw_user_meta_data->>'birth_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN (au.raw_user_meta_data->>'birth_date')::DATE
    ELSE NULL
  END,
  NULLIF(au.raw_user_meta_data->>'representative_phone', '')
FROM auth.users au
ON CONFLICT (user_id) DO UPDATE SET
  phone = COALESCE(EXCLUDED.phone, public.user_private_profiles.phone),
  birth_date = COALESCE(EXCLUDED.birth_date, public.user_private_profiles.birth_date),
  representative_phone = COALESCE(EXCLUDED.representative_phone, public.user_private_profiles.representative_phone);

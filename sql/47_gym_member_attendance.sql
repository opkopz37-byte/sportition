-- ============================================================
-- 체육관 관리자용: 본인 체육관 회원들의 최근 출석 일괄 조회 RPC
--
-- 문제: attendance 테이블 RLS 가 `auth.uid() = user_id` 만 허용 →
--       체육관 관리자가 자기 회원의 출석 SELECT 시 빈 결과
--
-- 해결: SECURITY DEFINER 로 RLS 우회 + 함수 안에서 "호출자가 그 회원의
--       체육관 관리자인지" 검증 → 권한 누수 없이 데이터 노출
--
-- ⚠️ Supabase SQL Editor 에 실행
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_recent_gym_member_attendance(
  p_user_ids UUID[],
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (user_id UUID, attendance_date DATE, check_in_time TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller UUID := auth.uid();
  _caller_role TEXT;
  _caller_gym TEXT;
  _since DATE;
BEGIN
  IF _caller IS NULL THEN
    RETURN;
  END IF;

  -- 호출자가 체육관(gym) 또는 관리자(admin) 인지 확인 + 본인 체육관 이름 조회
  SELECT role, gym_name
    INTO _caller_role, _caller_gym
    FROM public.users
   WHERE id = _caller;

  IF _caller_role NOT IN ('gym', 'admin') THEN
    RETURN; -- 권한 없는 호출자 → 빈 결과
  END IF;

  _since := ((NOW() AT TIME ZONE 'Asia/Seoul')::DATE - (COALESCE(p_days, 30) || ' days')::INTERVAL)::DATE;

  -- 본인 체육관 소속(gym_user_id 직결 OR gym_name 일치) 회원의 출석만 반환
  RETURN QUERY
  SELECT a.user_id, a.attendance_date, a.check_in_time
    FROM public.attendance a
    JOIN public.users u ON u.id = a.user_id
   WHERE a.user_id = ANY(p_user_ids)
     AND a.attendance_date >= _since
     AND (
           u.gym_user_id = _caller
        OR (_caller_gym IS NOT NULL AND u.gym_name = _caller_gym AND u.gym_user_id IS NULL)
        OR _caller_role = 'admin'
     )
   ORDER BY a.attendance_date DESC, a.check_in_time DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_gym_member_attendance(UUID[], INTEGER) TO authenticated;

-- 테스트: SELECT * FROM public.get_recent_gym_member_attendance(ARRAY['<uuid1>','<uuid2>']::uuid[], 30);

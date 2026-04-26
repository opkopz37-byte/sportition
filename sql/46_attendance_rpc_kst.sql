-- ============================================================
-- 출석 체크 RPC — KST(Asia/Seoul) 자정 기준 + SP +1 + 통계 갱신
--
-- 문제: 기존 checkAttendance() 는
--   1) 클라이언트의 toISOString() = UTC 날짜 사용 → 한국 새벽 시간 출석이 어제 날짜로 저장
--   2) 스킬포인트 +1 로직 없음
--   3) statistics 의 total_attendance / current_streak 갱신 없음
--
-- 해결: 모든 로직을 서버 RPC 로 통합. 날짜는 PG 가 KST 로 환산.
-- 트랜잭션 안에서 attendance / statistics / users.skill_points 한 번에 처리.
--
-- ⚠️ Supabase SQL Editor 에 실행
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_daily_attendance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;  -- ⭐ KST 기준 오늘
  _yesterday DATE := _today - INTERVAL '1 day';
  _already BOOLEAN;
  _y_attended BOOLEAN;
  _new_sp INTEGER;
  _new_streak INTEGER;
  _new_total INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 1) 이미 오늘 출석했는지 확인
  SELECT EXISTS (
    SELECT 1 FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _today
  ) INTO _already;

  IF _already THEN
    -- 멱등 — 같은 날 여러 번 눌러도 안전
    SELECT current_streak, total_attendance
      INTO _new_streak, _new_total
      FROM public.statistics WHERE user_id = _uid;
    SELECT skill_points INTO _new_sp FROM public.users WHERE id = _uid;
    RETURN jsonb_build_object(
      'ok', true,
      'already_checked', true,
      'attendance_date', _today,
      'skill_points', COALESCE(_new_sp, 0),
      'current_streak', COALESCE(_new_streak, 0),
      'total_attendance', COALESCE(_new_total, 0),
      'message', '이미 출석 체크되었습니다.'
    );
  END IF;

  -- 2) 어제 출석 여부 (streak 계산용)
  SELECT EXISTS (
    SELECT 1 FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _yesterday
  ) INTO _y_attended;

  -- 3) attendance INSERT (영구 저장)
  INSERT INTO public.attendance (user_id, attendance_date, check_in_time)
  VALUES (_uid, _today, NOW());

  -- 4) statistics 갱신 (없으면 생성) — total_attendance + 1, streak 갱신
  INSERT INTO public.statistics (
    user_id, total_attendance, current_streak, longest_streak,
    total_matches, wins, losses, draws, ko_wins, win_streak
  )
  VALUES (_uid, 1, 1, 1, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    total_attendance = COALESCE(public.statistics.total_attendance, 0) + 1,
    current_streak = CASE
      WHEN _y_attended THEN COALESCE(public.statistics.current_streak, 0) + 1
      ELSE 1
    END,
    longest_streak = GREATEST(
      COALESCE(public.statistics.longest_streak, 0),
      CASE
        WHEN _y_attended THEN COALESCE(public.statistics.current_streak, 0) + 1
        ELSE 1
      END
    );

  -- 5) SP +1
  UPDATE public.users
     SET skill_points = COALESCE(skill_points, 0) + 1,
         updated_at = NOW()
   WHERE id = _uid
   RETURNING skill_points INTO _new_sp;

  -- 6) 최신 통계값 조회 (반환용)
  SELECT current_streak, total_attendance
    INTO _new_streak, _new_total
    FROM public.statistics WHERE user_id = _uid;

  RETURN jsonb_build_object(
    'ok', true,
    'already_checked', false,
    'attendance_date', _today,
    'skill_points', COALESCE(_new_sp, 0),
    'current_streak', COALESCE(_new_streak, 0),
    'total_attendance', COALESCE(_new_total, 0),
    'sp_added', 1,
    'message', '출석 체크 완료! 스킬 포인트 +1'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_daily_attendance() TO authenticated;

-- ============================================================
-- 보너스: KST 기준 오늘 날짜를 반환하는 헬퍼 (클라이언트에서 RPC 로 호출 가능)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kst_today()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
$$;

GRANT EXECUTE ON FUNCTION public.get_kst_today() TO authenticated, anon;

-- ============================================================
-- attendance 영구 저장 보장 — UNIQUE 제약 (user_id, attendance_date)
-- 이미 있다면 IF NOT EXISTS 로 안전하게
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'attendance_user_date_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.attendance
        ADD CONSTRAINT attendance_user_date_unique UNIQUE (user_id, attendance_date);
    EXCEPTION WHEN duplicate_table OR unique_violation THEN
      -- 기존 중복 데이터가 있으면 제약 추가 실패 — 무시 (수동 정리 필요)
      RAISE NOTICE 'attendance_user_date_unique 추가 실패 — 중복 데이터 정리 필요';
    END;
  END IF;
END $$;

-- ============================================================
-- 테스트:
--   SELECT public.record_daily_attendance();
--   SELECT public.get_kst_today();
-- ============================================================

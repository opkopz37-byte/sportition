-- ============================================================
-- 출석/SP 관련 쿼리 통합 — 트래픽·RTT 최적화
--
-- 변경:
--   1) get_my_attendance_summary() — 페이지 진입 시 1 RPC 로 모든 상태 반환
--      (이전: attendance/statistics/users/week/month 5개 parallel SELECT)
--   2) attendance_open_modal() — 출석체크 클릭 시 1 RPC 로 기록 + 모달 상태 반환
--      (이전: record_daily_attendance + getMyPromotionRequests + 5/5 SELECT + skill_tree_nodes 4개 sequential)
--   3) 옛 100 SP 부여 백필 잔재 reset — name/nickname/email 패턴 일치 회원
--
-- ⚠️ Supabase SQL Editor 에 실행. sql/50 적용 후.
-- ============================================================

-- ============================================================
-- 0) 옛 100 SP 백필 잔재 정리 (one-time)
--    sql/08 / sql/09 가 "이호진" 패턴 회원에게 100 SP 를 부여하던 백필 제거.
--    여전히 100 SP 갖고 있는 패턴 매칭 회원만 0 SP 로 리셋. 다른 회원은 영향 없음.
-- ============================================================
UPDATE public.users
   SET skill_points = 0,
       updated_at = NOW()
 WHERE skill_points >= 100
   AND (name ILIKE '%이호진%' OR nickname ILIKE '%이호진%' OR email ILIKE '%ihojin%');


-- ============================================================
-- 1) get_my_attendance_summary — 회원 페이지 진입 시 1 RPC
--    반환: 오늘 출석 여부, sp_claimed, streak, 이번 달 출석, 이번 주 출석 도장, SP, 처리 안 된 마스터
--    클라이언트는 이 RPC 1번 호출로 카드 + 모달 가능 상태 모두 결정.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_attendance_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  _dow INTEGER := EXTRACT(ISODOW FROM _today)::INTEGER;
  -- ISODOW: 1=월요일 ... 7=일요일. 이번주 월요일 = today - (dow - 1)
  _week_start DATE := _today - ((_dow - 1) || ' days')::INTERVAL;
  _week_end DATE := _week_start + INTERVAL '6 days';
  _month_start DATE := DATE_TRUNC('month', _today)::DATE;
  _today_checked BOOLEAN := FALSE;
  _today_sp_claimed BOOLEAN := FALSE;
  _current_streak INTEGER := 0;
  _total_attendance INTEGER := 0;
  _this_month_count INTEGER := 0;
  _skill_points INTEGER := 0;
  _week_dates DATE[];
  _unfinished_count INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 오늘 출석 + sp_claimed
  SELECT TRUE, COALESCE(sp_claimed, FALSE)
    INTO _today_checked, _today_sp_claimed
    FROM public.attendance
   WHERE user_id = _uid AND attendance_date = _today;
  IF NOT FOUND THEN
    _today_checked := FALSE;
  END IF;

  -- streak / total
  SELECT COALESCE(current_streak, 0), COALESCE(total_attendance, 0)
    INTO _current_streak, _total_attendance
    FROM public.statistics
   WHERE user_id = _uid;

  -- 이번 달 출석 일수
  SELECT COUNT(*)::INTEGER INTO _this_month_count
    FROM public.attendance
   WHERE user_id = _uid AND attendance_date >= _month_start;

  -- SP
  SELECT COALESCE(skill_points, 0) INTO _skill_points
    FROM public.users WHERE id = _uid;

  -- 이번 주 출석 날짜 배열
  SELECT array_agg(attendance_date ORDER BY attendance_date) INTO _week_dates
    FROM public.attendance
   WHERE user_id = _uid
     AND attendance_date >= _week_start
     AND attendance_date <= _week_end;

  -- 처리 안 된 마스터 (5/5 + 미승인)
  SELECT COUNT(*) INTO _unfinished_count
    FROM public.user_skill_node_progress p
   WHERE p.user_id = _uid
     AND p.exp_level >= 5
     AND NOT EXISTS (
       SELECT 1 FROM public.skill_promotion_requests r
        WHERE r.user_id = p.user_id
          AND r.fork_node_id = p.node_id
          AND r.status = 'approved'
     );

  RETURN jsonb_build_object(
    'ok', true,
    'today', _today,
    'today_checked', _today_checked,
    'today_sp_claimed', _today_sp_claimed,
    'current_streak', _current_streak,
    'total_attendance', _total_attendance,
    'this_month_count', _this_month_count,
    'skill_points', _skill_points,
    'week_start', _week_start,
    'week_end', _week_end,
    'week_dates', COALESCE(_week_dates, ARRAY[]::DATE[]),
    'has_unfinished_mastery', _unfinished_count > 0
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_attendance_summary() TO authenticated;


-- ============================================================
-- 2) attendance_open_modal — 출석체크 버튼 클릭 시 1 RPC
--    동작: 출석 기록 (멱등) + 모달이 필요한 모든 상태 반환
--      · today_checked / sp_claimed
--      · current_streak / this_month_count
--      · 가장 우선순위 높은 처리 안 된 마스터 노드 (있으면 — 레벨업 신청 타겟)
--          { node_id, skill_name, status }   status: pending|reviewing|rejected|unsubmitted
-- ============================================================
CREATE OR REPLACE FUNCTION public.attendance_open_modal()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  _yesterday DATE := _today - INTERVAL '1 day';
  _month_start DATE := DATE_TRUNC('month', _today)::DATE;
  _already BOOLEAN := FALSE;
  _y_attended BOOLEAN := FALSE;
  _sp_claimed BOOLEAN := FALSE;
  _current_streak INTEGER := 0;
  _this_month INTEGER := 0;
  _target_node_id INTEGER;
  _target_status TEXT;
  _target_skill_name TEXT;
  _unfinished JSONB := NULL;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 1) 출석 기록 (멱등)
  SELECT EXISTS (
    SELECT 1 FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _today
  ) INTO _already;

  IF _already THEN
    SELECT sp_claimed INTO _sp_claimed
      FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _today;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.attendance
       WHERE user_id = _uid AND attendance_date = _yesterday
    ) INTO _y_attended;

    INSERT INTO public.attendance (user_id, attendance_date, check_in_time, sp_claimed)
    VALUES (_uid, _today, NOW(), FALSE);

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
    _sp_claimed := FALSE;
  END IF;

  -- 2) 통계 + 이번 달
  SELECT COALESCE(current_streak, 0) INTO _current_streak
    FROM public.statistics WHERE user_id = _uid;

  SELECT COUNT(*)::INTEGER INTO _this_month
    FROM public.attendance
   WHERE user_id = _uid AND attendance_date >= _month_start;

  -- 3) 처리 안 된 마스터 노드 검출 (우선순위 정렬)
  --    pending(4) > reviewing(3) > rejected(2) > unsubmitted(1)
  SELECT p.node_id,
         COALESCE(latest.status, 'unsubmitted'),
         n.name
    INTO _target_node_id, _target_status, _target_skill_name
    FROM public.user_skill_node_progress p
    JOIN public.skill_tree_nodes n ON n.id = p.node_id
    LEFT JOIN LATERAL (
      SELECT status FROM public.skill_promotion_requests r
       WHERE r.user_id = p.user_id AND r.fork_node_id = p.node_id
       ORDER BY r.requested_at DESC
       LIMIT 1
    ) latest ON TRUE
   WHERE p.user_id = _uid
     AND p.exp_level >= 5
     AND COALESCE(latest.status, 'unsubmitted') <> 'approved'
   ORDER BY CASE COALESCE(latest.status, 'unsubmitted')
              WHEN 'pending'    THEN 4
              WHEN 'reviewing'  THEN 3
              WHEN 'rejected'   THEN 2
              ELSE 1
            END DESC
   LIMIT 1;

  IF _target_node_id IS NOT NULL THEN
    _unfinished := jsonb_build_object(
      'node_id', _target_node_id,
      'status', _target_status,
      'skill_name', COALESCE(_target_skill_name, '마스터 스킬')
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_checked', _already,
    'sp_claimed', COALESCE(_sp_claimed, FALSE),
    'current_streak', _current_streak,
    'this_month', _this_month,
    'today', _today,
    'unfinished', _unfinished
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.attendance_open_modal() TO authenticated;


-- ============================================================
-- ── 테스트 ──
-- SELECT public.get_my_attendance_summary();
-- SELECT public.attendance_open_modal();
-- ============================================================

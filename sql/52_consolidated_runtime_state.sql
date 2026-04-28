-- ============================================================
-- Sportition v1 — 출석 / SP / 스킬 / 승단 통합 상태
--
-- 이 파일 하나만 Supabase SQL Editor 에 실행하면 모든 현재 정책이 적용됩니다.
-- sql/49 + sql/50 + sql/51 의 내용을 정리·통합한 멱등 마이그레이션.
-- 여러 번 실행해도 안전 (CREATE OR REPLACE / IF NOT EXISTS / IDEMPOTENT UPDATE).
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 적용 정책 요약:
--   ① 출석체크 = DB 기록 + 모달 표시. SP 자동 지급 없음.
--   ② 모달 [스킬 포인트 적립] 클릭 시만 SP +1.
--   ③ 5/5 마스터 + 승단 미승인 노드 1개라도 있으면 SP 적립 차단.
--   ④ 심사 대기/진행 중이면 모든 스킬 투자 차단.
--   ⑤ 마스터는 5/5 고정 (거절 시 SP 맥스 증가 시스템 폐기).
--   ⑥ 모든 노드 최소 1 SP 비용 (튜토리얼 잡 포함).
--   ⑦ 신규 회원 SP = 0 (기본값).
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 의존: sql/01 ~ sql/48 까지 적용된 환경 가정 (테이블·뷰·기본 데이터).
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- SECTION 1) 스키마 정합 — 컬럼·제약·트리거
-- ════════════════════════════════════════════════════════════

-- 1.1) 옛 자동 SP 지급 트리거 제거
--      attendance INSERT 시 자동으로 +1 SP 주던 트리거 (sql/03) 가
--      새 분리 시스템 (record_daily_attendance + claim_daily_skill_point)
--      과 충돌 → 모달 [적립] 안 눌러도 SP 들어가는 버그 유발.
DROP TRIGGER IF EXISTS on_attendance_recorded_update_stats ON public.attendance;
DROP FUNCTION IF EXISTS public.handle_attendance_recorded() CASCADE;


-- 1.2) attendance.sp_claimed — 출석일 SP 적립 했는지 플래그
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS sp_claimed BOOLEAN NOT NULL DEFAULT FALSE;

-- 기존 출석 기록은 이미 SP 받은 것으로 간주 (소급 지급 X)
UPDATE public.attendance SET sp_claimed = TRUE WHERE sp_claimed = FALSE;


-- 1.3) skill_tree_nodes 의 fork 메타 컬럼 (sql/08 미적용 환경 대비)
ALTER TABLE public.skill_tree_nodes
  ADD COLUMN IF NOT EXISTS is_fork BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.skill_tree_nodes
  ADD COLUMN IF NOT EXISTS fork_branch_node_numbers INTEGER[];


-- 1.4) user_skill_node_progress.promotion_fail_count
--      sql/49 의 거절 카운트 시스템은 폐기됐지만, 컬럼은 통계용으로 남겨둠.
ALTER TABLE public.user_skill_node_progress
  ADD COLUMN IF NOT EXISTS promotion_fail_count INTEGER NOT NULL DEFAULT 0
    CHECK (promotion_fail_count >= 0 AND promotion_fail_count <= 5);


-- 1.5) exp_level CHECK 0~5 — 마스터 5 고정 (sql/49 의 0~10 동적 max 롤백)
ALTER TABLE public.user_skill_node_progress
  DROP CONSTRAINT IF EXISTS user_skill_node_progress_exp_level_check;
ALTER TABLE public.user_skill_node_progress
  ADD CONSTRAINT user_skill_node_progress_exp_level_check
  CHECK (exp_level BETWEEN 0 AND 5);


-- ════════════════════════════════════════════════════════════
-- SECTION 2) 데이터 정합 — one-time 정리
-- ════════════════════════════════════════════════════════════

-- 2.1) 동적 max 시스템 잔재 — exp_level > 5 인 행은 5 로 캡
UPDATE public.user_skill_node_progress
   SET exp_level = 5
 WHERE exp_level > 5;


-- 2.2) point_cost = 0 인 노드 (옛 튜토리얼 잡) 모두 1 로 강제
--      0 비용 노드는 SP 없이 무한 클릭 가능한 버그를 유발.
UPDATE public.skill_tree_nodes
   SET point_cost = 1
 WHERE point_cost IS NULL OR point_cost < 1;


-- 2.3) 옛 "이호진" 패턴 100 SP 백필 잔재 정리
--      sql/08 / sql/09 가 테스트용으로 100 SP 부여했던 코드를 제거하면서
--      여전히 100+ SP 갖고 있는 패턴 매칭 회원만 0 으로 reset.
UPDATE public.users
   SET skill_points = 0,
       updated_at = NOW()
 WHERE skill_points >= 100
   AND (name ILIKE '%이호진%' OR nickname ILIKE '%이호진%' OR email ILIKE '%ihojin%');


-- ════════════════════════════════════════════════════════════
-- SECTION 3) 출석 / SP RPC
-- ════════════════════════════════════════════════════════════

-- 3.1) record_daily_attendance
--      출석 INSERT + statistics 갱신만. SP 는 별도 RPC.
CREATE OR REPLACE FUNCTION public.record_daily_attendance()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  _yesterday DATE := _today - INTERVAL '1 day';
  _already BOOLEAN;
  _y_attended BOOLEAN;
  _new_streak INTEGER;
  _new_total INTEGER;
  _sp_claimed BOOLEAN := FALSE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _today
  ) INTO _already;

  IF _already THEN
    SELECT current_streak, total_attendance
      INTO _new_streak, _new_total
      FROM public.statistics WHERE user_id = _uid;
    SELECT sp_claimed INTO _sp_claimed
      FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _today;
    RETURN jsonb_build_object(
      'ok', true,
      'already_checked', true,
      'attendance_date', _today,
      'sp_claimed', COALESCE(_sp_claimed, FALSE),
      'current_streak', COALESCE(_new_streak, 0),
      'total_attendance', COALESCE(_new_total, 0)
    );
  END IF;

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
      CASE WHEN _y_attended
        THEN COALESCE(public.statistics.current_streak, 0) + 1
        ELSE 1 END
    );

  SELECT current_streak, total_attendance
    INTO _new_streak, _new_total
    FROM public.statistics WHERE user_id = _uid;

  RETURN jsonb_build_object(
    'ok', true,
    'already_checked', false,
    'attendance_date', _today,
    'sp_claimed', FALSE,
    'current_streak', COALESCE(_new_streak, 0),
    'total_attendance', COALESCE(_new_total, 0)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_daily_attendance() TO authenticated;


-- 3.2) claim_daily_skill_point
--      모달 [스킬 포인트 적립] 클릭 시 호출.
--      차단 조건: 미인증 / 5/5+미승인 마스터 존재 / 출석 행 없음 / 이미 적립됨.
CREATE OR REPLACE FUNCTION public.claim_daily_skill_point()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  _claimed BOOLEAN;
  _found BOOLEAN := FALSE;
  _new_sp INTEGER;
  _unfinished_count INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 처리 안 된 마스터 (5/5 + 승인 안 됨) 가 있으면 차단
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

  IF _unfinished_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'mastery_unresolved');
  END IF;

  -- 오늘 출석 행 + lock
  SELECT sp_claimed INTO _claimed
    FROM public.attendance
   WHERE user_id = _uid AND attendance_date = _today
   FOR UPDATE;
  _found := FOUND;

  IF NOT _found THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_attendance');
  END IF;

  IF COALESCE(_claimed, FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  UPDATE public.attendance
     SET sp_claimed = TRUE
   WHERE user_id = _uid AND attendance_date = _today;
  UPDATE public.users
     SET skill_points = COALESCE(skill_points, 0) + 1,
         updated_at = NOW()
   WHERE id = _uid
   RETURNING skill_points INTO _new_sp;

  RETURN jsonb_build_object(
    'ok', true,
    'skill_points', COALESCE(_new_sp, 0),
    'sp_added', 1
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_daily_skill_point() TO authenticated;


-- 3.3) get_my_attendance_summary
--      회원 페이지 진입 시 1 RPC 로 모든 출석 통계 조회 (트래픽 최적화).
CREATE OR REPLACE FUNCTION public.get_my_attendance_summary()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  _dow INTEGER := EXTRACT(ISODOW FROM _today)::INTEGER;
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

  SELECT TRUE, COALESCE(sp_claimed, FALSE)
    INTO _today_checked, _today_sp_claimed
    FROM public.attendance
   WHERE user_id = _uid AND attendance_date = _today;
  IF NOT FOUND THEN _today_checked := FALSE; END IF;

  SELECT COALESCE(current_streak, 0), COALESCE(total_attendance, 0)
    INTO _current_streak, _total_attendance
    FROM public.statistics WHERE user_id = _uid;

  SELECT COUNT(*)::INTEGER INTO _this_month_count
    FROM public.attendance
   WHERE user_id = _uid AND attendance_date >= _month_start;

  SELECT COALESCE(skill_points, 0) INTO _skill_points
    FROM public.users WHERE id = _uid;

  SELECT array_agg(attendance_date ORDER BY attendance_date) INTO _week_dates
    FROM public.attendance
   WHERE user_id = _uid
     AND attendance_date >= _week_start
     AND attendance_date <= _week_end;

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


-- 3.4) attendance_open_modal
--      출석체크 클릭 시 1 RPC 로 출석 기록 + 모달 상태 (가장 우선순위 높은 미승인 마스터).
CREATE OR REPLACE FUNCTION public.attendance_open_modal()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
      current_streak = CASE WHEN _y_attended
        THEN COALESCE(public.statistics.current_streak, 0) + 1 ELSE 1 END,
      longest_streak = GREATEST(
        COALESCE(public.statistics.longest_streak, 0),
        CASE WHEN _y_attended
          THEN COALESCE(public.statistics.current_streak, 0) + 1 ELSE 1 END
      );
    _sp_claimed := FALSE;
  END IF;

  SELECT COALESCE(current_streak, 0) INTO _current_streak
    FROM public.statistics WHERE user_id = _uid;

  SELECT COUNT(*)::INTEGER INTO _this_month
    FROM public.attendance
   WHERE user_id = _uid AND attendance_date >= _month_start;

  -- 우선순위: pending(4) > reviewing(3) > rejected(2) > unsubmitted(1)
  SELECT p.node_id, COALESCE(latest.status, 'unsubmitted'), n.name
    INTO _target_node_id, _target_status, _target_skill_name
    FROM public.user_skill_node_progress p
    JOIN public.skill_tree_nodes n ON n.id = p.node_id
    LEFT JOIN LATERAL (
      SELECT status FROM public.skill_promotion_requests r
       WHERE r.user_id = p.user_id AND r.fork_node_id = p.node_id
       ORDER BY r.requested_at DESC LIMIT 1
    ) latest ON TRUE
   WHERE p.user_id = _uid AND p.exp_level >= 5
     AND COALESCE(latest.status, 'unsubmitted') <> 'approved'
   ORDER BY CASE COALESCE(latest.status, 'unsubmitted')
              WHEN 'pending'   THEN 4
              WHEN 'reviewing' THEN 3
              WHEN 'rejected'  THEN 2
              ELSE 1 END DESC
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


-- 3.5) kiosk_check_attendance
--      체육관 입구 키오스크용. KST 기준 + statistics 갱신 (트리거 제거 후 직접 처리).
CREATE OR REPLACE FUNCTION public.kiosk_check_attendance(
  target_user_id UUID,
  location_text TEXT DEFAULT NULL
)
RETURNS TABLE (
  attendance_id UUID,
  attendance_date DATE,
  check_in_time TIMESTAMPTZ,
  total_skill_points INTEGER,
  message TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  _yesterday DATE := _today - INTERVAL '1 day';
  _y_attended BOOLEAN;
  existing_record public.attendance%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
     WHERE id = target_user_id
       AND role IN ('player_common', 'player_athlete')
  ) THEN
    RAISE EXCEPTION 'Attendance is only available for player accounts.';
  END IF;

  SELECT * INTO existing_record FROM public.attendance
   WHERE user_id = target_user_id AND attendance_date = _today;

  IF FOUND THEN
    RETURN QUERY
    SELECT existing_record.id, existing_record.attendance_date,
           existing_record.check_in_time, COALESCE(u.skill_points, 0),
           '이미 출석 체크되었습니다.'
      FROM public.users u WHERE u.id = target_user_id;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.attendance
     WHERE user_id = target_user_id AND attendance_date = _yesterday
  ) INTO _y_attended;

  INSERT INTO public.attendance (user_id, location, attendance_date, sp_claimed)
  VALUES (target_user_id, location_text, _today, FALSE);

  INSERT INTO public.statistics (
    user_id, total_attendance, current_streak, longest_streak,
    total_matches, wins, losses, draws, ko_wins, win_streak
  )
  VALUES (target_user_id, 1, 1, 1, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    total_attendance = COALESCE(public.statistics.total_attendance, 0) + 1,
    current_streak = CASE WHEN _y_attended
      THEN COALESCE(public.statistics.current_streak, 0) + 1 ELSE 1 END,
    longest_streak = GREATEST(
      COALESCE(public.statistics.longest_streak, 0),
      CASE WHEN _y_attended
        THEN COALESCE(public.statistics.current_streak, 0) + 1 ELSE 1 END
    );

  RETURN QUERY
  SELECT a.id, a.attendance_date, a.check_in_time,
         COALESCE(u.skill_points, 0), '출석 체크 완료!'
    FROM public.attendance a
    JOIN public.users u ON u.id = a.user_id
   WHERE a.user_id = target_user_id AND a.attendance_date = _today;
END;
$$;
GRANT EXECUTE ON FUNCTION public.kiosk_check_attendance(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.kiosk_check_attendance(UUID, TEXT) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- SECTION 4) 스킬 / 승단 RPC
-- ════════════════════════════════════════════════════════════

-- 4.1) add_skill_exp
--      스킬 노드에 +1 EXP. 마스터 5 고정, 최소 1 SP 비용, 심사 대기 중 차단.
DROP FUNCTION IF EXISTS public.add_skill_exp(INTEGER) CASCADE;

CREATE FUNCTION public.add_skill_exp(p_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _cost INTEGER;
  _parents INTEGER[];
  _parents_ok BOOLEAN := TRUE;
  _current INTEGER := 0;
  _new INTEGER;
  _sp INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT n.point_cost, n.parent_nodes
    INTO _cost, _parents
    FROM public.skill_tree_nodes AS n
   WHERE n.id = p_node_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 노드입니다.';
  END IF;

  -- 최소 비용 1 SP — DB 가 NULL/0 이라도 차감 보장
  _cost := GREATEST(1, COALESCE(_cost, 1));

  -- 심사 대기/진행 중이면 모든 스킬 투자 차단
  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = _uid AND status IN ('pending', 'reviewing')
  ) THEN
    RAISE EXCEPTION '승단 심사 대기 중에는 다른 스킬을 찍을 수 없습니다.';
  END IF;

  -- 부모 검증 (있으면 1개 이상 exp_level >= 1)
  IF _parents IS NOT NULL AND array_length(_parents, 1) > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.skill_tree_nodes AS pn
        INNER JOIN public.user_skill_node_progress AS up ON up.node_id = pn.id
       WHERE up.user_id = _uid
         AND pn.node_number = ANY (_parents)
         AND up.exp_level >= 1
    ) INTO _parents_ok;
    IF NOT _parents_ok THEN
      RAISE EXCEPTION '선행 스킬을 먼저 1단계 이상 찍어야 합니다.';
    END IF;
  END IF;

  -- SP 잔액
  SELECT COALESCE(u.skill_points, 0) INTO _sp
    FROM public.users AS u
   WHERE u.id = _uid
   FOR UPDATE;
  _sp := COALESCE(_sp, 0);
  IF _sp < _cost THEN
    RAISE EXCEPTION 'SP가 부족합니다. (보유 %, 필요 %)', _sp, _cost;
  END IF;

  -- 현재 EXP
  SELECT COALESCE(usnp.exp_level, 0) INTO _current
    FROM public.user_skill_node_progress AS usnp
   WHERE usnp.user_id = _uid AND usnp.node_id = p_node_id
   FOR UPDATE;
  _current := COALESCE(_current, 0);

  IF _current >= 5 THEN
    RAISE EXCEPTION '이미 마스터한 스킬입니다.';
  END IF;

  _new := _current + 1;

  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (_uid, p_node_id, _new)
  ON CONFLICT (user_id, node_id)
  DO UPDATE SET exp_level = EXCLUDED.exp_level;

  IF _new = 5 THEN
    INSERT INTO public.user_skill_unlocks (user_id, node_id)
    VALUES (_uid, p_node_id)
    ON CONFLICT (user_id, node_id) DO NOTHING;
  END IF;

  UPDATE public.users
     SET skill_points = COALESCE(skill_points, 0) - _cost
   WHERE id = _uid;

  RETURN jsonb_build_object(
    'node_id',      p_node_id,
    'exp_level',    _new,
    'max_exp',      5,
    'sp_remaining', _sp - _cost
  );
END
$function$;
GRANT EXECUTE ON FUNCTION public.add_skill_exp(INTEGER) TO authenticated;


-- 4.2) submit_master_exam_request
--      마스터 5/5 회원이 승단 심사 신청. 동일 노드 중복 신청·승인 차단.
CREATE OR REPLACE FUNCTION public.submit_master_exam_request(p_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _exp INTEGER;
  _gym TEXT;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.skill_tree_nodes WHERE id = p_node_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  SELECT COALESCE(exp_level, 0) INTO _exp
    FROM public.user_skill_node_progress
   WHERE user_id = _uid AND node_id = p_node_id;
  IF NOT FOUND OR COALESCE(_exp, 0) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_mastered');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = _uid AND fork_node_id = p_node_id AND status = 'approved'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_promoted');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = _uid AND fork_node_id = p_node_id AND status IN ('pending', 'reviewing')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_pending');
  END IF;

  SELECT gym_name INTO _gym FROM public.users WHERE id = _uid;
  IF _gym IS NULL OR btrim(_gym) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_gym');
  END IF;

  INSERT INTO public.skill_promotion_requests (user_id, fork_node_id, gym_name, status)
  VALUES (_uid, p_node_id, btrim(_gym), 'pending');

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_master_exam_request(INTEGER) TO authenticated;


-- 4.3) gym_resolve_master_exam
--      체육관·관리자가 신청 승인 또는 거절. 거절 시 SP 맥스 +1 시스템 폐기.
CREATE OR REPLACE FUNCTION public.gym_resolve_master_exam(
  p_request_id UUID,
  p_approved   BOOLEAN,
  p_notes      TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _r   public.skill_promotion_requests%ROWTYPE;
  _g   public.users%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _g FROM public.users WHERE id = _uid;
  IF NOT FOUND OR _g.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO _r FROM public.skill_promotion_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF _g.role <> 'admin' AND (_g.gym_name IS DISTINCT FROM _r.gym_name) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_gym');
  END IF;

  IF _r.status NOT IN ('pending', 'reviewing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF p_approved THEN
    UPDATE public.skill_promotion_requests
       SET status = 'approved',
           resolved_at = NOW(),
           reviewer_id = _uid,
           notes = COALESCE(p_notes, notes)
     WHERE id = p_request_id;
  ELSE
    UPDATE public.skill_promotion_requests
       SET status = 'rejected',
           resolved_at = NOW(),
           reviewer_id = _uid,
           notes = p_notes
     WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gym_resolve_master_exam(UUID, BOOLEAN, TEXT) TO authenticated;


-- 4.4) reset_skill_tree_with_ticket
--      스킬 초기화권 1장 사용 → 진행/언락/승단 신청 모두 삭제 + 사용 SP 환급.
DROP FUNCTION IF EXISTS public.reset_skill_tree_with_ticket() CASCADE;

CREATE FUNCTION public.reset_skill_tree_with_ticket()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _tickets INTEGER;
  _refund INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT COALESCE(u.skill_reset_tickets, 0) INTO _tickets
    FROM public.users AS u
   WHERE u.id = _uid
   FOR UPDATE;

  _tickets := COALESCE(_tickets, 0);
  IF _tickets < 1 THEN
    RAISE EXCEPTION '스킬 초기화권이 없습니다.';
  END IF;

  SELECT COALESCE(SUM(usnp.exp_level * COALESCE(stn.point_cost, 1)), 0)
    INTO _refund
    FROM public.user_skill_node_progress AS usnp
    INNER JOIN public.skill_tree_nodes AS stn ON stn.id = usnp.node_id
   WHERE usnp.user_id = _uid;

  DELETE FROM public.user_skill_node_progress  WHERE user_id = _uid;
  DELETE FROM public.user_skill_unlocks        WHERE user_id = _uid;
  DELETE FROM public.skill_promotion_requests  WHERE user_id = _uid;

  UPDATE public.users
     SET skill_reset_tickets = COALESCE(skill_reset_tickets, 0) - 1,
         skill_points = COALESCE(skill_points, 0) + _refund
   WHERE id = _uid;

  RETURN jsonb_build_object(
    'ok', true,
    'refunded_sp', _refund,
    'tickets_left', _tickets - 1
  );
END
$function$;
GRANT EXECUTE ON FUNCTION public.reset_skill_tree_with_ticket() TO authenticated;


-- ════════════════════════════════════════════════════════════
-- SECTION 5) 조회 / 큐 RPC (체육관·회원 페이지에서 사용)
-- ════════════════════════════════════════════════════════════

-- 5.1) get_my_promotion_requests
--      본인의 승단 신청 이력 (skills 페이지 상태 표시용).
CREATE OR REPLACE FUNCTION public.get_my_promotion_requests()
RETURNS TABLE (
  id UUID,
  node_id INTEGER,
  status TEXT,
  requested_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notes TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, fork_node_id, status, requested_at, resolved_at, notes
    FROM public.skill_promotion_requests
   WHERE user_id = auth.uid()
   ORDER BY requested_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_promotion_requests() TO authenticated;


-- 5.2) get_gym_promotion_queue
--      체육관 심사 큐 (모든 상태). 회원 + 스킬 메타 한 번에 조인.
CREATE OR REPLACE FUNCTION public.get_gym_promotion_queue(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  fork_node_id INTEGER,
  status TEXT,
  requested_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  reviewer_id UUID,
  notes TEXT,
  gym_name TEXT,
  member_name TEXT,
  member_nickname TEXT,
  member_display_name TEXT,
  member_tier TEXT,
  member_avatar_url TEXT,
  skill_name TEXT,
  skill_node_number INTEGER,
  skill_is_fork BOOLEAN,
  skill_fork_branch_node_numbers INTEGER[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    r.id, r.user_id, r.fork_node_id, r.status,
    r.requested_at, r.resolved_at, r.reviewer_id, r.notes, r.gym_name,
    p.name, p.nickname, p.display_name, p.tier, p.avatar_url,
    n.name, n.node_number, COALESCE(n.is_fork, FALSE), n.fork_branch_node_numbers
  FROM public.skill_promotion_requests r
  LEFT JOIN public.public_player_profiles p ON p.id = r.user_id
  LEFT JOIN public.skill_tree_nodes n        ON n.id = r.fork_node_id
  WHERE (p_status IS NULL OR r.status = p_status)
    AND EXISTS (
      SELECT 1 FROM public.users gu
       WHERE gu.id = auth.uid()
         AND gu.role IN ('gym', 'admin')
         AND (gu.role = 'admin' OR gu.gym_name IS NOT DISTINCT FROM r.gym_name)
    )
  ORDER BY r.requested_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_gym_promotion_queue(TEXT) TO authenticated;


-- 5.3) get_gym_promotion_logs
--      체육관 거절 로그 (최근 N개) — 거절 사유·시각 표시용.
CREATE OR REPLACE FUNCTION public.get_gym_promotion_logs(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  fork_node_id INTEGER,
  status TEXT,
  requested_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  member_name TEXT,
  member_nickname TEXT,
  member_avatar_url TEXT,
  skill_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    r.id, r.user_id, r.fork_node_id, r.status,
    r.requested_at, r.resolved_at, r.notes,
    p.name, p.nickname, p.avatar_url, n.name
  FROM public.skill_promotion_requests r
  LEFT JOIN public.public_player_profiles p ON p.id = r.user_id
  LEFT JOIN public.skill_tree_nodes n        ON n.id = r.fork_node_id
  WHERE r.status = 'rejected'
    AND EXISTS (
      SELECT 1 FROM public.users gu
       WHERE gu.id = auth.uid()
         AND gu.role IN ('gym', 'admin')
         AND (gu.role = 'admin' OR gu.gym_name IS NOT DISTINCT FROM r.gym_name)
    )
  ORDER BY r.resolved_at DESC NULLS LAST, r.requested_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;
GRANT EXECUTE ON FUNCTION public.get_gym_promotion_logs(INTEGER) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- SECTION 6) 검증 / 점검 쿼리 (수동 실행 권장)
-- ════════════════════════════════════════════════════════════
-- 적용 후 다음 쿼리들을 직접 실행해서 데이터 무결성 확인:
--
-- ─ claim_daily_skill_point 가 mastery_unresolved 검사를 갖고 있는지:
--   SELECT pg_get_functiondef('public.claim_daily_skill_point()'::regprocedure);
--   → 결과에 'mastery_unresolved' 단어가 있어야 정상.
--
-- ─ 옛 자동 SP 트리거가 제거됐는지:
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.attendance'::regclass
--      AND NOT tgisinternal;
--   → 'on_attendance_recorded_update_stats' 가 보이면 안 됨.
--
-- ─ 음수 SP 회원:
--   SELECT id, email, skill_points FROM public.users WHERE skill_points < 0;
--   → 0 행이어야 정상.
--
-- ─ exp_level > 5 행:
--   SELECT user_id, node_id, exp_level FROM public.user_skill_node_progress
--    WHERE exp_level > 5;
--   → 0 행이어야 정상.
--
-- ─ point_cost < 1 노드:
--   SELECT id, node_number, name, point_cost FROM public.skill_tree_nodes
--    WHERE point_cost < 1;
--   → 0 행이어야 정상.
--
-- ─ 처리 안 된 마스터 (SP 적립 잠금 회원):
--   SELECT u.email, n.name AS skill, p.exp_level
--     FROM public.user_skill_node_progress p
--     JOIN public.users u ON u.id = p.user_id
--     JOIN public.skill_tree_nodes n ON n.id = p.node_id
--    WHERE p.exp_level >= 5
--      AND NOT EXISTS (
--        SELECT 1 FROM public.skill_promotion_requests r
--         WHERE r.user_id = p.user_id
--           AND r.fork_node_id = p.node_id
--           AND r.status = 'approved'
--      );
--
-- ─ 새 통합 RPC 동작 테스트:
--   SELECT public.get_my_attendance_summary();
--   SELECT public.attendance_open_modal();
-- ============================================================

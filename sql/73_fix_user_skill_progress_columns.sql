-- ============================================================
-- sql/73 — sql/69, sql/70 의 RPC/INSERT 에서 사라진 컬럼 참조 제거
--
-- 원인:
--   sql/33_redesign_skill_tree.sql 이 user_skill_node_progress 에서 다음 컬럼을 DROP:
--     • investment_count
--     • promotion_status
--     • chosen_branch_node_number
--     • fail_count
--     • required_investments_for_fork
--   그러나 sql/69 (gym_unlock/gym_skip) 와 sql/70 (record_daily_attendance) 의
--   INSERT 가 `promotion_status` 컬럼을 명시 → 호출 시 에러.
--
-- 처리:
--   3개 함수 CREATE OR REPLACE 로 본문에서 promotion_status 컬럼 참조 제거.
--   현재 살아있는 컬럼:
--     user_id, node_id, exp_level, promotion_fail_count, is_skipped, updated_at
--
-- 멱등 (CREATE OR REPLACE).
-- ⚠️ Supabase SQL Editor 에서 실행.
-- ============================================================

BEGIN;


-- ════════════════════════════════════════════════════════════
-- 1) gym_unlock_skill_node — promotion_status 참조 제거
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.gym_unlock_skill_node(
  p_member_id UUID,
  p_node_id   INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _caller_id      UUID := auth.uid();
  _caller         RECORD;
  _target         RECORD;
  _latest_node_id INTEGER;
BEGIN
  IF _caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT id, role, gym_name INTO _caller
    FROM public.users WHERE id = _caller_id;
  IF NOT FOUND OR _caller.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT id, role, gym_user_id, gym_name INTO _target
    FROM public.users WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member_not_found');
  END IF;
  IF _target.role NOT IN ('player_common', 'player_athlete') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_not_player');
  END IF;

  IF _caller.role = 'gym' THEN
    IF NOT (
      _target.gym_user_id = _caller_id
      OR (_target.gym_user_id IS NULL AND _target.gym_name = _caller.gym_name)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_same_gym');
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.skill_tree_nodes WHERE id = p_node_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_skill_unlocks
     WHERE user_id = p_member_id AND node_id = p_node_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_unlocked');
  END IF;

  -- 활성 스킬 차단
  IF EXISTS (
    SELECT 1
      FROM public.user_skill_unlocks u
      LEFT JOIN public.user_skill_node_progress p
        ON p.user_id = u.user_id AND p.node_id = u.node_id
     WHERE u.user_id = p_member_id
       AND COALESCE(p.exp_level, 0) < 5
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'active_skill_in_progress',
      'message', '회원이 진행 중인 스킬을 먼저 마스터해야 합니다.'
    );
  END IF;

  -- 가장 최근 마스터 노드 + 승단 신청 확인
  SELECT u.node_id INTO _latest_node_id
    FROM public.user_skill_unlocks u
   WHERE u.user_id = p_member_id
   ORDER BY u.unlocked_at DESC NULLS LAST
   LIMIT 1;

  IF _latest_node_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.skill_promotion_requests r
       WHERE r.user_id = p_member_id
         AND r.fork_node_id = _latest_node_id
         AND r.status IN ('pending', 'reviewing', 'approved')
    ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'promotion_required',
        'message', '승단 신청이 진행되어야 합니다.'
      );
    END IF;
  END IF;

  -- 해금 처리 (promotion_status 컬럼 제거)
  INSERT INTO public.user_skill_unlocks (user_id, node_id, unlocked_by, unlock_source)
  VALUES (p_member_id, p_node_id, _caller_id, 'gym');

  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (p_member_id, p_node_id, 0)
  ON CONFLICT (user_id, node_id) DO UPDATE
    SET exp_level = COALESCE(user_skill_node_progress.exp_level, 0);

  INSERT INTO public.skill_unlock_logs (target_user_id, gym_user_id, node_id, action)
  VALUES (p_member_id, _caller_id, p_node_id, 'unlock');

  RETURN jsonb_build_object('ok', true, 'node_id', p_node_id, 'action', 'unlock');
END;
$$;
GRANT EXECUTE ON FUNCTION public.gym_unlock_skill_node(UUID, INTEGER) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 2) gym_skip_skill_node — promotion_status 참조 제거
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.gym_skip_skill_node(
  p_member_id UUID,
  p_node_id   INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _caller_id      UUID := auth.uid();
  _caller         RECORD;
  _target         RECORD;
  _already_unlocked BOOLEAN;
  _latest_node_id INTEGER;
BEGIN
  IF _caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT id, role, gym_name INTO _caller
    FROM public.users WHERE id = _caller_id;
  IF NOT FOUND OR _caller.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT id, role, gym_user_id, gym_name INTO _target
    FROM public.users WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member_not_found');
  END IF;
  IF _target.role NOT IN ('player_common', 'player_athlete') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_not_player');
  END IF;

  IF _caller.role = 'gym' THEN
    IF NOT (
      _target.gym_user_id = _caller_id
      OR (_target.gym_user_id IS NULL AND _target.gym_name = _caller.gym_name)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_same_gym');
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.skill_tree_nodes WHERE id = p_node_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_skill_node_progress
     WHERE user_id = p_member_id AND node_id = p_node_id AND exp_level >= 5
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_mastered');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_skill_unlocks
     WHERE user_id = p_member_id AND node_id = p_node_id
  ) INTO _already_unlocked;

  -- 활성 스킬 (스킵 대상 제외) 차단
  IF EXISTS (
    SELECT 1
      FROM public.user_skill_unlocks u
      LEFT JOIN public.user_skill_node_progress p
        ON p.user_id = u.user_id AND p.node_id = u.node_id
     WHERE u.user_id = p_member_id
       AND u.node_id <> p_node_id
       AND COALESCE(p.exp_level, 0) < 5
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'active_skill_in_progress',
      'message', '회원이 진행 중인 다른 스킬을 먼저 마스터해야 합니다.'
    );
  END IF;

  -- 미해금이면 승단 신청 검증
  IF NOT _already_unlocked THEN
    SELECT u.node_id INTO _latest_node_id
      FROM public.user_skill_unlocks u
     WHERE u.user_id = p_member_id
     ORDER BY u.unlocked_at DESC NULLS LAST
     LIMIT 1;

    IF _latest_node_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.skill_promotion_requests r
         WHERE r.user_id = p_member_id
           AND r.fork_node_id = _latest_node_id
           AND r.status IN ('pending', 'reviewing', 'approved')
      ) THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'promotion_required',
          'message', '승단 신청이 진행되어야 합니다.'
        );
      END IF;
    END IF;

    INSERT INTO public.user_skill_unlocks (user_id, node_id, unlocked_by, unlock_source)
    VALUES (p_member_id, p_node_id, _caller_id, 'skip');
  END IF;

  -- 마스터 처리 (promotion_status 제거)
  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level, is_skipped)
  VALUES (p_member_id, p_node_id, 5, TRUE)
  ON CONFLICT (user_id, node_id) DO UPDATE
    SET exp_level  = 5,
        is_skipped = TRUE,
        updated_at = NOW();

  INSERT INTO public.skill_unlock_logs (target_user_id, gym_user_id, node_id, action)
  VALUES (p_member_id, _caller_id, p_node_id, 'skip');

  RETURN jsonb_build_object('ok', true, 'node_id', p_node_id, 'action', 'skip');
END;
$$;
GRANT EXECUTE ON FUNCTION public.gym_skip_skill_node(UUID, INTEGER) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 3) record_daily_attendance — promotion_status 참조 제거
-- ════════════════════════════════════════════════════════════
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
  _new_sp INTEGER;
  _active_node_id INTEGER;
  _active_node_name TEXT;
  _new_exp INTEGER;
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
    SELECT COALESCE(skill_points, 0) INTO _new_sp
      FROM public.users WHERE id = _uid;
    RETURN jsonb_build_object(
      'ok', true,
      'already_checked', true,
      'attendance_date', _today,
      'current_streak', COALESCE(_new_streak, 0),
      'total_attendance', COALESCE(_new_total, 0),
      'skill_points', _new_sp
    );
  END IF;

  SELECT u.node_id, n.name
    INTO _active_node_id, _active_node_name
    FROM public.user_skill_unlocks u
    JOIN public.skill_tree_nodes n ON n.id = u.node_id
    LEFT JOIN public.user_skill_node_progress p
      ON p.user_id = u.user_id AND p.node_id = u.node_id
   WHERE u.user_id = _uid
     AND COALESCE(p.exp_level, 0) < 5
   ORDER BY u.unlocked_at DESC NULLS LAST
   LIMIT 1;

  IF _active_node_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'no_active_skill',
      'message', '진행 중인 활성 스킬이 없습니다.' || E'\n' ||
                 '관장님께 다음 스킬 해금을 요청하거나, 마스터한 스킬의 승단 심사 신청을 진행해 주세요.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _yesterday
  ) INTO _y_attended;

  INSERT INTO public.attendance (user_id, attendance_date, check_in_time, sp_claimed)
  VALUES (_uid, _today, NOW(), TRUE);

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

  UPDATE public.users
     SET skill_points = COALESCE(skill_points, 0) + 1,
         updated_at = NOW()
   WHERE id = _uid
   RETURNING skill_points INTO _new_sp;

  -- 활성 노드 EXP +1 (promotion_status 컬럼 제거)
  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (_uid, _active_node_id, 1)
  ON CONFLICT (user_id, node_id) DO UPDATE SET
    exp_level = LEAST(5, COALESCE(public.user_skill_node_progress.exp_level, 0) + 1),
    updated_at = NOW()
  RETURNING exp_level INTO _new_exp;

  SELECT current_streak, total_attendance
    INTO _new_streak, _new_total
    FROM public.statistics WHERE user_id = _uid;

  RETURN jsonb_build_object(
    'ok', true,
    'already_checked', false,
    'attendance_date', _today,
    'current_streak', COALESCE(_new_streak, 0),
    'total_attendance', COALESCE(_new_total, 0),
    'skill_points', COALESCE(_new_sp, 0),
    'active_node_id', _active_node_id,
    'active_node_name', _active_node_name,
    'new_exp_level', COALESCE(_new_exp, 0),
    'mastered_now', COALESCE(_new_exp, 0) >= 5,
    'sp_added', 1
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_daily_attendance() TO authenticated;


-- 검증
DO $$
BEGIN
  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/73] ✅ 3개 함수 promotion_status 참조 제거 완료';
  RAISE NOTICE '  - gym_unlock_skill_node';
  RAISE NOTICE '  - gym_skip_skill_node';
  RAISE NOTICE '  - record_daily_attendance';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

COMMIT;

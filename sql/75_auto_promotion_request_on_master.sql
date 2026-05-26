-- ============================================================
-- sql/75 — 5/5 도달 시 자동 승단 신청 트리거
--
-- 기존 회원은 [★ 승단 심사 신청] 버튼을 직접 눌러야 신청됐음 (수동).
-- 새 기획: 5/5 도달 순간 시스템이 자동으로 신청 생성.
--
-- 변경 대상:
--   • record_daily_attendance — 출석으로 EXP 가 5/5 도달 시 → status='pending' INSERT
--   • gym_skip_skill_node     — 스킵으로 즉시 5/5 처리 시 → status='approved' INSERT
--                               (관장이 명시적으로 "이 스킬 끝났다" 결정한 것 ↔ 자동 승인)
--
-- 변경 없음:
--   • gym_unlock_skill_node   — 기존 검증(이전 노드 promotion 요청 존재)이 그대로 동작.
--                               회원이 5/5 도달 → 자동 pending 생성 → 관장이 다음 노드 unlock 가능.
--
-- 회원이 [★ 승단 심사 신청] 버튼을 직접 눌러도 기존 submit_master_exam_request 가
-- 중복 INSERT 를 차단하므로 호환됨.
--
-- 멱등 (CREATE OR REPLACE).
-- ⚠️ sql/73 위에 누적. Supabase SQL Editor 에서 실행.
-- ============================================================

BEGIN;


-- ════════════════════════════════════════════════════════════
-- 1) record_daily_attendance — 5/5 도달 시 자동 'pending' 신청
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
  _user_gym TEXT;
  _auto_promotion_created BOOLEAN := FALSE;
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

  -- 활성 노드 EXP +1
  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (_uid, _active_node_id, 1)
  ON CONFLICT (user_id, node_id) DO UPDATE SET
    exp_level = LEAST(5, COALESCE(public.user_skill_node_progress.exp_level, 0) + 1),
    updated_at = NOW()
  RETURNING exp_level INTO _new_exp;

  -- ★ 5/5 도달 시 자동 승단 신청 (pending)
  IF _new_exp = 5 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.skill_promotion_requests
       WHERE user_id = _uid
         AND fork_node_id = _active_node_id
         AND status IN ('pending', 'reviewing', 'approved')
    ) THEN
      SELECT btrim(gym_name) INTO _user_gym FROM public.users WHERE id = _uid;
      IF _user_gym IS NOT NULL AND _user_gym <> '' THEN
        INSERT INTO public.skill_promotion_requests (user_id, fork_node_id, gym_name, status)
        VALUES (_uid, _active_node_id, _user_gym, 'pending');
        _auto_promotion_created := TRUE;
      END IF;
    END IF;
  END IF;

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
    'auto_promotion_created', _auto_promotion_created,
    'sp_added', 1
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_daily_attendance() TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 2) gym_skip_skill_node — 스킵 시 자동 'approved' 신청
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
  _target_gym     TEXT;
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

  -- 마스터 처리
  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level, is_skipped)
  VALUES (p_member_id, p_node_id, 5, TRUE)
  ON CONFLICT (user_id, node_id) DO UPDATE
    SET exp_level  = 5,
        is_skipped = TRUE,
        updated_at = NOW();

  INSERT INTO public.skill_unlock_logs (target_user_id, gym_user_id, node_id, action)
  VALUES (p_member_id, _caller_id, p_node_id, 'skip');

  -- ★ 자동 승단 처리 (스킵 = 관장이 직접 마스터 결정 → 'approved')
  --   기존 pending/reviewing/rejected 가 있으면 approved 로 UPDATE
  --   기존 approved 가 있으면 그대로 (멱등)
  --   아무것도 없으면 새로 INSERT
  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = p_member_id
       AND fork_node_id = p_node_id
       AND status IN ('pending', 'reviewing', 'rejected')
  ) THEN
    UPDATE public.skill_promotion_requests
       SET status      = 'approved',
           resolved_at = NOW(),
           reviewer_id = _caller_id,
           notes       = COALESCE(notes, '관장 스킵으로 자동 승인')
     WHERE user_id = p_member_id
       AND fork_node_id = p_node_id
       AND status IN ('pending', 'reviewing', 'rejected');
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = p_member_id
       AND fork_node_id = p_node_id
       AND status = 'approved'
  ) THEN
    SELECT btrim(gym_name) INTO _target_gym FROM public.users WHERE id = p_member_id;
    IF _target_gym IS NULL OR _target_gym = '' THEN
      _target_gym := COALESCE(btrim(_caller.gym_name), '체육관 미지정');
    END IF;
    INSERT INTO public.skill_promotion_requests
      (user_id, fork_node_id, gym_name, status, resolved_at, reviewer_id, notes)
    VALUES
      (p_member_id, p_node_id, _target_gym, 'approved', NOW(), _caller_id, '관장 스킵으로 자동 승인');
  END IF;

  RETURN jsonb_build_object('ok', true, 'node_id', p_node_id, 'action', 'skip');
END;
$$;
GRANT EXECUTE ON FUNCTION public.gym_skip_skill_node(UUID, INTEGER) TO authenticated;


-- 검증
DO $$
BEGIN
  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/75] ✅ 자동 승단 신청 트리거 추가';
  RAISE NOTICE '  - record_daily_attendance: 5/5 도달 시 pending 자동 INSERT';
  RAISE NOTICE '  - gym_skip_skill_node    : 스킵 시 approved 자동 INSERT/UPDATE';
  RAISE NOTICE '  - gym_unlock_skill_node  : 변경 없음 (기존 검증 그대로)';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

COMMIT;

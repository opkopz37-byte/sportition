-- ============================================================
-- sql/78 — gym_skip_skill_node 에 승단 신청 자동 등록 옵션 추가
--
-- 변경:
--   p_create_promotion BOOLEAN DEFAULT TRUE 파라미터 추가
--   • TRUE  (기본): 기존 동작 — approved 자동 INSERT/UPDATE
--   • FALSE: 승단 신청 row 를 만들거나 수정하지 않음
--            → 회원은 해당 노드에서 멈춤 (다음 노드 진행하려면 별도 처리 필요)
--
-- 호환:
--   기존 2-arg 호출 (skill-skip API) 은 default 로 TRUE 가 채워져 기존 동작 유지.
--
-- ⚠️ Supabase SQL Editor 에서 실행. 동일 이름의 옛 시그니처 DROP 후 재생성.
-- ============================================================

BEGIN;

-- 시그니처 변경이므로 기존 함수 DROP (CREATE OR REPLACE 로는 인자 추가 불가)
DROP FUNCTION IF EXISTS public.gym_skip_skill_node(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.gym_skip_skill_node(UUID, INTEGER, BOOLEAN);

CREATE FUNCTION public.gym_skip_skill_node(
  p_member_id        UUID,
  p_node_id          INTEGER,
  p_create_promotion BOOLEAN DEFAULT TRUE
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _caller_id        UUID := auth.uid();
  _caller           RECORD;
  _target           RECORD;
  _already_unlocked BOOLEAN;
  _latest_node_id   INTEGER;
  _target_gym       TEXT;
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

  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level, is_skipped)
  VALUES (p_member_id, p_node_id, 5, TRUE)
  ON CONFLICT (user_id, node_id) DO UPDATE
    SET exp_level  = 5,
        is_skipped = TRUE,
        updated_at = NOW();

  INSERT INTO public.skill_unlock_logs (target_user_id, gym_user_id, node_id, action)
  VALUES (p_member_id, _caller_id, p_node_id, 'skip');

  -- ★ p_create_promotion=TRUE 일 때만 자동 승단 처리 (approved)
  IF p_create_promotion THEN
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
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'node_id', p_node_id,
    'action', 'skip',
    'promotion_created', p_create_promotion
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gym_skip_skill_node(UUID, INTEGER, BOOLEAN) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/78] ✅ gym_skip_skill_node 에 p_create_promotion 옵션 추가';
  RAISE NOTICE '  - TRUE  (기본): approved 자동 등록';
  RAISE NOTICE '  - FALSE: 승단 신청 미생성 (회원 진행 보류)';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

COMMIT;

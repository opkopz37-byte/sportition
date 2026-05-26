-- ============================================================
-- sql/76 — 관장이 회원 대신 승단 신청을 INSERT 하는 RPC
--
-- 기존 submit_master_exam_request 는 auth.uid() 기반이라 관장이
-- 회원 대신 호출할 수 없음. 본 함수는 SECURITY DEFINER + 같은 체육관
-- 검증으로 관장이 회원의 5/5 노드에 대해 pending 승단 신청을 생성.
--
-- 사용 케이스:
--   회원이 이전 노드 마스터했지만 승단 신청이 아직 없는 상태에서
--   관장이 다음 노드를 해금하려다 'promotion_required' 에러를 받았을 때,
--   "승단 신청부터 자동으로 진행" 모달에서 호출됨.
--
-- 멱등 (CREATE OR REPLACE).
-- ⚠️ Supabase SQL Editor 에서 실행.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.gym_submit_promotion_request_for_member(
  p_member_id UUID,
  p_node_id   INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _caller_id UUID := auth.uid();
  _caller    RECORD;
  _target    RECORD;
  _exp       INTEGER;
  _gym       TEXT;
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

  SELECT COALESCE(exp_level, 0) INTO _exp
    FROM public.user_skill_node_progress
   WHERE user_id = p_member_id AND node_id = p_node_id;
  IF NOT FOUND OR COALESCE(_exp, 0) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_mastered');
  END IF;

  -- 이미 처리 중/완료된 신청 있으면 그대로 ok (멱등)
  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = p_member_id
       AND fork_node_id = p_node_id
       AND status IN ('pending', 'reviewing', 'approved')
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_exists', true);
  END IF;

  -- 회원의 gym_name 사용 (관장과 같은 체육관임은 위에서 검증됨)
  SELECT btrim(gym_name) INTO _gym FROM public.users WHERE id = p_member_id;
  IF _gym IS NULL OR _gym = '' THEN
    _gym := COALESCE(btrim(_caller.gym_name), '체육관 미지정');
  END IF;

  INSERT INTO public.skill_promotion_requests (user_id, fork_node_id, gym_name, status)
  VALUES (p_member_id, p_node_id, _gym, 'pending');

  RETURN jsonb_build_object('ok', true, 'already_exists', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gym_submit_promotion_request_for_member(UUID, INTEGER) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/76] ✅ gym_submit_promotion_request_for_member 신설';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

COMMIT;

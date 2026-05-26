-- ============================================================
-- sql/79 — gym_skip_skill_node 의 자동 승단 등록을 'approved' → 'pending' 으로 변경
--
-- 기획 의도 (재정정):
--   기존 룰: 5/5 마스터 후 회원이 [승단 신청] → 관장이 오프라인 검증 후 승인
--            → 그제서야 다음 스킬 해금
--   관장이 스킵해도 이 검증 단계가 살아 있어야 함.
--   즉 스킵 = 즉시 5/5 마스터 처리는 맞지만, 승단까지 동시에 승인해버리면 안 됨.
--
--   sql/78 은 스킵 + 자동 등록 시 'approved' 로 처리 → 검증 단계 우회됨.
--   sql/79 에서 'pending' 으로 바꿔 관장이 승단 신청 페이지에서 검토 가능하게 함.
--
-- 변경:
--   • p_create_promotion=TRUE 인 경우의 INSERT/UPDATE 만 변경
--     - 이전: status='approved', resolved_at=NOW(), reviewer_id=관장
--     - 신규: status='pending' (대기 — 관장 추가 승인 필요)
--   • 기존에 'pending' / 'reviewing' / 'approved' / 'rejected' 어떤 row 라도 있으면 no-op
--     (중복 신청 방지 — submit_master_exam_request 와 동일한 멱등성)
--   • p_create_promotion=FALSE 인 경우는 변화 없음 (승단 row 미생성)
--
-- 시그니처 변경 없음 → CREATE OR REPLACE 로 충분.
-- ⚠️ Supabase SQL Editor 에서 실행. sql/78 위에 덮어쓰기.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.gym_skip_skill_node(
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
  _promotion_created BOOLEAN := FALSE;
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

  -- ★ p_create_promotion=TRUE 일 때만 자동 승단 신청 (pending — 관장 추가 승인 필요)
  --   기존에 어떤 status 든 row 가 있으면 no-op (멱등)
  IF p_create_promotion THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.skill_promotion_requests
       WHERE user_id = p_member_id
         AND fork_node_id = p_node_id
    ) THEN
      SELECT btrim(gym_name) INTO _target_gym FROM public.users WHERE id = p_member_id;
      IF _target_gym IS NULL OR _target_gym = '' THEN
        _target_gym := COALESCE(btrim(_caller.gym_name), '체육관 미지정');
      END IF;
      INSERT INTO public.skill_promotion_requests
        (user_id, fork_node_id, gym_name, status, notes)
      VALUES
        (p_member_id, p_node_id, _target_gym, 'pending', '관장 스킵 — 승단 신청 대기');
      _promotion_created := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'node_id', p_node_id,
    'action', 'skip',
    'promotion_created', _promotion_created
  );
END;
$$;


DO $$
BEGIN
  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/79] ✅ gym_skip_skill_node 의 자동 승단 등록을 pending 으로 변경';
  RAISE NOTICE '  - 스킵 + 자동 등록 → status=pending (관장 검토 대기)';
  RAISE NOTICE '  - 회원 다음 노드 진행은 관장이 승단 페이지에서 승인 후 가능';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

COMMIT;

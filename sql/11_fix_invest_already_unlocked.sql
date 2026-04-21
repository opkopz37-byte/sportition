-- ============================================================
-- 증상: 같은 노드 1/5만 찍은 뒤 2번째 투자 시 "이미 포인트를 쓴 노드" (already_unlocked)
-- 원인: invest_skill_node 가 예전 버전(비포크 1회만 허용)으로 남아 있는 경우
-- 조치: 아래 invest_skill_node 전체를 Supabase SQL Editor에서 실행 (08/10과 동일 본문)
-- ============================================================

CREATE OR REPLACE FUNCTION public.invest_skill_node(target_node_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cost int;
  n public.skill_tree_nodes%ROWTYPE;
  new_balance int;
  prog public.user_skill_node_progress%ROWTYPE;
  req int;
  pfail int;
  inv int;
  fork_has_prog boolean;
  new_inv int;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO n FROM public.skill_tree_nodes WHERE id = target_node_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  IF NOT public.skill_parents_satisfied(uid, n) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'parent_not_unlocked');
  END IF;

  cost := COALESCE(n.point_cost, 1);

  IF COALESCE(n.is_fork, false) THEN
    SELECT * INTO prog FROM public.user_skill_node_progress WHERE user_id = uid AND node_id = n.id;
    fork_has_prog := FOUND;
    IF fork_has_prog AND prog.promotion_status = 'passed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'fork_already_passed');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.skill_promotion_requests r
      WHERE r.user_id = uid AND r.fork_node_id = n.id AND r.status IN ('pending', 'reviewing')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'promotion_pending');
    END IF;

    IF fork_has_prog THEN
      pfail := COALESCE(prog.promotion_fail_count, 0);
      inv := COALESCE(prog.investment_count, 0);
    ELSE
      pfail := 0;
      inv := 0;
    END IF;

    IF pfail >= 5 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'fork_use_promotion_only');
    END IF;

    req := public.required_investments_for_fork(pfail);
    IF inv >= req AND req > 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'fork_submit_promotion');
    END IF;

    IF cost > 0 THEN
      UPDATE public.users SET skill_points = skill_points - cost WHERE id = uid AND skill_points >= cost RETURNING skill_points INTO new_balance;
      IF new_balance IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'insufficient_points');
      END IF;
    ELSE
      SELECT skill_points INTO new_balance FROM public.users WHERE id = uid;
    END IF;

    INSERT INTO public.user_skill_node_progress (user_id, node_id, investment_count, promotion_fail_count, promotion_status)
    VALUES (uid, n.id, 1, pfail, 'none')
    ON CONFLICT (user_id, node_id) DO UPDATE SET
      investment_count = user_skill_node_progress.investment_count + 1,
      updated_at = NOW();

    SELECT skill_points INTO new_balance FROM public.users WHERE id = uid;
    RETURN jsonb_build_object('ok', true, 'skill_points', COALESCE(new_balance, 0), 'investment_count', (SELECT investment_count FROM public.user_skill_node_progress WHERE user_id = uid AND node_id = n.id));
  END IF;

  INSERT INTO public.user_skill_node_progress (user_id, node_id, investment_count, promotion_status)
  SELECT u.user_id, u.node_id, 1, 'none'
  FROM public.user_skill_unlocks u
  WHERE u.user_id = uid AND u.node_id = n.id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_skill_node_progress p
      WHERE p.user_id = u.user_id AND p.node_id = u.node_id
    )
  ON CONFLICT DO NOTHING;

  SELECT investment_count INTO inv
  FROM public.user_skill_node_progress
  WHERE user_id = uid AND node_id = n.id;

  IF NOT FOUND OR inv IS NULL THEN
    inv := 0;
  END IF;

  IF inv >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_investments_reached');
  END IF;

  IF cost > 0 THEN
    UPDATE public.users SET skill_points = skill_points - cost WHERE id = uid AND skill_points >= cost RETURNING skill_points INTO new_balance;
    IF new_balance IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_points');
    END IF;
  ELSE
    SELECT skill_points INTO new_balance FROM public.users WHERE id = uid;
  END IF;

  INSERT INTO public.user_skill_node_progress (user_id, node_id, investment_count, promotion_status)
  VALUES (uid, n.id, 1, 'none')
  ON CONFLICT (user_id, node_id) DO UPDATE SET
    investment_count = user_skill_node_progress.investment_count + 1,
    updated_at = NOW();

  INSERT INTO public.user_skill_unlocks (user_id, node_id) VALUES (uid, n.id)
  ON CONFLICT DO NOTHING;

  SELECT investment_count INTO new_inv FROM public.user_skill_node_progress WHERE user_id = uid AND node_id = n.id;

  RETURN jsonb_build_object('ok', true, 'skill_points', COALESCE(new_balance, 0), 'investment_count', COALESCE(new_inv, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.invest_skill_node(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invest_skill_node(integer) TO authenticated;

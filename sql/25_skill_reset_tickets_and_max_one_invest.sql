-- ============================================================
-- 1) 모든 스킬 노드: 동일 노드당 투자(찍기) 최대 1회 (비포크)
-- 2) 갈림길: 필요 투자 횟수를 1회로 단순화 (실패 누적 규칙은 유지)
-- 3) users.skill_reset_tickets + reset_skill_tree_with_ticket() RPC
-- 적용: 07·08·10 이후 Supabase SQL Editor에서 1회 실행
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS skill_reset_tickets INTEGER NOT NULL DEFAULT 0 CHECK (skill_reset_tickets >= 0);

COMMENT ON COLUMN public.users.skill_reset_tickets IS '스킬 트리 초기화권(1장당 전체 초기화 1회)';

-- ---------------------------------------------------------------------------
-- 갈림길: 실패 n회마다 1회 투자 후 승단 신청 (기존 5*(n+1) → 1)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.required_investments_for_fork(p_fail_count integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_fail_count >= 5 THEN 0
    ELSE 1
  END;
$$;

-- ---------------------------------------------------------------------------
-- invest_skill_node: 비포크 최대 1회 / 포크는 위 req 사용
-- ---------------------------------------------------------------------------
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

  -- 비포크: 노드당 최대 1회 투자
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

  IF inv >= 1 THEN
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

-- ---------------------------------------------------------------------------
-- 스킬 트리 전체 초기화 (초기화권 1장 소모, 사용한 SP 환급)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_skill_tree_with_ticket()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prog_sum bigint;
  orphan_sum bigint;
  refund bigint;
  tickets int;
  new_sp bigint;
  new_tickets int;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT skill_reset_tickets INTO tickets FROM public.users WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_user');
  END IF;
  IF COALESCE(tickets, 0) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_reset_ticket');
  END IF;

  SELECT COALESCE(SUM(
    p.investment_count::bigint * COALESCE(n.point_cost, 1)::bigint
  ), 0) INTO prog_sum
  FROM public.user_skill_node_progress p
  INNER JOIN public.skill_tree_nodes n ON n.id = p.node_id
  WHERE p.user_id = uid;

  SELECT COALESCE(SUM(COALESCE(n.point_cost, 1)::bigint), 0) INTO orphan_sum
  FROM public.user_skill_unlocks u
  INNER JOIN public.skill_tree_nodes n ON n.id = u.node_id
  WHERE u.user_id = uid
    AND NOT COALESCE(n.is_fork, false)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_skill_node_progress p
      WHERE p.user_id = u.user_id AND p.node_id = u.node_id
    );

  refund := COALESCE(prog_sum, 0) + COALESCE(orphan_sum, 0);

  DELETE FROM public.skill_promotion_requests WHERE user_id = uid;
  DELETE FROM public.user_skill_unlocks WHERE user_id = uid;
  DELETE FROM public.user_skill_node_progress WHERE user_id = uid;

  UPDATE public.users
  SET skill_points = skill_points + refund,
      skill_reset_tickets = skill_reset_tickets - 1,
      updated_at = NOW()
  WHERE id = uid
  RETURNING skill_points, skill_reset_tickets INTO new_sp, new_tickets;

  RETURN jsonb_build_object(
    'ok', true,
    'skill_points', COALESCE(new_sp, 0),
    'skill_reset_tickets', COALESCE(new_tickets, 0),
    'refunded_points', refund
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_skill_tree_with_ticket() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_skill_tree_with_ticket() TO authenticated;

COMMENT ON FUNCTION public.reset_skill_tree_with_ticket() IS '스킬 해금·진행·승단 신청 삭제 + 사용 SP 환급, skill_reset_tickets 1 차감';

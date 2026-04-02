-- ============================================================
-- 갈림길(fork) 노드: 5회 투자 → 승단 신청 → 체육관 심사 → 분기 오픈
-- 실패 시 노드마다 실패 횟수 증가, 추가 5회씩 투자 필요 (최대 5회 실패 후에는 투자 없이 신청만)
-- 적용: Supabase SQL Editor에서 실행 (07_skill_points_tree.sql 이후)
-- ============================================================

ALTER TABLE public.skill_tree_nodes
  ADD COLUMN IF NOT EXISTS is_fork BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fork_branch_node_numbers INTEGER[];

COMMENT ON COLUMN public.skill_tree_nodes.is_fork IS '갈림길 노드: 승단 신청 대상';
COMMENT ON COLUMN public.skill_tree_nodes.fork_branch_node_numbers IS '관장이 선택할 분기 자식 node_number 배열 (보통 2개)';

-- 예시: 인파이터 분기 노드 10 → 11 또는 13
UPDATE public.skill_tree_nodes
SET is_fork = true,
    fork_branch_node_numbers = ARRAY[11, 13]
WHERE node_number = 10;

-- ---------------------------------------------------------------------------
-- 사용자별 노드 투자(찍기) 및 승단 실패 횟수
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_skill_node_progress (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES public.skill_tree_nodes(id) ON DELETE CASCADE,
  investment_count INTEGER NOT NULL DEFAULT 0 CHECK (investment_count >= 0),
  promotion_fail_count INTEGER NOT NULL DEFAULT 0 CHECK (promotion_fail_count >= 0 AND promotion_fail_count <= 5),
  promotion_status TEXT NOT NULL DEFAULT 'none' CHECK (promotion_status IN ('none', 'pending', 'passed')),
  chosen_branch_node_number INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_user_skill_node_progress_user ON public.user_skill_node_progress(user_id);

ALTER TABLE public.user_skill_node_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own skill node progress" ON public.user_skill_node_progress;
CREATE POLICY "Users read own skill node progress"
  ON public.user_skill_node_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 승단 신청 (회원의 gym_name 기준으로 체육관에 표시)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skill_promotion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  fork_node_id INTEGER NOT NULL REFERENCES public.skill_tree_nodes(id) ON DELETE CASCADE,
  gym_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_started_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  reviewer_id UUID REFERENCES public.users(id),
  chosen_child_node_id INTEGER REFERENCES public.skill_tree_nodes(id),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_skill_promotion_gym ON public.skill_promotion_requests(gym_name, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_promotion_user ON public.skill_promotion_requests(user_id);

ALTER TABLE public.skill_promotion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own promotion requests" ON public.skill_promotion_requests;
CREATE POLICY "Users read own promotion requests"
  ON public.skill_promotion_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Gym reads gym promotion requests" ON public.skill_promotion_requests;
CREATE POLICY "Gym reads gym promotion requests"
  ON public.skill_promotion_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('gym', 'admin')
        AND (
          u.role = 'admin'
          OR (u.gym_name IS NOT NULL AND u.gym_name = skill_promotion_requests.gym_name)
        )
    )
  );

-- 기존 unlock → progress 투자 1회로 백필
INSERT INTO public.user_skill_node_progress (user_id, node_id, investment_count, promotion_status)
SELECT u.user_id, u.node_id, 1, 'none'
FROM public.user_skill_unlocks u
ON CONFLICT (user_id, node_id) DO UPDATE SET investment_count = GREATEST(user_skill_node_progress.investment_count, 1);

-- ---------------------------------------------------------------------------
-- 필요 투자 횟수 (실패 n회: 5*(n+1), n<5 / n>=5 이면 신청만 가능(투자 0)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.required_investments_for_fork(p_fail_count integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_fail_count >= 5 THEN 0
    ELSE 5 * (p_fail_count + 1)
  END;
$$;

-- 부모 노드 통과 여부 (fork 부모는 passed + 분기 일치)
CREATE OR REPLACE FUNCTION public.skill_parents_satisfied(p_uid uuid, p_node public.skill_tree_nodes)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  pnum integer;
  pnode public.skill_tree_nodes;
  prog public.user_skill_node_progress%ROWTYPE;
BEGIN
  IF p_node.parent_nodes IS NULL OR array_length(p_node.parent_nodes, 1) IS NULL THEN
    RETURN true;
  END IF;

  FOREACH pnum IN ARRAY p_node.parent_nodes
  LOOP
    SELECT * INTO pnode FROM public.skill_tree_nodes WHERE node_number = pnum;
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    IF COALESCE(pnode.is_fork, false) THEN
      SELECT * INTO prog FROM public.user_skill_node_progress WHERE user_id = p_uid AND node_id = pnode.id;
      IF NOT FOUND THEN
        RETURN false;
      END IF;
      IF prog.promotion_status <> 'passed' THEN
        RETURN false;
      END IF;
      IF prog.chosen_branch_node_number IS DISTINCT FROM p_node.node_number THEN
        RETURN false;
      END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.user_skill_unlocks WHERE user_id = p_uid AND node_id = pnode.id) THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- invest_skill_node: 비포크 노드당 최대 5회 투자 / 포크는 승단용 투자 누적
-- (최신 정의는 sql/10_invest_max_five_non_fork.sql 과 동기화)
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

  -- 비포크: 동일 노드 최대 5회 투자
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

-- unlock_skill_node → 비포크만 (포크는 invest 사용)
CREATE OR REPLACE FUNCTION public.unlock_skill_node(target_node_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n public.skill_tree_nodes%ROWTYPE;
BEGIN
  SELECT * INTO n FROM public.skill_tree_nodes WHERE id = target_node_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;
  IF COALESCE(n.is_fork, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'use_invest_for_fork');
  END IF;
  RETURN public.invest_skill_node(target_node_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- submit_skill_promotion_request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_skill_promotion_request(fork_node_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  n public.skill_tree_nodes%ROWTYPE;
  prog public.user_skill_node_progress%ROWTYPE;
  req int;
  gname text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO n FROM public.skill_tree_nodes WHERE id = fork_node_id;
  IF NOT FOUND OR NOT COALESCE(n.is_fork, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_fork_node');
  END IF;

  SELECT * INTO prog FROM public.user_skill_node_progress WHERE user_id = uid AND node_id = n.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_progress');
  END IF;

  IF prog.promotion_status = 'passed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_passed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests r
    WHERE r.user_id = uid AND r.fork_node_id = n.id AND r.status IN ('pending', 'reviewing')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_pending');
  END IF;

  req := public.required_investments_for_fork(COALESCE(prog.promotion_fail_count, 0));
  IF prog.promotion_fail_count < 5 THEN
    IF COALESCE(prog.investment_count, 0) < req THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_investment', 'required', req, 'current', COALESCE(prog.investment_count, 0));
    END IF;
  END IF;

  SELECT gym_name INTO gname FROM public.users WHERE id = uid;
  IF gname IS NULL OR btrim(gname) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_gym_assigned');
  END IF;

  INSERT INTO public.skill_promotion_requests (user_id, fork_node_id, gym_name, status)
  VALUES (uid, n.id, btrim(gname), 'pending');

  UPDATE public.user_skill_node_progress SET promotion_status = 'pending', updated_at = NOW()
  WHERE user_id = uid AND node_id = n.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_skill_promotion_request(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_skill_promotion_request(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 체육관: 심사 시작 / 승인(분기 선택) / 거절
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gym_start_promotion_review(request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.skill_promotion_requests%ROWTYPE;
  gu public.users%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  SELECT * INTO gu FROM public.users WHERE id = uid;
  IF NOT FOUND OR gu.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO r FROM public.skill_promotion_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF gu.role <> 'admin' AND (gu.gym_name IS DISTINCT FROM r.gym_name) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_gym');
  END IF;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  UPDATE public.skill_promotion_requests
  SET status = 'reviewing', review_started_at = NOW(), reviewer_id = uid
  WHERE id = request_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gym_start_promotion_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gym_start_promotion_review(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.gym_resolve_promotion_request(uuid, boolean, integer);
CREATE OR REPLACE FUNCTION public.gym_resolve_promotion_request(request_id uuid, approved boolean, chosen_child_node_id integer, p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.skill_promotion_requests%ROWTYPE;
  gu public.users%ROWTYPE;
  fn public.skill_tree_nodes%ROWTYPE;
  ch public.skill_tree_nodes%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  SELECT * INTO gu FROM public.users WHERE id = uid;
  IF NOT FOUND OR gu.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO r FROM public.skill_promotion_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF gu.role <> 'admin' AND (gu.gym_name IS DISTINCT FROM r.gym_name) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_gym');
  END IF;
  IF r.status NOT IN ('pending', 'reviewing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT * INTO fn FROM public.skill_tree_nodes WHERE id = r.fork_node_id;

  IF approved THEN
    IF chosen_child_node_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'branch_required');
    END IF;
    SELECT * INTO ch FROM public.skill_tree_nodes WHERE id = chosen_child_node_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_branch');
    END IF;
    IF fn.fork_branch_node_numbers IS NULL OR NOT (ch.node_number = ANY(fn.fork_branch_node_numbers)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'branch_not_in_fork');
    END IF;

    INSERT INTO public.user_skill_unlocks (user_id, node_id) VALUES (r.user_id, ch.id)
    ON CONFLICT DO NOTHING;

    UPDATE public.user_skill_node_progress SET
      promotion_status = 'passed',
      chosen_branch_node_number = ch.node_number,
      updated_at = NOW()
    WHERE user_id = r.user_id AND node_id = fn.id;

    UPDATE public.skill_promotion_requests SET
      status = 'approved',
      resolved_at = NOW(),
      reviewer_id = uid,
      chosen_child_node_id = ch.id,
      notes = COALESCE(p_notes, notes)
    WHERE id = request_id;
  ELSE
    UPDATE public.user_skill_node_progress SET
      promotion_fail_count = LEAST(5, COALESCE(promotion_fail_count, 0) + 1),
      promotion_status = 'none',
      updated_at = NOW()
    WHERE user_id = r.user_id AND node_id = r.fork_node_id;

    UPDATE public.skill_promotion_requests SET
      status = 'rejected',
      resolved_at = NOW(),
      reviewer_id = uid,
      notes = p_notes
    WHERE id = request_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gym_resolve_promotion_request(uuid, boolean, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gym_resolve_promotion_request(uuid, boolean, integer, text) TO authenticated;

-- 이전 잘못된 시그니처 제거
DROP FUNCTION IF EXISTS public.gym_resolve_promotion_request(uuid, boolean, integer);

-- ---------------------------------------------------------------------------
-- 레거시: 포크 노드에 user_skill_unlocks 가 있으면 진행도로 옮긴 뒤 삭제
-- ---------------------------------------------------------------------------
INSERT INTO public.user_skill_node_progress (user_id, node_id, investment_count, promotion_fail_count, promotion_status)
SELECT u.user_id, u.node_id, 5, 0, 'none'
FROM public.user_skill_unlocks u
INNER JOIN public.skill_tree_nodes s ON s.id = u.node_id AND COALESCE(s.is_fork, false)
ON CONFLICT (user_id, node_id) DO UPDATE SET
  investment_count = GREATEST(user_skill_node_progress.investment_count, EXCLUDED.investment_count),
  updated_at = NOW();

DELETE FROM public.user_skill_unlocks u
USING public.skill_tree_nodes s
WHERE u.node_id = s.id AND COALESCE(s.is_fork, false);

-- ---------------------------------------------------------------------------
-- 이호진 회원 스킬 포인트·진행 초기화 (이름/닉네임/이메일 일치 시)
-- ---------------------------------------------------------------------------
UPDATE public.users u
SET skill_points = 100,
    updated_at = NOW()
WHERE u.name ILIKE '%이호진%'
   OR u.nickname ILIKE '%이호진%'
   OR u.email ILIKE '%ihojin%';

DELETE FROM public.user_skill_node_progress p
USING public.users u
WHERE p.user_id = u.id
  AND (u.name ILIKE '%이호진%' OR u.nickname ILIKE '%이호진%' OR u.email ILIKE '%ihojin%');

DELETE FROM public.user_skill_unlocks x
USING public.users u
WHERE x.user_id = u.id
  AND (u.name ILIKE '%이호진%' OR u.nickname ILIKE '%이호진%' OR u.email ILIKE '%ihojin%');

DELETE FROM public.skill_promotion_requests r
USING public.users u
WHERE r.user_id = u.id
  AND (u.name ILIKE '%이호진%' OR u.nickname ILIKE '%이호진%' OR u.email ILIKE '%ihojin%');

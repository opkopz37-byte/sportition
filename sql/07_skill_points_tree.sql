-- ============================================================
-- 스킬 포인트로 트리 노드에 투자(찍기) — 클라이언트는 "포인트 사용"으로 표시
-- (내부 테이블명 user_skill_unlocks / RPC unlock_skill_node 는 호환용으로 유지)
-- 적용: Supabase SQL Editor 또는 psql에서 한 번 실행
-- ============================================================

-- 노드별 필요 포인트 (기본 1, 루트만 0)
ALTER TABLE public.skill_tree_nodes
  ADD COLUMN IF NOT EXISTS point_cost INTEGER NOT NULL DEFAULT 1;

UPDATE public.skill_tree_nodes SET point_cost = 0 WHERE node_number = 1;

CREATE TABLE IF NOT EXISTS public.user_skill_unlocks (
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  node_id    INTEGER NOT NULL REFERENCES public.skill_tree_nodes(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_user_skill_unlocks_user ON public.user_skill_unlocks(user_id);

ALTER TABLE public.user_skill_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own skill unlocks" ON public.user_skill_unlocks;
CREATE POLICY "Users read own skill unlocks"
  ON public.user_skill_unlocks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE는 RPC로만 수행 (클라이언트 직접 쓰기 방지)

CREATE OR REPLACE FUNCTION public.unlock_skill_node(target_node_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cost int;
  node_record public.skill_tree_nodes%ROWTYPE;
  parent_num int;
  new_balance int;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO node_record FROM public.skill_tree_nodes WHERE id = target_node_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_skill_unlocks WHERE user_id = uid AND node_id = target_node_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_unlocked');
  END IF;

  cost := COALESCE(node_record.point_cost, 1);

  IF node_record.parent_nodes IS NOT NULL AND array_length(node_record.parent_nodes, 1) IS NOT NULL THEN
    FOREACH parent_num IN ARRAY node_record.parent_nodes
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.user_skill_unlocks u
        INNER JOIN public.skill_tree_nodes n ON n.id = u.node_id
        WHERE u.user_id = uid AND n.node_number = parent_num
      ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'parent_not_unlocked');
      END IF;
    END LOOP;
  END IF;

  IF cost > 0 THEN
    UPDATE public.users
    SET skill_points = skill_points - cost
    WHERE id = uid AND skill_points >= cost
    RETURNING skill_points INTO new_balance;

    IF new_balance IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_points');
    END IF;
  ELSE
    SELECT skill_points INTO new_balance FROM public.users WHERE id = uid;
  END IF;

  INSERT INTO public.user_skill_unlocks (user_id, node_id) VALUES (uid, target_node_id);

  RETURN jsonb_build_object('ok', true, 'skill_points', COALESCE(new_balance, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_skill_node(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_skill_node(integer) TO authenticated;

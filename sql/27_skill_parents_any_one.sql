-- ============================================================
-- 선행(parent_nodes)이 여러 개여도 그중 1개만 충족하면 다음 노드 투자 가능
-- (기존: 모든 선행 충족 필요 → 변경: OR)
-- 적용: 08·25 등 이후 Supabase SQL Editor에서 1회 실행
-- ============================================================

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
      CONTINUE;
    END IF;

    IF COALESCE(pnode.is_fork, false) THEN
      SELECT * INTO prog FROM public.user_skill_node_progress WHERE user_id = p_uid AND node_id = pnode.id;
      IF FOUND THEN
        IF prog.promotion_status = 'passed'
          AND prog.chosen_branch_node_number IS NOT DISTINCT FROM p_node.node_number
        THEN
          RETURN true;
        END IF;
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM public.user_skill_unlocks WHERE user_id = p_uid AND node_id = pnode.id) THEN
        RETURN true;
      END IF;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

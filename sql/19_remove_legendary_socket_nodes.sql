-- ============================================================
-- 전설 소켓 노드(node_number 100~109) 제거
-- skill_tree_nodes에 이미 들어 있는 경우 Supabase SQL Editor에서 1회 실행
-- (user_skill_unlocks / user_skill_node_progress 는 ON DELETE CASCADE)
-- ============================================================

BEGIN;

UPDATE public.user_cards
SET equipped_node_id = NULL,
    is_equipped = false
WHERE equipped_node_id IN (
  SELECT id FROM public.skill_tree_nodes WHERE node_number BETWEEN 100 AND 109
);

DELETE FROM public.skill_approval_queue
WHERE node_id IN (
  SELECT id FROM public.skill_tree_nodes WHERE node_number BETWEEN 100 AND 109
);

DELETE FROM public.skill_promotion_requests
WHERE fork_node_id IN (
  SELECT id FROM public.skill_tree_nodes WHERE node_number BETWEEN 100 AND 109
)
OR chosen_child_node_id IN (
  SELECT id FROM public.skill_tree_nodes WHERE node_number BETWEEN 100 AND 109
);

DELETE FROM public.skill_tree_nodes
WHERE node_number BETWEEN 100 AND 109;

COMMIT;

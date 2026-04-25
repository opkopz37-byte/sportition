-- ============================================================
-- skill_tree_nodes.style_tag 추가
--
-- 노드 카드 좌상단에 표시할 "스타일" 라벨용 컬럼.
-- 예) '카운터', '인파이트', '아웃복싱', '몸 공격' 등 8자 이내 짧은 태그
--
-- - NULL/빈 문자열이면 카드에 라벨이 표시되지 않음
-- - 화면 좌상단 배지로 렌더링 → 길면 truncate 됨 (8자 이내 권장)
--
-- ⚠️ Supabase SQL Editor 에 실행
-- ============================================================

ALTER TABLE public.skill_tree_nodes
  ADD COLUMN IF NOT EXISTS style_tag TEXT;

COMMENT ON COLUMN public.skill_tree_nodes.style_tag IS
  '카드 좌상단 배지 — 스킬 스타일 라벨 (8자 이내 권장, NULL/빈 문자열이면 미표시)';

-- ── 채우는 예시 ─────────────────────────────────────────
-- UPDATE public.skill_tree_nodes SET style_tag = '카운터'
--  WHERE node_number IN (12, 23, 41);
--
-- UPDATE public.skill_tree_nodes SET style_tag = '인파이트'
--  WHERE node_number IN (5, 17);
--
-- UPDATE public.skill_tree_nodes SET style_tag = '아웃복싱'
--  WHERE node_number IN (8, 19);

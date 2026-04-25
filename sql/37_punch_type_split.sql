-- ============================================================
-- punch_type 세분화: common → common_straight / common_hook / common_upper
--
-- 새로운 6단계 분류:
--   common_straight | common_hook | common_upper   (각 탭의 일반 스킬)
--   straight        | hook        | upper          (각 탭의 전문 스킬)
--
-- 진행 룰:
--   - 훅 탭 해금     ← common_straight 전부 마스터
--   - 어퍼 탭 해금   ← common_hook 전부 마스터
--
-- 마이그레이션:
--   - 기존 'common' (tutorial zone 노드) → 'common_straight'
--   - 'straight', 'hook', 'upper' 는 그대로 유지
--
-- ⚠️ 이후 common_hook / common_upper 노드는 SQL UPDATE 로 직접 분류해 주세요.
--    예시:
--      UPDATE public.skill_tree_nodes SET punch_type = 'common_hook'
--       WHERE node_number IN (...);
-- ============================================================

-- 1) 기존 체크 제약 제거
ALTER TABLE public.skill_tree_nodes
  DROP CONSTRAINT IF EXISTS skill_tree_nodes_punch_type_check;

-- 2) 데이터 마이그레이션 (제약 제거 후 안전하게)
UPDATE public.skill_tree_nodes
   SET punch_type = 'common_straight'
 WHERE punch_type = 'common';

-- 3) 새 체크 제약 등록 (6단계)
ALTER TABLE public.skill_tree_nodes
  ADD CONSTRAINT skill_tree_nodes_punch_type_check
  CHECK (punch_type IN (
    'common_straight', 'common_hook', 'common_upper',
    'straight',        'hook',        'upper'
  ));

COMMENT ON COLUMN public.skill_tree_nodes.punch_type IS
  '스킬 분류: common_straight/hook/upper (각 탭 일반) + straight/hook/upper (각 탭 전문)';

-- 4) 인덱스는 sql/32 에서 이미 만들어져 있으므로 유지
-- (idx_skill_tree_nodes_punch_type)

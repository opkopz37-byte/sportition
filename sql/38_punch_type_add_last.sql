-- ============================================================
-- punch_type 에 'last' 4번째 탭 추가
--
-- 새로운 8단계 분류 (이전 6단계 + 라스트):
--   common_straight | common_hook | common_upper | common_last  (각 탭 일반)
--   straight        | hook        | upper        | last         (각 탭 전문)
--
-- 진행 룰:
--   - 라스트 탭 해금 ← common_upper 전부 마스터
--
-- ⚠️ Supabase SQL Editor 에 실행
-- ============================================================

-- 기존 체크 제약 제거
ALTER TABLE public.skill_tree_nodes
  DROP CONSTRAINT IF EXISTS skill_tree_nodes_punch_type_check;

-- 새 체크 제약 (8단계)
ALTER TABLE public.skill_tree_nodes
  ADD CONSTRAINT skill_tree_nodes_punch_type_check
  CHECK (punch_type IN (
    'common_straight', 'common_hook', 'common_upper', 'common_last',
    'straight',        'hook',        'upper',        'last'
  ));

COMMENT ON COLUMN public.skill_tree_nodes.punch_type IS
  '스킬 분류 8단계: common_straight/hook/upper/last (각 탭 일반) + straight/hook/upper/last (각 탭 전문)';

-- ============================================================
-- 이후 'last' / 'common_last' 노드는 SQL UPDATE 로 직접 분류:
--   UPDATE public.skill_tree_nodes SET punch_type = 'common_last'
--    WHERE node_number IN (...);
--   UPDATE public.skill_tree_nodes SET punch_type = 'last'
--    WHERE node_number IN (...);
-- ============================================================

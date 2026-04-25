-- ============================================================
-- punch_type 'last' / 'common_last' → 'advanced' / 'common_advanced'
--
-- "라스트" 라는 명칭이 게임적이지 않아서 "심화(advanced)" 로 변경
-- ⚠️ Supabase SQL Editor 에 실행
-- ============================================================

-- 1) 기존 체크 제약 제거
ALTER TABLE public.skill_tree_nodes
  DROP CONSTRAINT IF EXISTS skill_tree_nodes_punch_type_check;

-- 2) 데이터 마이그레이션
UPDATE public.skill_tree_nodes
   SET punch_type = 'common_advanced'
 WHERE punch_type = 'common_last';

UPDATE public.skill_tree_nodes
   SET punch_type = 'advanced'
 WHERE punch_type = 'last';

-- 3) 새 체크 제약 등록 (8단계, last → advanced)
ALTER TABLE public.skill_tree_nodes
  ADD CONSTRAINT skill_tree_nodes_punch_type_check
  CHECK (punch_type IN (
    'common_straight', 'common_hook', 'common_upper', 'common_advanced',
    'straight',        'hook',        'upper',        'advanced'
  ));

COMMENT ON COLUMN public.skill_tree_nodes.punch_type IS
  '스킬 분류 8단계: common_straight/hook/upper/advanced (각 탭 일반) + straight/hook/upper/advanced (각 탭 전문)';

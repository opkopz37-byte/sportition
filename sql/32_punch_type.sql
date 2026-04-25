-- ============================================================
-- 스킬 트리 노드 주먹 타입 분류 (common / straight / hook / upper)
-- - 스킬 페이지에서 3개 탭(스트레이트·훅·어퍼) 필터용
-- - 'common' 은 모든 탭에 공통으로 표시 (튜토리얼/기본기 라인)
-- Supabase SQL Editor에서 한 번 실행하세요.
-- ============================================================

-- 1) 컬럼 추가
ALTER TABLE public.skill_tree_nodes
  ADD COLUMN IF NOT EXISTS punch_type TEXT
  CHECK (punch_type IN ('common', 'straight', 'hook', 'upper'));

COMMENT ON COLUMN public.skill_tree_nodes.punch_type IS
  '스킬 분류 탭: common(공용/모든 탭 표시) | straight | hook | upper';

-- 2) 기존 노드 자동 매핑
--    - 튜토리얼 존 → common (모든 탭에 공통 표시)
--    - 이름에 훅/hook 포함 → hook
--    - 이름에 어퍼/upper/uppercut 포함 → upper
--    - 그 외(잽·스트레이트·원투 등 포함) → straight
UPDATE public.skill_tree_nodes
SET punch_type = CASE
  WHEN zone = 'tutorial' THEN 'common'
  WHEN LOWER(COALESCE(name, '')) ~ '(훅|hook)' THEN 'hook'
  WHEN LOWER(COALESCE(name_en, '')) ~ 'hook' THEN 'hook'
  WHEN LOWER(COALESCE(name, '')) ~ '(어퍼|uppercut|upper)' THEN 'upper'
  WHEN LOWER(COALESCE(name_en, '')) ~ '(upper|uppercut)' THEN 'upper'
  ELSE 'straight'
END
WHERE punch_type IS NULL;

-- 3) 필터 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_skill_tree_nodes_punch_type
  ON public.skill_tree_nodes (punch_type);

-- 4) 공용(common) 노드 수평 배치 기본값
--    - position_y = 50 (가운데 수평 라인)
--    - position_x = 5 ~ 95 에 node_number 순서대로 균등 배치
--    - 이후 각 노드는 position_x/position_y 를 개별적으로 자유롭게 수정 가능
WITH ordered_common AS (
  SELECT id,
         ROW_NUMBER() OVER (
           ORDER BY
             CASE
               WHEN node_number = 421 THEN 10000
               WHEN node_number = 422 THEN 10001
               WHEN node_number = 423 THEN 10002
               ELSE node_number
             END
         ) - 1 AS ord,
         COUNT(*) OVER () AS total
  FROM public.skill_tree_nodes
  WHERE punch_type = 'common'
)
UPDATE public.skill_tree_nodes n
SET position_x = 5 + (o.ord * 90.0 / GREATEST(1, o.total - 1)),
    position_y = 50
FROM ordered_common o
WHERE n.id = o.id;

-- 참고: straight/hook/upper 노드의 position_x/position_y 는 건드리지 않습니다.
--       필요 시 Supabase 대시보드 → Table Editor 에서 각 노드의 좌표를 개별 편집하세요.
--       (x: 0~100, y: 0~100 권장 범위. 0=왼쪽/상단, 100=오른쪽/하단)

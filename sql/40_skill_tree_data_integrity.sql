-- ============================================================
-- skill_tree_nodes 데이터 무결성 진단 (읽기 전용)
--
-- ⚠️ Supabase SQL Editor 에서 각 쿼리를 따로 실행해
--    문제가 있는 행이 있는지 점검하세요.
--
-- "DB 에서 직접 추가했는데 노드가 안 보이거나, parent_nodes 를
--  채웠는데 연결선이 안 그려지는" 사례를 찾기 위한 도구입니다.
-- ============================================================

-- ── 1) punch_type 누락/이상치 ─────────────────────────────
-- 8단계 분류에 속하지 않는 노드 → straight 탭에 폴백 노출되지만
-- 탭 진행(마스터 카운트)에는 잡히지 않음
SELECT id, node_number, name, punch_type, zone, tier
  FROM public.skill_tree_nodes
 WHERE punch_type IS NULL
    OR punch_type NOT IN (
         'common_straight', 'common_hook', 'common_upper', 'common_advanced',
         'straight',        'hook',        'upper',        'advanced',
         'common'  -- 레거시
       )
 ORDER BY node_number;

-- ── 2) zone 누락 ──────────────────────────────────────────
-- zone(infighting/outboxing 등) 이 비어 있으면 컬러/라벨이 빠짐
SELECT id, node_number, name, punch_type, zone
  FROM public.skill_tree_nodes
 WHERE zone IS NULL OR zone = ''
 ORDER BY node_number;

-- ── 3) node_number 중복 ──────────────────────────────────
-- 같은 번호가 두 개면 parent_nodes 가 어느 노드를 가리키는지 모호해짐
SELECT node_number, COUNT(*) AS cnt
  FROM public.skill_tree_nodes
 GROUP BY node_number
HAVING COUNT(*) > 1
 ORDER BY node_number;

-- ── 4) parent_nodes 가 존재하지 않는 번호를 가리키는 경우 ──
-- 화면에서 "연결선이 안 그려지는" 가장 흔한 원인
WITH child AS (
  SELECT id, node_number, name, punch_type,
         unnest(parent_nodes) AS parent_num
    FROM public.skill_tree_nodes
   WHERE parent_nodes IS NOT NULL
     AND array_length(parent_nodes, 1) > 0
)
SELECT c.id, c.node_number, c.name, c.punch_type, c.parent_num
  FROM child c
  LEFT JOIN public.skill_tree_nodes p
         ON p.node_number = c.parent_num
 WHERE p.id IS NULL
 ORDER BY c.node_number;

-- ── 5) parent 와 child 의 punch_type 이 다른 경우 ─────────
-- 같은 탭 안에서만 연결되도록 데이터를 정렬하면 트리가 깔끔함
-- (의도된 cross-tab 연결이 있다면 무시)
SELECT c.node_number AS child_num, c.punch_type AS child_pt,
       p.node_number AS parent_num, p.punch_type AS parent_pt
  FROM public.skill_tree_nodes c,
       LATERAL unnest(c.parent_nodes) AS pn
  JOIN public.skill_tree_nodes p ON p.node_number = pn
 WHERE c.parent_nodes IS NOT NULL
   AND c.punch_type IS DISTINCT FROM p.punch_type
   -- common_X → X (같은 탭의 일반→전문) 은 정상이므로 제외
   AND NOT (
         (c.punch_type = 'straight' AND p.punch_type = 'common_straight')
      OR (c.punch_type = 'hook'     AND p.punch_type = 'common_hook')
      OR (c.punch_type = 'upper'    AND p.punch_type = 'common_upper')
      OR (c.punch_type = 'advanced' AND p.punch_type = 'common_advanced')
       )
 ORDER BY c.node_number;

-- ── 6) parent_nodes 자료형 점검 ───────────────────────────
-- INTEGER[] 컬럼이지만 혹시 모를 NULL element 검사
SELECT id, node_number, name, parent_nodes
  FROM public.skill_tree_nodes
 WHERE parent_nodes IS NOT NULL
   AND array_position(parent_nodes, NULL) IS NOT NULL;

-- ── 7) 자기 자신을 parent 로 지정한 경우 ──────────────────
SELECT id, node_number, name, parent_nodes
  FROM public.skill_tree_nodes
 WHERE node_number = ANY(parent_nodes);

-- ============================================================
-- 자동 보정 예시 (필요할 때만 주석 해제하고 실행)
-- ============================================================

-- punch_type 이 NULL 인 노드를 임시로 'common_straight' 로 채우기
-- UPDATE public.skill_tree_nodes
--    SET punch_type = 'common_straight'
--  WHERE punch_type IS NULL;

-- zone 이 NULL 인 노드를 'infighting' 으로 채우기
-- UPDATE public.skill_tree_nodes
--    SET zone = 'infighting'
--  WHERE zone IS NULL OR zone = '';

-- 존재하지 않는 parent_num 을 parent_nodes 에서 제거 (배열에서 빼기)
-- UPDATE public.skill_tree_nodes c
--    SET parent_nodes = ARRAY(
--          SELECT pn FROM unnest(c.parent_nodes) AS pn
--           WHERE EXISTS (
--             SELECT 1 FROM public.skill_tree_nodes p
--              WHERE p.node_number = pn
--           )
--        )
--  WHERE EXISTS (
--          SELECT 1 FROM unnest(c.parent_nodes) AS pn
--           WHERE NOT EXISTS (
--             SELECT 1 FROM public.skill_tree_nodes p
--              WHERE p.node_number = pn
--           )
--        );

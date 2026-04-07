-- ============================================================
-- 이미 20번 마이그레이션을 적용한 DB에만: 노드 4 분기 301~304 추가(멱등)
-- 06 시드 또는 20 전체 재실행으로 이미 들어간 경우 충돌 시 이름·부모만 갱신됩니다.
-- ============================================================

INSERT INTO public.skill_tree_nodes (node_number, name, name_en, zone, position_x, position_y, node_type, parent_nodes) VALUES
(301,'백스텝 롱 가드-앞손 블라인드','Backstep Long Guard Lead Hand Blind','outboxer',50,50,'basic',ARRAY[4]::INTEGER[]),
(302,'쓱 빡','Quick Snap','outboxer',50,50,'basic',ARRAY[4]::INTEGER[]),
(303,'흔들기(헤드 무브먼트)','Head Movement','infighter',50,50,'basic',ARRAY[4]::INTEGER[]),
(304,'풋 워킹','Footwork','infighter',50,50,'basic',ARRAY[4]::INTEGER[])
ON CONFLICT (node_number) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  zone = EXCLUDED.zone,
  position_x = EXCLUDED.position_x,
  position_y = EXCLUDED.position_y,
  node_type = EXCLUDED.node_type,
  parent_nodes = EXCLUDED.parent_nodes;

UPDATE public.skill_tree_nodes SET point_cost = 1 WHERE node_number IN (301, 302, 303, 304) AND (point_cost IS NULL OR point_cost < 0);

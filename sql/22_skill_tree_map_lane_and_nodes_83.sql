-- ============================================================
-- 목업 기준 총 83노드: map_lane(범례 색) + 노드 401~423 추가
-- 기존 DB: 컬럼 추가 후 노드 삽입·UPDATE. 신규 시드는 06 하단과 동일 내용.
-- (20번 마이그레이션 직후 실행 권장)
-- ============================================================

ALTER TABLE public.skill_tree_nodes ADD COLUMN IF NOT EXISTS map_lane TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skill_tree_nodes_map_lane_check'
  ) THEN
    ALTER TABLE public.skill_tree_nodes ADD CONSTRAINT skill_tree_nodes_map_lane_check
      CHECK (map_lane IS NULL OR map_lane IN ('common', 'c', 'g', 'a', 'ik', 'n', 'r', 't'));
  END IF;
END $$;

DELETE FROM public.skill_tree_nodes WHERE node_number BETWEEN 401 AND 423;

INSERT INTO public.skill_tree_nodes (node_number, name, name_en, zone, position_x, position_y, node_type, parent_nodes, map_lane) VALUES
(401,'백스텝 롱가드 심화','Backstep Long Guard Adv','outboxer',50,50,'basic',ARRAY[301]::INTEGER[],'c'),
(402,'사이드 스텝 우','Side Step Right','outboxer',50,50,'basic',ARRAY[301]::INTEGER[],'g'),
(403,'원투 쓱 빡','One-Two Quick Snap','outboxer',50,50,'basic',ARRAY[301]::INTEGER[],'g'),
(404,'빽 투 훅','Back Two Hook','outboxer',50,50,'basic',ARRAY[301]::INTEGER[],'ik'),
(405,'턴 훅','Turn Hook','outboxer',50,50,'basic',ARRAY[301]::INTEGER[],'c'),
(406,'쓱 빡 연계','Quick Snap Combo','outboxer',50,50,'basic',ARRAY[302]::INTEGER[],'g'),
(407,'찍고 돌리기','Step Pivot','outboxer',50,50,'basic',ARRAY[302]::INTEGER[],'c'),
(408,'동시에 빽+훅','Back and Hook Together','outboxer',50,50,'basic',ARRAY[302]::INTEGER[],'g'),
(409,'쓱 훅','Slip Hook','outboxer',50,50,'basic',ARRAY[302]::INTEGER[],'ik'),
(410,'백사이드 스텝 우','Backside Step Right','outboxer',50,50,'basic',ARRAY[302]::INTEGER[],'c'),
(411,'아래 위(뒷 손)','Low-High Rear Hand','infighter',50,50,'basic',ARRAY[303]::INTEGER[],'n'),
(412,'아래 위 원투','Low-High One-Two','infighter',50,50,'basic',ARRAY[303]::INTEGER[],'r'),
(413,'잽 롤','Jab Roll','infighter',50,50,'basic',ARRAY[303]::INTEGER[],'n'),
(414,'원투 롤','One-Two Roll','infighter',50,50,'basic',ARRAY[303]::INTEGER[],'r'),
(415,'더킹 훅','Ducking Hook','infighter',50,50,'basic',ARRAY[303]::INTEGER[],'n'),
(416,'위빙 훅','Weaving Hook','infighter',50,50,'basic',ARRAY[304]::INTEGER[],'r'),
(417,'투훅 뛰어 들어가기','Two-Hook Dash In','infighter',50,50,'basic',ARRAY[304]::INTEGER[],'n'),
(418,'더킹 어퍼(배) 훅','Ducking Upper Body Hook','infighter',50,50,'basic',ARRAY[304]::INTEGER[],'t'),
(419,'슬립 바디(앞 손)','Slip Body Lead','infighter',50,50,'basic',ARRAY[304]::INTEGER[],'a'),
(420,'걸어치기 슬립 바디','Walk-In Slip Body','infighter',50,50,'basic',ARRAY[304]::INTEGER[],'r'),
(421,'생활체육대회 준비','Amateur League Prep','tutorial',50,50,'basic',ARRAY[26]::INTEGER[],'common'),
(422,'생활체육대회 도전!','Amateur League Challenge','tutorial',50,50,'basic',ARRAY[421]::INTEGER[],'common'),
(423,'마스터 클로징 루틴','Master Closing Routine','tutorial',50,50,'basic',ARRAY[422]::INTEGER[],'common')
ON CONFLICT (node_number) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  zone = EXCLUDED.zone,
  position_x = EXCLUDED.position_x,
  position_y = EXCLUDED.position_y,
  node_type = EXCLUDED.node_type,
  parent_nodes = EXCLUDED.parent_nodes,
  map_lane = EXCLUDED.map_lane;

-- 범례 색 (기존 1~215, 301~304)
UPDATE public.skill_tree_nodes SET map_lane = 'common' WHERE node_number BETWEEN 1 AND 26;
UPDATE public.skill_tree_nodes SET map_lane = 'c' WHERE node_number = 301;
UPDATE public.skill_tree_nodes SET map_lane = 'g' WHERE node_number = 302;
UPDATE public.skill_tree_nodes SET map_lane = 'n' WHERE node_number = 303;
UPDATE public.skill_tree_nodes SET map_lane = 'r' WHERE node_number = 304;
UPDATE public.skill_tree_nodes SET map_lane = 'n' WHERE node_number = 101;
UPDATE public.skill_tree_nodes SET map_lane = 'ik' WHERE node_number = 102;
UPDATE public.skill_tree_nodes SET map_lane = 'n' WHERE node_number = 103;
UPDATE public.skill_tree_nodes SET map_lane = 'r' WHERE node_number = 104;
UPDATE public.skill_tree_nodes SET map_lane = 'n' WHERE node_number = 105;
UPDATE public.skill_tree_nodes SET map_lane = 'ik' WHERE node_number = 106;
UPDATE public.skill_tree_nodes SET map_lane = 'r' WHERE node_number = 107;
UPDATE public.skill_tree_nodes SET map_lane = 't' WHERE node_number = 108;
UPDATE public.skill_tree_nodes SET map_lane = 'n' WHERE node_number = 109;
UPDATE public.skill_tree_nodes SET map_lane = 't' WHERE node_number = 110;
UPDATE public.skill_tree_nodes SET map_lane = 'a' WHERE node_number = 111;
UPDATE public.skill_tree_nodes SET map_lane = 'ik' WHERE node_number = 112;
UPDATE public.skill_tree_nodes SET map_lane = 'r' WHERE node_number = 113;
UPDATE public.skill_tree_nodes SET map_lane = 't' WHERE node_number = 114;
UPDATE public.skill_tree_nodes SET map_lane = 'n' WHERE node_number = 115;
UPDATE public.skill_tree_nodes SET map_lane = 'c' WHERE node_number = 201;
UPDATE public.skill_tree_nodes SET map_lane = 'g' WHERE node_number = 202;
UPDATE public.skill_tree_nodes SET map_lane = 'c' WHERE node_number = 203;
UPDATE public.skill_tree_nodes SET map_lane = 'g' WHERE node_number = 204;
UPDATE public.skill_tree_nodes SET map_lane = 'ik' WHERE node_number = 205;
UPDATE public.skill_tree_nodes SET map_lane = 'c' WHERE node_number = 206;
UPDATE public.skill_tree_nodes SET map_lane = 'g' WHERE node_number = 207;
UPDATE public.skill_tree_nodes SET map_lane = 'ik' WHERE node_number = 208;
UPDATE public.skill_tree_nodes SET map_lane = 'c' WHERE node_number = 209;
UPDATE public.skill_tree_nodes SET map_lane = 'g' WHERE node_number = 210;
UPDATE public.skill_tree_nodes SET map_lane = 'ik' WHERE node_number = 211;
UPDATE public.skill_tree_nodes SET map_lane = 'c' WHERE node_number = 212;
UPDATE public.skill_tree_nodes SET map_lane = 'g' WHERE node_number = 213;
UPDATE public.skill_tree_nodes SET map_lane = 'ik' WHERE node_number = 214;
UPDATE public.skill_tree_nodes SET map_lane = 'c' WHERE node_number = 215;

UPDATE public.skill_tree_nodes SET point_cost = 1 WHERE node_number BETWEEN 401 AND 423 AND (point_cost IS NULL OR point_cost < 0);

-- ============================================================
-- 스킬 노드 83개 한 번에 확정 (upsert)
-- - 기존 06의 DO NOTHING과 달리, 충돌 시에도 이름·부모·map_lane·좌표·부제·마일스톤 덮어씀
-- - 목업: 중앙 수직 스파인 + 좌 아웃복싱 + 우 인파이팅 + 하단 마일스톤
-- - 좌우 얼라인: 아웃 x∈{18,22,26}, 인 x∈{74,78,82}, 벨트·파생은 동일 y행 스냅(논리 순서 불변)
-- - Supabase SQL Editor에서 1회 실행
-- - 적용 후: SELECT COUNT(*) FROM public.skill_tree_nodes; → 83
-- ============================================================

BEGIN;

ALTER TABLE public.skill_tree_nodes ADD COLUMN IF NOT EXISTS map_lane TEXT;
ALTER TABLE public.skill_tree_nodes ADD COLUMN IF NOT EXISTS map_subtitle TEXT;
ALTER TABLE public.skill_tree_nodes ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skill_tree_nodes_map_lane_check'
  ) THEN
    ALTER TABLE public.skill_tree_nodes ADD CONSTRAINT skill_tree_nodes_map_lane_check
      CHECK (map_lane IS NULL OR map_lane IN ('common', 'c', 'g', 'a', 'ik', 'n', 'r', 't'));
  END IF;
END $$;

INSERT INTO public.skill_tree_nodes (
  node_number, name, name_en, zone, position_x, position_y, node_type, parent_nodes, map_lane, map_subtitle, is_milestone
) VALUES
-- 중앙 스파인 (tutorial): y 5.5 ~ 64.25
(1,'잽','Jab','tutorial',50,5.5,'basic',ARRAY[]::INTEGER[],'common',NULL,false),
(2,'원투','One-Two','tutorial',50,7.85,'basic',ARRAY[1],'common',NULL,false),
(3,'잽빽 원투','Jab Back One-Two','tutorial',50,10.2,'basic',ARRAY[2],'common',NULL,false),
(4,'잽빽 원투원투','Jab Back One-Two One-Two','tutorial',50,12.55,'basic',ARRAY[3],'common',NULL,false),
(5,'잽 빽 위 아래','Jab Back High-Low','tutorial',50,14.9,'basic',ARRAY[4],'common',NULL,false),
(6,'잽 빽 위 아래 원투','Jab Back High-Low One-Two','tutorial',50,17.25,'basic',ARRAY[5],'common',NULL,false),
(7,'원투 훅','One-Two Hook','tutorial',50,19.6,'basic',ARRAY[6],'common',NULL,false),
(8,'잽 빽 원투 훅','Jab Back One-Two Hook','tutorial',50,21.95,'basic',ARRAY[7],'common',NULL,false),
(9,'원 훅','One Hook','tutorial',50,24.3,'basic',ARRAY[8],'common',NULL,false),
(10,'잽 빽 원훅','Jab Back One Hook','tutorial',50,26.65,'basic',ARRAY[9],'common',NULL,false),
(11,'원 양훅','One Double Hook','tutorial',50,29,'basic',ARRAY[10],'common',NULL,false),
(12,'잽 빽 원 양훅','Jab Back One Double Hook','tutorial',50,31.35,'basic',ARRAY[11],'common',NULL,false),
(13,'원 어퍼(배)','One Upper Body','tutorial',50,33.7,'basic',ARRAY[12],'common',NULL,false),
(14,'잽 빽 어퍼(배)','Jab Back Upper Body','tutorial',50,36.05,'basic',ARRAY[13],'common',NULL,false),
(15,'원 배 훅','One Body Hook','tutorial',50,38.4,'basic',ARRAY[14],'common',NULL,false),
(16,'원 양 어퍼(배)','One Double Upper Body','tutorial',50,40.75,'basic',ARRAY[15],'common',NULL,false),
(17,'투 어퍼(턱)','Two Upper Chin','tutorial',50,43.1,'basic',ARRAY[16],'common',NULL,false),
(18,'잽 빽 투 어퍼(턱)','Jab Back Two Upper Chin','tutorial',50,45.45,'basic',ARRAY[17],'common',NULL,false),
(19,'투 바디(앞 손)','Two Body Lead','tutorial',50,47.8,'basic',ARRAY[18],'common',NULL,false),
(20,'원 투 바디(앞 손)','One Two Body Lead','tutorial',50,50.15,'basic',ARRAY[19],'common',NULL,false),
(21,'잽 빽 투 바디(앞 손)','Jab Back Two Body Lead','tutorial',50,52.5,'basic',ARRAY[20],'common',NULL,false),
(22,'투 바디 더블 훅 (옆구리 이후 턱)','Two Body Double Hook Flank-Chin','tutorial',50,54.85,'basic',ARRAY[21],'common','옆구리 이후 턱',false),
(23,'잽 빽 투 바디 더블 훅 (옆구리 이후 턱)','Jab Back Two Body Double Hook','tutorial',50,57.2,'basic',ARRAY[22],'common','옆구리 이후 턱',false),
(24,'잽 빽 투 바디 더블 훅 (옆구리 이후 턱) 투','Jab Back Two Body Double Hook Two','tutorial',50,59.55,'basic',ARRAY[23],'common','옆구리 이후 턱',false),
(25,'양 어퍼(배) 양 훅','Double Upper Double Hook','tutorial',50,61.9,'basic',ARRAY[24],'common',NULL,true),
(26,'양 배 어퍼 훅-양 어퍼(배) 뒷 손 어퍼(턱) 훅(앞 손)','Double Body Upper Combo','tutorial',50,64.25,'basic',ARRAY[25],'common',NULL,false),
-- 갈림 (parent 4) — 한 행에 좌 2열 / 우 2열 정렬
(301,'백스텝 롱 가드-앞손 블라인드','Backstep Long Guard Lead Hand Blind','outboxer',20,14,'basic',ARRAY[4],'c',NULL,false),
(302,'쓱 빡','Quick Snap','outboxer',26,14,'basic',ARRAY[4],'g',NULL,false),
(303,'흔들기(헤드 무브먼트)','Head Movement','infighter',74,14,'basic',ARRAY[4],'n',NULL,false),
(304,'풋 워킹','Footwork','infighter',80,14,'basic',ARRAY[4],'r',NULL,false),
-- 인파이터 벨트 (parent 26) — 열 74·82, 행 48+4k (201~215과 같은 높이)
(101,'근력 강화','Strength Training','infighter',74,48,'basic',ARRAY[26],'n',NULL,false),
(102,'맷집 강화','Durability','infighter',82,48,'basic',ARRAY[101],'ik',NULL,false),
(103,'파워 펀치','Power Punch','infighter',74,52,'basic',ARRAY[102],'n',NULL,false),
(104,'체력 훈련','Stamina','infighter',82,52,'basic',ARRAY[101],'r',NULL,false),
(105,'폭발력','Explosive Power','infighter',74,56,'basic',ARRAY[104],'n',NULL,false),
(106,'확장 1','Expansion 1','infighter',82,56,'socket',ARRAY[101],'ik',NULL,false),
(107,'확장 2','Expansion 2','infighter',74,60,'socket',ARRAY[104],'r',NULL,false),
(108,'확장 3','Expansion 3','infighter',82,60,'socket',ARRAY[105],'t',NULL,false),
(109,'확장 4','Expansion 4','infighter',74,64,'socket',ARRAY[103],'n',NULL,false),
(110,'확장 5','Expansion 5','infighter',82,64,'socket',ARRAY[105],'t',NULL,false),
(111,'확장 6','Expansion 6','infighter',74,68,'socket',ARRAY[103],'a',NULL,false),
(112,'확장 7','Expansion 7','infighter',82,68,'socket',ARRAY[110],'ik',NULL,false),
(113,'확장 8','Expansion 8','infighter',74,72,'socket',ARRAY[111],'r',NULL,false),
(114,'확장 9','Expansion 9','infighter',82,72,'socket',ARRAY[112],'t',NULL,false),
(115,'확장 10','Expansion 10','infighter',78,76,'socket',ARRAY[113],'n',NULL,false),
-- 아웃복서 벨트 (parent 26) — 열 18·26, 인파이터와 동일 y행
(201,'스피드 훈련','Speed Training','outboxer',18,48,'basic',ARRAY[26],'c',NULL,false),
(202,'동체시력','Dynamic Vision','outboxer',26,48,'basic',ARRAY[201],'g',NULL,false),
(203,'반응속도','Reaction Speed','outboxer',18,52,'basic',ARRAY[202],'c',NULL,false),
(204,'민첩성','Agility','outboxer',26,52,'basic',ARRAY[201],'g',NULL,false),
(205,'유연성','Flexibility','outboxer',18,56,'basic',ARRAY[204],'ik',NULL,false),
(206,'확장 11','Expansion 11','outboxer',26,56,'socket',ARRAY[201],'c',NULL,false),
(207,'확장 12','Expansion 12','outboxer',18,60,'socket',ARRAY[204],'g',NULL,false),
(208,'확장 13','Expansion 13','outboxer',26,60,'socket',ARRAY[205],'ik',NULL,false),
(209,'확장 14','Expansion 14','outboxer',18,64,'socket',ARRAY[203],'c',NULL,false),
(210,'확장 15','Expansion 15','outboxer',26,64,'socket',ARRAY[205],'g',NULL,false),
(211,'확장 16','Expansion 16','outboxer',18,68,'socket',ARRAY[203],'ik',NULL,false),
(212,'확장 17','Expansion 17','outboxer',26,68,'socket',ARRAY[210],'c',NULL,false),
(213,'확장 18','Expansion 18','outboxer',18,72,'socket',ARRAY[211],'g',NULL,false),
(214,'확장 19','Expansion 19','outboxer',26,72,'socket',ARRAY[212],'ik',NULL,false),
(215,'확장 20','Expansion 20','outboxer',22,76,'socket',ARRAY[213],'c',NULL,false),
-- 301 파생 — 좌 그리드 18·22, 행 22·26·30
(401,'백스텝 롱가드 심화','Backstep Long Guard Adv','outboxer',18,22,'basic',ARRAY[301],'c',NULL,false),
(402,'사이드 스텝 우','Side Step Right','outboxer',22,22,'basic',ARRAY[301],'g',NULL,false),
(403,'원투 쓱 빡','One-Two Quick Snap','outboxer',18,26,'basic',ARRAY[301],'g',NULL,false),
(404,'빽 투 훅','Back Two Hook','outboxer',22,26,'basic',ARRAY[301],'ik',NULL,false),
(405,'턴 훅','Turn Hook','outboxer',20,30,'basic',ARRAY[301],'c',NULL,false),
-- 302 파생 — 좌 그리드 16·20 (한 칸 바깥 열), 행 34·38·42
(406,'쓱 빡 연계','Quick Snap Combo','outboxer',16,34,'basic',ARRAY[302],'g',NULL,false),
(407,'찍고 돌리기','Step Pivot','outboxer',20,34,'basic',ARRAY[302],'c',NULL,false),
(408,'동시에 빽+훅','Back and Hook Together','outboxer',16,38,'basic',ARRAY[302],'g',NULL,false),
(409,'쓱 훅','Slip Hook','outboxer',20,38,'basic',ARRAY[302],'ik',NULL,false),
(410,'백사이드 스텝 우','Backside Step Right','outboxer',18,42,'basic',ARRAY[302],'c',NULL,false),
-- 303 파생 — 우 그리드 78·82 (301 블록과 거울)
(411,'아래 위(뒷 손)','Low-High Rear Hand','infighter',78,22,'basic',ARRAY[303],'n',NULL,false),
(412,'아래 위 원투','Low-High One-Two','infighter',82,22,'basic',ARRAY[303],'r',NULL,false),
(413,'잽 롤','Jab Roll','infighter',78,26,'basic',ARRAY[303],'n',NULL,false),
(414,'원투 롤','One-Two Roll','infighter',82,26,'basic',ARRAY[303],'r',NULL,false),
(415,'더킹 훅','Ducking Hook','infighter',80,30,'basic',ARRAY[303],'n',NULL,false),
-- 304 파생 — 우 그리드 80·84 (302 블록과 거울)
(416,'위빙 훅','Weaving Hook','infighter',80,34,'basic',ARRAY[304],'r',NULL,false),
(417,'투훅 뛰어 들어가기','Two-Hook Dash In','infighter',84,34,'basic',ARRAY[304],'n',NULL,false),
(418,'더킹 어퍼(배) 훅','Ducking Upper Body Hook','infighter',80,38,'basic',ARRAY[304],'t',NULL,false),
(419,'슬립 바디(앞 손)','Slip Body Lead','infighter',84,38,'basic',ARRAY[304],'a','앞 손',false),
(420,'걸어치기 슬립 바디','Walk-In Slip Body','infighter',82,42,'basic',ARRAY[304],'r','앞발 전진 뒷 손',false),
-- 하단 마일스톤 (벨트 y=76 아래)
(421,'생활체육대회 준비','Amateur League Prep','tutorial',50,80,'basic',ARRAY[26],'common',NULL,false),
(422,'생활체육대회 도전!','Amateur League Challenge','tutorial',50,84,'basic',ARRAY[421],'common',NULL,true),
(423,'마스터 클로징 루틴','Master Closing Routine','tutorial',50,88,'basic',ARRAY[422],'common',NULL,true)
ON CONFLICT (node_number) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  zone = EXCLUDED.zone,
  position_x = EXCLUDED.position_x,
  position_y = EXCLUDED.position_y,
  node_type = EXCLUDED.node_type,
  parent_nodes = EXCLUDED.parent_nodes,
  map_lane = EXCLUDED.map_lane,
  map_subtitle = EXCLUDED.map_subtitle,
  is_milestone = EXCLUDED.is_milestone;

UPDATE public.skill_tree_nodes
SET is_fork = true,
    fork_branch_node_numbers = ARRAY[102, 104]
WHERE node_number = 101;

UPDATE public.skill_tree_nodes SET point_cost = 0 WHERE node_number = 1;
UPDATE public.skill_tree_nodes
SET point_cost = 1
WHERE node_number > 1 AND (point_cost IS NULL OR point_cost < 0);

COMMIT;

-- 검증 (기대: 83)
-- SELECT COUNT(*) AS skill_nodes_total FROM public.skill_tree_nodes;

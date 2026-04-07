-- ============================================================
-- 기존 Supabase DB: 공통 기본기 1~26 직선 체인 + 노드 4 분기(301~304) + 인파이터 101~115 + 아웃복서 201~215 로 전환
-- (옛 번호 1~5 튜토리얼, 10~24 인파이터, 30~44 아웃복서 제거 후 재삽입)
-- 해당 node_id에 매달린 언락·진행 기록은 CASCADE로 삭제됩니다. 운영 DB는 백업 후 실행하세요.
-- 적용: SQL Editor에서 19_remove_legendary_socket_nodes.sql 이후 권장, 07 point_cost 적용된 DB
-- ============================================================

BEGIN;

UPDATE public.user_cards
SET equipped_node_id = NULL,
    is_equipped = false
WHERE equipped_node_id IN (
  SELECT id FROM public.skill_tree_nodes
  WHERE node_number BETWEEN 1 AND 44
     OR node_number BETWEEN 301 AND 304
     OR node_number BETWEEN 401 AND 423
);

DELETE FROM public.skill_approval_queue
WHERE node_id IN (SELECT id FROM public.skill_tree_nodes WHERE node_number BETWEEN 1 AND 44);

DELETE FROM public.skill_promotion_requests
WHERE fork_node_id IN (SELECT id FROM public.skill_tree_nodes WHERE node_number BETWEEN 1 AND 44)
   OR chosen_child_node_id IN (SELECT id FROM public.skill_tree_nodes WHERE node_number BETWEEN 1 AND 44);

DELETE FROM public.skill_tree_nodes
WHERE node_number BETWEEN 1 AND 5
   OR (node_number >= 10 AND node_number <= 44)
   OR node_number BETWEEN 101 AND 115
   OR node_number BETWEEN 201 AND 215
   OR node_number BETWEEN 301 AND 304
   OR node_number BETWEEN 401 AND 423;

INSERT INTO public.skill_tree_nodes (node_number, name, name_en, zone, position_x, position_y, node_type, parent_nodes) VALUES
(1,'잽','Jab','tutorial',50,50,'basic',ARRAY[]::INTEGER[]),
(2,'원투','One-Two','tutorial',50,50,'basic',ARRAY[1]),
(3,'잽빽 원투','Jab Back One-Two','tutorial',50,50,'basic',ARRAY[2]),
(4,'잽빽 원투원투','Jab Back One-Two One-Two','tutorial',50,50,'basic',ARRAY[3]),
(5,'잽 빽 위 아래','Jab Back High-Low','tutorial',50,50,'basic',ARRAY[4]),
(6,'잽 빽 위 아래 원투','Jab Back High-Low One-Two','tutorial',50,50,'basic',ARRAY[5]),
(7,'원투 훅','One-Two Hook','tutorial',50,50,'basic',ARRAY[6]),
(8,'잽 빽 원투 훅','Jab Back One-Two Hook','tutorial',50,50,'basic',ARRAY[7]),
(9,'원 훅','One Hook','tutorial',50,50,'basic',ARRAY[8]),
(10,'잽 빽 원훅','Jab Back One Hook','tutorial',50,50,'basic',ARRAY[9]),
(11,'원 양훅','One Double Hook','tutorial',50,50,'basic',ARRAY[10]),
(12,'잽 빽 원 양훅','Jab Back One Double Hook','tutorial',50,50,'basic',ARRAY[11]),
(13,'원 어퍼(배)','One Upper Body','tutorial',50,50,'basic',ARRAY[12]),
(14,'잽 빽 어퍼(배)','Jab Back Upper Body','tutorial',50,50,'basic',ARRAY[13]),
(15,'원 배 훅','One Body Hook','tutorial',50,50,'basic',ARRAY[14]),
(16,'원 양 어퍼(배)','One Double Upper Body','tutorial',50,50,'basic',ARRAY[15]),
(17,'투 어퍼(턱)','Two Upper Chin','tutorial',50,50,'basic',ARRAY[16]),
(18,'잽 빽 투 어퍼(턱)','Jab Back Two Upper Chin','tutorial',50,50,'basic',ARRAY[17]),
(19,'투 바디(앞 손)','Two Body Lead','tutorial',50,50,'basic',ARRAY[18]),
(20,'원 투 바디(앞 손)','One Two Body Lead','tutorial',50,50,'basic',ARRAY[19]),
(21,'잽 빽 투 바디(앞 손)','Jab Back Two Body Lead','tutorial',50,50,'basic',ARRAY[20]),
(22,'투 바디 더블 훅 (옆구리 이후 턱)','Two Body Double Hook Flank-Chin','tutorial',50,50,'basic',ARRAY[21]),
(23,'잽 빽 투 바디 더블 훅 (옆구리 이후 턱)','Jab Back Two Body Double Hook','tutorial',50,50,'basic',ARRAY[22]),
(24,'잽 빽 투 바디 더블 훅 (옆구리 이후 턱) 투','Jab Back Two Body Double Hook Two','tutorial',50,50,'basic',ARRAY[23]),
(25,'양 어퍼(배) 양 훅','Double Upper Double Hook','tutorial',50,50,'basic',ARRAY[24]),
(26,'양 배 어퍼 훅-양 어퍼(배) 뒷 손 어퍼(턱) 훅(앞 손)','Double Body Upper Combo','tutorial',50,50,'basic',ARRAY[25]),
(301,'백스텝 롱 가드-앞손 블라인드','Backstep Long Guard Lead Hand Blind','outboxer',50,50,'basic',ARRAY[4]),
(302,'쓱 빡','Quick Snap','outboxer',50,50,'basic',ARRAY[4]),
(303,'흔들기(헤드 무브먼트)','Head Movement','infighter',50,50,'basic',ARRAY[4]),
(304,'풋 워킹','Footwork','infighter',50,50,'basic',ARRAY[4]),
(101,'근력 강화','Strength Training','infighter',35,40,'basic',ARRAY[26]),
(102,'맷집 강화','Durability','infighter',30,35,'basic',ARRAY[101]),
(103,'파워 펀치','Power Punch','infighter',25,40,'basic',ARRAY[102]),
(104,'체력 훈련','Stamina','infighter',35,30,'basic',ARRAY[101]),
(105,'폭발력','Explosive Power','infighter',30,25,'basic',ARRAY[104]),
(106,'확장 1','Expansion 1','infighter',40,35,'socket',ARRAY[101]),
(107,'확장 2','Expansion 2','infighter',38,30,'socket',ARRAY[104]),
(108,'확장 3','Expansion 3','infighter',33,28,'socket',ARRAY[105]),
(109,'확장 4','Expansion 4','infighter',28,30,'socket',ARRAY[103]),
(110,'확장 5','Expansion 5','infighter',25,25,'socket',ARRAY[105]),
(111,'확장 6','Expansion 6','infighter',20,30,'socket',ARRAY[103]),
(112,'확장 7','Expansion 7','infighter',23,20,'socket',ARRAY[110]),
(113,'확장 8','Expansion 8','infighter',18,25,'socket',ARRAY[111]),
(114,'확장 9','Expansion 9','infighter',15,20,'socket',ARRAY[112]),
(115,'확장 10','Expansion 10','infighter',12,25,'socket',ARRAY[113]),
(201,'스피드 훈련','Speed Training','outboxer',65,60,'basic',ARRAY[26]),
(202,'동체시력','Dynamic Vision','outboxer',70,65,'basic',ARRAY[201]),
(203,'반응속도','Reaction Speed','outboxer',75,60,'basic',ARRAY[202]),
(204,'민첩성','Agility','outboxer',65,70,'basic',ARRAY[201]),
(205,'유연성','Flexibility','outboxer',70,75,'basic',ARRAY[204]),
(206,'확장 11','Expansion 11','outboxer',60,65,'socket',ARRAY[201]),
(207,'확장 12','Expansion 12','outboxer',62,70,'socket',ARRAY[204]),
(208,'확장 13','Expansion 13','outboxer',67,72,'socket',ARRAY[205]),
(209,'확장 14','Expansion 14','outboxer',72,70,'socket',ARRAY[203]),
(210,'확장 15','Expansion 15','outboxer',75,75,'socket',ARRAY[205]),
(211,'확장 16','Expansion 16','outboxer',80,70,'socket',ARRAY[203]),
(212,'확장 17','Expansion 17','outboxer',77,78,'socket',ARRAY[210]),
(213,'확장 18','Expansion 18','outboxer',82,75,'socket',ARRAY[211]),
(214,'확장 19','Expansion 19','outboxer',85,80,'socket',ARRAY[212]),
(215,'확장 20','Expansion 20','outboxer',88,75,'socket',ARRAY[213]);

UPDATE public.skill_tree_nodes
SET is_fork = true,
    fork_branch_node_numbers = ARRAY[102, 104]
WHERE node_number = 101;

UPDATE public.skill_tree_nodes SET point_cost = 0 WHERE node_number = 1;
UPDATE public.skill_tree_nodes SET point_cost = 1 WHERE node_number > 1 AND (point_cost IS NULL OR point_cost < 0);

COMMIT;

-- map_lane 컬럼 및 노드 401~423·범례 색 UPDATE: sql/22_skill_tree_map_lane_and_nodes_83.sql 실행

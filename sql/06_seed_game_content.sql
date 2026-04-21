-- ============================================================
-- SPORTITION MVP3 GAME SEED DATA
-- Master boxers, cards, skill nodes, and collection rewards.
-- ============================================================

INSERT INTO public.skill_masters (id, name, name_en, nickname, description, animal_motif, style_type) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  '브루클린의 흑표범', 'Black Panther of Brooklyn', '흑표범',
  '압도적인 파워와 스피드로 상대를 제압하는 인파이터의 상징', '흑표범', 'infighter'
),
(
  '00000000-0000-0000-0000-000000000002',
  '나비의 춤', 'Dance of the Butterfly', '나비',
  '우아한 풋워크와 환상적인 스피드로 상대를 농락하는 아웃복서의 전설', '나비', 'outboxer'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.skill_cards (id, master_id, name, name_en, description, rarity, card_type, max_level) VALUES
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','기본 잽','Basic Jab','빠른 직선 펀치로 상대의 가드를 흔듭니다','normal','infighter',5),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','보디 블로우','Body Blow','상대의 복부를 강타하여 체력을 소진시킵니다','normal','infighter',5),
('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','더블 훅','Double Hook','좌우 훅을 연속으로 날립니다','normal','infighter',5),
('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','어퍼컷','Uppercut','턱을 노리는 강력한 상승 펀치','rare','infighter',5),
('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','스모더링','Smothering','상대에게 밀착하여 거리를 무력화시킵니다','rare','infighter',5),
('10000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','피크어부 블록','Peek-a-Boo Block','타이슨의 상징적인 방어 자세','rare','infighter',5),
('10000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','리핑 훅','Ripping Hook','간을 노리는 치명적인 훅 펀치','epic','infighter',5),
('10000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','개저링 스톰','Gazelle Storm','몸을 낮춘 상태에서 폭발적으로 올라오는 어퍼컷 콤보','epic','infighter',5),
('10000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001','스톤 피스트','Stone Fist','돌처럼 단단한 주먹으로 상대를 무너뜨립니다','epic','infighter',5),
('10000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','뎀프시 롤','Dempsey Roll','흑표범의 전설적인 8자 무한 콤보','legendary','infighter',5),
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','기본 스텝','Basic Step','가볍고 빠른 풋워크의 기초','normal','outboxer',5),
('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','사이드 스텝','Side Step','옆으로 빠르게 이동하여 펀치를 회피합니다','normal','outboxer',5),
('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','더블 잽','Double Jab','빠른 두 번의 잽으로 거리를 유지합니다','normal','outboxer',5),
('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','백스텝','Back Step','뒤로 물러나며 상대의 공격을 무력화','rare','outboxer',5),
('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','피봇 턴','Pivot Turn','축을 중심으로 회전하여 각도를 만듭니다','rare','outboxer',5),
('20000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002','플리커 잽','Flicker Jab','독특한 각도에서 날아오는 기습 잽','rare','outboxer',5),
('20000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','슬립 카운터','Slip Counter','헤드무브로 회피하며 즉시 반격','epic','outboxer',5),
('20000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000002','팬텀 스트레이트','Phantom Straight','보이지 않는 속도의 스트레이트','epic','outboxer',5),
('20000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000002','매트릭스 슬립','Matrix Slip','뒤로 젖히며 펀치를 완전히 회피','epic','outboxer',5),
('20000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','알리 셔플','Ali Shuffle','나비의 전설적인 환상 풋워크','legendary','outboxer',5)
ON CONFLICT (id) DO NOTHING;

-- 공통 기본기: 노드 1~26 직선 체인(엑셀 E열). 노드 4에서 301~304(아웃·인 예시 분기). 인파이터 101~115, 아웃복서 201~215(구 10~24, 30~44). 소켓 표기명은 확장 1~20.
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
(215,'확장 20','Expansion 20','outboxer',88,75,'socket',ARRAY[213])
ON CONFLICT (node_number) DO NOTHING;

-- 목업 합계 86노드: 401~426. 맵 좌표·콘텐츠 확정은 sql/skill_tree/SKILL_TREE_UNIFIED.sql 를 Supabase에서 1회 실행하세요.
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
(421,'생활체육대회 준비','Amateur League Prep','tutorial',50,66.6,'basic',ARRAY[26]::INTEGER[],'common'),
(422,'생활체육대회 도전!','Amateur League Challenge','tutorial',50,68.95,'basic',ARRAY[421]::INTEGER[],'common'),
(423,'마스터 클로징 루틴','Master Closing Routine','tutorial',50,71.3,'basic',ARRAY[422]::INTEGER[],'common'),
(424,'배잽','Body Jab','tutorial',50,50,'basic',ARRAY[1]::INTEGER[],'common'),
(425,'레벨 체인지 배잽(아웃복싱형)','Level Change Body Jab (Outboxer)','outboxer',50,50,'basic',ARRAY[424]::INTEGER[],'g'),
(426,'레벨 체인지 배잽(인파이팅형)','Level Change Body Jab (Infighting)','infighter',50,50,'basic',ARRAY[424]::INTEGER[],'n')
ON CONFLICT (node_number) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  zone = EXCLUDED.zone,
  position_x = EXCLUDED.position_x,
  position_y = EXCLUDED.position_y,
  node_type = EXCLUDED.node_type,
  parent_nodes = EXCLUDED.parent_nodes,
  map_lane = EXCLUDED.map_lane;

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

INSERT INTO public.collections (id, name, name_en, description, required_card_ids, reward_type, reward_data, display_order) VALUES
(
  '90000000-0000-0000-0000-000000000001',
  '흑표범의 분노', 'Black Panther''s Fury',
  '브루클린의 흑표범 마스터의 모든 스킬을 수집하세요',
  ARRAY[
    '10000000-0000-0000-0000-000000000001'::UUID,
    '10000000-0000-0000-0000-000000000002'::UUID,
    '10000000-0000-0000-0000-000000000003'::UUID,
    '10000000-0000-0000-0000-000000000004'::UUID,
    '10000000-0000-0000-0000-000000000005'::UUID,
    '10000000-0000-0000-0000-000000000006'::UUID,
    '10000000-0000-0000-0000-000000000007'::UUID,
    '10000000-0000-0000-0000-000000000008'::UUID,
    '10000000-0000-0000-0000-000000000009'::UUID,
    '10000000-0000-0000-0000-000000000010'::UUID
  ],
  'profile_border',
  '{"border_type": "lightning", "color": "blue", "animation": "pulse"}'::JSONB,
  1
),
(
  '90000000-0000-0000-0000-000000000002',
  '나비의 우아함', 'Butterfly''s Grace',
  '나비의 춤 마스터의 모든 스킬을 수집하세요',
  ARRAY[
    '20000000-0000-0000-0000-000000000001'::UUID,
    '20000000-0000-0000-0000-000000000002'::UUID,
    '20000000-0000-0000-0000-000000000003'::UUID,
    '20000000-0000-0000-0000-000000000004'::UUID,
    '20000000-0000-0000-0000-000000000005'::UUID,
    '20000000-0000-0000-0000-000000000006'::UUID,
    '20000000-0000-0000-0000-000000000007'::UUID,
    '20000000-0000-0000-0000-000000000008'::UUID,
    '20000000-0000-0000-0000-000000000009'::UUID,
    '20000000-0000-0000-0000-000000000010'::UUID
  ],
  'profile_border',
  '{"border_type": "butterfly", "color": "red", "animation": "float"}'::JSONB,
  2
)
ON CONFLICT (id) DO NOTHING;

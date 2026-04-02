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

INSERT INTO public.skill_tree_nodes (node_number, name, name_en, zone, position_x, position_y, node_type, parent_nodes) VALUES
(1,'기본 스탠스','Basic Stance','tutorial',50,50,'basic',ARRAY[]::INTEGER[]),
(2,'기본 잽','Basic Jab','tutorial',45,45,'basic',ARRAY[1]),
(3,'원투','One-Two','tutorial',55,45,'basic',ARRAY[2]),
(4,'가드 자세','Guard Position','tutorial',45,55,'basic',ARRAY[3]),
(5,'풋워크 기초','Basic Footwork','tutorial',55,55,'basic',ARRAY[4]),
(10,'근력 강화','Strength Training','infighter',35,40,'basic',ARRAY[5]),
(11,'맷집 강화','Durability','infighter',30,35,'basic',ARRAY[10]),
(12,'파워 펀치','Power Punch','infighter',25,40,'basic',ARRAY[11]),
(13,'체력 훈련','Stamina','infighter',35,30,'basic',ARRAY[10]),
(14,'폭발력','Explosive Power','infighter',30,25,'basic',ARRAY[13]),
(15,'히든 소켓 1','Hidden Socket 1','infighter',40,35,'socket',ARRAY[10]),
(16,'히든 소켓 2','Hidden Socket 2','infighter',38,30,'socket',ARRAY[13]),
(17,'히든 소켓 3','Hidden Socket 3','infighter',33,28,'socket',ARRAY[14]),
(18,'히든 소켓 4','Hidden Socket 4','infighter',28,30,'socket',ARRAY[12]),
(19,'히든 소켓 5','Hidden Socket 5','infighter',25,25,'socket',ARRAY[14]),
(20,'히든 소켓 6','Hidden Socket 6','infighter',20,30,'socket',ARRAY[12]),
(21,'히든 소켓 7','Hidden Socket 7','infighter',23,20,'socket',ARRAY[19]),
(22,'히든 소켓 8','Hidden Socket 8','infighter',18,25,'socket',ARRAY[20]),
(23,'히든 소켓 9','Hidden Socket 9','infighter',15,20,'socket',ARRAY[21]),
(24,'히든 소켓 10','Hidden Socket 10','infighter',12,25,'socket',ARRAY[22]),
(30,'스피드 훈련','Speed Training','outboxer',65,60,'basic',ARRAY[5]),
(31,'동체시력','Dynamic Vision','outboxer',70,65,'basic',ARRAY[30]),
(32,'반응속도','Reaction Speed','outboxer',75,60,'basic',ARRAY[31]),
(33,'민첩성','Agility','outboxer',65,70,'basic',ARRAY[30]),
(34,'유연성','Flexibility','outboxer',70,75,'basic',ARRAY[33]),
(35,'히든 소켓 11','Hidden Socket 11','outboxer',60,65,'socket',ARRAY[30]),
(36,'히든 소켓 12','Hidden Socket 12','outboxer',62,70,'socket',ARRAY[33]),
(37,'히든 소켓 13','Hidden Socket 13','outboxer',67,72,'socket',ARRAY[34]),
(38,'히든 소켓 14','Hidden Socket 14','outboxer',72,70,'socket',ARRAY[32]),
(39,'히든 소켓 15','Hidden Socket 15','outboxer',75,75,'socket',ARRAY[34]),
(40,'히든 소켓 16','Hidden Socket 16','outboxer',80,70,'socket',ARRAY[32]),
(41,'히든 소켓 17','Hidden Socket 17','outboxer',77,78,'socket',ARRAY[39]),
(42,'히든 소켓 18','Hidden Socket 18','outboxer',82,75,'socket',ARRAY[40]),
(43,'히든 소켓 19','Hidden Socket 19','outboxer',85,80,'socket',ARRAY[41]),
(44,'히든 소켓 20','Hidden Socket 20','outboxer',88,75,'socket',ARRAY[42]),
(100,'전설 소켓 1','Legendary Socket 1','legendary',42,42,'legendary_socket',ARRAY[10,30]),
(101,'전설 소켓 2','Legendary Socket 2','legendary',44,44,'legendary_socket',ARRAY[100]),
(102,'전설 소켓 3','Legendary Socket 3','legendary',46,46,'legendary_socket',ARRAY[101]),
(103,'전설 소켓 4','Legendary Socket 4','legendary',48,48,'legendary_socket',ARRAY[102]),
(104,'전설 소켓 5','Legendary Socket 5','legendary',50,50,'legendary_socket',ARRAY[103]),
(105,'전설 소켓 6','Legendary Socket 6','legendary',52,52,'legendary_socket',ARRAY[104]),
(106,'전설 소켓 7','Legendary Socket 7','legendary',54,54,'legendary_socket',ARRAY[105]),
(107,'전설 소켓 8','Legendary Socket 8','legendary',56,56,'legendary_socket',ARRAY[106]),
(108,'전설 소켓 9','Legendary Socket 9','legendary',58,58,'legendary_socket',ARRAY[107]),
(109,'전설 소켓 10','Legendary Socket 10','legendary',60,60,'legendary_socket',ARRAY[108])
ON CONFLICT (node_number) DO NOTHING;

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

-- ============================================================
-- 스킬 노드 단일 진실 소스 (90노드 + 콘텐츠 필드)
--
-- 노드 추가·수정·좌표·설명 변경은 이 파일만 편집한 뒤,
-- Supabase SQL Editor에서 본 파일 전체를 1회 실행하세요.
-- (18 / 23 / 24 는 스텁이며, 내용을 복제해 두지 않습니다.)
--
-- 적용 후: SELECT COUNT(*) FROM public.skill_tree_nodes;  -- 기대: 90
-- ============================================================

BEGIN;

-- ---------- 스키마 (맵·마일스톤)
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

-- ---------- 스키마 (상세 패널·맵 짧은 제목)
ALTER TABLE public.skill_tree_nodes
  ADD COLUMN IF NOT EXISTS display_title TEXT,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS training_intent TEXT,
  ADD COLUMN IF NOT EXISTS flow_summary TEXT;

COMMENT ON COLUMN public.skill_tree_nodes.display_title IS '중앙 스파인 노드창용 이름(기획 좌측 표기)';
COMMENT ON COLUMN public.skill_tree_nodes.source_name IS '원문·기술명(기획 우측 표기, 상세 원문명)';
COMMENT ON COLUMN public.skill_tree_nodes.description IS '스킬 이름: … / 설명: … 형식 권장';
COMMENT ON COLUMN public.skill_tree_nodes.training_intent IS '훈련 의도';
COMMENT ON COLUMN public.skill_tree_nodes.flow_summary IS '연결 흐름 한 줄(없으면 클라이언트에서 선행 체인 표시)';

-- ---------- 아웃복싱 / 인파이터 / 인파이터·아웃 별도 스킬
-- (연계선 parent_nodes·flow_summary·갈림길은 비튜토리얼 구역에서 비움 — 추후 재설정)
--
-- ---------- 노드 구조 — ON CONFLICT 로 기존 행 덮어씀
-- 루트 잽(1): parent_nodes 비움. 튜토리얼 스파인(2~26, 421~424): 선행 체인 유지. 비튜토리얼은 parent_nodes 비움.
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
(26,'양 배 어퍼 훅 + 양 어퍼(배) 뒷 손 어퍼(턱) 훅(앞 손)','Double Body Upper Combo','tutorial',50,64.25,'basic',ARRAY[25],'common',NULL,false),
-- 갈림 (좌·우) — 비튜토리얼: parent_nodes 비움 (맵 좌표만 유지)
(301,'백스텝 롱 가드-앞손 블라인드','Backstep Long Guard Lead Hand Blind','outboxer',20,14,'basic',ARRAY[]::INTEGER[],'c',NULL,false),
(302,'쓱 빽','Quick Snap Back','outboxer',18,19,'basic',ARRAY[]::INTEGER[],'g','리듬 교란 · 쓱 빽',false),
(303,'흔들기(헤드 무브먼트)','Head Movement','infighter',74,14,'basic',ARRAY[]::INTEGER[],'n',NULL,false),
(304,'풋 워킹','Footwork','infighter',80,14,'basic',ARRAY[]::INTEGER[],'r',NULL,false),
-- 인파이터 벨트
(101,'근력 강화','Strength Training','infighter',74,48,'basic',ARRAY[]::INTEGER[],'n',NULL,false),
(102,'맷집 강화','Durability','infighter',82,48,'basic',ARRAY[]::INTEGER[],'ik',NULL,false),
(103,'파워 펀치','Power Punch','infighter',74,52,'basic',ARRAY[]::INTEGER[],'n',NULL,false),
(104,'체력 훈련','Stamina','infighter',82,52,'basic',ARRAY[]::INTEGER[],'r',NULL,false),
(105,'폭발력','Explosive Power','infighter',74,56,'basic',ARRAY[]::INTEGER[],'n',NULL,false),
(106,'확장 1','Expansion 1','infighter',82,56,'socket',ARRAY[]::INTEGER[],'ik',NULL,false),
(107,'확장 2','Expansion 2','infighter',74,60,'socket',ARRAY[]::INTEGER[],'r',NULL,false),
(108,'확장 3','Expansion 3','infighter',82,60,'socket',ARRAY[]::INTEGER[],'t',NULL,false),
(109,'확장 4','Expansion 4','infighter',74,64,'socket',ARRAY[]::INTEGER[],'n',NULL,false),
(110,'확장 5','Expansion 5','infighter',82,64,'socket',ARRAY[]::INTEGER[],'t',NULL,false),
(111,'확장 6','Expansion 6','infighter',74,68,'socket',ARRAY[]::INTEGER[],'a',NULL,false),
(112,'확장 7','Expansion 7','infighter',82,68,'socket',ARRAY[]::INTEGER[],'ik',NULL,false),
(113,'확장 8','Expansion 8','infighter',74,72,'socket',ARRAY[]::INTEGER[],'r',NULL,false),
(114,'확장 9','Expansion 9','infighter',82,72,'socket',ARRAY[]::INTEGER[],'t',NULL,false),
(115,'확장 10','Expansion 10','infighter',78,76,'socket',ARRAY[]::INTEGER[],'n',NULL,false),
-- 아웃복서 벨트
(201,'스피드 훈련','Speed Training','outboxer',18,48,'basic',ARRAY[]::INTEGER[],'c',NULL,false),
(202,'동체시력','Dynamic Vision','outboxer',26,48,'basic',ARRAY[]::INTEGER[],'g',NULL,false),
(203,'반응속도','Reaction Speed','outboxer',18,52,'basic',ARRAY[]::INTEGER[],'c',NULL,false),
(204,'민첩성','Agility','outboxer',26,52,'basic',ARRAY[]::INTEGER[],'g',NULL,false),
(205,'유연성','Flexibility','outboxer',18,56,'basic',ARRAY[]::INTEGER[],'ik',NULL,false),
(206,'확장 11','Expansion 11','outboxer',26,56,'socket',ARRAY[]::INTEGER[],'c',NULL,false),
(207,'확장 12','Expansion 12','outboxer',18,60,'socket',ARRAY[]::INTEGER[],'g',NULL,false),
(208,'확장 13','Expansion 13','outboxer',26,60,'socket',ARRAY[]::INTEGER[],'ik',NULL,false),
(209,'확장 14','Expansion 14','outboxer',18,64,'socket',ARRAY[]::INTEGER[],'c',NULL,false),
(210,'확장 15','Expansion 15','outboxer',26,64,'socket',ARRAY[]::INTEGER[],'g',NULL,false),
(211,'확장 16','Expansion 16','outboxer',18,68,'socket',ARRAY[]::INTEGER[],'ik',NULL,false),
(212,'확장 17','Expansion 17','outboxer',26,68,'socket',ARRAY[]::INTEGER[],'c',NULL,false),
(213,'확장 18','Expansion 18','outboxer',18,72,'socket',ARRAY[]::INTEGER[],'g',NULL,false),
(214,'확장 19','Expansion 19','outboxer',26,72,'socket',ARRAY[]::INTEGER[],'ik',NULL,false),
(215,'확장 20','Expansion 20','outboxer',22,76,'socket',ARRAY[]::INTEGER[],'c',NULL,false),
-- 301 파생 — 좌 그리드 18·22, 행 22·26·30
(401,'백스텝 롱가드 심화','Backstep Long Guard Adv','outboxer',18,22,'basic',ARRAY[]::INTEGER[],'c',NULL,false),
(402,'사이드 스텝 우','Side Step Right','outboxer',22,22,'basic',ARRAY[]::INTEGER[],'g',NULL,false),
(403,'원투 쓱 빽','One-Two Quick Snap Back','outboxer',18,24,'basic',ARRAY[]::INTEGER[],'g','리듬 교란',false),
(404,'빽 투 훅','Back Two Hook','outboxer',22,26,'basic',ARRAY[]::INTEGER[],'ik',NULL,false),
(405,'턴 훅','Turn Hook','outboxer',20,30,'basic',ARRAY[]::INTEGER[],'c',NULL,false),
-- 302 파생 — 좌 그리드 16·20 (한 칸 바깥 열), 행 34·38·42
(406,'리듬 브레이크','Rhythm Break','outboxer',18,40,'basic',ARRAY[]::INTEGER[],'g','고급 리듬 · 쓱 빽(뒷 손)',false),
(407,'찍고 돌리기','Step Pivot','outboxer',22,34,'basic',ARRAY[]::INTEGER[],'c',NULL,false),
(408,'동시 타격','Simultaneous Strike','outboxer',18,36,'basic',ARRAY[]::INTEGER[],'g','타이밍 변형 · 동시에 빽+훅(뒷 손)',false),
(409,'슬립 훅','Slip Hook','outboxer',18,32,'basic',ARRAY[]::INTEGER[],'ik','타이밍 변형 · 쓱 훅(뒷 손)',false),
(410,'백사이드 스텝 우','Backside Step Right','outboxer',22,50,'basic',ARRAY[]::INTEGER[],'c',NULL,false),
-- 303 파생 — 우 그리드 78·82 (301 블록과 거울)
(411,'아래 위(뒷 손)','Low-High Rear Hand','infighter',78,22,'basic',ARRAY[]::INTEGER[],'n',NULL,false),
(412,'아래 위 원투','Low-High One-Two','infighter',82,22,'basic',ARRAY[]::INTEGER[],'r',NULL,false),
(413,'잽 롤','Jab Roll','infighter',78,26,'basic',ARRAY[]::INTEGER[],'n',NULL,false),
(414,'원투 롤','One-Two Roll','infighter',82,26,'basic',ARRAY[]::INTEGER[],'r',NULL,false),
(415,'더킹 훅','Ducking Hook','infighter',80,30,'basic',ARRAY[]::INTEGER[],'n',NULL,false),
-- 304 파생 — 우 그리드 80·84 (302 블록과 거울)
(416,'위빙 훅','Weaving Hook','infighter',80,34,'basic',ARRAY[]::INTEGER[],'r',NULL,false),
(417,'투훅 뛰어 들어가기','Two-Hook Dash In','infighter',84,34,'basic',ARRAY[]::INTEGER[],'n',NULL,false),
(418,'더킹 어퍼(배) 훅','Ducking Upper Body Hook','infighter',80,38,'basic',ARRAY[]::INTEGER[],'t',NULL,false),
(419,'슬립 바디(앞 손)','Slip Body Lead','infighter',84,38,'basic',ARRAY[]::INTEGER[],'a','앞 손',false),
(420,'걸어치기 슬립 바디','Walk-In Slip Body','infighter',82,42,'basic',ARRAY[]::INTEGER[],'r','앞발 전진 뒷 손',false),
-- 중앙 스파인 연속: 26 직후 (좌표는 맵에서 1~26과 동일 규칙으로 통합 배치; skills.js applyUnifiedCenterSpineY)
(421,'생활체육대회 준비','Amateur League Prep','tutorial',50,66.6,'basic',ARRAY[26],'common',NULL,false),
(422,'생활체육대회 도전!','Amateur League Challenge','tutorial',50,68.95,'basic',ARRAY[421],'common',NULL,true),
(423,'마스터 클로징 루틴','Master Closing Routine','tutorial',50,71.3,'basic',ARRAY[422],'common',NULL,true),
-- 잽 파생: 배잽 → 레벨 체인지 배잽(아웃/인파이) — SKILL_TREE_LEVEL_CHANGE_BODY_JAB.md
(424,'배잽','Body Jab','tutorial',46,6.4,'basic',ARRAY[1],'common','잽(기본) → 배잽(파생)',false),
(425,'레벨 체인지 배잽(아웃복싱형)','Level Change Body Jab (Outboxer)','outboxer',22,16,'basic',ARRAY[]::INTEGER[],'g','아래(배 앞손) → 위(투)',false),
(426,'레벨 체인지 배잽(인파이팅형)','Level Change Body Jab (Infighting)','infighter',78,16,'basic',ARRAY[]::INTEGER[],'n','아래 → 위(뒷손)',false),
(427,'백스텝 원투 쓱 빽','Backstep One-Two Quick Snap Back','outboxer',18,28,'basic',ARRAY[]::INTEGER[],'g','리듬 교란 · 잽 빽 원투 쓱 빽',false),
(428,'슬립 바디','Slip Body (Lead)','outboxer',18,44,'basic',ARRAY[]::INTEGER[],'g','카운터·바디 · 앞 손',false),
(429,'전진 슬립 바디','Walk-In Slip Body','outboxer',18,48,'basic',ARRAY[]::INTEGER[],'g','앞발 전진 · 뒷 손 바디',false),
(430,'슬립 더블 훅','Slip Double Hook','outboxer',18,52,'basic',ARRAY[]::INTEGER[],'g','앞 손 · 옆구리·턱',false)
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

-- 갈림길(연계) 비활성 — 추후 parent_nodes·fork 재설정 시 다시 켤 수 있음
UPDATE public.skill_tree_nodes
SET is_fork = false,
    fork_branch_node_numbers = NULL
WHERE node_number = 101;

UPDATE public.skill_tree_nodes SET point_cost = 0 WHERE node_number = 1;
UPDATE public.skill_tree_nodes
SET point_cost = 1
WHERE node_number > 1 AND (point_cost IS NULL OR point_cost < 0);

-- ---------- 콘텐츠: 중앙 스파인 1~26 (좌=노드창 display_title, 우=원문 source_name·name)
UPDATE public.skill_tree_nodes SET
  display_title = CASE node_number
    WHEN 1 THEN '잽' WHEN 2 THEN '원투' WHEN 3 THEN '백스텝 원투' WHEN 4 THEN '더블 원투' WHEN 5 THEN '레벨 체인지' WHEN 6 THEN '레벨 체인지 원투'
    WHEN 7 THEN '원투 훅' WHEN 8 THEN '백스텝 원투 훅' WHEN 9 THEN '원 훅' WHEN 10 THEN '백스텝 원 훅' WHEN 11 THEN '더블 훅' WHEN 12 THEN '백스텝 더블 훅'
    WHEN 13 THEN '바디 어퍼' WHEN 14 THEN '백스텝 바디 어퍼' WHEN 15 THEN '원 바디 훅' WHEN 16 THEN '더블 바디 어퍼' WHEN 17 THEN '턱 어퍼' WHEN 18 THEN '백스텝 턱 어퍼'
    WHEN 19 THEN '바디 스트레이트' WHEN 20 THEN '원투 바디' WHEN 21 THEN '백스텝 원투 바디' WHEN 22 THEN '더블 바디 훅' WHEN 23 THEN '백스텝 더블 바디 훅' WHEN 24 THEN '바디 더블 훅 투'
    WHEN 25 THEN '더블 어퍼 훅' WHEN 26 THEN '복합 연타' END,
  source_name = CASE node_number
    WHEN 1 THEN '잽' WHEN 2 THEN '원투' WHEN 3 THEN '잽빽 원투' WHEN 4 THEN '잽빽 원투원투' WHEN 5 THEN '잽 빽 위 아래' WHEN 6 THEN '잽 빽 위 아래 원투'
    WHEN 7 THEN '원투 훅' WHEN 8 THEN '잽 빽 원투 훅' WHEN 9 THEN '원 훅' WHEN 10 THEN '잽 빽 원훅' WHEN 11 THEN '원 양훅' WHEN 12 THEN '잽 빽 원 양훅'
    WHEN 13 THEN '원 어퍼(배)' WHEN 14 THEN '잽 빽 어퍼(배)' WHEN 15 THEN '원 배 훅' WHEN 16 THEN '원 양 어퍼(배)' WHEN 17 THEN '투 어퍼(턱)' WHEN 18 THEN '잽 빽 투 어퍼(턱)'
    WHEN 19 THEN '투 바디(앞 손)' WHEN 20 THEN '원 투 바디(앞 손)' WHEN 21 THEN '잽 빽 투 바디(앞 손)' WHEN 22 THEN '투 바디 더블 훅 (옆구리 이후 턱)' WHEN 23 THEN '잽 빽 투 바디 더블 훅 (옆구리 이후 턱)' WHEN 24 THEN '잽 빽 투 바디 더블 훅 (옆구리 이후 턱) 투'
    WHEN 25 THEN '양 어퍼(배) 양 훅' WHEN 26 THEN '양 배 어퍼 훅 + 양 어퍼(배) 뒷 손 어퍼(턱) 훅(앞 손)' END,
  map_subtitle = CASE node_number
    WHEN 1 THEN 'Tier 1 (기본)' WHEN 2 THEN 'Tier 1 (기본)' WHEN 3 THEN 'Tier 2 (기초 연계)' WHEN 4 THEN 'Tier 2 (기초 연계)' WHEN 5 THEN 'Tier 2 (기초 연계)' WHEN 6 THEN 'Tier 2 (기초 연계)'
    WHEN 7 THEN 'Tier 3 (훅 연계)' WHEN 8 THEN 'Tier 3 (훅 연계)' WHEN 9 THEN 'Tier 3 (훅 연계)' WHEN 10 THEN 'Tier 3 (훅 연계)' WHEN 11 THEN 'Tier 3 (훅 연계)' WHEN 12 THEN 'Tier 3 (훅 연계)'
    WHEN 13 THEN 'Tier 4 (어퍼 연계)' WHEN 14 THEN 'Tier 4 (어퍼 연계)' WHEN 15 THEN 'Tier 4 (어퍼 연계)' WHEN 16 THEN 'Tier 4 (어퍼 연계)' WHEN 17 THEN 'Tier 4 (어퍼 연계)' WHEN 18 THEN 'Tier 4 (어퍼 연계)'
    WHEN 19 THEN 'Tier 5 (바디 & 복합 연계)' WHEN 20 THEN 'Tier 5 (바디 & 복합 연계)' WHEN 21 THEN 'Tier 5 (바디 & 복합 연계)' WHEN 22 THEN 'Tier 5 (바디 & 복합 연계)' WHEN 23 THEN 'Tier 5 (바디 & 복합 연계)' WHEN 24 THEN 'Tier 5 (바디 & 복합 연계)'
    WHEN 25 THEN 'Tier 6 (최종 연계)' WHEN 26 THEN 'Tier 6 (최종 연계) · 최종 목표: 피벗 및 스위칭 (관장님 지도)' END,
  description = CASE node_number
    WHEN 1 THEN E'스킬 이름: 잽\n설명: 잽'
    WHEN 2 THEN E'스킬 이름: 원투\n설명: 원투'
    WHEN 3 THEN E'스킬 이름: 백스텝 원투\n설명: 잽빽 원투'
    WHEN 4 THEN E'스킬 이름: 더블 원투\n설명: 잽빽 원투원투'
    WHEN 5 THEN E'스킬 이름: 레벨 체인지\n설명: 잽 빽 위 아래'
    WHEN 6 THEN E'스킬 이름: 레벨 체인지 원투\n설명: 잽 빽 위 아래 원투'
    WHEN 7 THEN E'스킬 이름: 원투 훅\n설명: 원투 훅'
    WHEN 8 THEN E'스킬 이름: 백스텝 원투 훅\n설명: 잽 빽 원투 훅'
    WHEN 9 THEN E'스킬 이름: 원 훅\n설명: 원 훅'
    WHEN 10 THEN E'스킬 이름: 백스텝 원 훅\n설명: 잽 빽 원훅'
    WHEN 11 THEN E'스킬 이름: 더블 훅\n설명: 원 양훅'
    WHEN 12 THEN E'스킬 이름: 백스텝 더블 훅\n설명: 잽 빽 원 양훅'
    WHEN 13 THEN E'스킬 이름: 바디 어퍼\n설명: 원 어퍼(배)'
    WHEN 14 THEN E'스킬 이름: 백스텝 바디 어퍼\n설명: 잽 빽 어퍼(배)'
    WHEN 15 THEN E'스킬 이름: 원 바디 훅\n설명: 원 배 훅'
    WHEN 16 THEN E'스킬 이름: 더블 바디 어퍼\n설명: 원 양 어퍼(배)'
    WHEN 17 THEN E'스킬 이름: 턱 어퍼\n설명: 투 어퍼(턱)'
    WHEN 18 THEN E'스킬 이름: 백스텝 턱 어퍼\n설명: 잽 빽 투 어퍼(턱)'
    WHEN 19 THEN E'스킬 이름: 바디 스트레이트\n설명: 투 바디(앞 손)'
    WHEN 20 THEN E'스킬 이름: 원투 바디\n설명: 원 투 바디(앞 손)'
    WHEN 21 THEN E'스킬 이름: 백스텝 원투 바디\n설명: 잽 빽 투 바디(앞 손)'
    WHEN 22 THEN E'스킬 이름: 더블 바디 훅\n설명: 투 바디 더블 훅 (옆구리 이후 턱)'
    WHEN 23 THEN E'스킬 이름: 백스텝 더블 바디 훅\n설명: 잽 빽 투 바디 더블 훅 (옆구리 이후 턱)'
    WHEN 24 THEN E'스킬 이름: 바디 더블 훅 투\n설명: 잽 빽 투 바디 더블 훅 (옆구리 이후 턱) 투'
    WHEN 25 THEN E'스킬 이름: 더블 어퍼 훅\n설명: 양 어퍼(배) 양 훅'
    WHEN 26 THEN E'스킬 이름: 복합 연타\n설명: 양 배 어퍼 훅 + 양 어퍼(배) 뒷 손 어퍼(턱) 훅(앞 손)\n\n최종 목표: 피벗 및 스위칭 (관장님 지도)' END,
  training_intent = CASE node_number
    WHEN 1 THEN 'Tier 1 (기본)' WHEN 2 THEN 'Tier 1 (기본)' WHEN 3 THEN 'Tier 2 (기초 연계)' WHEN 4 THEN 'Tier 2 (기초 연계)' WHEN 5 THEN 'Tier 2 (기초 연계)' WHEN 6 THEN 'Tier 2 (기초 연계)'
    WHEN 7 THEN 'Tier 3 (훅 연계)' WHEN 8 THEN 'Tier 3 (훅 연계)' WHEN 9 THEN 'Tier 3 (훅 연계)' WHEN 10 THEN 'Tier 3 (훅 연계)' WHEN 11 THEN 'Tier 3 (훅 연계)' WHEN 12 THEN 'Tier 3 (훅 연계)'
    WHEN 13 THEN 'Tier 4 (어퍼 연계)' WHEN 14 THEN 'Tier 4 (어퍼 연계)' WHEN 15 THEN 'Tier 4 (어퍼 연계)' WHEN 16 THEN 'Tier 4 (어퍼 연계)' WHEN 17 THEN 'Tier 4 (어퍼 연계)' WHEN 18 THEN 'Tier 4 (어퍼 연계)'
    WHEN 19 THEN 'Tier 5 (바디 & 복합 연계)' WHEN 20 THEN 'Tier 5 (바디 & 복합 연계)' WHEN 21 THEN 'Tier 5 (바디 & 복합 연계)' WHEN 22 THEN 'Tier 5 (바디 & 복합 연계)' WHEN 23 THEN 'Tier 5 (바디 & 복합 연계)' WHEN 24 THEN 'Tier 5 (바디 & 복합 연계)'
    WHEN 25 THEN 'Tier 6 (최종 연계)' WHEN 26 THEN 'Tier 6 (최종 연계)' END,
  flow_summary = CASE node_number
    WHEN 1 THEN NULL WHEN 2 THEN '잽 → 원투' ELSE '선행: 이전 단계 기본기 완료' END
WHERE node_number BETWEEN 1 AND 26 AND zone = 'tutorial';

UPDATE public.skill_tree_nodes SET
  display_title = '근력 강화',
  source_name = '근력 강화',
  description = '근접 교전을 지탱하는 힘·지구력 기반 훈련 항목입니다.',
  training_intent = '압박 스타일에 필요한 지속력과 파워 기반을 쌓습니다.',
  flow_summary = NULL
WHERE node_number = 101;

UPDATE public.skill_tree_nodes SET
  display_title = '스피드 훈련',
  source_name = '스피드 훈련',
  description = '거리 운영과 반응에 필요한 발·상체 속도를 다룹니다.',
  training_intent = '간격 싸움·카운터 타이밍의 기초 속도를 올립니다.',
  flow_summary = NULL
WHERE node_number = 201;

UPDATE public.skill_tree_nodes SET
  display_title = '백스텝 롱가드',
  source_name = '백스텝 롱 가드-앞손 블라인드',
  description = '거리를 벌리며 앞손으로 시야를 가리는 운영 쪽 응용입니다.',
  training_intent = '백스텝·롱가드에서 다음 연계로 이어지는 리듬을 익힙니다.',
  flow_summary = NULL
WHERE node_number = 301;

-- [A] 301 백스텝 롱가드 파생 (403은 [B]로 이동됨)
UPDATE public.skill_tree_nodes SET
  display_title = '백스텝 롱가드 심화',
  source_name = '백스텝 롱가드 심화',
  description = '롱가드·백스텝 자세에서 손·거리를 한 단계 세밀하게 다룹니다.',
  training_intent = '기본 롱가드에서 심화 리듬으로 이어집니다.',
  flow_summary = NULL
WHERE node_number = 401;

UPDATE public.skill_tree_nodes SET
  display_title = '사이드 스텝 우',
  source_name = '사이드 스텝 우',
  description = '우측 사이드 스텝으로 각도를 바꿉니다.',
  training_intent = '거리 유지하며 횡이동으로 상대 시선을 흐립니다.',
  flow_summary = NULL
WHERE node_number = 402;

UPDATE public.skill_tree_nodes SET
  display_title = '빽 투 훅',
  source_name = '빽 투 훅',
  description = '빽 스텝 후 투·훅으로 연결합니다.',
  training_intent = '후퇴 후 뒷손 훅 타이밍을 익힙니다.',
  flow_summary = NULL
WHERE node_number = 404;

UPDATE public.skill_tree_nodes SET
  display_title = '턴 훅',
  source_name = '턴 훅',
  description = '회전 축을 넣은 훅 연계입니다.',
  training_intent = '몸통 회전으로 훅 궤적을 숨깁니다.',
  flow_summary = NULL
WHERE node_number = 405;

UPDATE public.skill_tree_nodes SET
  display_title = '찍고 돌리기',
  source_name = '찍고 돌리기(스텝 피벗)',
  description = '쓱 빽 줄과 병렬: 발을 찍고 피벗으로 방향을 바꿉니다.',
  training_intent = '짧은 스텝으로 각도 전환을 만듭니다.',
  flow_summary = NULL
WHERE node_number = 407;

UPDATE public.skill_tree_nodes SET
  display_title = '백사이드 스텝 우',
  source_name = '백사이드 스텝 우',
  description = '쓱 빽 줄과 병렬: 백사이드로 우측 스텝을 빼며 거리를 유지합니다.',
  training_intent = '후퇴·횡이동을 섞어 상대 진입을 끊습니다.',
  flow_summary = NULL
WHERE node_number = 410;

UPDATE public.skill_tree_nodes SET
  display_title = '쓱 빽',
  source_name = '쓱 빽',
  description = '레벨 체인지 배잽(아웃) 이후, 쓱·빽으로 리듬을 끊는 아웃복싱 기본 리듬 교란입니다.',
  training_intent = '배잽·레벨 체인지에서 이어지는 짧은 스냅으로 상대 타이밍을 흔듭니다.',
  flow_summary = NULL
WHERE node_number = 302;

UPDATE public.skill_tree_nodes SET
  display_title = '원투 쓱 빽',
  source_name = '원투 쓱 빽',
  description = '원투에 쓱 빽을 얹은 리듬 교란 연계입니다.',
  training_intent = '원투 후 뒷손 스냅으로 연속 압박을 만듭니다.',
  flow_summary = NULL
WHERE node_number = 403;

UPDATE public.skill_tree_nodes SET
  display_title = '백스텝 원투 쓱 빽',
  source_name = '백스텝 원투 쓱 빽',
  description = '백스텝으로 거리를 벌린 뒤 잽 빽·원투·쓱 빽으로 이어지는 연계입니다.',
  training_intent = '후퇴 리듬 속에서도 동일 리듬 패턴을 유지합니다.',
  flow_summary = NULL
WHERE node_number = 427;

UPDATE public.skill_tree_nodes SET
  display_title = '슬립 훅',
  source_name = '쓱 훅(뒷 손)',
  description = '타이밍 변형: 슬립 후 뒷손 훅으로 반격합니다.',
  training_intent = '슬립 타이밍에서 훅 각도를 숨깁니다.',
  flow_summary = NULL
WHERE node_number = 409;

UPDATE public.skill_tree_nodes SET
  display_title = '동시 타격',
  source_name = '동시에 빽 + 훅(뒷 손)',
  description = '타이밍 변형: 빽과 훅을 동시에 겹쳐 타격합니다.',
  training_intent = '동시 축으로 상대 가드를 흔듭니다.',
  flow_summary = NULL
WHERE node_number = 408;

UPDATE public.skill_tree_nodes SET
  display_title = '리듬 브레이크',
  source_name = '쓱 빽(뒷 손)',
  description = '고급 리듬: 뒷손 쓱 빽으로 흐름을 끊습니다.',
  training_intent = '연속 공격 속에서 리듬 단절을 만듭니다.',
  flow_summary = NULL
WHERE node_number = 406;

UPDATE public.skill_tree_nodes SET
  display_title = '슬립 바디',
  source_name = '슬립 바디(앞 손)',
  description = '카운터·바디: 슬립로 들어가 앞손 바디를 넣습니다.',
  training_intent = '슬립 거리에서 바디 견제를 섞습니다.',
  flow_summary = NULL
WHERE node_number = 428;

UPDATE public.skill_tree_nodes SET
  display_title = '전진 슬립 바디',
  source_name = '걸어치기 슬립(앞발 전진) 바디(뒷 손)',
  description = '전진하며 슬립로 바디를 넣는 응용입니다.',
  training_intent = '앞발 전진으로 거리를 압축합니다.',
  flow_summary = NULL
WHERE node_number = 429;

UPDATE public.skill_tree_nodes SET
  display_title = '슬립 더블 훅',
  source_name = '슬립 더블 훅(앞 손) 옆구리·턱',
  description = '슬립에서 앞손 더블 훅으로 옆구리와 턱을 연결합니다.',
  training_intent = '짧은 거리에서 연속 훅을 완성합니다.',
  flow_summary = NULL
WHERE node_number = 430;

UPDATE public.skill_tree_nodes SET
  display_title = '흔들기',
  source_name = '흔들기(헤드 무브먼트)',
  description = '상체 흔들기로 타격선을 바꿉니다.',
  training_intent = '압박 속에서 헤드 무브로 생존·카운터 타이밍을 만듭니다.',
  flow_summary = NULL
WHERE node_number = 303;

UPDATE public.skill_tree_nodes SET
  display_title = '풋 워킹',
  source_name = '풋 워킹',
  description = '발밑 스텝으로 거리·각도를 조정합니다.',
  training_intent = '인파이트에서 밀고 들어가기 위한 발 기반을 다집니다.',
  flow_summary = NULL
WHERE node_number = 304;

UPDATE public.skill_tree_nodes SET
  display_title = '배잽',
  source_name = '배잽',
  description = '기본 잽에서 파생하는 하단 견제 스킬로, 레벨 체인지 배잽(아웃·인파이) 완성 스킬로 이어지는 공통 출발점입니다.',
  training_intent = '잽(기본) → 배잽(파생) → 아래·위 레벨 체인지로 이어지는 리듬을 익힙니다.',
  flow_summary = '잽 → 배잽'
WHERE node_number = 424;

UPDATE public.skill_tree_nodes SET
  display_title = 'Lv.체인지 배잽·아웃',
  source_name = '레벨 체인지 배잽 - 아웃복싱형',
  description = '배를 먼저 건드려 가드를 아래로 유도한 뒤, 상단 투로 연결하는 높이 변화형 연계. 거리 유지 상태에서 견제 후 상단 연결에 적합한 아웃복싱용 스킬.',
  training_intent = '하단 견제로 시선을 분산시킨 뒤 상단 투로 끊어 치는 거리 유지 리듬을 익힙니다.',
  flow_summary = NULL
WHERE node_number = 425;

UPDATE public.skill_tree_nodes SET
  display_title = 'Lv.체인지 배잽·인파이',
  source_name = '레벨 체인지 배잽 - 인파이팅형',
  description = '하단 타격 이후 바로 상단 뒷손으로 이어지는 압박형 연계. 근거리에서 짧고 강하게 연결하는 인파이팅용 스킬.',
  training_intent = '하단 반응 뒤 상단 뒷손으로 밀어붙이는 근접 압박 리듬을 익힙니다.',
  flow_summary = NULL
WHERE node_number = 426;

COMMIT;

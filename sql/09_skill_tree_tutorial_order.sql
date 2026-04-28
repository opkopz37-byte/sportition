-- ============================================================
-- 튜토리얼(공통 기본기) 1→26 직선 선행 + 인파이터(101)·아웃복서(201) 분기는 26 완료 후
-- (기존 DB에 옛 번호(10,30)가 남아 있으면 sql/20_skill_tree_tutorial_spine_migrate.sql 먼저 실행)
-- ============================================================

UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[1]::integer[] WHERE node_number = 2;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[2]::integer[] WHERE node_number = 3;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[3]::integer[] WHERE node_number = 4;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[4]::integer[] WHERE node_number = 5;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[5]::integer[] WHERE node_number = 6;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[6]::integer[] WHERE node_number = 7;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[7]::integer[] WHERE node_number = 8;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[8]::integer[] WHERE node_number = 9;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[9]::integer[] WHERE node_number = 10;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[10]::integer[] WHERE node_number = 11;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[11]::integer[] WHERE node_number = 12;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[12]::integer[] WHERE node_number = 13;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[13]::integer[] WHERE node_number = 14;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[14]::integer[] WHERE node_number = 15;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[15]::integer[] WHERE node_number = 16;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[16]::integer[] WHERE node_number = 17;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[17]::integer[] WHERE node_number = 18;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[18]::integer[] WHERE node_number = 19;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[19]::integer[] WHERE node_number = 20;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[20]::integer[] WHERE node_number = 21;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[21]::integer[] WHERE node_number = 22;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[22]::integer[] WHERE node_number = 23;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[23]::integer[] WHERE node_number = 24;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[24]::integer[] WHERE node_number = 25;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[25]::integer[] WHERE node_number = 26;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[26]::integer[] WHERE node_number IN (101, 201);
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[4]::integer[] WHERE node_number IN (301, 302, 303, 304);
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[26]::integer[] WHERE node_number = 421;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[421]::integer[] WHERE node_number = 422;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[422]::integer[] WHERE node_number = 423;

-- (제거됨) 테스트 편의용 100 SP 백필 — sql/51 의 일회성 정리에서 0 으로 reset.

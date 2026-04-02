-- ============================================================
-- 튜토리얼 순서 고정: 기본 잽 → 원투 → 가드 자세 → 풋워크 기초 (선행 1개씩)
-- 이후 인파이터(10)·아웃복서(30) 분기는 풋워크 기초(5) 완료 후에만 가능
-- (기존 DB에 이미 06 시드가 들어간 경우 UPDATE로 맞춤)
-- 적용: 07·08 이후, Supabase SQL Editor에서 실행
-- ============================================================

UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[1]::integer[] WHERE node_number = 2;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[2]::integer[] WHERE node_number = 3;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[3]::integer[] WHERE node_number = 4;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[4]::integer[] WHERE node_number = 5;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[5]::integer[] WHERE node_number = 10;
UPDATE public.skill_tree_nodes SET parent_nodes = ARRAY[5]::integer[] WHERE node_number = 30;

-- 이호진: 스킬 포인트 100, 진행 초기화 (08과 동일 조건, SP만 100)
UPDATE public.users u
SET skill_points = 100,
    updated_at = NOW()
WHERE u.name ILIKE '%이호진%'
   OR u.nickname ILIKE '%이호진%'
   OR u.email ILIKE '%ihojin%';

DELETE FROM public.user_skill_node_progress p
USING public.users u
WHERE p.user_id = u.id
  AND (u.name ILIKE '%이호진%' OR u.nickname ILIKE '%이호진%' OR u.email ILIKE '%ihojin%');

DELETE FROM public.user_skill_unlocks x
USING public.users u
WHERE x.user_id = u.id
  AND (u.name ILIKE '%이호진%' OR u.nickname ILIKE '%이호진%' OR u.email ILIKE '%ihojin%');

DELETE FROM public.skill_promotion_requests r
USING public.users u
WHERE r.user_id = u.id
  AND (u.name ILIKE '%이호진%' OR u.nickname ILIKE '%이호진%' OR u.email ILIKE '%ihojin%');

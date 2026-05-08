-- ============================================================
-- 티어 포인트 재계산 (점수 규칙 변경)
-- 변경 사항:
--   승리: +60 (동일)
--   무승부: +50 → +20
--   패배: +40 → -40
-- 최소 점수: 0
-- 날짜: 2026-05-08
-- ============================================================

-- 1. 백업 테이블 생성 (롤백용)
CREATE TABLE IF NOT EXISTS users_backup_20260508 AS
SELECT id, tier, tier_points, created_at, updated_at
FROM public.users;

CREATE TABLE IF NOT EXISTS statistics_backup_20260508 AS
SELECT * FROM public.statistics;

-- 2. 모든 유저의 tier_points 재계산
-- 공식: (승 × 60) + (무 × 20) + (패 × -40)
-- 최소값: 0
UPDATE public.users u
SET tier_points = GREATEST(0, 
  COALESCE(
    (s.wins * 60) + (s.draws * 20) + (s.losses * -40),
    0
  )
)
FROM public.statistics s
WHERE u.id = s.user_id;

-- 3. statistics가 없는 유저는 0점으로 설정
UPDATE public.users
SET tier_points = 0
WHERE id NOT IN (SELECT user_id FROM public.statistics);

-- 4. 결과 확인 쿼리 (주석 해제해서 실행)
-- SELECT 
--   COUNT(*) as total_users,
--   MIN(tier_points) as min_points,
--   MAX(tier_points) as max_points,
--   ROUND(AVG(tier_points), 2) as avg_points,
--   COUNT(*) FILTER (WHERE tier_points = 0) as zero_point_users
-- FROM public.users
-- WHERE role IN ('player_common', 'player_athlete');

-- 5. 롤백이 필요한 경우 (문제 발생 시):
-- UPDATE public.users u
-- SET tier = b.tier, tier_points = b.tier_points
-- FROM users_backup_20260508 b
-- WHERE u.id = b.id;

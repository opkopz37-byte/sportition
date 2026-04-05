-- ============================================================
-- 17: 공개 조회용 뷰 (security_invoker = false)
-- approval_queue_detailed / public_player_profiles 가 users RLS에
-- 막혀 빈 이름·빈 목록이 나오는 문제를 완화합니다.
-- Supabase SQL 에디터에서 한 번 실행하면 됩니다.
-- ============================================================

CREATE OR REPLACE VIEW public.approval_queue_detailed
WITH (security_invoker = false)
AS
SELECT
  saq.id,
  saq.user_id,
  saq.card_id,
  saq.node_id,
  saq.status,
  saq.requested_at,
  saq.approved_by,
  saq.approved_at,
  saq.rejection_reason,
  saq.notes,
  u.nickname AS user_nickname,
  u.name AS user_name,
  u.gym_name AS applicant_gym_name,
  u.gym_user_id AS applicant_gym_user_id,
  sc.name AS card_name,
  sc.rarity,
  stn.name AS node_name
FROM public.skill_approval_queue saq
JOIN public.users u ON saq.user_id = u.id
JOIN public.skill_cards sc ON saq.card_id = sc.id
LEFT JOIN public.skill_tree_nodes stn ON saq.node_id = stn.id
ORDER BY saq.requested_at DESC;

GRANT SELECT ON public.approval_queue_detailed TO authenticated;
REVOKE ALL ON public.approval_queue_detailed FROM anon;

CREATE OR REPLACE VIEW public.public_player_profiles
WITH (security_invoker = false)
AS
SELECT
  u.id,
  u.name,
  u.nickname,
  COALESCE(u.nickname, u.name) AS display_name,
  u.role,
  u.gender,
  u.height,
  u.weight,
  u.boxing_style,
  u.gym_name,
  u.tier,
  u.tier_points,
  tr.rank,
  tr.rank_change,
  s.total_matches,
  s.wins,
  s.losses,
  s.draws,
  s.ko_wins,
  s.current_win_streak,
  CASE
    WHEN COALESCE(s.total_matches, 0) = 0 THEN 0
    ELSE ROUND((s.wins::NUMERIC / s.total_matches::NUMERIC) * 100, 1)
  END AS win_rate,
  u.created_at
FROM public.users u
LEFT JOIN public.statistics s ON s.user_id = u.id
LEFT JOIN public.tier_rankings tr ON tr.user_id = u.id
WHERE u.role IN ('player_common', 'player_athlete', 'gym');

GRANT SELECT ON public.public_player_profiles TO authenticated;
REVOKE ALL ON public.public_player_profiles FROM anon;

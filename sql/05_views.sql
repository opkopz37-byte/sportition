-- ============================================================
-- SPORTITION MVP3 VIEWS
-- Public player/profile views and convenience joins.
-- ============================================================

DROP VIEW IF EXISTS public.skill_points_ranking;

CREATE OR REPLACE VIEW public.user_cards_detailed
WITH (security_invoker = true)
AS
SELECT
  uc.id,
  uc.user_id,
  uc.card_id,
  uc.level,
  uc.fragment_count,
  uc.is_equipped,
  uc.equipped_node_id,
  uc.obtained_at,
  sc.name AS card_name,
  sc.name_en AS card_name_en,
  sc.rarity,
  sc.card_type,
  sc.max_level,
  sc.image_url,
  sm.name AS master_name,
  sm.nickname AS master_nickname,
  sm.animal_motif
FROM public.user_cards uc
JOIN public.skill_cards sc ON uc.card_id = sc.id
LEFT JOIN public.skill_masters sm ON sc.master_id = sm.id;

GRANT SELECT ON public.user_cards_detailed TO authenticated;
REVOKE ALL ON public.user_cards_detailed FROM anon;

CREATE OR REPLACE VIEW public.approval_queue_detailed
WITH (security_invoker = true)
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
WHERE u.role IN ('player_common', 'player_athlete');

GRANT SELECT ON public.public_player_profiles TO authenticated;
REVOKE ALL ON public.public_player_profiles FROM anon;

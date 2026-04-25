-- ============================================================
-- public_player_profiles 뷰에 avatar_url 컬럼 추가
--
-- 기존: 뷰에 avatar_url 이 없어서 클라이언트가 users 테이블을 직접
-- 조회 → users.SELECT RLS 가 본인 외 행을 차단해 401/403 발생.
--
-- 수정: 공개 가능한 정보로서 avatar_url 을 뷰에 노출 → 추가 fetch 불필요.
--
-- ⚠️ Supabase SQL Editor 에 실행
-- ⚠️ sql/31_avatar_url_storage.sql 미적용 환경 대비 — users.avatar_url 컬럼 자동 보장
-- ============================================================

-- 0) avatar_url 컬럼 보장 (sql/31 미적용 환경 대비)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 1) 뷰 재정의
--    CREATE OR REPLACE VIEW 는 기존 컬럼 순서를 변경하지 못하므로
--    avatar_url 은 반드시 마지막에 추가 (기존 컬럼 순서 그대로 유지)
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
  u.created_at,
  u.avatar_url
FROM public.users u
LEFT JOIN public.statistics s ON s.user_id = u.id
LEFT JOIN public.tier_rankings tr ON tr.user_id = u.id
WHERE u.role IN ('player_common', 'player_athlete', 'gym');

GRANT SELECT ON public.public_player_profiles TO authenticated;
REVOKE ALL ON public.public_player_profiles FROM anon;
-- 비로그인 검색을 허용하려면 sql/29_anon_public_player_profiles_select.sql 재실행

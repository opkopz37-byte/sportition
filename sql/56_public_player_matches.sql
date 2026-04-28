-- ============================================================
-- 회원 프로필에서 다른 회원의 전적 보기 — public RPC
--
-- 문제: matches 테이블 RLS 가 'auth.uid() = user_id OR opponent_id' 만 SELECT 허용 →
--       회원 A 가 회원 B 의 프로필을 봐도 둘이 직접 한 매치만 보이고,
--       B 가 다른 회원 C 와 한 매치는 안 보임.
--       → 프로필 통계는 "3 전체 경기" 인데 전적 리스트는 비어있는 모순.
--
-- 해결: SECURITY DEFINER RPC 가 RLS 우회해서 본인 시점 전적을 한 번에 반환.
--       민감 정보 없음 (matches 테이블엔 user_id, opponent_id, result, method,
--       score, rounds, played_at 만) — 공개 안전.
--
-- ⚠️ Supabase SQL Editor 에 실행. matches / public_player_profiles 적용된 환경.
-- 멱등 (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_player_matches(
  p_user_id UUID,
  p_limit INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  opponent_id UUID,
  result TEXT,
  method TEXT,
  score TEXT,
  rounds INTEGER,
  played_at TIMESTAMPTZ,
  -- 상대 프로필 메타 (LEFT JOIN, 옛 데이터 NULL 안전)
  opponent_name TEXT,
  opponent_nickname TEXT,
  opponent_display_name TEXT,
  opponent_tier TEXT,
  opponent_avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.user_id,
    m.opponent_id,
    m.result,
    m.method,
    m.score,
    m.rounds,
    m.played_at,
    p.name,
    p.nickname,
    p.display_name,
    p.tier,
    p.avatar_url
  FROM public.matches m
  LEFT JOIN public.public_player_profiles p ON p.id = m.opponent_id
  WHERE m.user_id = p_user_id
  ORDER BY m.played_at DESC NULLS LAST
  LIMIT CASE WHEN p_limit IS NULL OR p_limit <= 0 THEN NULL ELSE p_limit END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_player_matches(UUID, INTEGER) TO authenticated;

-- ── 테스트 ──
-- SELECT * FROM public.get_public_player_matches('<UUID>'::uuid, 50);

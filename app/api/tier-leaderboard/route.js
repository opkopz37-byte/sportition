import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { computeMatchLeaderboard } from '@/lib/matchLeaderboardCompute';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

/** 티어보드 공개 읽기 — 60초 캐시로 DB·비용 완화 (클라이언트는 stale 허용) */
export const revalidate = 60;

/** computeMatchLeaderboard + 랭킹 UI에 필요한 컬럼만 (전체 행 대비 전송량·디코딩 비용 감소) */
const LEADERBOARD_PLAYER_COLUMNS =
  'id, name, nickname, display_name, role, boxing_style, gym_name, tier, tier_points, rank, total_matches, wins, losses, draws, win_rate';

/** 비로그인 티어 보드 — 서비스 롤로 동일 정렬 데이터 반환 */
export async function GET(request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:tier-leaderboard`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { data: [], error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json({ data: [], error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: players, error: playersError } = await admin
    .from('public_player_profiles')
    .select(LEADERBOARD_PLAYER_COLUMNS);
  if (playersError) {
    return NextResponse.json({ data: [], error: playersError.message }, { status: 500 });
  }

  const { data: matches, error: matchesError } = await admin
    .from('matches')
    .select('user_id, opponent_id, played_at')
    .order('played_at', { ascending: false })
    .limit(3000);

  if (matchesError) {
    return NextResponse.json({ data: [], error: matchesError.message }, { status: 500 });
  }

  const data = computeMatchLeaderboard(players, matches, 500);
  return NextResponse.json({ data });
}

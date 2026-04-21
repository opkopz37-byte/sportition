import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

const SEARCH_PLAYER_COLUMNS =
  'id, name, nickname, display_name, role, tier, rank, boxing_style, gym_name, wins, losses, draws, total_matches, win_rate';

/**
 * 비로그인 랜딩 검색용 — anon GRANT 없이도 동작하도록 서비스 롤로 public_player_profiles 조회.
 * SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 있어야 합니다.
 */
export async function GET(request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:search-players`, { limit: 45, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { data: [], error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('q') ?? '';
  const q = raw.trim();
  if (!q) {
    return NextResponse.json({ data: [] });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: 'Query too long' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json(
      { data: [], error: 'SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 503 }
    );
  }

  const k = q.replace(/%/g, '');
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from('public_player_profiles')
    .select(SEARCH_PLAYER_COLUMNS)
    .in('role', ['player_common', 'player_athlete'])
    .or(`display_name.ilike.%${k}%,name.ilike.%${k}%,nickname.ilike.%${k}%`)
    .order('rank', { ascending: true, nullsFirst: false })
    .limit(8);

  if (error) {
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data || [] });
}

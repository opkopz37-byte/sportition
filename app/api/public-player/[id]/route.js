import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { enrichPublicPlayerRow } from '@/lib/publicPlayerEnrich';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

const PUBLIC_PROFILE_COLUMNS =
  'id, name, nickname, display_name, role, gender, height, weight, boxing_style, gym_name, tier, tier_points, rank, total_matches, wins, losses, draws, win_rate';

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
}

export async function GET(request, ctx) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:public-player`, { limit: 90, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const params = await Promise.resolve(ctx.params);
  const rawId = params?.id;
  const id = typeof rawId === 'string' ? rawId.trim() : '';
  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: profileRow, error: pErr } = await admin
    .from('public_player_profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  if (!profileRow || !['player_common', 'player_athlete'].includes(profileRow.role)) {
    return NextResponse.json({ error: 'Not found', profile: null, matches: [] }, { status: 404 });
  }

  const profile = enrichPublicPlayerRow(profileRow);

  const { data: matchRows, error: mErr } = await admin
    .from('matches')
    .select('*')
    .or(`user_id.eq.${id},opponent_id.eq.${id}`)
    .order('played_at', { ascending: false })
    .limit(50);

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  const rows = matchRows || [];
  const otherIds = [...new Set(rows.map((m) => (m.user_id === id ? m.opponent_id : m.user_id)).filter(Boolean))];
  let profileMap = new Map();
  if (otherIds.length) {
    const { data: others } = await admin
      .from('public_player_profiles')
      .select('id, name, nickname, display_name, tier')
      .in('id', otherIds);
    profileMap = new Map((others || []).map((p) => [p.id, p]));
  }

  const matches = rows.map((match) => {
    const oid = match.user_id === id ? match.opponent_id : match.user_id;
    const opp = oid ? profileMap.get(oid) : null;
    return {
      ...match,
      opponent_name: opp?.nickname || opp?.display_name || opp?.name || null,
      opponent: opp
        ? { id: opp.id, name: opp.name, nickname: opp.nickname, tier: opp.tier }
        : null,
    };
  });

  return NextResponse.json({ profile, matches });
}

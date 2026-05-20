import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, getUserIdFromBearer, assertGymCanManageMember } from '@/lib/gymMemberAccess';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
}

/**
 * POST /api/gym-members/[memberId]/skill-skip
 * Body: { node_id: number }
 * 응답 (성공): { ok: true, node_id, action: 'skip' }
 * 응답 (실패): { ok: false, error, message? }
 *
 * 권한: gym (자기 회원) 또는 admin
 * 비즈니스 로직: RPC public.gym_skip_skill_node — 노드를 즉시 마스터 처리
 */
export async function POST(request, ctx) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:gym-skill-skip`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return NextResponse.json({ error: 'no_token' }, { status: 401 });
  }
  const token = m[1].trim();

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const { userId, error: tokenErr } = await getUserIdFromBearer(request);
  if (!userId) {
    return NextResponse.json({ error: tokenErr || 'unauthorized' }, { status: 401 });
  }

  const params = await Promise.resolve(ctx.params);
  const memberId = String(params?.memberId || '').trim();
  if (!memberId || !isUuid(memberId)) {
    return NextResponse.json({ error: 'Invalid member id' }, { status: 400 });
  }

  const access = await assertGymCanManageMember(admin, userId, memberId);
  if (!access.ok) {
    return NextResponse.json({ error: access.code || 'forbidden' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const nodeId = parseInt(body.node_id, 10);
  if (!Number.isInteger(nodeId) || nodeId <= 0) {
    return NextResponse.json({ error: 'invalid_node_id' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.rpc('gym_skip_skill_node', {
    p_member_id: memberId,
    p_node_id: nodeId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (data && data.ok === false) {
    return NextResponse.json(data, { status: 400 });
  }
  return NextResponse.json(data || { ok: true });
}

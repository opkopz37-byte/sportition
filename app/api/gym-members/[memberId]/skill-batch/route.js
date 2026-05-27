import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, getUserIdFromBearer, assertGymCanManageMember } from '@/lib/gymMemberAccess';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
}

/**
 * POST /api/gym-members/[memberId]/skill-batch
 * Body: {
 *   items: [
 *     { type: 'promotion_request', node_id: number },
 *     { type: 'skip', node_id: number, create_promotion?: boolean }
 *   ]
 * }
 *
 * 응답: { ok: true, results: [{ type, node_id, ok, error?, message?, ... }] }
 *
 * 항목들을 입력된 순서대로 처리. 중간 항목 실패해도 다음 항목 계속 시도.
 */
export async function POST(request, ctx) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:gym-skill-batch`, { limit: 10, windowMs: 60_000 });
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

  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'empty_items' }, { status: 400 });
  }
  if (items.length > 60) {
    return NextResponse.json({ error: 'too_many_items' }, { status: 400 });
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

  const results = [];
  for (const raw of items) {
    const type = String(raw?.type || '');
    const nodeId = parseInt(raw?.node_id, 10);
    if (!Number.isInteger(nodeId) || nodeId <= 0) {
      results.push({ type, node_id: raw?.node_id ?? null, ok: false, error: 'invalid_node_id' });
      continue;
    }
    if (type === 'promotion_request') {
      const { data, error } = await supabase.rpc('gym_submit_promotion_request_for_member', {
        p_member_id: memberId,
        p_node_id: nodeId,
      });
      if (error) {
        results.push({ type, node_id: nodeId, ok: false, error: error.message });
      } else if (data && data.ok === false) {
        results.push({ type, node_id: nodeId, ok: false, error: data.error, message: data.message });
      } else {
        results.push({ type, node_id: nodeId, ok: true });
      }
    } else if (type === 'skip') {
      const createPromotion = raw?.create_promotion !== false;
      const { data, error } = await supabase.rpc('gym_skip_skill_node', {
        p_member_id: memberId,
        p_node_id: nodeId,
        p_create_promotion: createPromotion,
      });
      if (error) {
        results.push({ type, node_id: nodeId, ok: false, error: error.message });
      } else if (data && data.ok === false) {
        results.push({ type, node_id: nodeId, ok: false, error: data.error, message: data.message });
      } else {
        results.push({ type, node_id: nodeId, ok: true, ...(data || {}) });
      }
    } else {
      results.push({ type, node_id: nodeId, ok: false, error: 'unknown_type' });
    }
  }

  return NextResponse.json({ ok: true, results });
}

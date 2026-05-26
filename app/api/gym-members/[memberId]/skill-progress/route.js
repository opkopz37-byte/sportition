import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserIdFromBearer, assertGymCanManageMember } from '@/lib/gymMemberAccess';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
}

/**
 * GET /api/gym-members/[memberId]/skill-progress
 *
 * 관장(또는 admin)이 소속 회원의 스킬 진행 전체를 한 번에 조회.
 *
 * 쿼리:
 *   ?include=user — 회원 변경 데이터만 (nodes 쿼리 생략, 액션 후 갱신용)
 *
 * 응답:
 *   {
 *     ok: true,
 *     member: { id, name, nickname, gym_name, skill_points },
 *     nodes: [...] (include=user 이면 생략),
 *     unlocks: [{ node_id, unlocked_at }],
 *     progress: [{ node_id, exp_level, promotion_fail_count, is_skipped, updated_at }],
 *     promotion_requests: [{ id, fork_node_id, status, requested_at,
 *                            resolved_at, chosen_child_node_id, notes }]
 *   }
 */
export async function GET(request, ctx) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:gym-member-skill-progress`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

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

  // include=user → 정적 nodes 쿼리 생략 (액션 후 갱신 시 페이로드/시간 절감)
  const includeOnly = new URL(request.url).searchParams.get('include');
  const skipNodes = includeOnly === 'user';

  const userQueries = [
    admin
      .from('users')
      .select('id, name, nickname, gym_name, skill_points')
      .eq('id', memberId)
      .single(),
    admin
      .from('user_skill_unlocks')
      .select('node_id, unlocked_at')
      .eq('user_id', memberId),
    admin
      .from('user_skill_node_progress')
      .select('node_id, exp_level, promotion_fail_count, is_skipped, updated_at')
      .eq('user_id', memberId),
    admin
      .from('skill_promotion_requests')
      .select('id, fork_node_id, status, requested_at, resolved_at, chosen_child_node_id, notes')
      .eq('user_id', memberId)
      .order('requested_at', { ascending: false })
      .limit(100),
  ];

  const nodesQuery = skipNodes
    ? Promise.resolve({ data: null, error: null })
    : admin
        .from('skill_tree_nodes')
        .select('id, node_number, name, parent_nodes, is_fork, fork_branch_node_numbers, point_cost, zone, punch_type')
        .order('node_number', { ascending: true });

  const [memberRes, unlocksRes, progressRes, requestsRes, nodesRes] = await Promise.all([
    ...userQueries,
    nodesQuery,
  ]);

  if (memberRes.error) {
    return NextResponse.json({ error: memberRes.error.message }, { status: 500 });
  }
  if (nodesRes.error) {
    return NextResponse.json({ error: nodesRes.error.message }, { status: 500 });
  }
  if (unlocksRes.error) {
    return NextResponse.json({ error: unlocksRes.error.message }, { status: 500 });
  }
  if (progressRes.error) {
    return NextResponse.json({ error: progressRes.error.message }, { status: 500 });
  }
  if (requestsRes.error) {
    return NextResponse.json({ error: requestsRes.error.message }, { status: 500 });
  }

  const body = {
    ok: true,
    member: memberRes.data,
    unlocks: unlocksRes.data || [],
    progress: progressRes.data || [],
    promotion_requests: requestsRes.data || [],
  };
  if (!skipNodes) body.nodes = nodesRes.data || [];

  return NextResponse.json(body);
}

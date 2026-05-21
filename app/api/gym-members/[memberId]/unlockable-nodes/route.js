import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserIdFromBearer, assertGymCanManageMember } from '@/lib/gymMemberAccess';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
}

/**
 * GET /api/gym-members/[memberId]/unlockable-nodes
 *
 * 관장이 회원에게 다음으로 해금/스킵 가능한 노드 후보를 조회.
 *
 * 응답:
 *   {
 *     ok: true,
 *     can_unlock: boolean,
 *     reason: null | 'active_skill_in_progress' | 'promotion_required',
 *     message: string | null,
 *     active_node_id: number | null,
 *     latest_mastered_node_id: number | null,
 *     latest_promotion_status: string | null,
 *     candidate_nodes: [{ id, node_number, name, parent_nodes, is_fork, fork_branch_node_numbers, point_cost }]
 *   }
 *
 * can_unlock=false 인 경우에도 candidate_nodes 는 반환 (UI 가 표시만 하고 버튼 비활성화).
 */
export async function GET(request, ctx) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:gym-unlockable-nodes`, { limit: 60, windowMs: 60_000 });
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

  const [nodesRes, unlocksRes, progressRes, requestsRes] = await Promise.all([
    admin
      .from('skill_tree_nodes')
      .select('id, node_number, name, parent_nodes, is_fork, fork_branch_node_numbers, point_cost, zone, punch_type')
      .order('node_number', { ascending: true }),
    admin
      .from('user_skill_unlocks')
      .select('node_id, unlocked_at')
      .eq('user_id', memberId)
      .order('unlocked_at', { ascending: false }),
    admin
      .from('user_skill_node_progress')
      .select('node_id, exp_level')
      .eq('user_id', memberId),
    admin
      .from('skill_promotion_requests')
      .select('fork_node_id, status, requested_at')
      .eq('user_id', memberId)
      .order('requested_at', { ascending: false }),
  ]);

  for (const r of [nodesRes, unlocksRes, progressRes, requestsRes]) {
    if (r.error) {
      return NextResponse.json({ error: r.error.message }, { status: 500 });
    }
  }

  const nodes = nodesRes.data || [];
  const unlocks = unlocksRes.data || [];
  const progress = progressRes.data || [];
  const requests = requestsRes.data || [];

  const unlockedNodeIds = new Set(unlocks.map((u) => u.node_id));
  const expByNodeId = new Map(progress.map((p) => [p.node_id, p.exp_level ?? 0]));

  // 활성 스킬 = 해금됐고 exp < 5 인 노드 (정의상 0개 또는 1개)
  let activeNodeId = null;
  for (const u of unlocks) {
    const exp = expByNodeId.get(u.node_id) ?? 0;
    if (exp < 5) {
      activeNodeId = u.node_id;
      break;
    }
  }

  // 가장 최근 마스터 노드 = 활성이 없을 때, unlocks 의 첫 행 (이미 unlocked_at DESC 정렬됨)
  const latestMasteredNodeId = !activeNodeId && unlocks.length > 0 ? unlocks[0].node_id : null;

  // 가장 최근 마스터 노드에 대한 승단 신청 상태
  let latestPromotionStatus = null;
  if (latestMasteredNodeId !== null) {
    const reqForNode = requests.find((r) => r.fork_node_id === latestMasteredNodeId);
    latestPromotionStatus = reqForNode?.status || null;
  }

  // 해금 가능 여부 판단
  let canUnlock = true;
  let reason = null;
  let message = null;

  if (activeNodeId !== null) {
    canUnlock = false;
    reason = 'active_skill_in_progress';
    message = '회원이 진행 중인 스킬을 먼저 마스터해야 합니다.';
  } else if (latestMasteredNodeId !== null) {
    const ok = ['pending', 'reviewing', 'approved'].includes(latestPromotionStatus);
    if (!ok) {
      canUnlock = false;
      reason = 'promotion_required';
      message = '승단 신청이 진행되어야 합니다.';
    }
  }

  // 미해금 노드 후보
  const candidateNodes = nodes.filter((n) => !unlockedNodeIds.has(n.id));

  return NextResponse.json({
    ok: true,
    can_unlock: canUnlock,
    reason,
    message,
    active_node_id: activeNodeId,
    latest_mastered_node_id: latestMasteredNodeId,
    latest_promotion_status: latestPromotionStatus,
    candidate_nodes: candidateNodes,
  });
}

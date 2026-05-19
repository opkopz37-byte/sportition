import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserIdFromBearer, assertGymCanManageMember } from '@/lib/gymMemberAccess';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
}

/**
 * POST /api/gym-members/[memberId]/skill-points
 * Body: { amount: number }  — 양수(지급) 또는 음수(차감)
 * 응답: { ok: true, skill_points: number, sp_added: number }
 */
export async function POST(request, ctx) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:gym-sp-grant`, { limit: 30, windowMs: 60_000 });
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const amount = parseInt(body.amount, 10);
  if (Number.isNaN(amount) || amount === 0) {
    return NextResponse.json({ error: 'amount must be a non-zero integer' }, { status: 400 });
  }

  // gym_grant_skill_points RPC는 SECURITY DEFINER이지만
  // 실제 권한 검증이 RPC 내부에서도 이루어짐 (double-check)
  // service role로 호출하되 caller 정보는 rpc 인자가 아닌 auth.uid() 방식 불가 →
  // admin client로 직접 UPDATE + INSERT 처리
  const { data: targetUser, error: fetchErr } = await admin
    .from('users')
    .select('id, skill_points')
    .eq('id', memberId)
    .single();

  if (fetchErr || !targetUser) {
    return NextResponse.json({ error: 'member_not_found' }, { status: 404 });
  }

  const currentSp = Number(targetUser.skill_points) || 0;
  const newSp = Math.max(0, currentSp + amount);

  const { error: updateErr } = await admin
    .from('users')
    .update({ skill_points: newSp, updated_at: new Date().toISOString() })
    .eq('id', memberId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { error: logErr } = await admin.from('skill_point_logs').insert({
    target_user_id: memberId,
    granted_by: userId,
    amount,
    balance_after: newSp,
  });

  if (logErr) {
    // 이력 저장 실패는 치명적이지 않으므로 경고만
    console.warn('[skill-points] log insert failed:', logErr.message);
  }

  return NextResponse.json({ ok: true, skill_points: newSp, sp_added: amount });
}

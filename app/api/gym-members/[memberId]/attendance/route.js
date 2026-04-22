import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserIdFromBearer, assertGymCanManageMember } from '@/lib/gymMemberAccess';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
}

export async function GET(request, ctx) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:gym-member-attendance`, { limit: 60, windowMs: 60_000 });
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

  const { data, error } = await admin
    .from('attendance')
    .select('id, attendance_date, check_in_time, location, created_at')
    .eq('user_id', memberId)
    .order('attendance_date', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data || [] });
}

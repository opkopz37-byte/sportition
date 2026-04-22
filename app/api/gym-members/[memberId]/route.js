import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserIdFromBearer, assertGymCanManageMember } from '@/lib/gymMemberAccess';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
}

const MEMBERSHIP = new Set(['basic', 'standard', 'premium']);

/**
 * @param {Request} request
 * @param {{ memberId: string } | Promise<{ memberId: string }>} params
 */
export async function PATCH(request, ctx) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:gym-member-patch`, { limit: 30, windowMs: 60_000 });
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

  const name = body.name != null ? String(body.name).trim() : null;
  const nickname = body.nickname != null ? String(body.nickname).trim() : null;
  const displayName = nickname || name;
  if (!displayName) {
    return NextResponse.json({ error: 'name_or_nickname_required' }, { status: 400 });
  }

  const membership_type = String(body.membership_type || 'basic');
  if (!MEMBERSHIP.has(membership_type)) {
    return NextResponse.json({ error: 'invalid_membership_type' }, { status: 400 });
  }

  const gender = body.gender === 'female' ? 'female' : 'male';
  const height = body.height != null && body.height !== '' ? Math.round(Number(body.height)) : null;
  const weight = body.weight != null && body.weight !== '' ? Number(body.weight) : null;
  if (height != null && (Number.isNaN(height) || height < 50 || height > 300)) {
    return NextResponse.json({ error: 'invalid_height' }, { status: 400 });
  }
  if (weight != null && (Number.isNaN(weight) || weight < 20 || weight > 300)) {
    return NextResponse.json({ error: 'invalid_weight' }, { status: 400 });
  }

  const address = body.address != null ? String(body.address).trim() : '';
  const notes = body.notes != null ? String(body.notes).trim() : '';
  const memoParts = [];
  if (address) memoParts.push(`주소: ${address}`);
  if (notes) memoParts.push(notes);
  const boxing_style = memoParts.length ? memoParts.join('\n') : null;

  const phone = body.phone != null ? String(body.phone).trim() || null : null;
  const birth_date = body.birth_date != null && String(body.birth_date).trim() !== '' ? String(body.birth_date).trim().slice(0, 10) : null;
  const representative_phone =
    body.representative_phone != null ? String(body.representative_phone).trim() || null : null;

  const { error: uErr } = await admin
    .from('users')
    .update({
      name: name || displayName,
      nickname: nickname || name || displayName,
      membership_type,
      gender,
      height: height != null && !Number.isNaN(height) ? height : null,
      weight: weight != null && !Number.isNaN(weight) ? weight : null,
      boxing_style,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId);

  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  const { error: pErr } = await admin.from('user_private_profiles').upsert(
    {
      user_id: memberId,
      phone,
      birth_date: birth_date || null,
      representative_phone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request, ctx) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:gym-member-delete`, { limit: 8, windowMs: 60_000 });
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

  if (userId === memberId) {
    return NextResponse.json({ error: 'cannot_delete_self' }, { status: 400 });
  }

  const access = await assertGymCanManageMember(admin, userId, memberId);
  if (!access.ok) {
    return NextResponse.json({ error: access.code || 'forbidden' }, { status: 403 });
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(memberId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message || 'delete_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

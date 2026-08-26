import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/gymMemberAccess';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

const RESET_PASSWORD = '123456';

function normalizePhone(v) {
  return String(v || '').replace(/\D/g, '');
}

/**
 * 이메일 인증 없이 이름+전화번호 일치 시 본인 비밀번호를 123456 으로 초기화.
 * 이메일은 받지 않음 — 이메일을 잊은 사용자도 초기화할 수 있어야 하며,
 * 같은 이름+전화번호로 find-id 가 어차피 이메일을 알려주므로 보안 수준은 동일.
 * 초기화된 계정의 이메일을 응답에 담아 클라이언트가 자동 로그인에 사용.
 */
export async function POST(request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:self-reset-pw`, { limit: 5, windowMs: 5 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  const phone = normalizePhone(body?.phone);

  if (!name || !phone) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // 전화번호 기준 속도 제한 — 이름 무차별 대입 완화
  const rlPhone = checkRateLimit(`phone:${phone}:self-reset-pw`, { limit: 5, windowMs: 15 * 60_000 });
  if (!rlPhone.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rlPhone.retryAfterSec) } }
    );
  }

  // find-id 와 동일한 매칭: 회원은 name, 체육관은 gym_name (role='gym' 한정 —
  // 회원 행에도 소속 gym_name 이 캐시돼 있어 무제한 매칭 시 회원이 잘못 걸림).
  // 전화번호는 하이픈 포함 저장이라 JS 에서 숫자만 남겨 비교.
  const [{ data: byName, error: nameErr }, { data: byGymName, error: gymErr }] = await Promise.all([
    admin.from('users').select('id, email').eq('name', name),
    admin.from('users').select('id, email').eq('gym_name', name).eq('role', 'gym'),
  ]);
  if (nameErr || gymErr) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }

  const candidates = [...(byName || []), ...(byGymName || [])];
  let matched = null;
  if (candidates.length > 0) {
    const ids = [...new Set(candidates.map((u) => u.id))];
    const { data: profiles, error: profileErr } = await admin
      .from('user_private_profiles')
      .select('user_id, phone, representative_phone')
      .in('user_id', ids);
    if (profileErr) {
      return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
    }
    const phoneOkIds = new Set(
      (profiles || [])
        .filter(
          (p) => normalizePhone(p.phone) === phone || normalizePhone(p.representative_phone) === phone
        )
        .map((p) => p.user_id)
    );
    matched = candidates.find((u) => phoneOkIds.has(u.id)) || null;
  }

  if (!matched) {
    return NextResponse.json({ error: 'no_match' }, { status: 400 });
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(matched.id, {
    password: RESET_PASSWORD,
  });
  if (updErr) {
    return NextResponse.json({ error: updErr.message || 'reset_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: matched.email });
}

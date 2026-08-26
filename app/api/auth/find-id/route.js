import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/gymMemberAccess';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

function normalizePhone(v) {
  return String(v || '').replace(/\D/g, '');
}

/**
 * 이름+전화번호 일치 시 가입 이메일(아이디)을 반환.
 * 마스킹하지 않음 — 이메일을 완전히 잊은 사용자가 대상이라 가리면 기능이 무의미.
 * (이름+전화번호를 아는 사람에게만 노출되며, 무차별 대입은 IP 속도 제한으로 완화)
 */
export async function POST(request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:find-id`, { limit: 5, windowMs: 5 * 60_000 });
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

  // 이름으로 후보를 먼저 찾은 뒤 전화번호는 JS 에서 숫자만 남겨 비교.
  // (DB 에는 010-1234-5678 처럼 하이픈 포함으로 저장되므로 eq 쿼리로는 못 찾음)
  // 체육관 계정은 name 이 비어있을 수 있어 gym_name 으로도 매칭 (role='gym' 한정 —
  // 회원 행에도 소속 gym_name 이 캐시돼 있어 무제한 매칭 시 회원이 잘못 걸림)
  const [{ data: byName, error: nameErr }, { data: byGymName, error: gymErr }] = await Promise.all([
    admin.from('users').select('id, email').eq('name', name),
    admin.from('users').select('id, email').eq('gym_name', name).eq('role', 'gym'),
  ]);
  if (nameErr || gymErr) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }

  const candidates = [...(byName || []), ...(byGymName || [])];
  let matchedEmail = null;
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
    const match = candidates.find((u) => phoneOkIds.has(u.id));
    if (match?.email) matchedEmail = match.email;
  }

  if (!matchedEmail) {
    return NextResponse.json({ error: 'no_match' }, { status: 400 });
  }

  return NextResponse.json({ email: matchedEmail });
}

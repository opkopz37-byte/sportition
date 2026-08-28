import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

/**
 * 이메일(로그인 ID) 사용 가능 여부 — public.users 기준.
 * SUPABASE_SERVICE_ROLE_KEY 필요.
 * 속도 제한: 이메일 열거·남용 완화.
 */
export async function GET(request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:check-email`, { limit: 12, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { available: null, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get('email') || '').trim();
  const email = raw.toLowerCase();
  if (!email) {
    return NextResponse.json({ available: false, error: 'empty' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ available: false, error: 'invalid_email' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json(
      { available: null, error: 'service_unavailable' },
      { status: 503 }
    );
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  // auth.users(로그인 계정) + public.users(프로필) 모두 확인 — 둘이 어긋난
  // 고아 계정이 있어도 "사용 가능하다더니 가입 실패" 가 생기지 않도록 함.
  const { data: taken, error } = await admin.rpc('email_taken', { check_email: email });

  if (error) {
    return NextResponse.json({ available: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ available: taken !== true });
}

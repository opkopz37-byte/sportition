/**
 * 로그인 ID(이메일) 중복 여부 — /api/check-email (서비스 롤) 호출.
 * @returns {{ ok: boolean, available: boolean | null, error?: string }}
 */
export async function checkEmailAvailable(email) {
  const trimmed = String(email).trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, available: false, error: 'empty' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, available: false, error: 'invalid_email' };
  }

  try {
    const res = await fetch(`/api/check-email?email=${encodeURIComponent(trimmed)}`, {
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 503) {
      return { ok: false, available: null, error: 'service_unavailable' };
    }
    if (!res.ok) {
      return { ok: false, available: null, error: body.error || 'request_failed' };
    }
    return { ok: true, available: body.available === true };
  } catch (e) {
    return { ok: false, available: null, error: e.message || 'network' };
  }
}

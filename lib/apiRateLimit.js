/**
 * 단일 Node 프로세스용 인메모리 속도 제한 (서버리스/멀티 인스턴스에서는 인스턴스별로 독립).
 * 남용·비용 폭증 방지용 — 프로덕션 앞단(WAF/CDN)과 병행 권장.
 */
const buckets = new Map();

function prune(now, maxAgeMs = 3600000) {
  for (const [k, v] of buckets.entries()) {
    if (now - v.resetAt > maxAgeMs) buckets.delete(k);
  }
}

/**
 * @param {string} key — 예: `${ip}:search-players`
 * @param {{ limit: number, windowMs: number }} opts
 * @returns {{ ok: boolean, retryAfterSec?: number }}
 */
export function checkRateLimit(key, opts) {
  const { limit, windowMs } = opts;
  const now = Date.now();
  if (buckets.size > 50000) prune(now);

  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  return { ok: true };
}

export function getClientIp(request) {
  const xf = request.headers.get('x-forwarded-for');
  if (xf) {
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

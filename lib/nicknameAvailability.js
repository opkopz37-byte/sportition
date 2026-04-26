/**
 * 닉네임 중복 확인 — Supabase RPC `is_nickname_available` 호출.
 * sql/45_nickname_availability.sql 적용 필요.
 * @returns {{ ok: boolean, available: boolean | null, error?: string }}
 */
export async function checkNicknameAvailable(nickname) {
  const trimmed = String(nickname || '').trim();
  if (!trimmed) {
    return { ok: false, available: false, error: 'empty' };
  }
  if (trimmed.length > 30) {
    return { ok: false, available: false, error: 'too_long' };
  }

  try {
    // 동적 import — 클라이언트 번들 절약
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.rpc('is_nickname_available', { p_nickname: trimmed });
    if (error) {
      return { ok: false, available: null, error: error.message || 'rpc_failed' };
    }
    return { ok: true, available: data === true };
  } catch (e) {
    return { ok: false, available: null, error: e?.message || 'network' };
  }
}

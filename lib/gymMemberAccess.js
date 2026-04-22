import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Authorization: Bearer <access_token> → auth user id */
export async function getUserIdFromBearer(request) {
  const auth = request.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { userId: null, error: 'no_token' };
  const token = m[1].trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return { userId: null, error: 'config' };
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return { userId: null, error: 'invalid_token' };
  return { userId: data.user.id, error: null };
}

/**
 * 체육관(또는 admin)이 해당 회원 행을 관리할 수 있는지 — RLS의 gym_can_view_member 와 동일한 규칙
 */
export async function assertGymCanManageMember(admin, gymUserId, memberId) {
  const { data: gym, error: e1 } = await admin
    .from('users')
    .select('id, role, gym_name')
    .eq('id', gymUserId)
    .single();
  if (e1 || !gym) return { ok: false, code: 'gym_not_found' };

  const { data: member, error: e2 } = await admin
    .from('users')
    .select('id, role, gym_user_id, gym_name, email')
    .eq('id', memberId)
    .single();
  if (e2 || !member) return { ok: false, code: 'member_not_found' };

  if (!['player_common', 'player_athlete'].includes(member.role)) {
    return { ok: false, code: 'not_player' };
  }

  if (gym.role === 'admin') {
    return { ok: true, gym, member };
  }

  if (gym.role !== 'gym') return { ok: false, code: 'forbidden' };

  const gname = (gym.gym_name || '').trim();
  if (!gname) return { ok: false, code: 'gym_no_name' };

  if (member.gym_user_id && member.gym_user_id === gymUserId) {
    return { ok: true, gym, member };
  }
  if (!member.gym_user_id && (member.gym_name || '').trim() === gname) {
    return { ok: true, gym, member };
  }

  return { ok: false, code: 'not_same_gym' };
}

import { createClient } from '@supabase/supabase-js';
import {
  computeMatchPoints,
  getTierLabelFromMatchPoints,
} from './tierLadder.js';

const ENV_HINT =
  '프로젝트 루트에 `.env.local`을 만들고 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 설정한 뒤 `npm run dev`를 다시 실행하세요. (`.env.example`을 복사해 사용 가능)';

/** Supabase에 연결할 URL·anon 키가 모두 있는지 */
export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    const err = new Error(`Supabase 환경 변수가 없습니다. ${ENV_HINT}`);
    err.name = 'SupabaseEnvMissingError';
    throw err;
  }
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let _supabaseSingleton = null;

/**
 * 실제 클라이언트 인스턴스 (환경 변수 없으면 throw)
 * AuthProvider 등에서 isSupabaseConfigured()로 먼저 분기할 것.
 */
export function getSupabase() {
  if (!_supabaseSingleton) {
    _supabaseSingleton = getSupabaseClient();
  }
  return _supabaseSingleton;
}

/**
 * 기존 import 호환용. 접근 시 환경 변수가 없으면 throw → 각 API 함수의 try/catch에서 처리 가능.
 */
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      return Reflect.get(getSupabase(), prop);
    },
  }
);

const PLAYER_ROLES = ['player_common', 'player_athlete'];

const normalizeRole = (role) => {
  if (role === 'athlete') return 'player_common';
  if (role === 'coach') return 'player_athlete';
  return role || 'player_common';
};

const flattenProfile = (data) => {
  if (!data) return null;

  const privateProfile = Array.isArray(data.user_private_profiles)
    ? data.user_private_profiles[0]
    : data.user_private_profiles;

  return {
    ...data,
    role: normalizeRole(data.role),
    phone: privateProfile?.phone || null,
    birth_date: privateProfile?.birth_date || null,
    representative_phone: privateProfile?.representative_phone || null,
  };
};

/** 랭크 점수(승·패·무 가중) 기준 티어 — lib/tierLadder.js 규정과 동일 */
function enrichPlayerWithMatchTier(profile, stats) {
  if (!profile) return null;
  const r = profile.role;
  if (r === 'gym' || r === 'admin') return profile;
  const wins = stats?.wins ?? profile.wins ?? 0;
  const draws = stats?.draws ?? profile.draws ?? 0;
  const losses = stats?.losses ?? profile.losses ?? 0;
  const mp = computeMatchPoints(wins, draws, losses);
  return {
    ...profile,
    wins,
    draws,
    losses,
    match_points: mp,
    tier: getTierLabelFromMatchPoints(mp),
    tier_points: mp,
  };
}

function enrichPublicPlayerRow(row) {
  if (!row) return null;
  if (row.role === 'gym') return row;
  const mp = computeMatchPoints(row.wins, row.draws, row.losses);
  return {
    ...row,
    match_points: mp,
    tier: getTierLabelFromMatchPoints(mp),
    tier_points: mp,
  };
}

async function attachStatisticsAndTier(userId, flat) {
  if (!flat?.id) return flat;
  const { data: stats } = await supabase
    .from('statistics')
    .select('wins,losses,draws')
    .eq('user_id', userId)
    .maybeSingle();
  return enrichPlayerWithMatchTier(flat, stats);
}

/** Cursor 디버그 세션: localhost ingest + 콘솔(프로덕션에서도 복사 가능) */
export function debugLogDe1eee(location, message, data) {
  const payload = { sessionId: 'de1eee', location, message, data, timestamp: Date.now() };
  // #region agent log
  fetch('http://127.0.0.1:7370/ingest/43671701-629e-4938-aa99-95f0adb6738f', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'de1eee' },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
  if (typeof console !== 'undefined' && console.info) {
    console.info('[Sportition-debug]', message, { location, ...data });
  }
}

/** PostgREST JSON에서 ok가 생략되거나 타입이 달라도 user 페이로드가 있으면 성공으로 처리 */
function rpcProfilePayloadOk(rpc) {
  if (!rpc || rpc.ok === false) return false;
  return Boolean(rpc.user);
}

function parseRpcJsonField(v) {
  if (v == null) return null;
  if (typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return null;
}

/** get_my_profile / ensure_my_profile_from_auth RPC JSON → 클라이언트 프로필 객체 */
async function profileFromMyProfileRpc(rpc, userId) {
  if (!rpcProfilePayloadOk(rpc)) return null;
  const userRow = parseRpcJsonField(rpc.user);
  const priv = parseRpcJsonField(rpc.private);
  if (!userRow || typeof userRow !== 'object') {
    debugLogDe1eee('supabase.js:profileFromMyProfileRpc', 'rpc_user_unusable', {
      hypothesisId: 'B',
      runId: 'post-fix',
      userId,
      rawUserType: typeof rpc.user,
    });
    return null;
  }
  const normalized = {
    ...userRow,
    user_private_profiles: priv ? [priv] : [],
  };
  const flat = flattenProfile(normalized);
  if (!flat?.id) {
    debugLogDe1eee('supabase.js:profileFromMyProfileRpc', 'flat_missing_id', {
      hypothesisId: 'B',
      runId: 'post-fix',
      userId,
    });
    return null;
  }
  return attachStatisticsAndTier(userId, flat);
}

// 회원가입
export const signUp = async (email, password, userData) => {
  try {
    console.log('[signUp] 회원가입 시작');
    console.log('[signUp] Email:', email);
    console.log('[signUp] UserData 받은 값:', userData);
    
    // 1. Supabase Auth 회원가입
    const normalizedRole = normalizeRole(userData.role);
    const normalizedUserData = {
      ...userData,
      role: normalizedRole,
    };

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: normalizedUserData,
      },
    });

    if (authError) throw authError;
    
    console.log('[signUp] Auth 회원가입 성공:', authData.user.id);
    
    // 2. users 테이블에 프로필 생성
    // 참고: auth.users INSERT 트리거(handle_new_user)가 이미 프로필을 생성합니다.
    // 트리거가 실패하거나 기존 환경에서 트리거가 없을 경우를 대비한 fallback upsert입니다.
    if (authData.user) {
      const profileData = {
        id: authData.user.id,
        email: email,
        name: normalizedUserData.name || '사용자',
        nickname: normalizedUserData.name || '사용자',
        role: normalizedRole,
        gender: normalizedUserData.gender || null,
      };

      const privateProfileData = {
        user_id: authData.user.id,
        phone: normalizedUserData.phone || null,
        birth_date: normalizedUserData.birth_date || null,
        representative_phone: normalizedUserData.representative_phone || null,
      };

      // 역할별 추가 필드
      if (normalizedRole === 'player_common') {
        profileData.tier = 'Bronze III';
        profileData.tier_points = 0;
        profileData.skill_points = 0;
        profileData.membership_type = normalizedUserData.membership_type || 'basic';
        profileData.height = normalizedUserData.height || null;
        profileData.weight = normalizedUserData.weight || null;
        profileData.gym_name = normalizedUserData.gym_name || null;
        profileData.gym_user_id = normalizedUserData.gym_user_id || null;
        profileData.boxing_style = null;
      } else if (normalizedRole === 'player_athlete') {
        profileData.tier = 'Bronze III';
        profileData.tier_points = 0;
        profileData.skill_points = 0;
        profileData.membership_type = normalizedUserData.membership_type || 'basic';
        profileData.height = normalizedUserData.height || null;
        profileData.weight = normalizedUserData.weight || null;
        profileData.boxing_style = normalizedUserData.boxing_style || null;
        profileData.gym_name = normalizedUserData.gym_name || null;
        profileData.gym_user_id = normalizedUserData.gym_user_id || null;
      } else if (normalizedRole === 'gym') {
        profileData.gym_name = normalizedUserData.gym_name || null;
        profileData.gym_location = normalizedUserData.gym_location || null;
        profileData.tier = null;
        profileData.tier_points = null;
        profileData.skill_points = 0;
        profileData.membership_type = null;
        profileData.height = null;
        profileData.weight = null;
        profileData.boxing_style = null;
      } else {
        profileData.tier = null;
        profileData.tier_points = null;
        profileData.skill_points = 0;
        profileData.membership_type = null;
      }

      console.log('[signUp] profileData (upsert 시도):', profileData);

      // upsert: 트리거가 이미 만들었으면 role/name만 업데이트, 없으면 생성
      // 실패해도 auth 계정은 생성됐으므로 에러를 throw하지 않음
      const { error: profileError } = await supabase
        .from('users')
        .upsert([profileData], { onConflict: 'id' });

      if (profileError) {
        console.warn('[signUp] users upsert 경고 (트리거가 처리했을 수 있음):', profileError.message);
      } else {
        console.log('[signUp] users 테이블 upsert 성공');
      }

      // 3. statistics / tier_rankings 초기화 (athlete, coach만)
      const { error: privateProfileError } = await supabase
        .from('user_private_profiles')
        .upsert([privateProfileData], { onConflict: 'user_id' });

      if (privateProfileError) {
        console.warn('[signUp] user_private_profiles upsert 경고:', privateProfileError.message);
      }

      if (PLAYER_ROLES.includes(normalizedRole)) {
        const { error: statsError } = await supabase
          .from('statistics')
          .upsert([{
            user_id: authData.user.id,
            total_matches: 0, wins: 0, losses: 0, draws: 0,
            ko_wins: 0, win_streak: 0, total_attendance: 0, current_streak: 0,
          }], { onConflict: 'user_id' });

        if (statsError) {
          console.warn('[signUp] statistics upsert 경고:', statsError.message);
        } else {
          console.log('[signUp] statistics 초기화 성공');
        }

        const { error: rankError } = await supabase
          .from('tier_rankings')
          .upsert([{
            user_id: authData.user.id,
            rank: null, previous_rank: null, rank_change: 0,
          }], { onConflict: 'user_id' });

        if (rankError) {
          console.warn('[signUp] tier_rankings upsert 경고:', rankError.message);
        } else {
          console.log('[signUp] tier_rankings 초기화 성공');
        }
      }
    }

    console.log('[signUp] 회원가입 전체 프로세스 완료');
    return { data: authData, error: null };
  } catch (error) {
    console.error('[signUp] 회원가입 에러:', error);
    return { data: null, error };
  }
};

// 로그인
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 로그아웃
export const signOut = async () => {
  try {
    console.log('[signOut] 로그아웃 요청');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[signOut] 로그아웃 에러:', error);
      throw error;
    }
    console.log('[signOut] 로그아웃 성공');
    return { error: null };
  } catch (error) {
    console.error('[signOut] 로그아웃 예외:', error);
    return { error };
  }
};

// 현재 사용자 가져오기 — getUser()는 서버 검증이라 네트워크 일시 오류 시 null이 될 수 있음.
// 클라이언트 지속 로그인은 로컬 세션(getSession)을 우선해 흔들리지 않게 함.
export const getCurrentUser = async () => {
  try {
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (!sessionErr && session?.user) {
      return { user: session.user, error: null };
    }
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      const { data: { session: s2 } } = await supabase.auth.getSession();
      if (s2?.user) {
        console.warn('[getCurrentUser] getUser 실패, 로컬 세션 유지:', error?.message || error);
        return { user: s2.user, error: null };
      }
      throw error;
    }
    return { user: user ?? null, error: null };
  } catch (error) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      console.warn('[getCurrentUser] 예외 후 로컬 세션 유지:', error?.message || error);
      return { user: session.user, error: null };
    }
    return { user: null, error };
  }
};

function isRetryableProfileError(err) {
  if (!err) return false;
  const msg = String(err.message || err.code || err).toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('network error') || msg.includes('load failed')) {
    return true;
  }
  if (msg.includes('timeout') || msg.includes('timed out')) return true;
  if (msg.includes('fetch')) return true;
  return false;
}

/** 단일 시도 — 로컬 세션(getSession)으로 본인 여부 확인 후 RPC (모바일에서 getUser 실패와 무관) */
async function getUserProfileOnce(userId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    let authId = session?.user?.id;
    if (!authId || authId !== userId) {
      const { data: { user: gu } } = await supabase.auth.getUser();
      if (gu?.id === userId) authId = gu.id;
    }

    if (authId === userId) {
      const { data: rpc, error: rpcErr } = await supabase.rpc('get_my_profile');
      debugLogDe1eee('supabase.js:getUserProfileOnce:get_my_profile', 'rpc_get_my_profile', {
        hypothesisId: 'B',
        runId: 'post-fix',
        rpcErr: rpcErr ? String(rpcErr.message || rpcErr.code || rpcErr).slice(0, 120) : null,
        rpcOk: rpc?.ok,
        rpcErrField: rpc?.error || null,
        hasUser: Boolean(rpc?.user),
      });
      if (!rpcErr && rpcProfilePayloadOk(rpc)) {
        const data = await profileFromMyProfileRpc(rpc, userId);
        if (data) return { data, error: null };
      }
      if (rpcErr) {
        console.warn('[getUserProfile] get_my_profile RPC 실패, 복구·테이블 조회로 재시도:', rpcErr.message);
      } else if (rpc && rpc.ok === false) {
        console.warn('[getUserProfile] get_my_profile ok=false:', rpc.error || rpc);
      }

      // auth.users만 있고 public.users 행이 없을 때 — 클라이언트 upsert는 RLS에 막힐 수 있음 (sql/24)
      const { data: ensured, error: ensErr } = await supabase.rpc('ensure_my_profile_from_auth');
      debugLogDe1eee('supabase.js:getUserProfileOnce:ensure', 'rpc_ensure_my_profile', {
        hypothesisId: 'B',
        runId: 'post-fix',
        ensErr: ensErr ? String(ensErr.message || ensErr.code || ensErr).slice(0, 120) : null,
        ensOk: ensured?.ok,
        ensErrField: ensured?.error || null,
        hasUser: Boolean(ensured?.user),
      });
      if (!ensErr && rpcProfilePayloadOk(ensured)) {
        const data = await profileFromMyProfileRpc(ensured, userId);
        if (data) return { data, error: null };
      }
      if (ensErr && ensErr.code !== 'PGRST202') {
        console.warn('[getUserProfile] ensure_my_profile_from_auth:', ensErr.message);
      }
    } else {
      debugLogDe1eee('supabase.js:getUserProfileOnce:auth_mismatch', 'authId_mismatch', {
        hypothesisId: 'C',
        runId: 'post-fix',
        authId: authId || null,
        userId,
      });
    }

    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        user_private_profiles (
          phone,
          birth_date,
          representative_phone
        )
      `)
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const { data: ensured, error: ensErr } = await supabase.rpc('ensure_my_profile_from_auth');
      if (!ensErr && rpcProfilePayloadOk(ensured)) {
        const row = await profileFromMyProfileRpc(ensured, userId);
        if (row) return { data: row, error: null };
      }
      debugLogDe1eee('supabase.js:getUserProfileOnce:no_row', 'users_table_empty', {
        hypothesisId: 'B',
        runId: 'post-fix',
        userId,
        ensErr2: ensErr ? String(ensErr.message || ensErr.code).slice(0, 100) : null,
      });
      return { data: null, error: new Error('users 행 없음') };
    }
    const flat = flattenProfile(data);
    const enriched = await attachStatisticsAndTier(userId, flat);
    return { data: enriched, error: null };
  } catch (error) {
    debugLogDe1eee('supabase.js:getUserProfileOnce:catch', 'getUserProfileOnce_throw', {
      hypothesisId: 'B',
      runId: 'post-fix',
      err: String(error?.message || error).slice(0, 160),
    });
    return { data: null, error };
  }
}

// 사용자 프로필 가져오기 (모바일·느린망에서 일시 오류 시 자동 재시도)
export const getUserProfile = async (userId) => {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await getUserProfileOnce(userId);
    if (data) return { data, error: null };
    lastErr = error;
    if (attempt < 2 && isRetryableProfileError(error)) {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      continue;
    }
    break;
  }
  return { data: null, error: lastErr };
};

// 사용자 프로필 업데이트
export const updateUserProfile = async (userId, updates) => {
  try {
    const publicUpdates = { ...updates };
    const privateUpdates = {
      user_id: userId,
    };

    ['phone', 'birth_date', 'representative_phone'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(publicUpdates, key)) {
        privateUpdates[key] = publicUpdates[key];
        delete publicUpdates[key];
      }
    });

    let publicError = null;
    let privateError = null;

    if (Object.keys(publicUpdates).length > 0) {
      const { error } = await supabase
        .from('users')
        .update(publicUpdates)
        .eq('id', userId);

      publicError = error;
    }

    if (Object.keys(privateUpdates).length > 1) {
      const { error } = await supabase
        .from('user_private_profiles')
        .upsert([privateUpdates], { onConflict: 'user_id' });

      privateError = error;
    }

    if (publicError) throw publicError;
    if (privateError) throw privateError;

    const { data, error } = await getUserProfile(userId);
    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const getPublicPlayerProfiles = async () => {
  try {
    const { data, error } = await supabase
      .from('public_player_profiles')
      .select('*')
      .order('rank', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return { data: (data || []).map(enrichPublicPlayerRow), error: null };
  } catch (error) {
    return { data: [], error };
  }
};

export const searchPublicPlayerProfiles = async (searchQuery) => {
  try {
    const keyword = searchQuery?.trim();
    if (!keyword) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('public_player_profiles')
      .select('*')
      .or(`display_name.ilike.*${keyword}*,name.ilike.*${keyword}*,nickname.ilike.*${keyword}*`)
      .order('rank', { ascending: true, nullsFirst: false })
      .limit(8);

    if (error) throw error;
    return { data: (data || []).map(enrichPublicPlayerRow), error: null };
  } catch (error) {
    return { data: [], error };
  }
};

export const getPublicPlayerProfileById = async (playerId) => {
  try {
    const { data, error } = await supabase
      .from('public_player_profiles')
      .select('*')
      .eq('id', playerId)
      .single();

    if (error) throw error;
    return { data: enrichPublicPlayerRow(data), error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 전화번호로 사용자 검색 (출석 키오스크용)
export const searchUserByPhone = async (phoneLastFour) => {
  try {
    const { data, error } = await supabase.rpc('search_members_by_phone_last4', {
      phone_last_four: phoneLastFour,
    });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 회원 멤버십 타입 업데이트
export const updateMembershipType = async (userId, membershipType) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ membership_type: membershipType })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 출석 체크
export const checkAttendance = async (userId, location = null) => {
  try {
    console.log('[checkAttendance] 출석 체크 시작:', userId);
    
    const today = new Date().toISOString().split('T')[0];

    // 오늘 이미 출석했는지 확인 (attendance_date 기준)
    const { data: existingAttendance, error: checkError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('attendance_date', today)
      .maybeSingle();

    if (existingAttendance) {
      console.log('[checkAttendance] 이미 출석함:', existingAttendance);
      return { 
        data: existingAttendance, 
        error: null, 
        message: '이미 출석 체크되었습니다.' 
      };
    }

    // 출석 기록 추가
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .insert([
        {
          user_id: userId,
          location: location,
          attendance_date: today
        },
      ])
      .select()
      .single();

    if (attendanceError) {
      console.error('[checkAttendance] 출석 기록 추가 실패:', attendanceError);
      throw attendanceError;
    }
    
    console.log('[checkAttendance] 출석 기록 추가 성공:', attendanceData);

    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('skill_points')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('[checkAttendance] 출석 후 사용자 조회 실패:', userError);
    }

    return { 
      data: attendanceData, 
      error: null, 
      message: '출석 체크 완료!',
      skillPointsAdded: 1,
      totalSkillPoints: currentUser?.skill_points || null
    };
  } catch (error) {
    console.error('[checkAttendance] 출석 체크 예외:', error);
    return { data: null, error, message: '출석 체크 실패' };
  }
};

// 출석 키오스크용 체크인
export const kioskCheckAttendance = async (userId, location = null) => {
  try {
    const { data, error } = await supabase.rpc('kiosk_check_attendance', {
      target_user_id: userId,
      location_text: location,
    });

    if (error) throw error;

    const attendanceData = Array.isArray(data) ? data[0] : data;

    return {
      data: attendanceData,
      error: null,
      message: attendanceData?.message || '출석 체크 완료!',
      skillPointsAdded: attendanceData?.message === '출석 체크 완료!' ? 1 : 0,
      totalSkillPoints: attendanceData?.total_skill_points || null,
    };
  } catch (error) {
    return { data: null, error, message: '출석 체크 실패' };
  }
};

// 사용자의 출석 기록 가져오기
export const getUserAttendance = async (userId, startDate = null, endDate = null) => {
  try {
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .order('check_in_time', { ascending: false });

    if (startDate) {
      query = query.gte('check_in_time', startDate);
    }
    if (endDate) {
      query = query.lte('check_in_time', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 카테고리 목록 가져오기 (categories 테이블 생성 전까지 비활성화)
// export const getCategories = async (type = null) => {
//   try {
//     let query = supabase
//       .from('categories')
//       .select('*')
//       .eq('is_active', true)
//       .order('sort_order', { ascending: true });

//     if (type) {
//       query = query.eq('type', type);
//     }

//     const { data, error } = await query;

//     if (error) throw error;
//     return { data, error: null };
//   } catch (error) {
//     return { data: null, error };
//   }
// };

// ============================================
// 스킬 관련 함수
// ============================================

// 사용자의 스킬 목록 가져오기
export const getUserSkills = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 스킬 요청하기
export const requestSkill = async (userId, skillData) => {
  try {
    const { data, error } = await supabase
      .from('skills')
      .insert([
        {
          user_id: userId,
          skill_name: skillData.skill_name,
          skill_type: skillData.skill_type,
          tier: skillData.tier,
          description: skillData.description || null,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 스킬 승인/거절 (코치용)
export const updateSkillStatus = async (skillId, status, coachId) => {
  try {
    const { data, error } = await supabase
      .from('skills')
      .update({ 
        status: status,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        approved_by: status === 'approved' ? coachId : null,
      })
      .eq('id', skillId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 대기 중인 스킬 요청 가져오기 (코치용)
export const getPendingSkills = async () => {
  try {
    const { data, error } = await supabase
      .from('skills')
      .select(`
        *,
        users:user_id (name, tier)
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// ============================================
// 경기 기록 관련 함수
// ============================================

/** users RLS로 조인 시 상대가 비는 문제 방지: 공개 프로필 뷰로 표시명 조회 */
async function fetchPlayerDisplayByIds(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from('public_player_profiles')
    .select('id, name, nickname, display_name, tier')
    .in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((p) => [p.id, p]));
}

// 사용자의 경기 기록 가져오기
export const getUserMatches = async (userId, limit = null) => {
  try {
    let query = supabase
      .from('matches')
      .select('*')
      .or(`user_id.eq.${userId},opponent_id.eq.${userId}`)
      .order('played_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const otherIds = rows.map((m) => (m.user_id === userId ? m.opponent_id : m.user_id));
    const profileMap = await fetchPlayerDisplayByIds(otherIds);

    const normalizedData = rows.map((match) => {
      const oid = match.user_id === userId ? match.opponent_id : match.user_id;
      const opp = oid ? profileMap.get(oid) : null;
      return {
        ...match,
        opponent: opp
          ? { id: opp.id, name: opp.name, nickname: opp.nickname, tier: opp.tier }
          : null,
        opponent_name: opp?.nickname || opp?.display_name || opp?.name || null,
      };
    });

    return { data: normalizedData, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 경기 결과 추가
export const addMatch = async (matchData) => {
  try {
    const payload = {
      ...matchData,
      played_at: matchData.played_at || matchData.match_date || new Date().toISOString(),
    };

    delete payload.match_date;

    const { data, error } = await supabase
      .from('matches')
      .insert([payload])
      .select('*')
      .single();

    if (error) throw error;

    const oppId = data?.opponent_id;
    const profileMap = await fetchPlayerDisplayByIds(oppId ? [oppId] : []);
    const opp = oppId ? profileMap.get(oppId) : null;

    return {
      data: {
        ...data,
        opponent: opp
          ? { id: opp.id, name: opp.name, nickname: opp.nickname, tier: opp.tier }
          : null,
        opponent_name: opp?.nickname || opp?.display_name || opp?.name || null,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
};

// 코치 매치룸용: 양 선수 전적을 동시에 저장하고 통계를 반영
export const submitMatchResult = async ({
  blueUserId,
  redUserId,
  winnerCorner, // 'blue' | 'red' | 'draw'
  finishMethod = 'decision',
  blueScore = 0,
  redScore = 0,
  roundsPlayed = 3,
  playedAt = null,
}) => {
  try {
    if (!blueUserId || !redUserId) {
      throw new Error('경기 결과 저장에 필요한 선수 정보가 없습니다.');
    }

    const normalizedWinner = winnerCorner === 'draw' ? 'draw' : winnerCorner;
    const blueResult = normalizedWinner === 'draw' ? 'draw' : normalizedWinner === 'blue' ? 'win' : 'loss';
    const redResult = normalizedWinner === 'draw' ? 'draw' : normalizedWinner === 'red' ? 'win' : 'loss';
    const methodLabelMap = {
      rsc: 'TKO',
      tko: 'TKO',
      ko: 'KO',
      forced: 'forced_stop',
      decision: 'decision',
    };
    const methodLabel = methodLabelMap[finishMethod] || finishMethod || 'decision';
    const matchPlayedAt = playedAt || new Date().toISOString();

    const payload = [
      {
        user_id: blueUserId,
        opponent_id: redUserId,
        result: blueResult,
        method: methodLabel,
        score: `${blueScore}-${redScore}`,
        rounds: roundsPlayed,
        played_at: matchPlayedAt,
      },
      {
        user_id: redUserId,
        opponent_id: blueUserId,
        result: redResult,
        method: methodLabel,
        score: `${redScore}-${blueScore}`,
        rounds: roundsPlayed,
        played_at: matchPlayedAt,
      },
    ];

    const { data: insertedMatches, error: insertError } = await supabase
      .from('matches')
      .insert(payload)
      .select('*');

    if (insertError) throw insertError;

    const updateStatistics = async (userId, result, isRscWin) => {
      const { data: currentStats, error: fetchError } = await supabase
        .from('statistics')
        .select('user_id, total_matches, wins, losses, draws, ko_wins')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const base = currentStats || {
        user_id: userId,
        total_matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        ko_wins: 0,
      };

      const nextStats = {
        user_id: userId,
        total_matches: (base.total_matches || 0) + 1,
        wins: (base.wins || 0) + (result === 'win' ? 1 : 0),
        losses: (base.losses || 0) + (result === 'loss' ? 1 : 0),
        draws: (base.draws || 0) + (result === 'draw' ? 1 : 0),
        ko_wins: (base.ko_wins || 0) + (isRscWin ? 1 : 0),
      };

      const { error: upsertError } = await supabase
        .from('statistics')
        .upsert([nextStats], { onConflict: 'user_id' });

      if (upsertError) throw upsertError;
    };

    await Promise.all([
      updateStatistics(blueUserId, blueResult, (methodLabel === 'RSC' || methodLabel === 'TKO' || methodLabel === 'KO') && blueResult === 'win'),
      updateStatistics(redUserId, redResult, (methodLabel === 'RSC' || methodLabel === 'TKO' || methodLabel === 'KO') && redResult === 'win'),
    ]);

    return { data: insertedMatches, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const GYM_MEMBER_SELECT = `
  id,
  name,
  nickname,
  email,
  gender,
  gym_name,
  gym_user_id,
  membership_type,
  height,
  weight,
  boxing_style,
  tier,
  tier_points,
  created_at,
  role,
  statistics (
    total_matches,
    wins,
    losses,
    draws,
    total_attendance,
    ko_wins
  ),
  user_private_profiles (
    phone,
    birth_date,
    representative_phone
  ),
  tier_rankings (
    rank
  )
`;

/**
 * 체육관 회원관리: 소속 체육관 계정 id(gym_user_id) 우선, 없으면 gym_name 레거시 매칭.
 * RLS: sql/12_gym_members_rls.sql + sql/13_gym_user_id.sql
 */
export const getGymMembersForGym = async ({ gymUserId, gymName } = {}) => {
  try {
    const gid = gymUserId ? String(gymUserId).trim() : '';
    const g = String(gymName || '').trim();
    if (!gid && !g) {
      return { data: [], error: null };
    }

    let query = supabase
      .from('users')
      .select(GYM_MEMBER_SELECT)
      .in('role', ['player_common', 'player_athlete']);

    if (gid && g) {
      query = query.or(`gym_user_id.eq.${gid},and(gym_name.eq.${g},gym_user_id.is.null)`);
    } else if (gid) {
      query = query.eq('gym_user_id', gid);
    } else {
      query = query.eq('gym_name', g);
    }

    const { data, error } = await query.order('name', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('[getGymMembersForGym]', error);
    return { data: null, error };
  }
};

/** @deprecated Prefer getGymMembersForGym({ gymUserId, gymName }) */
export const getGymMembersByGymName = async (gymName) =>
  getGymMembersForGym({ gymUserId: null, gymName });

// ============================================
// 훈련 기록 관련 함수
// ============================================

// 사용자의 훈련 기록 가져오기
export const getUserWorkouts = async (userId, startDate = null, endDate = null) => {
  try {
    let query = supabase
      .from('workouts')
      .select(`
        *,
        workout_exercises (*)
      `)
      .eq('user_id', userId)
      .order('workout_date', { ascending: false });

    if (startDate) {
      query = query.gte('workout_date', startDate);
    }
    if (endDate) {
      query = query.lte('workout_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 훈련 기록 추가
export const addWorkout = async (workoutData, exercises) => {
  try {
    // 1. workout 추가
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert([workoutData])
      .select()
      .single();

    if (workoutError) throw workoutError;

    // 2. exercises 추가
    if (exercises && exercises.length > 0) {
      const exercisesWithWorkoutId = exercises.map(ex => ({
        ...ex,
        workout_id: workout.id,
      }));

      const { error: exercisesError } = await supabase
        .from('workout_exercises')
        .insert(exercisesWithWorkoutId);

      if (exercisesError) throw exercisesError;
    }

    return { data: workout, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// ============================================
// 통계 관련 함수
// ============================================

// 사용자 통계 가져오기
export const getUserStatistics = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('statistics')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// ============================================
// 랭킹 관련 함수
// ============================================

// 티어 랭킹 가져오기
export const getTierRankings = async (limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('tier_rankings')
      .select(`
        *,
        users (name, tier, tier_points)
      `)
      .order('rank', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 매치 결과 기반 리더보드 (전체 수집 후 정렬 → 티어보드·실시간 랭킹과 동일한 순서)
export const getMatchLeaderboard = async (limit = 200) => {
  try {
    const { data: players, error: playersError } = await supabase
      .from('public_player_profiles')
      .select('*');

    if (playersError) throw playersError;

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('user_id, opponent_id, played_at')
      .order('played_at', { ascending: false })
      .limit(5000);

    if (matchesError) throw matchesError;

    const latestMatchByUser = {};
    (matches || []).forEach((match) => {
      const t = match?.played_at;
      if (!t) return;
      const uid = match.user_id;
      const oid = match.opponent_id;
      if (uid && !latestMatchByUser[uid]) latestMatchByUser[uid] = t;
      if (oid && !latestMatchByUser[oid]) latestMatchByUser[oid] = t;
    });

    const enriched = (players || []).map((player) => {
      const wins = Number(player.wins || 0);
      const losses = Number(player.losses || 0);
      const draws = Number(player.draws || 0);
      const totalMatches = Number(player.total_matches || wins + losses + draws || 0);
      const winRate = totalMatches > 0
        ? Number(((wins / totalMatches) * 100).toFixed(1))
        : Number(player.win_rate || 0);
      const matchPoints = computeMatchPoints(wins, draws, losses);
      const lastMatchAt = latestMatchByUser[player.id] || player.last_match_at || null;
      const qualified = totalMatches >= 5;

      const isGym = player.role === 'gym';
      const tierLabel = isGym ? player.tier : getTierLabelFromMatchPoints(matchPoints);
      return {
        ...player,
        wins,
        losses,
        draws,
        total_matches: totalMatches,
        win_rate: winRate,
        match_points: matchPoints,
        tier: tierLabel,
        tier_points: isGym ? player.tier_points : matchPoints,
        last_match_at: lastMatchAt,
        qualified_rank: qualified,
      };
    });

    enriched.sort((a, b) => {
      if (a.qualified_rank !== b.qualified_rank) return a.qualified_rank ? -1 : 1;
      if ((b.match_points || 0) !== (a.match_points || 0)) return (b.match_points || 0) - (a.match_points || 0);
      if ((b.win_rate || 0) !== (a.win_rate || 0)) return (b.win_rate || 0) - (a.win_rate || 0);
      if ((b.total_matches || 0) !== (a.total_matches || 0)) return (b.total_matches || 0) - (a.total_matches || 0);
      const aTime = a.last_match_at ? new Date(a.last_match_at).getTime() : 0;
      const bTime = b.last_match_at ? new Date(b.last_match_at).getTime() : 0;
      return bTime - aTime;
    });

    let qualifiedRank = 0;
    const ranked = enriched.map((player, index) => {
      const displayRank = index + 1;
      if (player.qualified_rank) {
        qualifiedRank += 1;
        return { ...player, match_rank: qualifiedRank, rank_label: `${displayRank}` };
      }
      return { ...player, match_rank: null, rank_label: `${displayRank}` };
    });

    const sliced =
      typeof limit === 'number' && limit > 0 ? ranked.slice(0, limit) : ranked;
    return { data: sliced, error: null };
  } catch (error) {
    return { data: [], error };
  }
};

// 전체 선수 목록 가져오기 (코치용)
export const getAllAthletes = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        statistics (*),
        tier_rankings (rank, rank_change)
      `)
      .in('role', PLAYER_ROLES)
      .order('tier_points', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// ==========================================
// 가챠 시스템 API
// ==========================================

// 유저 인벤토리 조회
export const getUserInventory = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getUserInventory] 에러:', error);
    return { data: null, error };
  }
};

// 가챠 확률 계산
const calculateGachaRarity = (pityCounter = 0) => {
  // 천장 시스템: 200회 도달 시 전설 확정
  if (pityCounter >= 200) {
    return 'legendary';
  }

  // 기본 확률 (천장 카운터에 따라 전설 확률 증가)
  const legendaryBoost = Math.min(pityCounter * 0.01, 2.0); // 최대 2% 증가
  
  const probabilities = {
    legendary: 1.5 + legendaryBoost,
    epic: 8.5,
    rare: 40.0,
    normal: 50.0 - legendaryBoost
  };

  const random = Math.random() * 100;
  let cumulative = 0;

  for (const [rarity, probability] of Object.entries(probabilities)) {
    cumulative += probability;
    if (random <= cumulative) {
      return rarity;
    }
  }

  return 'normal';
};

// 가챠 실행 (단일)
const performSingleGacha = async (userId, pityCounter) => {
  // 1. 등급 결정
  const rarity = calculateGachaRarity(pityCounter);
  
  // 2. 해당 등급의 카드 중 랜덤 선택
  const { data: cards, error } = await supabase
    .from('skill_cards')
    .select('*')
    .eq('rarity', rarity);

  if (error || !cards || cards.length === 0) {
    console.error('[performSingleGacha] 카드 조회 에러:', error);
    return null;
  }

  const selectedCard = cards[Math.floor(Math.random() * cards.length)];
  
  // 3. 완제품(10%) vs 조각(90%) 결정
  const isFullCard = Math.random() < 0.1; // 10% 확률로 완제품

  return {
    card: selectedCard,
    isFullCard,
    rarity
  };
};

// 가챠 실행 (메인 함수)
export const performGacha = async (userId, pullCount = 1) => {
  try {
    console.log(`[performGacha] ${pullCount}회 가챠 시작:`, userId);

    // 1. 인벤토리 확인
    const { data: inventory } = await getUserInventory(userId);
    if (!inventory) {
      return { data: null, error: { message: '인벤토리를 찾을 수 없습니다.' } };
    }

    // 2. 코인/무료권 확인
    const costPerPull = 50; // 1회당 50코인
    const totalCost = pullCount * costPerPull;
    
    const availableCoins = inventory.coins + (inventory.free_pulls * costPerPull);
    if (availableCoins < totalCost) {
      return { 
        data: null, 
        error: { message: `코인이 부족합니다. (필요: ${totalCost}, 보유: ${availableCoins})` } 
      };
    }

    // 3. 가챠 실행
    const results = [];
    let currentPity = inventory.pity_counter || 0;

    for (let i = 0; i < pullCount; i++) {
      const result = await performSingleGacha(userId, currentPity);
      if (result) {
        results.push(result);
        
        // 전설 뽑으면 천장 카운터 리셋
        if (result.rarity === 'legendary') {
          currentPity = 0;
        } else {
          currentPity++;
        }
      }
    }

    // 4. 카드 지급 처리
    for (const result of results) {
      const { card, isFullCard } = result;
      
      // 이미 보유한 카드인지 확인
      const { data: existingCard } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', userId)
        .eq('card_id', card.id)
        .maybeSingle();

      if (existingCard) {
        // 이미 보유 중 - 조각 추가
        const fragmentsToAdd = isFullCard ? 5 : 1;
        await supabase
          .from('user_cards')
          .update({ 
            fragment_count: existingCard.fragment_count + fragmentsToAdd,
            obtained_at: new Date().toISOString()
          })
          .eq('id', existingCard.id);
      } else {
        // 신규 카드 - 보관함에 추가
        await supabase
          .from('user_cards')
          .insert([{
            user_id: userId,
            card_id: card.id,
            level: isFullCard ? 1 : 0, // 완제품이면 Lv.1, 조각이면 Lv.0
            fragment_count: isFullCard ? 0 : 1,
            obtained_at: new Date().toISOString()
          }]);
      }
    }

    // 5. 인벤토리 업데이트 (코인 차감, 천장 카운터)
    const usedFree = Math.min(inventory.free_pulls, pullCount);
    const usedCoins = (pullCount - usedFree) * costPerPull;

    await supabase
      .from('user_inventory')
      .update({
        coins: inventory.coins - usedCoins,
        free_pulls: inventory.free_pulls - usedFree,
        total_pulls: inventory.total_pulls + pullCount,
        pity_counter: currentPity,
        last_updated: new Date().toISOString()
      })
      .eq('user_id', userId);

    // 6. 가챠 히스토리 기록
    await supabase
      .from('gacha_history')
      .insert([{
        user_id: userId,
        pull_count: pullCount,
        cost_coins: usedCoins,
        cards_obtained: JSON.stringify(results.map(r => ({
          card_id: r.card.id,
          card_name: r.card.name,
          rarity: r.rarity,
          is_full_card: r.isFullCard
        }))),
        pity_before: inventory.pity_counter,
        pity_after: currentPity
      }]);

    console.log('[performGacha] 가챠 완료:', results.length, '개');
    return { data: { results, pityCounter: currentPity }, error: null };
  } catch (error) {
    console.error('[performGacha] 에러:', error);
    return { data: null, error };
  }
};

// 유저 보유 카드 조회
export const getUserCards = async (userId, filters = {}) => {
  try {
    let query = supabase
      .from('user_cards_detailed')
      .select('*')
      .eq('user_id', userId)
      .order('obtained_at', { ascending: false });

    if (filters.rarity) {
      query = query.eq('rarity', filters.rarity);
    }
    if (filters.card_type) {
      query = query.eq('card_type', filters.card_type);
    }
    if (filters.is_equipped !== undefined) {
      query = query.eq('is_equipped', filters.is_equipped);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getUserCards] 에러:', error);
    return { data: null, error };
  }
};

// 모든 스킬 카드 조회 (도감용)
export const getAllSkillCards = async () => {
  try {
    const { data, error } = await supabase
      .from('skill_cards')
      .select(`
        *,
        master:skill_masters(*)
      `)
      .order('rarity', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getAllSkillCards] 에러:', error);
    return { data: null, error };
  }
};

// 스킬 트리 노드 전체 조회
export const getSkillTreeNodes = async () => {
  try {
    const { data, error } = await supabase
      .from('skill_tree_nodes')
      .select('*')
      .order('node_number', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getSkillTreeNodes] 에러:', error);
    return { data: null, error };
  }
};

// 유저의 스킬 트리 상태 조회 (레거시: 카드 장착 기준)
export const getUserSkillTree = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_cards')
      .select(`
        *,
        card:skill_cards(*),
        node:skill_tree_nodes(*)
      `)
      .eq('user_id', userId)
      .eq('is_equipped', true);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getUserSkillTree] 에러:', error);
    return { data: null, error };
  }
};

/** 스킬 포인트로 찍은 노드 목록 (user_skill_unlocks, DB 내부 이름 유지) */
export const getUserSkillUnlocks = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_skill_unlocks')
      .select('node_id')
      .eq('user_id', userId);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getUserSkillUnlocks] 에러:', error);
    return { data: null, error };
  }
};

/** 노드별 투자·승단 진행 (갈림길 등) */
export const getUserSkillNodeProgress = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_skill_node_progress')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getUserSkillNodeProgress] 에러:', error);
    return { data: null, error };
  }
};

/** 노드별 진행 + 트리 노드 메타 (대시보드 캘린더 등) */
export const getUserSkillNodeProgressWithNodes = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_skill_node_progress')
      .select(`
        *,
        node:skill_tree_nodes (id, node_number, name, name_en, zone)
      `)
      .eq('user_id', userId);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getUserSkillNodeProgressWithNodes] 에러:', error);
    return { data: null, error };
  }
};

/** 노드에 스킬 포인트 투자 (포크·일반 공통 RPC) */
export const investSkillNodeRpc = async (nodeId) => {
  try {
    const targetId =
      typeof nodeId === 'number' && !Number.isNaN(nodeId) ? nodeId : parseInt(String(nodeId), 10);
    if (Number.isNaN(targetId)) {
      return { data: null, error: { message: '잘못된 노드입니다.' } };
    }

    const { data, error } = await supabase.rpc('invest_skill_node', { target_node_id: targetId });

    if (error) throw error;
    if (data && typeof data === 'object' && data.ok === false) {
      return { data: null, error: { message: mapInvestError(data.error) } };
    }
    return { data, error: null };
  } catch (error) {
    console.error('[investSkillNodeRpc] 에러:', error);
    return { data: null, error };
  }
};

/** 레거시: 비포크는 unlock_skill_node → invest로 위임 */
export const unlockSkillNodeRpc = async (nodeId) => {
  return investSkillNodeRpc(nodeId);
};

/** 스킬 트리 전체 초기화 (초기화권 1장·사용 SP 환급) */
export const resetSkillTreeWithTicketRpc = async () => {
  try {
    const { data, error } = await supabase.rpc('reset_skill_tree_with_ticket');
    if (error) throw error;
    if (data && typeof data === 'object' && data.ok === false) {
      return { data: null, error: { message: mapResetSkillTreeError(data.error) } };
    }
    return { data, error: null };
  } catch (error) {
    console.error('[resetSkillTreeWithTicketRpc] 에러:', error);
    return { data: null, error };
  }
};

function mapResetSkillTreeError(code) {
  const m = {
    not_authenticated: '로그인이 필요합니다.',
    no_user: '사용자 정보를 찾을 수 없습니다.',
    no_reset_ticket: '스킬 초기화권이 없습니다.',
  };
  return m[code] || code || '스킬 트리를 초기화하지 못했습니다.';
}

export const submitSkillPromotionRequestRpc = async (forkNodeId) => {
  try {
    const { data, error } = await supabase.rpc('submit_skill_promotion_request', { fork_node_id: forkNodeId });

    if (error) throw error;
    if (data && typeof data === 'object' && data.ok === false) {
      return { data: null, error: { message: mapPromotionSubmitError(data.error, data) } };
    }
    return { data, error: null };
  } catch (error) {
    console.error('[submitSkillPromotionRequestRpc] 에러:', error);
    return { data: null, error };
  }
};

export const gymStartPromotionReviewRpc = async (requestId) => {
  try {
    const { data, error } = await supabase.rpc('gym_start_promotion_review', { request_id: requestId });

    if (error) throw error;
    if (data && typeof data === 'object' && data.ok === false) {
      return { data: null, error: { message: mapGymPromotionError(data.error) } };
    }
    return { data, error: null };
  } catch (error) {
    console.error('[gymStartPromotionReviewRpc] 에러:', error);
    return { data: null, error };
  }
};

export const gymResolvePromotionRequestRpc = async (requestId, approved, chosenChildNodeId, notes = null) => {
  try {
    const { data, error } = await supabase.rpc('gym_resolve_promotion_request', {
      request_id: requestId,
      approved,
      chosen_child_node_id: chosenChildNodeId,
      p_notes: notes,
    });

    if (error) throw error;
    if (data && typeof data === 'object' && data.ok === false) {
      return { data: null, error: { message: mapGymPromotionError(data.error) } };
    }
    return { data, error: null };
  } catch (error) {
    console.error('[gymResolvePromotionRequestRpc] 에러:', error);
    return { data: null, error };
  }
};

/** 체육관 소속 승단 신청 목록 (RLS: gym_name 일치) */
export const getGymPromotionRequests = async (status = null) => {
  try {
    let q = supabase
      .from('skill_promotion_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getGymPromotionRequests] 에러:', error);
    return { data: null, error };
  }
};

/** node_number 목록으로 스킬 노드 조회 (승단 분기 선택용) */
export const getSkillTreeNodesByNumbers = async (nodeNumbers) => {
  try {
    if (!nodeNumbers?.length) return { data: [], error: null };
    const { data, error } = await supabase
      .from('skill_tree_nodes')
      .select('id, name, node_number')
      .in('node_number', nodeNumbers);
    if (error) throw error;
    const order = new Map(nodeNumbers.map((n, i) => [n, i]));
    const sorted = [...(data || [])].sort(
      (a, b) => (order.get(a.node_number) ?? 0) - (order.get(b.node_number) ?? 0)
    );
    return { data: sorted, error: null };
  } catch (error) {
    console.error('[getSkillTreeNodesByNumbers] 에러:', error);
    return { data: null, error };
  }
};

/** 승단 신청 + 회원·갈림길 노드 메타 (관장 화면용) */
export const getGymPromotionRequestsDetailed = async (status = null) => {
  try {
    const { data: rows, error } = await getGymPromotionRequests(status);
    if (error) throw error;
    if (!rows?.length) return { data: [], error: null };

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const forkIds = [...new Set(rows.map((r) => r.fork_node_id))];

    const [{ data: profiles }, { data: forks }] = await Promise.all([
      supabase
        .from('public_player_profiles')
        .select('id, name, nickname, display_name, tier')
        .in('id', userIds),
      supabase
        .from('skill_tree_nodes')
        .select('id, name, node_number, fork_branch_node_numbers, is_fork')
        .in('id', forkIds),
    ]);

    const userMap = new Map((profiles || []).map((u) => [u.id, u]));
    const forkMap = new Map((forks || []).map((n) => [n.id, n]));

    return {
      data: rows.map((r) => ({
        ...r,
        member: userMap.get(r.user_id) || null,
        fork: forkMap.get(r.fork_node_id) || null,
      })),
      error: null,
    };
  } catch (error) {
    console.error('[getGymPromotionRequestsDetailed] 에러:', error);
    return { data: null, error };
  }
};

function mapInvestError(code) {
  const m = {
    not_authenticated: '로그인이 필요합니다.',
    invalid_node: '잘못된 노드입니다.',
    already_unlocked:
      '이미 이 노드에 기록했습니다. 노드당 1회만 찍을 수 있습니다. (DB가 오래되었으면 sql/25_skill_reset_tickets_and_max_one_invest.sql 적용 여부를 확인하세요.)',
    parent_not_unlocked: '먼저 선행 스킬을 찍어 주세요.',
    insufficient_points: '스킬 포인트가 부족합니다. 출석으로 포인트를 모으세요.',
    fork_already_passed: '이 갈림길은 이미 승단이 완료되었습니다.',
    promotion_pending: '승단 심사 대기 중입니다. 체육관 처리를 기다려 주세요.',
    fork_use_promotion_only: '실패 5회 이후에는 투자 없이 승단 신청만 가능합니다.',
    fork_submit_promotion: '필요 투자를 채웠습니다. 승단 신청을 진행해 주세요.',
    use_invest_for_fork: '갈림길 노드는 투자(찍기)로 진행해 주세요.',
    max_investments_reached: '이 노드는 1번만 찍을 수 있습니다.',
  };
  return m[code] || code || '스킬 포인트를 사용하지 못했습니다.';
}

function mapPromotionSubmitError(code, payload) {
  const m = {
    not_authenticated: '로그인이 필요합니다.',
    not_fork_node: '갈림길 노드만 승단 신청할 수 있습니다.',
    no_progress: '먼저 이 노드에 투자해 주세요.',
    already_passed: '이미 승단이 완료된 노드입니다.',
    already_pending: '이미 신청이 접수되었습니다.',
    insufficient_investment: '필요 투자를 채우지 못했습니다.',
    no_gym_assigned: '프로필에 소속 체육관(gym_name)을 입력해야 승단 신청이 가능합니다.',
  };
  if (code === 'insufficient_investment' && payload?.required != null) {
    return `투자가 부족합니다. (필요 ${payload.required}, 현재 ${payload.current ?? 0})`;
  }
  return m[code] || code || '승단 신청에 실패했습니다.';
}

function mapGymPromotionError(code) {
  const m = {
    not_authenticated: '로그인이 필요합니다.',
    forbidden: '권한이 없습니다.',
    not_found: '요청을 찾을 수 없습니다.',
    wrong_gym: '소속 체육관이 일치하지 않습니다.',
    invalid_status: '처리할 수 없는 상태입니다.',
    branch_required: '분기할 자식 노드를 선택해 주세요.',
    invalid_branch: '잘못된 분기입니다.',
    branch_not_in_fork: '이 갈림길에 속한 분기가 아닙니다.',
  };
  return m[code] || code || '처리에 실패했습니다.';
}

// 카드 장착/해제
export const equipCard = async (userCardId, nodeId, equip = true) => {
  try {
    const updates = {
      is_equipped: equip,
      equipped_node_id: equip ? nodeId : null
    };

    const { data, error } = await supabase
      .from('user_cards')
      .update(updates)
      .eq('id', userCardId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[equipCard] 에러:', error);
    return { data: null, error };
  }
};

// 카드 레벨업 (조각 사용)
export const upgradeCard = async (userCardId) => {
  try {
    // 1. 현재 카드 정보 조회
    const { data: userCard, error: fetchError } = await supabase
      .from('user_cards')
      .select('*, card:skill_cards(*)')
      .eq('id', userCardId)
      .single();

    if (fetchError || !userCard) {
      throw fetchError || new Error('카드를 찾을 수 없습니다.');
    }

    // 2. 레벨업 가능 여부 확인
    const requiredFragments = userCard.card.fragments_for_upgrade || 5;
    if (userCard.fragment_count < requiredFragments) {
      return { 
        data: null, 
        error: { message: `조각이 부족합니다. (필요: ${requiredFragments}, 보유: ${userCard.fragment_count})` } 
      };
    }

    if (userCard.level >= userCard.card.max_level) {
      return { data: null, error: { message: '이미 최대 레벨입니다.' } };
    }

    // 3. 레벨업 실행
    const { data, error } = await supabase
      .from('user_cards')
      .update({
        level: userCard.level + 1,
        fragment_count: userCard.fragment_count - requiredFragments,
        upgraded_at: new Date().toISOString()
      })
      .eq('id', userCardId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[upgradeCard] 에러:', error);
    return { data: null, error };
  }
};

// 조각 합성 (Normal 5개 → Rare 1개)
export const synthesizeFragments = async (userId, fragmentIds) => {
  try {
    // TODO: 합성 로직 구현
    // 5개의 Normal 조각 → 1개의 Rare 조각으로 변환
    console.log('[synthesizeFragments] 합성 시작:', fragmentIds);
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error('[synthesizeFragments] 에러:', error);
    return { data: null, error };
  }
};

// 스킬 승인 요청
export const requestSkillApproval = async (userId, cardId, nodeId) => {
  try {
    // 1. 이미 대기 중인 요청이 있는지 확인
    const { data: existing } = await supabase
      .from('skill_approval_queue')
      .select('*')
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .eq('node_id', nodeId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return { data: null, error: { message: '이미 승인 대기 중입니다.' } };
    }

    // 2. 승인 요청 생성
    const { data, error } = await supabase
      .from('skill_approval_queue')
      .insert([{
        user_id: userId,
        card_id: cardId,
        node_id: nodeId,
        status: 'pending',
        requested_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[requestSkillApproval] 에러:', error);
    return { data: null, error };
  }
};

// 승인 대기열 조회 (관장님용)
export const getApprovalQueue = async (status = null) => {
  try {
    let query = supabase
      .from('approval_queue_detailed')
      .select('*')
      .order('requested_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getApprovalQueue] 에러:', error);
    return { data: null, error };
  }
};

// 스킬 승인 처리 (관장님용)
export const approveSkill = async (approvalId, approved, coachId, notes = '') => {
  try {
    const status = approved ? 'approved' : 'rejected';
    
    // 승인 정보 조회
    const { data: approval, error: fetchError } = await supabase
      .from('skill_approval_queue')
      .select('*')
      .eq('id', approvalId)
      .single();

    if (fetchError || !approval) {
      throw fetchError || new Error('승인 요청을 찾을 수 없습니다.');
    }

    // 승인 상태 업데이트
    const { data, error } = await supabase
      .from('skill_approval_queue')
      .update({
        status,
        approved_by: coachId,
        approved_at: new Date().toISOString(),
        notes
      })
      .eq('id', approvalId)
      .select()
      .single();

    if (error) throw error;

    // 승인된 경우 카드 장착
    if (approved && data) {
      // user_cards에서 해당 카드 찾기
      const { data: userCard } = await supabase
        .from('user_cards')
        .select('id')
        .eq('user_id', approval.user_id)
        .eq('card_id', approval.card_id)
        .single();

      if (userCard) {
        await equipCard(userCard.id, approval.node_id, true);
      }
    }

    return { data, error: null };
  } catch (error) {
    console.error('[approveSkill] 에러:', error);
    return { data: null, error };
  }
};

// 도감 진행도 조회
export const getUserCollections = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_collection_progress')
      .select(`
        *,
        collection:collections(*)
      `)
      .eq('user_id', userId);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getUserCollections] 에러:', error);
    return { data: null, error };
  }
};

// 테스트용: 코인 지급
export const addTestCoins = async (userId, amount = 1000) => {
  try {
    const { data: inventory } = await getUserInventory(userId);
    
    const { data, error } = await supabase
      .from('user_inventory')
      .update({
        coins: (inventory?.coins || 0) + amount,
        last_updated: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[addTestCoins] 에러:', error);
    return { data: null, error };
  }
};

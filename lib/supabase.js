import { createClient } from '@supabase/supabase-js';
import {
  computeMatchPoints,
  getTierLabelFromMatchPoints,
} from './tierLadder.js';
import { computeMatchLeaderboard } from './matchLeaderboardCompute.js';
import { enrichPublicPlayerRow } from './publicPlayerEnrich.js';

export { enrichPublicPlayerRow };

const supabaseDevLog = (...args) => {
  if (process.env.NODE_ENV === 'development') console.log(...args);
};

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

async function attachStatisticsAndTier(userId, flat) {
  if (!flat?.id) return flat;
  const { data: stats } = await supabase
    .from('statistics')
    .select('wins,losses,draws')
    .eq('user_id', userId)
    .maybeSingle();
  return enrichPlayerWithMatchTier(flat, stats);
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
    return null;
  }
  const normalized = {
    ...userRow,
    user_private_profiles: priv ? [priv] : [],
  };
  const flat = flattenProfile(normalized);
  if (!flat?.id) {
    return null;
  }
  return attachStatisticsAndTier(userId, flat);
}

// 회원가입
export const signUp = async (email, password, userData) => {
  try {
    supabaseDevLog('[signUp] 회원가입 시작', { role: userData?.role });

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

    // ⛔ Supabase 의 이메일 enumeration 방지 동작:
    //   이메일 확인 활성 + 이미 가입된 이메일이면 error 없이 성공 응답을 주는데
    //   data.user.identities = [] 로 와서 신규 가입이 아님을 표시함.
    //   이 경우를 명시적으로 잡아서 "이미 가입된 이메일" 에러로 변환.
    if (
      authData?.user
      && Array.isArray(authData.user.identities)
      && authData.user.identities.length === 0
    ) {
      supabaseDevLog('[signUp] 중복 이메일 감지 (identities 빈 배열)');
      const dupErr = new Error('User already registered');
      dupErr.code = 'user_already_exists';
      dupErr.status = 422;
      throw dupErr;
    }

    supabaseDevLog('[signUp] Auth 회원가입 성공', authData.user?.id);
    
    // 2. users 테이블에 프로필 생성
    // 참고: auth.users INSERT 트리거(handle_new_user)가 이미 프로필을 생성합니다.
    // 트리거가 실패하거나 기존 환경에서 트리거가 없을 경우를 대비한 fallback upsert입니다.
    if (authData.user) {
      const profileData = {
        id: authData.user.id,
        email: email,
        name: normalizedUserData.name || '사용자',
        nickname: normalizedUserData.nickname || normalizedUserData.name || '사용자',
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
        // gym_name / gym_user_id 는 sql/61 의 handle_new_user_gym_code 트리거가
        // gym_code → gym 으로 resolve 해서 채운다. 여기서 보내면 NULL 로 덮어써져 소속이 끊김.
        profileData.boxing_style =
          normalizedUserData.boxing_style ||
          normalizedUserData.notes ||
          null;
      } else if (normalizedRole === 'player_athlete') {
        profileData.tier = 'Bronze III';
        profileData.tier_points = 0;
        profileData.skill_points = 0;
        profileData.membership_type = normalizedUserData.membership_type || 'basic';
        profileData.height = normalizedUserData.height || null;
        profileData.weight = normalizedUserData.weight || null;
        profileData.boxing_style = normalizedUserData.boxing_style || null;
        // gym_name / gym_user_id 는 sql/61 트리거가 gym_code 로 채움. 여기서 보내면 덮어쓰임.
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

      supabaseDevLog('[signUp] profileData (upsert 시도)', { id: profileData.id, role: profileData.role });

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
          supabaseDevLog('[signUp] statistics 초기화 성공');
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
          supabaseDevLog('[signUp] tier_rankings 초기화 성공');
        }
      }
    }

    supabaseDevLog('[signUp] 회원가입 전체 프로세스 완료');
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

/**
 * 이메일·비밀번호 로그인 계정: 현재 비밀번호로 재검증 후 새 비밀번호로 변경 (Supabase Auth)
 * OAuth 등 비밀번호가 없는 계정은 signInWithPassword 단계에서 실패합니다.
 */
/** 현재 비밀번호만 검증 (업데이트 없이 일치 여부만 확인) */
export const verifyCurrentPassword = async (currentPassword) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const email = session?.user?.email?.trim();
    if (!email) {
      return { ok: false, error: new Error('로그인 세션이 없거나 이메일 계정이 아닙니다.') };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
};

export const changePasswordWithCurrentVerification = async (currentPassword, newPassword) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const email = session?.user?.email?.trim();
    if (!email) {
      return { data: null, error: new Error('로그인 세션이 없거나 이메일 계정이 아닙니다.') };
    }
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyErr) {
      return { data: null, error: verifyErr };
    }
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

/** 비밀번호 재설정 메일 발송 (로그인 화면 «비밀번호 찾기») — Supabase Auth */
export const sendPasswordResetEmail = async (email) => {
  try {
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname || '/'}`
        : undefined;
    const { data, error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
      redirectTo,
    });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

/** 이메일 복구 링크로 세션이 잡힌 뒤 새 비밀번호 설정 (@/components/auth/PasswordRecoveryModal) */
export const setPasswordFromRecoverySession = async (newPassword) => {
  try {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { data: null, error };
    }
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
      if (!ensErr && rpcProfilePayloadOk(ensured)) {
        const data = await profileFromMyProfileRpc(ensured, userId);
        if (data) return { data, error: null };
      }
      if (ensErr && ensErr.code !== 'PGRST202') {
        console.warn('[getUserProfile] ensure_my_profile_from_auth:', ensErr.message);
      }
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
      return { data: null, error: new Error('users 행 없음') };
    }
    const flat = flattenProfile(data);
    const enriched = await attachStatisticsAndTier(userId, flat);
    return { data: enriched, error: null };
  } catch (error) {
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

/** Storage `avatars` 버킷 경로 (항상 동일 파일명으로 덮어쓰기) */
export const userAvatarStoragePath = (userId) => `${userId}/avatar.jpg`;

/**
 * 리사이즈된 JPEG Blob 업로드 + users.avatar_url 갱신 (클라이언트 전용).
 * `sql/31_avatar_url_storage.sql` 로 컬럼·버킷·정책이 있어야 합니다.
 */
export const uploadUserAvatarBlob = async (userId, jpegBlob) => {
  try {
    if (!userId || !jpegBlob) {
      return { data: null, publicUrl: null, error: new Error('Invalid arguments') };
    }
    const supabase = getSupabase();
    const path = userAvatarStoragePath(userId);
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, jpegBlob, {
      upsert: true,
      contentType: 'image/jpeg',
      // CDN/브라우저가 같은 URL 의 옛 이미지를 캐싱하지 않도록 짧은 cache-control
      cacheControl: '0',
    });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const baseUrl = pub?.publicUrl || null;
    if (!baseUrl) throw new Error('공개 URL을 만들 수 없습니다.');

    // 경로는 항상 같으므로 (avatar.jpg 덮어쓰기) URL 끝에 timestamp 쿼리 붙여
    // 브라우저/CDN 캐시 무효화 → 매 업로드마다 즉시 최신 이미지 표시
    const cacheBustedUrl = `${baseUrl.split('?')[0]}?v=${Date.now()}`;

    const { error: dbErr } = await supabase
      .from('users')
      .update({ avatar_url: cacheBustedUrl, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (dbErr) throw dbErr;

    const { data, error: gErr } = await getUserProfile(userId);
    if (gErr) throw gErr;
    return { data, publicUrl: cacheBustedUrl, error: null };
  } catch (error) {
    return { data: null, publicUrl: null, error };
  }
};

/** 스토리지 파일 삭제(실패해도 무시) + users.avatar_url NULL */
export const removeUserAvatar = async (userId) => {
  try {
    if (!userId) return { data: null, error: new Error('Invalid user') };
    const supabase = getSupabase();
    const path = userAvatarStoragePath(userId);
    const { error: rmErr } = await supabase.storage.from('avatars').remove([path]);
    if (rmErr) {
      supabaseDevLog('[removeUserAvatar] storage remove (무시 가능):', rmErr.message);
    }
    const { error: dbErr } = await supabase
      .from('users')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (dbErr) throw dbErr;
    const { data, error: gErr } = await getUserProfile(userId);
    if (gErr) throw gErr;
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

/** 브라우저 anon(401) 또는 서버에서 직접 조회 — DB에 anon GRANT 가 있으면 비로그인도 동작 */
async function searchPublicPlayerProfilesDirect(keyword) {
  const k = keyword.replace(/%/g, '');
  const { data, error } = await supabase
    .from('public_player_profiles')
    .select('*')
    .in('role', ['player_common', 'player_athlete'])
    .or(`display_name.ilike.%${k}%,name.ilike.%${k}%,nickname.ilike.%${k}%`)
    .order('rank', { ascending: true, nullsFirst: false })
    .limit(8);

  if (error) throw error;
  return { data: (data || []).map(enrichPublicPlayerRow), error: null };
}

/**
 * 회원·선수 공개 검색. 브라우저에서는 먼저 `/api/search-players`(서비스 롤)로 조회해 anon 401을 피합니다.
 * 서비스 키가 없으면(503) 직접 조회로 폴백합니다.
 */
export const searchPublicPlayerProfiles = async (searchQuery) => {
  try {
    const keyword = searchQuery?.trim();
    if (!keyword) {
      return { data: [], error: null };
    }

    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(
          `/api/search-players?q=${encodeURIComponent(keyword)}`,
          { credentials: 'same-origin' }
        );
        if (res.ok) {
          const json = await res.json();
          return { data: (json.data || []).map(enrichPublicPlayerRow), error: null };
        }
        if (res.status === 503) {
          return await searchPublicPlayerProfilesDirect(keyword);
        }
        const body = await res.json().catch(() => ({}));
        return { data: [], error: new Error(body.error || `HTTP ${res.status}`) };
      } catch {
        return await searchPublicPlayerProfilesDirect(keyword);
      }
    }

    return await searchPublicPlayerProfilesDirect(keyword);
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

// 출석 체크 — KST 자정 기준 + SP +1 + 통계 갱신을 서버 RPC 로 일괄 처리
// 출석 기록만 (SP 자동 지급 없음 — 모달의 [스킬 포인트 적립] 버튼이 별도 RPC 호출)
// (sql/50_attendance_claim_split.sql 적용 필요)
//   - 클라이언트 toISOString() = UTC 날짜 버그 제거
//   - 멱등 — 같은 날 여러 번 눌러도 안전
//   - attendance INSERT + statistics 갱신 (SP 는 분리)
export const checkAttendance = async (_userId = null, _location = null) => {
  try {
    const { data, error } = await supabase.rpc('record_daily_attendance');
    if (error) {
      console.error('[checkAttendance] RPC 에러:', error);
      return { data: null, error, message: '출석 체크 실패' };
    }
    if (data && typeof data === 'object' && data.ok === false) {
      return { data: null, error: { message: data.error || '출석 체크 실패' }, message: data.error };
    }
    const alreadyChecked = data?.already_checked === true;
    return {
      data,
      error: null,
      message: alreadyChecked ? '이미 출석' : '출석 체크 완료!',
      alreadyChecked,
      spClaimed: data?.sp_claimed === true,
      currentStreak: typeof data?.current_streak === 'number' ? data.current_streak : null,
      totalAttendance: typeof data?.total_attendance === 'number' ? data.total_attendance : null,
      attendanceDate: data?.attendance_date || null,
    };
  } catch (error) {
    console.error('[checkAttendance] 예외:', error);
    return { data: null, error, message: '출석 체크 실패' };
  }
};

// 모달의 [스킬 포인트 적립] 버튼이 호출 — 오늘 출석 + 미적립 + 심사 대기 아닐 때만 +1
export const claimDailySkillPoint = async () => {
  try {
    const { data, error } = await supabase.rpc('claim_daily_skill_point');
    if (error) {
      console.error('[claimDailySkillPoint] RPC 에러:', error);
      return { data: null, error: { message: error.message || '스킬 포인트 적립 실패' } };
    }
    if (data && typeof data === 'object' && data.ok === false) {
      const map = {
        not_authenticated: '로그인이 필요합니다.',
        promotion_pending: '승단 심사 대기 중에는 스킬 포인트를 적립할 수 없습니다.',
        mastery_unresolved: '마스터한 스킬이 있습니다. 먼저 승단 심사를 통해 승인 받으세요.',
        no_attendance: '오늘 출석 기록이 없습니다. 먼저 출석 체크를 해주세요.',
        already_claimed: '오늘 이미 스킬 포인트를 적립했습니다.',
      };
      return { data: null, error: { message: map[data.error] || data.error || '스킬 포인트 적립 실패' } };
    }
    return {
      data,
      error: null,
      skillPoints: typeof data?.skill_points === 'number' ? data.skill_points : null,
      spAdded: typeof data?.sp_added === 'number' ? data.sp_added : 0,
    };
  } catch (error) {
    console.error('[claimDailySkillPoint] 예외:', error);
    return { data: null, error: { message: '스킬 포인트 적립 실패' } };
  }
};

// 페이지 진입 시 출석 통계 — sql/51 RPC 가 있으면 1번에, 없으면 옛 방식 폴백
export const getMyAttendanceSummary = async (userId = null) => {
  try {
    // 1차: sql/51 의 새 RPC 시도
    const rpcRes = await supabase.rpc('get_my_attendance_summary');
    if (!rpcRes.error && rpcRes.data?.ok !== false) {
      return { data: rpcRes.data, error: null };
    }
    // function 없거나 에러 → 폴백
    const isMissing = rpcRes.error && /could not find|does not exist|404/i.test(String(rpcRes.error.message || ''));
    if (rpcRes.error && !isMissing) {
      console.error('[getMyAttendanceSummary] RPC 에러:', rpcRes.error);
    }

    // 2차 폴백: 기존 5 parallel 쿼리 → summary 객체 합성 (sql/51 미적용 환경)
    const uid = userId || (await supabase.auth.getUser())?.data?.user?.id;
    if (!uid) {
      return { data: null, error: { message: '로그인이 필요합니다.' } };
    }
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = ymd(now);
    const monthStart = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const weekStart = ymd(monday);
    const weekEnd = ymd(new Date(monday.getTime() + 6 * 86400000));

    const [todayRes, statsRes, userRes, monthRes, weekRes, masteredRes, promoRes] = await Promise.all([
      supabase.from('attendance').select('attendance_date, sp_claimed').eq('user_id', uid).eq('attendance_date', today).maybeSingle(),
      supabase.from('statistics').select('current_streak, total_attendance').eq('user_id', uid).maybeSingle(),
      supabase.from('users').select('skill_points').eq('id', uid).maybeSingle(),
      supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('user_id', uid).gte('attendance_date', monthStart),
      supabase.from('attendance').select('attendance_date').eq('user_id', uid).gte('attendance_date', weekStart).lte('attendance_date', weekEnd),
      supabase.from('user_skill_node_progress').select('node_id, exp_level').eq('user_id', uid).gte('exp_level', 5),
      supabase.rpc('get_my_promotion_requests'),
    ]);

    const masteredIds = (masteredRes?.data || []).map((r) => r.node_id);
    const approvedSet = new Set(
      (promoRes?.data || []).filter((r) => r.status === 'approved').map((r) => r.node_id)
    );
    const hasUnfinished = masteredIds.some((id) => !approvedSet.has(id));

    const summary = {
      ok: true,
      today,
      today_checked: !!todayRes?.data,
      today_sp_claimed: todayRes?.data?.sp_claimed === true,
      current_streak: Number(statsRes?.data?.current_streak ?? 0),
      total_attendance: Number(statsRes?.data?.total_attendance ?? 0),
      this_month_count: typeof monthRes?.count === 'number' ? monthRes.count : 0,
      skill_points: Number(userRes?.data?.skill_points ?? 0),
      week_dates: (weekRes?.data || []).map((r) => String(r.attendance_date)),
      has_unfinished_mastery: hasUnfinished,
    };
    return { data: summary, error: null };
  } catch (error) {
    console.error('[getMyAttendanceSummary] 예외:', error);
    return { data: null, error };
  }
};

// 출석체크 클릭 시 — sql/51 RPC 가 있으면 1번에, 없으면 옛 방식 폴백
export const openAttendanceModal = async () => {
  try {
    // 1차: sql/51 의 새 RPC 시도
    const rpcRes = await supabase.rpc('attendance_open_modal');
    if (!rpcRes.error && rpcRes.data?.ok !== false) {
      return { data: rpcRes.data, error: null };
    }
    const isMissing = rpcRes.error && /could not find|does not exist|404/i.test(String(rpcRes.error.message || ''));
    if (rpcRes.error && !isMissing) {
      console.error('[openAttendanceModal] RPC 에러:', rpcRes.error);
    }

    // 2차 폴백: 옛 record_daily_attendance + getMyPromotionRequests + 5/5 SELECT + skill_tree_nodes
    const attRes = await supabase.rpc('record_daily_attendance');
    if (attRes.error) return { data: null, error: attRes.error };
    if (attRes.data?.ok === false) {
      return { data: null, error: { message: attRes.data.error || '출석 처리 실패' } };
    }

    const uid = (await supabase.auth.getUser())?.data?.user?.id;
    const [{ data: progressRows }, { data: promoRows }] = await Promise.all([
      supabase.from('user_skill_node_progress').select('node_id, exp_level').eq('user_id', uid).gte('exp_level', 5),
      supabase.rpc('get_my_promotion_requests'),
    ]);
    const masteredIds = (progressRows || []).map((r) => r.node_id);
    const latestStatusByNode = new Map();
    for (const r of (promoRows || [])) {
      if (r?.node_id != null && !latestStatusByNode.has(r.node_id)) {
        latestStatusByNode.set(r.node_id, r.status);
      }
    }
    const STATUS_PRIORITY = { pending: 4, reviewing: 3, rejected: 2 };
    const unfinishedSorted = masteredIds
      .filter((id) => latestStatusByNode.get(id) !== 'approved')
      .map((id) => ({ id, status: latestStatusByNode.get(id) || 'unsubmitted' }))
      .sort((a, b) => (STATUS_PRIORITY[b.status] || 1) - (STATUS_PRIORITY[a.status] || 1));
    const target = unfinishedSorted[0];

    let unfinished = null;
    if (target?.id != null) {
      const { data: nodes } = await supabase.from('skill_tree_nodes').select('id, name').eq('id', target.id);
      unfinished = {
        node_id: target.id,
        status: target.status,
        skill_name: nodes?.[0]?.name || '마스터 스킬',
      };
    }

    return {
      data: {
        ok: true,
        already_checked: attRes.data?.already_checked === true,
        sp_claimed: attRes.data?.sp_claimed === true,
        current_streak: Number(attRes.data?.current_streak ?? 0),
        this_month: 0, // 옛 응답엔 없음 — 폴백에선 정확 X. UI 는 기존 prev 유지.
        today: attRes.data?.attendance_date,
        unfinished,
      },
      error: null,
    };
  } catch (error) {
    console.error('[openAttendanceModal] 예외:', error);
    return { data: null, error };
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
  // sql/43 적용 후 뷰에 avatar_url 포함 → 별도 users 조회 불필요
  const { data, error } = await supabase
    .from('public_player_profiles')
    .select('id, name, nickname, display_name, tier, avatar_url')
    .in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((p) => [p.id, { ...p, avatar_url: p.avatar_url || null }]));
}

// 다른 회원의 전적 공개 조회 (sql/56) — RLS 우회. 상대 프로필에서 사용.
// 폴백: RPC 없으면 기존 getUserMatches (본인 참여 매치만 보임).
export const getPublicPlayerMatches = async (userId, limit = null) => {
  if (!userId) return { data: [], error: null };
  try {
    const rpcRes = await supabase.rpc('get_public_player_matches', {
      p_user_id: userId,
      p_limit: limit || null,
    });
    if (!rpcRes.error && Array.isArray(rpcRes.data)) {
      // RPC 응답을 getUserMatches 와 같은 shape 으로 정규화
      const data = rpcRes.data.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        opponent_id: r.opponent_id,
        result: r.result,
        method: r.method,
        score: r.score,
        rounds: r.rounds,
        played_at: r.played_at,
        opponent: r.opponent_id
          ? {
              id: r.opponent_id,
              name: r.opponent_name || null,
              nickname: r.opponent_nickname || null,
              display_name: r.opponent_display_name || null,
              tier: r.opponent_tier || null,
              avatar_url: r.opponent_avatar_url || null,
            }
          : null,
        opponent_name:
          r.opponent_nickname || r.opponent_display_name || r.opponent_name || null,
      }));
      return { data, error: null };
    }
    if (rpcRes.error) {
      const isMissing = /could not find|does not exist|404/i.test(String(rpcRes.error.message || ''));
      if (!isMissing) console.warn('[getPublicPlayerMatches] RPC 에러:', rpcRes.error.message);
    }
    // 폴백 — 기존 RLS-제약 함수
    return await getUserMatches(userId, limit);
  } catch (error) {
    console.error('[getPublicPlayerMatches] 예외:', error);
    return { data: null, error };
  }
};

// 사용자의 경기 기록 가져오기
export const getUserMatches = async (userId, limit = null) => {
  try {
    let query = supabase
      .from('matches')
      .select('*')
      .eq('user_id', userId)
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
          ? { id: opp.id, name: opp.name, nickname: opp.nickname, tier: opp.tier, avatar_url: opp.avatar_url || null }
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
          ? { id: opp.id, name: opp.name, nickname: opp.nickname, tier: opp.tier, avatar_url: opp.avatar_url || null }
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
  skill_points,
  avatar_url,
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

/**
 * 체육관 관리자용: 본인 체육관 회원들의 최근 출석을 일괄 조회.
 * SECURITY DEFINER RPC 로 RLS 우회 + 함수 내부에서 호출자 권한 검증.
 * sql/47_gym_member_attendance.sql 적용 필요.
 * 반환: { [user_id]: [{ attendance_date, check_in_time }, ...] }
 */
export const getRecentAttendanceForUsers = async (userIds = [], perUser = 3) => {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return { data: {}, error: null };

    const { data, error } = await supabase.rpc('get_recent_gym_member_attendance', {
      p_user_ids: ids,
      p_days: 30,
    });

    if (error) throw error;

    // user_id 별로 그룹화 + perUser 제한 (RPC 가 이미 desc 정렬)
    const map = {};
    for (const row of data || []) {
      if (!map[row.user_id]) map[row.user_id] = [];
      if (map[row.user_id].length < perUser) {
        map[row.user_id].push({
          attendance_date: row.attendance_date,
          check_in_time: row.check_in_time,
        });
      }
    }
    return { data: map, error: null };
  } catch (error) {
    console.error('[getRecentAttendanceForUsers]', error);
    return { data: {}, error };
  }
};

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

    const sliced = computeMatchLeaderboard(players, matches, limit);
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

/** 스킬 페이지에 필요한 컬럼만 (payload 축소) */
const SKILL_TREE_NODES_SELECT =
  'id, node_number, name, name_en, zone, punch_type, tier, position_x, position_y, node_type, parent_nodes, display_title, point_cost, style_tag';

// 스킬 트리 노드는 거의 변하지 않는 정적 데이터 — 모듈 레벨 캐시로 중복 fetch 차단
// (탭 전환·새로고침 시 재호출 비용 절감, Supabase egress/db cost 감소)
let _skillTreeNodesCache = null; // { data, ts }
const SKILL_TREE_NODES_TTL_MS = 5 * 60 * 1000; // 5분
export const invalidateSkillTreeNodesCache = () => { _skillTreeNodesCache = null; };

// 스킬 트리 노드 전체 조회 (5분 캐시)
export const getSkillTreeNodes = async () => {
  try {
    if (_skillTreeNodesCache && Date.now() - _skillTreeNodesCache.ts < SKILL_TREE_NODES_TTL_MS) {
      return { data: _skillTreeNodesCache.data, error: null };
    }
    const { data, error } = await supabase
      .from('skill_tree_nodes')
      .select(SKILL_TREE_NODES_SELECT)
      .order('node_number', { ascending: true });

    if (error) throw error;
    _skillTreeNodesCache = { data, ts: Date.now() };
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
      .select('node_id, unlocked_at')
      .eq('user_id', userId);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getUserSkillUnlocks] 에러:', error);
    return { data: null, error };
  }
};

/** 스킬 포인트·초기화권만 (전체 프로필 대신 탭 로드용) */
export const getUserSkillWallet = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('skill_points, skill_reset_tickets')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getUserSkillWallet] 에러:', error);
    return { data: null, error };
  }
};

/** 노드별 EXP 진행 (0~5) — 마스터는 5 고정. */
export const getUserSkillNodeProgress = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_skill_node_progress')
      .select('node_id, exp_level, updated_at')
      .eq('user_id', userId);
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getUserSkillNodeProgress] 에러:', error);
    return { data: null, error };
  }
};

/** 스킬 +1 EXP RPC (1회 호출 = exp_level +1, 최대 max). JSONB 반환 */
export const addSkillExpRpc = async (nodeId) => {
  try {
    const targetId =
      typeof nodeId === 'number' && !Number.isNaN(nodeId) ? nodeId : parseInt(String(nodeId), 10);
    if (Number.isNaN(targetId)) {
      return { data: null, error: { message: '잘못된 노드입니다.' } };
    }
    const { data, error } = await supabase.rpc('add_skill_exp', { p_node_id: targetId });
    if (error) {
      // 디버깅 — Postgres 가 반환하는 모든 메타 정보 콘솔로
      console.error('[addSkillExpRpc] RPC 에러:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        nodeId: targetId,
      });
      throw error;
    }
    const payload = Array.isArray(data) ? data[0] : data;
    return { data: payload, error: null };
  } catch (error) {
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

/** 전적 초기화권 보유 개수만 조회 */
export const getMatchResetTickets = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('match_reset_tickets')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return { data: Number(data?.match_reset_tickets ?? 0), error: null };
  } catch (error) {
    console.error('[getMatchResetTickets] 에러:', error);
    return { data: 0, error };
  }
};

/** 전적 초기화 (티켓 1장 차감 + matches/statistics/tier_rankings 초기화) */
export const resetMatchRecordsWithTicketRpc = async () => {
  try {
    const { data, error } = await supabase.rpc('reset_match_records_with_ticket');
    if (error) throw error;
    if (data && typeof data === 'object' && data.ok === false) {
      return { data: null, error: { message: mapResetMatchRecordsError(data.error) } };
    }
    return { data, error: null };
  } catch (error) {
    console.error('[resetMatchRecordsWithTicketRpc] 에러:', error);
    return { data: null, error };
  }
};

function mapResetMatchRecordsError(code) {
  const m = {
    not_authenticated: '로그인이 필요합니다.',
    no_user: '사용자 정보를 찾을 수 없습니다.',
    no_reset_ticket: '전적 초기화권이 없습니다.',
  };
  return m[code] || code || '전적을 초기화하지 못했습니다.';
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

/** 마스터 스킬(5/5) 승단 심사 신청 — sql/48 */
export const submitMasterExamRequestRpc = async (nodeId) => {
  try {
    const targetId = typeof nodeId === 'number' && !Number.isNaN(nodeId)
      ? nodeId : parseInt(String(nodeId), 10);
    if (Number.isNaN(targetId)) {
      return { data: null, error: { message: '잘못된 노드입니다.' } };
    }
    const { data, error } = await supabase.rpc('submit_master_exam_request', { p_node_id: targetId });
    if (error) throw error;
    if (data && typeof data === 'object' && data.ok === false) {
      return { data: null, error: { message: mapMasterExamError(data.error) } };
    }
    return { data, error: null };
  } catch (error) {
    console.error('[submitMasterExamRequestRpc]', error);
    return { data: null, error };
  }
};

function mapMasterExamError(code) {
  const m = {
    not_authenticated: '로그인이 필요합니다.',
    invalid_node: '존재하지 않는 스킬입니다.',
    not_mastered: '아직 마스터되지 않은 스킬입니다 (5/5 필요).',
    already_promoted: '이미 승단이 완료된 스킬입니다.',
    already_pending: '이미 승단 심사가 진행 중입니다.',
    no_gym: '소속 체육관을 먼저 등록해 주세요. (프로필 편집 → 체육관)',
    forbidden: '권한이 없습니다.',
    not_found: '신청을 찾을 수 없습니다.',
    wrong_gym: '본인 체육관 신청만 처리할 수 있습니다.',
    invalid_status: '이미 처리된 신청입니다.',
  };
  return m[code] || code || '승단 심사 처리에 실패했습니다.';
}

/** 마스터 스킬 승단 심사 처리 (분기 선택 없는 단순 승인/거절) — sql/48 */
export const gymResolveMasterExamRpc = async (requestId, approved, notes = null) => {
  try {
    const { data, error } = await supabase.rpc('gym_resolve_master_exam', {
      p_request_id: requestId,
      p_approved: approved === true,
      p_notes: notes,
    });
    if (error) throw error;
    if (data && typeof data === 'object' && data.ok === false) {
      return { data: null, error: { message: mapMasterExamError(data.error) } };
    }
    return { data, error: null };
  } catch (error) {
    console.error('[gymResolveMasterExamRpc]', error);
    return { data: null, error };
  }
};

/** 본인 승단 신청 목록 (skills 페이지 상태 배지용) — sql/48 */
export const getMyPromotionRequests = async () => {
  try {
    const { data, error } = await supabase.rpc('get_my_promotion_requests');
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('[getMyPromotionRequests]', error);
    return { data: [], error };
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

/** 체육관용: 거절 로그 (회원·스킬 메타 + 날짜) — sql/49 */
export const getGymPromotionLogs = async (limit = 50) => {
  try {
    const { data, error } = await supabase.rpc('get_gym_promotion_logs', { p_limit: limit });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('[getGymPromotionLogs]', error);
    return { data: [], error };
  }
};

/** 승단 신청 + 회원·갈림길 노드 메타 (관장 화면용).
 *  1차: SECURITY DEFINER RPC `get_gym_promotion_queue` 사용 (sql/49 — 가장 신뢰 가능)
 *  2차: 옛 RPC 가 없으면 직접 join (skill_tree_nodes 풀 SELECT → 폴백 최소 SELECT) */
export const getGymPromotionRequestsDetailed = async (status = null) => {
  try {
    // 1차 — RPC 시도 (sql/49 의 get_gym_promotion_queue)
    const rpcRes = await supabase.rpc('get_gym_promotion_queue', { p_status: status });
    if (!rpcRes.error && Array.isArray(rpcRes.data)) {
      const data = rpcRes.data.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        fork_node_id: r.fork_node_id,
        status: r.status,
        requested_at: r.requested_at,
        resolved_at: r.resolved_at,
        reviewer_id: r.reviewer_id,
        notes: r.notes,
        gym_name: r.gym_name,
        member: {
          id: r.user_id,
          name: r.member_name,
          nickname: r.member_nickname,
          display_name: r.member_display_name,
          tier: r.member_tier,
          avatar_url: r.member_avatar_url,
        },
        fork: r.fork_node_id != null
          ? {
              id: r.fork_node_id,
              name: r.skill_name,
              node_number: r.skill_node_number,
              is_fork: r.skill_is_fork === true,
              fork_branch_node_numbers: r.skill_fork_branch_node_numbers,
            }
          : null,
      }));
      return { data, error: null };
    }
    if (rpcRes.error) console.warn('[getGymPromotionRequestsDetailed] RPC 실패 → 폴백:', rpcRes.error?.message);

    // 2차 — 폴백: 직접 join
    const { data: rows, error } = await getGymPromotionRequests(status);
    if (error) throw error;
    if (!rows?.length) return { data: [], error: null };

    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const forkIds = [...new Set(rows.map((r) => r.fork_node_id).filter((v) => v != null))];

    // 프로필 조회 (실패해도 진행)
    const profilesP = userIds.length
      ? supabase
          .from('public_player_profiles')
          .select('id, name, nickname, display_name, tier, avatar_url')
          .in('id', userIds)
      : Promise.resolve({ data: [], error: null });

    // 스킬 노드 조회 — 옛 DB 호환을 위해 풀 SELECT 실패 시 최소 SELECT 폴백
    const fetchForks = async () => {
      if (!forkIds.length) return [];
      const full = await supabase
        .from('skill_tree_nodes')
        .select('id, name, node_number, fork_branch_node_numbers, is_fork, punch_type, zone')
        .in('id', forkIds);
      if (!full.error) return full.data || [];
      console.warn('[getGymPromotionRequestsDetailed] 풀 SELECT 실패 → 폴백:', full.error?.message);
      const minimal = await supabase
        .from('skill_tree_nodes')
        .select('id, name, node_number')
        .in('id', forkIds);
      if (minimal.error) {
        console.error('[getGymPromotionRequestsDetailed] 최소 SELECT 도 실패:', minimal.error?.message);
        return [];
      }
      return minimal.data || [];
    };

    const [profilesRes, forks] = await Promise.all([profilesP, fetchForks()]);
    const profiles = profilesRes?.data || [];
    if (profilesRes?.error) console.warn('[getGymPromotionRequestsDetailed] profiles 에러:', profilesRes.error?.message);

    const userMap = new Map(profiles.map((u) => [u.id, u]));
    const forkMap = new Map(forks.map((n) => [n.id, n]));

    // 매핑 안 되는 fork_node_id 가 있으면 한 번 경고 (디버깅용)
    for (const r of rows) {
      if (r.fork_node_id != null && !forkMap.has(r.fork_node_id)) {
        console.warn('[getGymPromotionRequestsDetailed] skill_tree_nodes 매칭 실패 — request', r.id, 'fork_node_id', r.fork_node_id);
        break;
      }
    }

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

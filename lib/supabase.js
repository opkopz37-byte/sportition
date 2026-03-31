import { createClient } from '@supabase/supabase-js';

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
    }
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
    phone: privateProfile?.phone || null,
    birth_date: privateProfile?.birth_date || null,
    representative_phone: privateProfile?.representative_phone || null,
  };
};

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

// 현재 사용자 가져오기
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return { user, error: null };
  } catch (error) {
    return { user: null, error };
  }
};

// 사용자 프로필 가져오기
export const getUserProfile = async (userId) => {
  try {
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
      .single();

    if (error) throw error;
    return { data: flattenProfile(data), error: null };
  } catch (error) {
    return { data: null, error };
  }
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
    return { data: data || [], error: null };
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
    return { data: data || [], error: null };
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
    return { data, error: null };
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

// 사용자의 경기 기록 가져오기
export const getUserMatches = async (userId, limit = null) => {
  try {
    let query = supabase
      .from('matches')
      .select('*')
      .eq('user_id', userId)
      .order('match_date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: matches, error } = await query;

    if (error) throw error;

    const opponentIds = [...new Set(
      (matches || [])
        .map((match) => match.opponent_id)
        .filter(Boolean)
    )];

    let opponentNameById = {};
    if (opponentIds.length > 0) {
      const { data: opponents, error: opponentError } = await supabase
        .from('users')
        .select('id, nickname, name')
        .in('id', opponentIds);

      if (opponentError) throw opponentError;

      opponentNameById = (opponents || []).reduce((acc, item) => {
        acc[item.id] = item.nickname || item.name || 'Unknown';
        return acc;
      }, {});
    }

    const normalizedMatches = (matches || []).map((match) => {
      const opponentLabel = match.opponent_name
        || opponentNameById[match.opponent_id]
        || 'Unknown';
      const normalizedResult = match.result === 'ko_win'
        ? 'win'
        : match.result === 'ko_loss'
          ? 'loss'
          : match.result || 'draw';
      return {
        ...match,
        opponent_label: opponentLabel,
        normalized_result: normalizedResult,
      };
    });

    const summary = normalizedMatches.reduce((acc, match) => {
      if (match.normalized_result === 'win') acc.wins += 1;
      if (match.normalized_result === 'loss') acc.losses += 1;
      if (match.normalized_result === 'draw') acc.draws += 1;
      return acc;
    }, { total: normalizedMatches.length, wins: 0, losses: 0, draws: 0 });

    const h2hMap = normalizedMatches.reduce((acc, match) => {
      const opponentKey = match.opponent_id || `name:${match.opponent_label}`;
      if (!acc[opponentKey]) {
        acc[opponentKey] = {
          opponent_id: match.opponent_id || null,
          opponent_name: match.opponent_label,
          wins: 0,
          losses: 0,
          draws: 0,
          total: 0,
          latest_match_date: match.match_date,
        };
      }
      acc[opponentKey].total += 1;
      if (match.normalized_result === 'win') acc[opponentKey].wins += 1;
      if (match.normalized_result === 'loss') acc[opponentKey].losses += 1;
      if (match.normalized_result === 'draw') acc[opponentKey].draws += 1;
      if (match.match_date > acc[opponentKey].latest_match_date) {
        acc[opponentKey].latest_match_date = match.match_date;
      }
      return acc;
    }, {});

    const h2h = Object.values(h2hMap)
      .map((row) => ({
        ...row,
        win_rate: row.total > 0 ? Number(((row.wins / row.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return new Date(b.latest_match_date) - new Date(a.latest_match_date);
      });

    const winRate = summary.total > 0
      ? Number(((summary.wins / summary.total) * 100).toFixed(1))
      : 0;

    return {
      data: {
        recentMatches: normalizedMatches,
        h2h,
        winRate,
        summary,
      },
      error: null
    };
  } catch (error) {
    return { data: null, error };
  }
};

// 경기 결과 추가
export const addMatch = async (matchData) => {
  try {
    const { data, error } = await supabase
      .from('matches')
      .insert([matchData])
      .select()
      .single();

    if (error) throw error;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matches:changed', { detail: { userId: matchData.user_id } }));
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
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

// 유저의 스킬 트리 상태 조회
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

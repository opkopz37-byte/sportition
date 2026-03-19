import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// 회원가입
export const signUp = async (email, password, userData) => {
  try {
    // 1. Supabase Auth 회원가입
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
      },
    });

    if (authError) throw authError;
    
    // 2. users 테이블에 프로필 생성
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: email,
            name: userData.name || '사용자',
            phone: userData.phone || null,
            birth_date: userData.birth_date || null,
            role: userData.role || 'athlete',
            gender: userData.gender || null,
            tier: userData.role === 'coach' ? null : 'Bronze III',
            tier_points: userData.role === 'coach' ? null : 0,
            membership_type: userData.membership_type || null,
          },
        ]);

      if (profileError) throw profileError;

      // 3. statistics 테이블 초기화 (선수만)
      if (userData.role === 'athlete' || !userData.role) {
        await supabase
          .from('statistics')
          .insert([
            {
              user_id: authData.user.id,
              total_matches: 0,
              wins: 0,
              losses: 0,
              draws: 0,
              ko_wins: 0,
              win_streak: 0,
              total_attendance: 0,
              current_streak: 0,
            },
          ]);

        // 4. tier_rankings 테이블 초기화
        await supabase
          .from('tier_rankings')
          .insert([
            {
              user_id: authData.user.id,
              rank: null,
              previous_rank: null,
              rank_change: 0,
            },
          ]);
      }
    }

    return { data: authData, error: null };
  } catch (error) {
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
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
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 사용자 프로필 업데이트
export const updateUserProfile = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
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
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00Z`;
    const todayEnd = `${today}T23:59:59Z`;

    // 오늘 이미 출석했는지 확인
    const { data: existingAttendance, error: checkError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .gte('check_in_time', todayStart)
      .lte('check_in_time', todayEnd)
      .maybeSingle();

    if (existingAttendance) {
      return { 
        data: existingAttendance, 
        error: null, 
        message: '이미 출석 체크되었습니다.' 
      };
    }

    // 출석 기록 추가
    const { data, error } = await supabase
      .from('attendance')
      .insert([
        {
          user_id: userId,
          location: location,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null, message: '출석 체크 완료!' };
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

// 전화번호로 사용자 검색 (출석 키오스크용)
export const searchUserByPhone = async (phoneLastFour) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('phone', `%${phoneLastFour}`);

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

    const { data, error } = await query;

    if (error) throw error;
    return { data, error: null };
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
      .eq('role', 'athlete')
      .order('tier_points', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

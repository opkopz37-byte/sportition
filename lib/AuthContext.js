'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getCurrentUser, getUserProfile, isSupabaseConfigured } from './supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthContext] useEffect 시작');

    if (!isSupabaseConfigured()) {
      console.warn(
        '[Sportition] Supabase 환경 변수가 없습니다. `.env.example`을 복사해 `.env.local`을 만들고 URL·anon 키를 입력한 뒤 개발 서버를 재시작하세요.'
      );
      setLoading(false);
      return;
    }

    let mounted = true;

    // 초기 사용자 체크
    const initAuth = async () => {
      console.log('[AuthContext] 초기 인증 체크 시작');
      try {
        await checkUser();
      } catch (error) {
        console.error('[AuthContext] 초기 인증 체크 에러:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // 인증 상태 변경 감지
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] 인증 상태 변경:', event, session?.user?.id);
        
        if (!mounted) {
          console.log('[AuthContext] 컴포넌트 언마운트됨, 이벤트 무시');
          return;
        }

        if (event === 'INITIAL_SESSION') {
          console.log('[AuthContext] INITIAL_SESSION 이벤트');
          try {
            if (session?.user) {
              setUser(session.user);
              await loadUserProfile(session.user.id, session.user);
            } else {
              setUser(null);
              setProfile(null);
            }
          } catch (e) {
            console.error('[AuthContext] INITIAL_SESSION 처리 실패:', e);
            setProfile(null);
          } finally {
            setLoading(false);
          }
        } else if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AuthContext] SIGNED_IN 이벤트');
          try {
            setUser(session.user);
            await loadUserProfile(session.user.id, session.user);
          } catch (e) {
            console.error('[AuthContext] SIGNED_IN 처리 실패:', e);
            setProfile(null);
          } finally {
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[AuthContext] SIGNED_OUT 이벤트 - 사용자/프로필 초기화');
          setUser(null);
          setProfile(null);
          setLoading(false);
        } else if (event === 'USER_UPDATED' && session?.user) {
          console.log('[AuthContext] USER_UPDATED 이벤트');
          setUser(session.user);
          try {
            await loadUserProfile(session.user.id, session.user);
          } catch (e) {
            console.error('[AuthContext] USER_UPDATED 프로필 로드 실패:', e);
          }
        } else if (!session) {
          console.log('[AuthContext] 세션 없음 - 사용자/프로필 초기화');
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      console.log('[AuthContext] 클린업 시작');
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
    // checkUser·loadUserProfile는 마운트 시 한 번만 구독하면 됨 — deps에 넣으면 리스너가 불필요하게 재등록됨
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only auth subscription
  }, []);

  const checkUser = async () => {
    console.log('[AuthContext] checkUser 시작');
    try {
      const { user: currentUser, error } = await Promise.race([
        getCurrentUser(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('인증 체크 타임아웃')), 10000)
        )
      ]);
      
      console.log('[AuthContext] getCurrentUser 결과:', { user: currentUser?.id, error });
      
      if (error) {
        console.error('[AuthContext] 사용자 확인 에러:', error);
        setUser(null);
        setProfile(null);
      } else if (currentUser) {
        console.log('[AuthContext] 사용자 확인됨:', currentUser.id);
        setUser(currentUser);
        // 프로필이 준비될 때까지 로딩 유지 → 랜딩/앱 전환 레이스 방지
        try {
          await loadUserProfile(currentUser.id, currentUser);
        } catch (err) {
          console.error('[AuthContext] 프로필 로드 실패:', err);
          setProfile(null);
        }
      } else {
        console.log('[AuthContext] 로그인된 사용자 없음');
        setUser(null);
        setProfile(null);
      }
    } catch (error) {
      console.error('[AuthContext] checkUser 예외:', error);
      setUser(null);
      setProfile(null);
    } finally {
      console.log('[AuthContext] checkUser 완료, setLoading(false)');
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId, authUser = null) => {
    if (!userId) {
      console.warn('[AuthContext] userId 없음, 프로필 로드 스킵');
      return;
    }
    
    try {
      console.log('[AuthContext] 프로필 로드 시작:', userId);
      
      const { data, error } = await Promise.race([
        getUserProfile(userId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('프로필 로드 타임아웃')), 10000)
        )
      ]);
      
      if (data) {
        console.log('[AuthContext] 프로필 로드 성공:', {
          id: data.id,
          role: data.role,
          nickname: data.nickname,
          tier: data.tier
        });
        setProfile(data);
        return;
      }

      // 프로필이 없거나 에러 → auth 메타데이터로 프로필 자동 생성 (복구)
      console.warn('[AuthContext] 프로필 없음 - auth 메타데이터로 복구 시도');
      const meta = authUser?.user_metadata || {};
      const userRole =
        meta.role === 'athlete' ? 'player_common' :
        meta.role === 'coach' ? 'player_athlete' :
        meta.role || 'player_common';

      const profileToCreate = {
        id: userId,
        email: authUser?.email || '',
        name: meta.name || '사용자',
        nickname: meta.name || '사용자',
        role: userRole,
        gender: meta.gender || null,
        gym_name: meta.gym_name || null,
        gym_location: meta.gym_location || null,
        height: meta.height ? parseInt(meta.height) : null,
        weight: meta.weight ? parseFloat(meta.weight) : null,
        boxing_style: meta.boxing_style || null,
        membership_type: meta.membership_type || (userRole === 'gym' ? null : 'basic'),
        tier: userRole === 'gym' ? null : 'Bronze III',
        tier_points: userRole === 'gym' ? null : 0,
        skill_points: 0,
      };

      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .upsert([profileToCreate], { onConflict: 'id' })
        .select()
        .single();

      if (newProfile && !createError) {
        await supabase
          .from('user_private_profiles')
          .upsert([{
            user_id: userId,
            phone: meta.phone || null,
            birth_date: meta.birth_date || null,
            representative_phone: meta.representative_phone || null,
          }], { onConflict: 'user_id' });

        console.log('[AuthContext] 프로필 자동 생성 성공:', newProfile.role);
        setProfile({
          ...newProfile,
          phone: meta.phone || null,
          birth_date: meta.birth_date || null,
          representative_phone: meta.representative_phone || null,
        });
      } else {
        console.error('[AuthContext] 프로필 자동 생성 실패:', createError);
        setProfile(null);
      }
    } catch (error) {
      console.error('[AuthContext] 프로필 로드 예외:', error);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      console.log('[AuthContext] 프로필 새로고침 요청');
      await loadUserProfile(user.id);
    }
  };

  // 무한 로딩 방지: 네트워크/청크 오류로 loading 이 true 에 고정된 경우
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (!loading) return;
    const t = setTimeout(() => {
      console.warn('[AuthContext] 로딩 25초 초과 — 화면 잠금 해제 (Supabase·네트워크·.next 캐시 확인)');
      setLoading(false);
    }, 25000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (profile) {
      console.log('[AuthContext] 프로필 상태 업데이트됨:', {
        name: profile.name,
        nickname: profile.nickname,
        email: profile.email,
        role: profile.role,
        tier: profile.tier,
      });
    }
  }, [profile]);

  const value = {
    user,
    profile,
    loading,
    refreshProfile,
    isAuthenticated: !!user,
    isPlayerCommon: profile?.role === 'player_common',
    isPlayerAthlete: profile?.role === 'player_athlete',
    isPlayer: ['player_common', 'player_athlete'].includes(profile?.role),
    isGym: profile?.role === 'gym',
    isAdmin: profile?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

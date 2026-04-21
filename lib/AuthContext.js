'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, getCurrentUser, getUserProfile, isSupabaseConfigured } from './supabase';

const authDevLog = (...args) => {
  if (process.env.NODE_ENV === 'development') console.log(...args);
};

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
  /** 마지막 프로필 로드 실패 사유 (UI에 표시 — Supabase/RLS/RPC 메시지) */
  const [profileLoadError, setProfileLoadError] = useState(null);
  /** 동시 loadUserProfile 호출 횟수 (디버그) */
  const profileLoadConcurrentRef = useRef(0);
  /** 동일 userId로 겹치는 프로필 요청을 하나로 합침 (checkUser + INITIAL_SESSION 등) */
  const profileLoadInFlightRef = useRef(new Map());

  useEffect(() => {
    authDevLog('[AuthContext] useEffect 시작');

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
      authDevLog('[AuthContext] 초기 인증 체크 시작');
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
        authDevLog('[AuthContext] 인증 상태 변경:', event, session?.user?.id);
        
        if (!mounted) {
          authDevLog('[AuthContext] 컴포넌트 언마운트됨, 이벤트 무시');
          return;
        }

        if (event === 'INITIAL_SESSION') {
          authDevLog('[AuthContext] INITIAL_SESSION 이벤트');
          try {
            if (session?.user) {
              setUser(session.user);
              // 프로필 RPC는 세션보다 느릴 수 있음 — 로딩은 세션 확정만으로 끝냄 (프로필은 별도 화면에서 처리)
              void loadUserProfile(session.user.id, session.user);
            } else {
              setUser(null);
              setProfile(null);
              setProfileLoadError(null);
            }
          } catch (e) {
            console.error('[AuthContext] INITIAL_SESSION 처리 실패:', e);
            setProfile(null);
          } finally {
            setLoading(false);
          }
        } else if (event === 'SIGNED_IN' && session?.user) {
          authDevLog('[AuthContext] SIGNED_IN 이벤트');
          try {
            setUser(session.user);
            void loadUserProfile(session.user.id, session.user);
          } catch (e) {
            console.error('[AuthContext] SIGNED_IN 처리 실패:', e);
            setProfile(null);
          } finally {
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          authDevLog('[AuthContext] SIGNED_OUT 이벤트 - 사용자/프로필 초기화');
          setUser(null);
          setProfile(null);
          setProfileLoadError(null);
          setLoading(false);
        } else if (event === 'USER_UPDATED' && session?.user) {
          authDevLog('[AuthContext] USER_UPDATED 이벤트');
          setUser(session.user);
          void loadUserProfile(session.user.id, session.user);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }
        // 주의: 여기서 !session 이어도 무조건 로그아웃 처리하지 않음.
        // 그렇지 않으면 TOKEN_REFRESHED 등 미처리 이벤트·경합 시 세션이 잠깐 비는 순간 로그인이 풀린 것처럼 보임.
      }
    );

    return () => {
      authDevLog('[AuthContext] 클린업 시작');
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
    // checkUser·loadUserProfile는 마운트 시 한 번만 구독하면 됨 — deps에 넣으면 리스너가 불필요하게 재등록됨
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only auth subscription
  }, []);

  const checkUser = async () => {
    authDevLog('[AuthContext] checkUser 시작');
    try {
      // 모바일·느린망에서 인증 확인이 10초를 넘길 수 있음 — 타임아웃으로 세션을 지우면 안 됨.
      const { user: currentUser, error } = await getCurrentUser();

      authDevLog('[AuthContext] getCurrentUser 결과:', { user: currentUser?.id, error });
      
      if (error) {
        console.error('[AuthContext] 사용자 확인 에러:', error);
        setUser(null);
        setProfile(null);
        setProfileLoadError(null);
      } else if (currentUser) {
        authDevLog('[AuthContext] 사용자 확인됨:', currentUser.id);
        setUser(currentUser);
        void loadUserProfile(currentUser.id, currentUser);
      } else {
        authDevLog('[AuthContext] 로그인된 사용자 없음');
        setUser(null);
        setProfile(null);
        setProfileLoadError(null);
      }
    } catch (error) {
      console.error('[AuthContext] checkUser 예외:', error);
      setUser(null);
      setProfile(null);
      setProfileLoadError(null);
    } finally {
      authDevLog('[AuthContext] checkUser 완료, setLoading(false)');
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId, authUser = null) => {
    if (!userId) {
      console.warn('[AuthContext] userId 없음, 프로필 로드 스킵');
      return;
    }

    const inflight = profileLoadInFlightRef.current.get(userId);
    if (inflight) {
      return inflight;
    }

    const run = (async () => {
      profileLoadConcurrentRef.current += 1;
      setProfileLoadError(null);

      try {
        authDevLog('[AuthContext] 프로필 로드 시작:', userId);

        const { data, error } = await getUserProfile(userId);

        if (data) {
          authDevLog('[AuthContext] 프로필 로드 성공:', {
            id: data.id,
            role: data.role,
            nickname: data.nickname,
            tier: data.tier
          });
          setProfile(data);
          setProfileLoadError(null);
          return;
        }

        const rpcErrText = error
          ? String(error.message || error).slice(0, 280)
          : '서버에서 프로필 행을 반환하지 않았습니다. (get_my_profile / ensure RPC·public.users 확인)';

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

          authDevLog('[AuthContext] 프로필 자동 생성 성공:', newProfile.role);
          setProfileLoadError(null);
          setProfile({
            ...newProfile,
            phone: meta.phone || null,
            birth_date: meta.birth_date || null,
            representative_phone: meta.representative_phone || null,
          });
        } else {
          console.error('[AuthContext] 프로필 자동 생성 실패:', createError);
          const up = createError ? String(createError.message || createError).slice(0, 280) : 'upsert 실패';
          setProfileLoadError(`${rpcErrText} · 클라이언트 복구: ${up}`);
          setProfile(null);
        }
      } catch (error) {
        console.error('[AuthContext] 프로필 로드 예외:', error);
        setProfileLoadError(String(error?.message || error).slice(0, 400));
        setProfile(null);
      } finally {
        profileLoadConcurrentRef.current = Math.max(0, profileLoadConcurrentRef.current - 1);
      }
    })();

    profileLoadInFlightRef.current.set(userId, run);
    run.finally(() => {
      if (profileLoadInFlightRef.current.get(userId) === run) {
        profileLoadInFlightRef.current.delete(userId);
      }
    });

    return run;
  };

  const refreshProfile = async () => {
    if (user) {
      authDevLog('[AuthContext] 프로필 새로고침 요청');
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        console.warn('[AuthContext] refreshSession 경고 (무시 가능):', refreshErr.message);
      }
      await loadUserProfile(user.id, user);
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
      authDevLog('[AuthContext] 프로필 상태 업데이트됨:', {
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
    profileLoadError,
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

'use client';

import { useState, useEffect } from 'react';
import { BackgroundGrid, PageHeader, THEME_ATHLETE, THEME_COACH, THEME_GYM } from '@/components/ui';
import { Navbar } from '@/components/navigation';
import { LoginModal, SignupPage, LandingPage } from '@/components/views/landing';
import { ActiveSkillsView } from '@/components/views/skills';
import { TierBoardView } from '@/components/views/ranking';
import { MyPageView, SettingsView, EditProfileView, PrivacySettingsView, ActivityHistoryView, OpponentProfileView, MatchHistoryView, OpponentMatchHistoryView } from '@/components/views/mypage';
import TermsOfServiceInlineView from '@/components/legal/TermsOfServiceInlineView';
import { PlayersManagementView, MatchRoomView, GymNewMemberRegisterView } from '@/components/views/coach';
import { ApprovalView } from '@/components/views/approval';
import { ComingSoonView } from '@/components/views/comingsoon';
import AppHomeView from '@/components/views/AppHomeView';
import DashboardAttendanceInline from '@/components/views/DashboardAttendanceInline';
import { translations } from '@/lib/translations';
import { useAuth } from '@/lib/AuthContext';

const devLog = (...args) => {
  if (process.env.NODE_ENV === 'development') console.log(...args);
};

export default function SportitionApp() {
  const { user, profile, isAuthenticated, loading, profileLoading, isOnline, profileLoadError, refreshProfile } = useAuth();
  const [currentPage, setCurrentPage] = useState('landing');
  const [role, setRole] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [tabHistory, setTabHistory] = useState([]);

  // profile.role을 항상 우선 신뢰 (role state가 아직 null이어도 렌더링 가능)
  const effectiveRole = profile?.role || role;
  const [signupInitialRole, setSignupInitialRole] = useState('player_common');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [language, setLanguage] = useState('ko');
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await refreshProfile();
    } finally {
      setIsRetrying(false);
    }
  };
  
  const [skillRequests, setSkillRequests] = useState([
    { id: 1, playerName: '김철수', skillName: '기본 펀치', skillType: 'active', status: 'pending', requestDate: '2024-02-07 14:30', tier: 'Master I' },
    { id: 2, playerName: '이영희', skillName: '스태미나 강화', skillType: 'passive', status: 'pending', requestDate: '2024-02-07 13:15', tier: 'Master II' },
    { id: 3, playerName: '박민준', skillName: '파워 스트라이크', skillType: 'active', status: 'approved', requestDate: '2024-02-06 16:20', tier: 'Master III' },
  ]);

  const t = (key) => translations[language][key] || key;
  
  const addSkillRequest = (playerName, skillName, skillType, tier) => {
    const newRequest = {
      id: skillRequests.length + 1,
      playerName,
      skillName,
      skillType,
      status: 'pending',
      requestDate: new Date().toLocaleString('ko-KR'),
      tier
    };
    setSkillRequests([...skillRequests, newRequest]);
  };

  const navigateToTab = (nextTab, options = {}) => {
    const { replace = false } = options;
    setActiveTab((prevTab) => {
      if (!nextTab || prevTab === nextTab) return prevTab;
      if (!replace) {
        setTabHistory((prev) => [...prev, prevTab].slice(-100));
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
      return nextTab;
    });
  };

  const canGoBack = currentPage === 'app' && activeTab !== 'home';
  const handleGlobalBack = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setTabHistory((prev) => {
      if (prev.length === 0) {
        setActiveTab('home');
        return prev;
      }
      const next = [...prev];
      const last = next.pop();
      setActiveTab(last || 'home');
      return next;
    });
  };
  
  // 인증 상태 변화 감지 및 자동 화면 전환 (세션만 있으면 앱으로 — 프로필은 비동기로 늦을 수 있음)
  useEffect(() => {
    if (loading) {
      devLog('[Auth Effect] 인증 상태 로딩 중...');
      return;
    }

    if (isAuthenticated && user) {
      devLog('[Auth Effect] 로그인 상태 - user:', user?.id, 'profile:', profile?.role);
      if (currentPage === 'signup') {
        // 홈에서 회원가입으로 이동한 경우 등 — 가입 화면 유지
      } else if (currentPage !== 'app') {
        devLog('[Auth Effect] 앱으로 이동');
        if (profile?.role) setRole(profile.role);
        setCurrentPage('app');
        setIsLoginModalOpen(false);

        const r = profile?.role;
        if (
          r === 'player_common' ||
          r === 'player_athlete' ||
          r === 'gym' ||
          r === 'admin'
        ) {
          setActiveTab('home');
          setTabHistory([]);
        }
      }
    } else if (!isAuthenticated) {
      devLog('[Auth Effect] 로그아웃 상태 - 랜딩으로 이동');
      // signup 페이지는 비로그인 상태에서도 접근 허용
      if (currentPage !== 'landing' && currentPage !== 'signup') {
        setRole(null);
        setCurrentPage('landing');
        setActiveTab('mypage');
      }
    }
  }, [isAuthenticated, user, profile, loading, currentPage]);

  // 프로필이 세션보다 늦게 도착해도 role state와 맞춤 (effectiveRole용)
  useEffect(() => {
    if (profile?.role) {
      setRole(profile.role);
    }
  }, [profile]);

  // 역할 변경 시 기본 탭을 홈으로
  useEffect(() => {
    devLog('역할 변경됨:', role);
    if (
      role === 'player_common' ||
      role === 'player_athlete' ||
      role === 'gym' ||
      role === 'admin'
    ) {
      setActiveTab('home');
      setTabHistory([]);
    }
  }, [role]);

  // currentPage 변경 감지
  useEffect(() => {
    devLog('현재 페이지:', currentPage, '역할:', role, 'activeTab:', activeTab);
  }, [currentPage, role, activeTab]);

  const handleLogout = async () => {
    try {
      devLog('[Logout] 로그아웃 시작');
      const { signOut } = await import('@/lib/supabase');
      const { error } = await signOut();
      
      if (error) {
        console.error('[Logout] signOut 에러:', error);
      } else {
        devLog('[Logout] Supabase signOut 성공');
      }
      
      // 로그인 모달 닫기 및 랜딩으로 강제 이동
      setIsLoginModalOpen(false);
      setRole(null);
      setSignupInitialRole('player_common');
      setCurrentPage('landing');
      setActiveTab('mypage');
    } catch (error) {
      console.error('[Logout] 로그아웃 예외:', error);
      setIsLoginModalOpen(false);
      setRole(null);
      setSignupInitialRole('player_common');
      setCurrentPage('landing');
      setActiveTab('mypage');
    }
  };

  const handleSignupClick = () => {
    setIsLoginModalOpen(false);
    setCurrentPage('signup');
  };

  const handleLoginSuccess = () => {
    devLog('로그인 성공 콜백 호출');
    // AuthContext가 자동으로 프로필 로드
    // useEffect가 화면 전환 처리
  };

  const handleSignupSuccess = () => {
    devLog('회원가입 성공 콜백 호출');
    setCurrentPage('landing');
    setIsLoginModalOpen(true);
  };

  // 로딩 중일 때
  // 통합 로딩 화면: 세션 확인 중 OR 로그인된 사용자의 프로필 로딩 중
  // currentPage에 의존하지 않아 타이밍 공백으로 인한 랜딩 페이지 노출 방지
  const isProfileLoading = user && !profile && profileLoading;
  if (loading || isProfileLoading) {
    const loadingText = isProfileLoading ? '프로필을 불러오는 중입니다' : '접속 확인 중입니다';
    return (
      <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <BackgroundGrid theme={{ accent: 'blue' }} />
        <div className="relative z-10 text-center max-w-sm w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 mb-5 animate-pulse">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
            </svg>
          </div>
          <p className="text-white font-medium mb-1">{loadingText}</p>
          <p className="text-gray-500 text-sm mb-6">잠시만 기다려 주세요...</p>
          <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden mx-auto max-w-xs">
            <div
              className="h-full w-1/3 bg-blue-500 rounded-full"
              style={{ animation: 'loading-slide 1.2s ease-in-out infinite' }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'signup') {
    return (
      <div className="relative min-h-screen bg-black text-white">
        <SignupPage 
          onBack={() => setCurrentPage('landing')} 
          language={language}
          t={t}
          onSignupSuccess={handleSignupSuccess}
          initialRole={signupInitialRole}
        />
      </div>
    );
  }
  
  if (currentPage === 'landing') {
    devLog('랜딩 페이지 렌더링');
    return (
      <div className="relative min-h-screen bg-black text-white overflow-hidden">
        <BackgroundGrid theme={{ accent: 'blue' }} />
        <LandingPage 
          onLoginClick={() => setIsLoginModalOpen(true)}
          onSignupClick={handleSignupClick}
          language={language}
          setLanguage={setLanguage}
        />
        <LoginModal 
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onSignup={handleSignupClick}
          onLoginSuccess={handleLoginSuccess}
          t={t}
        />
      </div>
    );
  }

  // 네트워크 끊김 — 로그인 후 프로필 로드 중 연결 단절
  if (!isOnline && user && !profile) {
    return (
      <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <BackgroundGrid theme={{ accent: 'blue' }} />
        <div className="relative z-10 text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 mb-5">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M8.111 8.111A8.5 8.5 0 0112 7c1.88 0 3.621.61 5.04 1.64M5.5 10.5a9.48 9.48 0 012.61-2.39M12 19.5a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </div>
          <p className="text-white font-semibold text-lg mb-2">인터넷 연결이 끊겼습니다</p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Wi-Fi 또는 모바일 데이터를 확인하고<br />다시 시도해 주세요.
          </p>
          <p className="text-gray-600 text-xs mt-4">연결이 복구되면 자동으로 계속됩니다.</p>
        </div>
      </div>
    );
  }

  // 세션은 있는데 프로필 로드 실패 — 진짜 에러 (5초 초과 or Supabase/RLS 오류)
  if (currentPage === 'app' && isAuthenticated && user && !profile && !loading && !profileLoading) {
    const isNetworkError =
      profileLoadError?.includes('fetch') ||
      profileLoadError?.includes('network') ||
      profileLoadError?.includes('시간이 초과');

    return (
      <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <BackgroundGrid theme={{ accent: 'blue' }} />
        <div className="relative z-10 text-center max-w-md w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 text-red-400 mb-5">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-white font-semibold text-lg mb-2">계정 정보를 불러오지 못했습니다</p>
          <p className="text-gray-400 text-sm mb-4 leading-relaxed">
            {isNetworkError
              ? '서버 응답이 너무 오래 걸립니다.\n네트워크 상태를 확인하고 다시 시도해 주세요.'
              : '계정 데이터를 불러오는 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.'}
          </p>
          {profileLoadError && (
            <p className="text-amber-200/80 text-xs text-left mb-5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 break-words font-mono leading-relaxed">
              {profileLoadError}
            </p>
          )}
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-6 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            {isRetrying ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                다시 시도 중...
              </>
            ) : '다시 시도'}
          </button>
        </div>
      </div>
    );
  }

  // 앱 화면 (역할이 선택되었을 때)
  if (currentPage === 'app') {
    devLog('앱 페이지 렌더링 시도, role:', role, 'activeTab:', activeTab);
  }
  
  const theme =
    effectiveRole === 'player_common' ? THEME_ATHLETE :
    effectiveRole === 'player_athlete' ? THEME_COACH :
    THEME_GYM;

  /** 선수: 스킬·랭킹 (통계 메뉴 제거) */
  const renderPlayerMainRoutes = () => {
    if (activeTab.startsWith('opponent-match-history-')) {
      const opponentId = activeTab.replace('opponent-match-history-', '');
      return <OpponentMatchHistoryView setActiveTab={navigateToTab} t={t} opponentId={opponentId} onBack={handleGlobalBack} />;
    }
    if (activeTab.startsWith('opponent-profile-')) {
      const opponentId = activeTab.replace('opponent-profile-', '');
      return <OpponentProfileView setActiveTab={navigateToTab} t={t} opponentId={opponentId} onBack={handleGlobalBack} />;
    }
    switch (activeTab) {
      case 'skills':
      case 'roadmap-active-skills':
      case 'roadmap-skill-tree':
        return <ActiveSkillsView t={t} setActiveTab={navigateToTab} addSkillRequest={addSkillRequest} onBack={handleGlobalBack} />;
      case 'ranking':
      case 'ranking-tier-board':
      case 'ranking-style':
      case 'ranking-regional':
        return <TierBoardView t={t} setActiveTab={navigateToTab} onBack={handleGlobalBack} />;
      default:
        return null;
    }
  };

  const renderMyPageRoutes = () => {
    switch(activeTab) {
      case 'mypage': return <MyPageView setActiveTab={navigateToTab} t={t} onBack={handleGlobalBack} canGoBack={tabHistory.length > 0} />;
      case 'settings': return <SettingsView setActiveTab={navigateToTab} t={t} onBack={handleGlobalBack} />;
      case 'mypage-edit-profile': return <EditProfileView setActiveTab={navigateToTab} t={t} onBack={handleGlobalBack} />;
      case 'mypage-privacy': return <PrivacySettingsView setActiveTab={navigateToTab} t={t} onBack={handleGlobalBack} />;
      case 'mypage-terms': return <TermsOfServiceInlineView setActiveTab={navigateToTab} backTab="mypage" onBack={handleGlobalBack} />;
      case 'mypage-activity': return <ActivityHistoryView setActiveTab={navigateToTab} t={t} onBack={handleGlobalBack} />;
      case 'mypage-match-history': return <MatchHistoryView setActiveTab={navigateToTab} t={t} onBack={handleGlobalBack} />;
      case 'mypage-attendance': return (
        <div className="animate-fade-in-up max-w-md mx-auto">
          <PageHeader
            title={t('attendance')}
            description={t('dailyCheckIn')}
            onBack={handleGlobalBack}
          />
          <DashboardAttendanceInline t={t} setActiveTab={navigateToTab} />
        </div>
      );
      default: return null;
    }
  };

  const renderCoachRoutes = () => {
    switch(activeTab) {
      case 'approval': return <ApprovalView setActiveTab={navigateToTab} t={t} onBack={handleGlobalBack} />;
      case 'players': return <PlayersManagementView t={t} setActiveTab={navigateToTab} onBack={handleGlobalBack} />;
      case 'gym-register-member': return <GymNewMemberRegisterView t={t} setActiveTab={navigateToTab} onBack={handleGlobalBack} />;
      case 'match': return <MatchRoomView t={t} setActiveTab={navigateToTab} onBack={handleGlobalBack} />;
      default: return null;
    }
  };

  const renderView = () => {
    if (activeTab.startsWith('opponent-match-history-')) {
      const opponentId = activeTab.replace('opponent-match-history-', '');
      return <OpponentMatchHistoryView setActiveTab={navigateToTab} t={t} opponentId={opponentId} onBack={handleGlobalBack} />;
    }
    if (activeTab.startsWith('opponent-profile-')) {
      const opponentId = activeTab.replace('opponent-profile-', '');
      return <OpponentProfileView setActiveTab={navigateToTab} t={t} opponentId={opponentId} onBack={handleGlobalBack} />;
    }
    if (
      activeTab === 'home' &&
      (effectiveRole === 'player_common' ||
        effectiveRole === 'player_athlete' ||
        effectiveRole === 'gym' ||
        effectiveRole === 'admin')
    ) {
      return (
        <AppHomeView
          setActiveTab={navigateToTab}
          t={t}
          role={effectiveRole === 'admin' ? 'gym' : effectiveRole}
        />
      );
    }
    if (effectiveRole === 'player_common' || effectiveRole === 'player_athlete') {
      return (
        renderPlayerMainRoutes() ||
        renderMyPageRoutes() ||
        <ComingSoonView title="Coming Soon" />
      );
    }
    if (effectiveRole === 'gym' || effectiveRole === 'admin') {
      return (
        renderPlayerMainRoutes() ||
        renderCoachRoutes() ||
        renderMyPageRoutes() ||
        <ComingSoonView title="Coming Soon" />
      );
    }
    return <ComingSoonView title="Coming Soon" />;
  };

  return (
    // 모바일에서 화면을 정확히 꽉 채우도록 — 100dvh + iOS 안전 영역 패딩 분리
    <div
      className="relative w-full bg-black text-white"
      style={{ minHeight: '100vh' }}
    >
      <BackgroundGrid theme={theme} />

      <Navbar
        role={effectiveRole}
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        onLogout={handleLogout}
        language={language}
        setLanguage={setLanguage}
        t={t}
      />

      <main
        className={
          activeTab === 'skills' || activeTab === 'roadmap-active-skills' || activeTab === 'home'
            ? 'relative z-10 pb-8 sm:pb-10 w-full min-w-0 max-w-none overflow-x-hidden'
            : 'relative z-10 px-2 xs:px-3 sm:px-4 lg:px-6 pb-12 xs:pb-14 sm:pb-20 max-w-7xl mx-auto'
        }
        style={{
          // 상단: 네비바 높이(반응형) + iOS 노치 safe-area-inset-top 포함
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + clamp(3.75rem, 8vw, 6rem))',
          // 하단/좌/우: iOS 안전 영역 포함 — 풀 화면 유지하면서 잘림 방지
          paddingLeft: 'max(env(safe-area-inset-left), 0px)',
          paddingRight: 'max(env(safe-area-inset-right), 0px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 32px)',
          minHeight: '100vh',
        }}
      >
        {renderView()}
      </main>
    </div>
  );
}

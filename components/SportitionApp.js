'use client';

import { useState, useEffect } from 'react';
import { BackgroundGrid, THEME_ATHLETE, THEME_COACH, THEME_GYM } from '@/components/ui';
import { Navbar } from '@/components/navigation';
import { LoginModal, SignupPage, LandingPage } from '@/components/views/landing';
import { ActiveSkillsView } from '@/components/views/skills';
import { TierBoardView } from '@/components/views/ranking';
import { MyPageView, EditProfileView, PrivacySettingsView, NotificationsView, AccountSecurityView, ActivityHistoryView, OpponentProfileView } from '@/components/views/mypage';
import TermsOfServiceInlineView from '@/components/legal/TermsOfServiceInlineView';
import { PlayersManagementView, MatchRoomView, GymNewMemberRegisterView } from '@/components/views/coach';
import { ApprovalView } from '@/components/views/approval';
import { ComingSoonView } from '@/components/views/comingsoon';
import AppHomeView from '@/components/views/AppHomeView';
import { translations } from '@/lib/translations';
import { useAuth } from '@/lib/AuthContext';

const devLog = (...args) => {
  if (process.env.NODE_ENV === 'development') console.log(...args);
};

export default function SportitionApp() {
  const { user, profile, isAuthenticated, loading, profileLoadError, refreshProfile } = useAuth();
  const [currentPage, setCurrentPage] = useState('landing');
  const [role, setRole] = useState(null);
  const [activeTab, setActiveTab] = useState('home');

  // profile.role을 항상 우선 신뢰 (role state가 아직 null이어도 렌더링 가능)
  const effectiveRole = profile?.role || role;
  const [signupInitialRole, setSignupInitialRole] = useState('player_common');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [language, setLanguage] = useState('ko');
  
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
  if (loading) {
    return (
      <div className="relative min-h-screen bg-black text-white flex items-center justify-center">
        <BackgroundGrid theme={{ accent: 'blue' }} />
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 mb-4 animate-pulse">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
            </svg>
          </div>
          <p className="text-gray-400">로딩 중...</p>
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

  // 세션은 있는데 users 행이 없거나 로드 실패 시 (RLS 등) — 랜딩에 붙지 않도록 별도 안내
  if (currentPage === 'app' && isAuthenticated && user && !profile && !loading) {
    return (
      <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <BackgroundGrid theme={{ accent: 'blue' }} />
        <div className="relative z-10 text-center max-w-md">
          <p className="text-gray-200 mb-2 font-medium">프로필을 불러오지 못했습니다.</p>
          <p className="text-gray-500 text-sm mb-3">네트워크·DB 권한을 확인하거나 잠시 후 다시 시도해 주세요.</p>
          {profileLoadError ? (
            <p className="text-amber-200/90 text-xs text-left mb-6 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 break-words font-mono leading-relaxed">
              {profileLoadError}
            </p>
          ) : (
            <p className="text-gray-600 text-xs mb-6">상세 오류가 없습니다. Network 탭에서 <span className="text-gray-400">supabase.co</span> 요청의 실패 응답을 확인해 주세요.</p>
          )}
          <button
            type="button"
            onClick={() => refreshProfile()}
            className="px-5 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 font-bold text-sm"
          >
            다시 시도
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
    if (activeTab.startsWith('opponent-profile-')) {
      const opponentId = activeTab.replace('opponent-profile-', '');
      return <OpponentProfileView setActiveTab={setActiveTab} t={t} opponentId={opponentId} />;
    }
    switch (activeTab) {
      case 'skills':
      case 'roadmap-active-skills':
      case 'roadmap-skill-tree':
        return <ActiveSkillsView t={t} setActiveTab={setActiveTab} addSkillRequest={addSkillRequest} />;
      case 'ranking':
      case 'ranking-tier-board':
      case 'ranking-style':
      case 'ranking-regional':
        return <TierBoardView t={t} setActiveTab={setActiveTab} />;
      default:
        return null;
    }
  };

  const renderMyPageRoutes = () => {
    switch(activeTab) {
      case 'mypage': return <MyPageView setActiveTab={setActiveTab} t={t} />;
      case 'mypage-edit-profile': return <EditProfileView setActiveTab={setActiveTab} t={t} />;
      case 'mypage-privacy': return <PrivacySettingsView setActiveTab={setActiveTab} t={t} />;
      case 'mypage-terms': return <TermsOfServiceInlineView setActiveTab={setActiveTab} backTab="mypage" />;
      case 'mypage-notifications': return <NotificationsView setActiveTab={setActiveTab} t={t} />;
      case 'mypage-security': return <AccountSecurityView setActiveTab={setActiveTab} t={t} />;
      case 'mypage-activity': return <ActivityHistoryView setActiveTab={setActiveTab} t={t} />;
      default: return null;
    }
  };

  const renderCoachRoutes = () => {
    switch(activeTab) {
      case 'approval': return <ApprovalView setActiveTab={setActiveTab} t={t} />;
      case 'players': return <PlayersManagementView t={t} setActiveTab={setActiveTab} />;
      case 'gym-register-member': return <GymNewMemberRegisterView t={t} setActiveTab={setActiveTab} />;
      case 'match': return <MatchRoomView t={t} setActiveTab={setActiveTab} />;
      default: return null;
    }
  };

  const renderView = () => {
    if (activeTab.startsWith('opponent-profile-')) {
      const opponentId = activeTab.replace('opponent-profile-', '');
      return <OpponentProfileView setActiveTab={setActiveTab} t={t} opponentId={opponentId} />;
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
          setActiveTab={setActiveTab}
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
    <div className="relative min-h-screen bg-black text-white">
      <BackgroundGrid theme={theme} />
      
      <Navbar 
        role={effectiveRole} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        language={language}
        setLanguage={setLanguage}
        t={t}
      />

      <main
        className={
          activeTab === 'skills' || activeTab === 'roadmap-active-skills' || activeTab === 'home'
            ? 'relative z-10 pt-16 xs:pt-18 sm:pt-24 pb-8 sm:pb-10 w-full min-w-0 max-w-none min-h-screen overflow-x-hidden'
            : 'relative z-10 pt-16 xs:pt-18 sm:pt-24 px-2 xs:px-3 sm:px-4 lg:px-6 pb-12 xs:pb-14 sm:pb-20 max-w-7xl mx-auto min-h-screen'
        }
      >
        {renderView()}
      </main>
    </div>
  );
}

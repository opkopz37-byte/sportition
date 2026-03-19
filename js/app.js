// 메인 앱 컴포넌트
const { useState, useEffect } = React;

function SportitionApp() {
  const [currentPage, setCurrentPage] = useState('landing');
  const [role, setRole] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
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
  
  const updateSkillRequestStatus = (requestId, newStatus) => {
    setSkillRequests(skillRequests.map(req => 
      req.id === requestId ? { ...req, status: newStatus } : req
    ));
  };

  useEffect(() => {
    if (role === 'athlete') setActiveTab('dashboard');
    if (role === 'coach') setActiveTab('insights');
  }, [role]);

  const handleSelectRole = (selectedRole) => {
    setRole(selectedRole);
    setCurrentPage('app');
  };

  const handleLogout = () => {
    setRole(null);
    setCurrentPage('landing');
  };

  const handleSignupClick = () => {
    setIsLoginModalOpen(false);
    setCurrentPage('signup');
  };

  if (currentPage === 'signup') {
    return (
      <div className="relative min-h-screen bg-black text-white">
        <SignupPage 
          onBack={() => setCurrentPage('landing')} 
          language={language}
          t={t}
        />
      </div>
    );
  }

  if (currentPage === 'landing') {
    return (
      <div className="relative min-h-screen bg-black text-white overflow-hidden">
        <BackgroundGrid theme={{ accent: 'blue' }} />
        <LandingPage 
          onSelectRole={handleSelectRole} 
          onLoginClick={() => setIsLoginModalOpen(true)}
          language={language}
          setLanguage={setLanguage}
        />
        <LoginModal 
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onSignup={handleSignupClick}
          t={t}
        />
      </div>
    );
  }

  const theme = role === 'athlete' ? THEME_ATHLETE : THEME_COACH;

  const renderDashboardRoutes = () => {
    if (activeTab.startsWith('opponent-profile-')) {
      const opponentName = activeTab.replace('opponent-profile-', '');
      return <OpponentProfileView setActiveTab={setActiveTab} t={t} opponentName={opponentName} />;
    }
    
    switch(activeTab) {
      case 'dashboard': return <DashboardView setActiveTab={setActiveTab} t={t} role={role} />;
      case 'dashboard-workout-details': return <ComingSoonView title={t('workoutResults')} />;
      case 'dashboard-steps': return <ComingSoonView title={t('stepsForToday')} />;
      case 'dashboard-habits': return <ComingSoonView title={t('myHabits')} />;
      case 'dashboard-weight-plan': return <ComingSoonView title={t('weightLossPlan')} />;
      default: return null;
    }
  };

  const renderRoadmapRoutes = () => {
    switch(activeTab) {
      case 'roadmap-skill-tree': return <SkillTreeView t={t} setActiveTab={setActiveTab} />;
      case 'roadmap-active-skills': return <ActiveSkillsView t={t} setActiveTab={setActiveTab} addSkillRequest={addSkillRequest} />;
      case 'roadmap-passive-skills': return <PassiveSkillsView t={t} setActiveTab={setActiveTab} addSkillRequest={addSkillRequest} />;
      default: return null;
    }
  };

  const renderRankingRoutes = () => {
    if (activeTab.startsWith('opponent-profile-')) {
      const opponentName = activeTab.replace('opponent-profile-', '');
      return <OpponentProfileView setActiveTab={setActiveTab} t={t} opponentName={opponentName} />;
    }
    
    switch(activeTab) {
      case 'ranking-tier-board': return <TierBoardView t={t} setActiveTab={setActiveTab} />;
      case 'ranking-style': return <ComingSoonView title={t('style') + ' ' + t('ranking')} />;
      case 'ranking-regional': return <ComingSoonView title={t('regional') + ' ' + t('ranking')} />;
      default: return null;
    }
  };

  const renderStatisticsRoutes = () => {
    switch(activeTab) {
      case 'statistics-style-stats': return <StyleStatsView t={t} setActiveTab={setActiveTab} />;
      case 'statistics-tier-stats': return <ComingSoonView title={t('tierStats')} />;
      default: return null;
    }
  };

  const renderMyPageRoutes = () => {
    switch(activeTab) {
      case 'mypage': return <MyPageView setActiveTab={setActiveTab} t={t} />;
      case 'mypage-edit-profile': return <EditProfileView setActiveTab={setActiveTab} t={t} />;
      case 'mypage-privacy': return <PrivacySettingsView setActiveTab={setActiveTab} t={t} />;
      case 'mypage-notifications': return <NotificationsView setActiveTab={setActiveTab} t={t} />;
      case 'mypage-security': return <AccountSecurityView setActiveTab={setActiveTab} t={t} />;
      case 'mypage-activity': return <ActivityHistoryView setActiveTab={setActiveTab} t={t} />;
      case 'mypage-achievements': return <AchievementsView setActiveTab={setActiveTab} t={t} />;
      default: return null;
    }
  };

  const renderCoachRoutes = () => {
    switch(activeTab) {
      case 'insights': return <CoachInsightsView t={t} setActiveTab={setActiveTab} skillRequests={skillRequests} updateSkillRequestStatus={updateSkillRequestStatus} />;
      case 'players': return <PlayersManagementView t={t} setActiveTab={setActiveTab} />;
      case 'match': return <MatchRoomView t={t} setActiveTab={setActiveTab} />;
      case 'admin': return <AdminManagementView t={t} setActiveTab={setActiveTab} />;
      default: return null;
    }
  };

  const renderView = () => {
    if (role === 'athlete') {
      return renderDashboardRoutes() || 
             renderRoadmapRoutes() || 
             renderRankingRoutes() || 
             renderStatisticsRoutes() || 
             renderMyPageRoutes() || 
             <ComingSoonView title="Coming Soon" />;
    } else {
      return renderCoachRoutes() || <ComingSoonView title="Coming Soon" />;
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white">
      <BackgroundGrid theme={theme} />
      
      <Navbar 
        role={role} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        language={language}
        setLanguage={setLanguage}
        t={t}
      />

      <main className="relative z-10 pt-20 sm:pt-28 px-3 sm:px-4 lg:px-6 pb-16 sm:pb-20 max-w-7xl mx-auto min-h-screen">
        {renderView()}
      </main>
    </div>
  );
}

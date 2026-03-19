// 공통 컴포넌트들
const { useState, useEffect, useRef } = React;

// Lucide 아이콘을 간단한 SVG로 대체
const Icon = ({ type, size = 20, className = "", fill = "none" }) => {
  const icons = {
    zap: <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    map: <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
    trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    login: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></>,
    arrowRight: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    chevronRight: <><polyline points="9 18 15 12 9 6"/></>,
    chevronLeft: <><polyline points="15 18 9 12 15 6"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m5.2-13.8l-4.2 4.2m-2 2l-4.2 4.2M23 12h-6m-6 0H5m13.8 5.2l-4.2-4.2m-2-2l-4.2-4.2"/></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    trendingUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    moreVertical: <><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    globe: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
    arrowLeft: <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
    checkCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
    clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    chevronDown: <><polyline points="6 9 12 15 18 9"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  };
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill={fill} 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      {icons[type]}
    </svg>
  );
};

// 테마 상수
const THEME_ATHLETE = {
  accent: 'blue',
  primary: '#3B82F6',
};

const THEME_COACH = {
  accent: 'emerald',
  primary: '#10B981',
};

// 페이지 헤더 컴포넌트 (뒤로가기 버튼 포함)
const PageHeader = ({ title, description, onBack, children }) => (
  <div className="mb-3 sm:mb-6">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            className="w-7 h-7 sm:w-9 sm:h-9 flex-shrink-0 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all group"
            title="뒤로가기"
          >
            <Icon type="arrowLeft" size={14} className="sm:w-4 sm:h-4 text-gray-400 group-hover:text-white group-hover:-translate-x-1 transition-all" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-xl lg:text-2xl font-bold text-white mb-0.5 truncate">{title}</h2>
          {description && <p className="text-[11px] sm:text-xs text-gray-500 truncate">{description}</p>}
        </div>
      </div>
      {children && <div className="w-full sm:w-auto flex-shrink-0">{children}</div>}
    </div>
  </div>
);

// 메뉴 구조 - 다국어 키 사용
const getMenuStructure = (t) => ({
  athlete: [
    { id: 'dashboard', labelKey: 'dashboard', icon: 'dashboard', submenus: [] },
    { 
      id: 'roadmap', 
      labelKey: 'roadmap', 
      icon: 'map', 
      alert: true,
      submenus: [
        { id: 'skill-tree', labelKey: 'skillTree' },
        { id: 'active-skills', labelKey: 'activeSkills' },
        { id: 'passive-skills', labelKey: 'passiveSkills' }
      ]
    },
    { 
      id: 'ranking', 
      labelKey: 'ranking', 
      icon: 'trophy',
      submenus: [
        { id: 'tier-board', labelKey: 'tierBoard' },
        { id: 'style', labelKey: 'style' },
        { id: 'regional', labelKey: 'regional' }
      ]
    },
    { 
      id: 'statistics', 
      labelKey: 'statistics', 
      icon: 'chart',
      submenus: [
        { id: 'style-stats', labelKey: 'styleStats' },
        { id: 'tier-stats', labelKey: 'tierStats' }
      ]
    },
    { id: 'mypage', labelKey: 'myPage', icon: 'user', submenus: [] },
  ],
  coach: [
    { id: 'insights', labelKey: 'insights', icon: 'chart', submenus: [] },
    { id: 'players', labelKey: 'members', icon: 'users', submenus: [] },
    { id: 'match', labelKey: 'matchRoom', icon: 'trophy', submenus: [] },
    { id: 'admin', labelKey: 'management', icon: 'settings', submenus: [] },
  ]
});

// SpotlightCard 컴포넌트
const SpotlightCard = ({ children, className = "", onClick, theme = 'blue' }) => {
  const divRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOpacity(1);
  };

  const glowColor = theme === 'blue' ? '120, 119, 198' : '16, 185, 129';

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setOpacity(0)}
      onClick={onClick}
      className={`relative rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden group ${onClick ? 'cursor-pointer hover:scale-[1.01] transition-transform duration-300' : ''} ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(${glowColor}, 0.15), transparent 40%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
};

// BackgroundGrid 컴포넌트
const BackgroundGrid = ({ theme }) => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black">
    <div 
      className="absolute inset-0 opacity-[0.15]"
      style={{
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(circle at 50% 50%, black, transparent 80%)'
      }}
    />
    <div className={`absolute top-0 left-1/4 w-[500px] h-[500px] bg-${theme.accent}-600/20 rounded-full blur-[120px] mix-blend-screen opacity-40 animate-pulse-slow`} />
  </div>
);

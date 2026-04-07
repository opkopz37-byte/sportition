'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon, THEME_ATHLETE, THEME_COACH, THEME_GYM, getMenuStructure } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { searchPublicPlayerProfiles } from '@/lib/supabase';

// 네비게이션 메뉴 아이템
const NavMenuItem = ({ item, activeTab, setActiveTab, theme, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef(null);
  const hasSubmenus = item.submenus && item.submenus.length > 0;

  const handleMouseEnter = () => {
if (timeoutRef.current) {
  clearTimeout(timeoutRef.current);
}
setIsOpen(true);
  };

  const handleMouseLeave = () => {
timeoutRef.current = setTimeout(() => {
  setIsOpen(false);
}, 200);
  };

  useEffect(() => {
return () => {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
  }
};
  }, []);

  return (
<div 
  className="relative z-[100]"
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
>
  <button
    type="button"
    onClick={() => !hasSubmenus && setActiveTab(item.id)}
    className={`shrink-0 whitespace-nowrap px-[clamp(0.5rem,1.5vw,1rem)] py-[clamp(0.375rem,1vw,0.5rem)] rounded-lg text-[clamp(0.75rem,calc(0.9vw+0.4rem),0.875rem)] font-medium transition-all duration-200 flex items-center gap-[clamp(0.25rem,1vw,0.5rem)] relative ${
      activeTab === item.id ? 'text-white bg-white/5' : 'text-gray-500 hover:text-gray-300'
    }`}
  >
    <Icon type={item.icon} className={`w-[clamp(0.875rem,2.2vw,1rem)] h-[clamp(0.875rem,2.2vw,1rem)] shrink-0 ${activeTab === item.id ? `text-${theme.accent}-400` : ''}`} />
    <span className="whitespace-nowrap">{t(item.labelKey)}</span>
    {item.alert && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />}
  </button>

  {hasSubmenus && isOpen && (
    <div className="absolute top-full left-0 mt-1.5 min-w-[12rem] w-max max-w-[min(100vw-1rem,20rem)] bg-[#0A0A0A] border border-white/10 rounded-lg shadow-2xl animate-fade-in-up z-[200] py-1">
      {item.submenus.map((submenu) => (
        <button
          key={submenu.id}
          type="button"
          onClick={() => setActiveTab(`${item.id}-${submenu.id}`)}
          className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-between gap-2 group whitespace-nowrap"
        >
          <span>{t(submenu.labelKey)}</span>
          <Icon type="chevronRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
    </div>
  )}
</div>
  );
};

// 네비게이션 바
const Navbar = ({ role, activeTab, setActiveTab, onLogout, language, setLanguage, t }) => {
  const { profile } = useAuth();
  const isPlayerRole = role === 'player_common' || role === 'player_athlete';
  const theme = role === 'player_common' ? THEME_ATHLETE : (role === 'player_athlete' ? THEME_COACH : THEME_GYM);
  const menuItems = getMenuStructure(t)[role] || [];
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [playerResults, setPlayerResults] = useState([]);
  const langRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const loadPlayerResults = async () => {
      if (!isPlayerRole || !searchQuery.trim()) {
        setPlayerResults([]);
        return;
      }

      const { data } = await searchPublicPlayerProfiles(searchQuery);
      setPlayerResults(data || []);
    };

    loadPlayerResults();
  }, [isPlayerRole, searchQuery]);

  useEffect(() => {
const handleClickOutside = (event) => {
  if (langRef.current && !langRef.current.contains(event.target)) {
    setShowLangMenu(false);
  }
  if (profileRef.current && !profileRef.current.contains(event.target)) {
    setShowProfileMenu(false);
  }
  if (searchRef.current && !searchRef.current.contains(event.target)) {
    setShowSearchResults(false);
  }
};
document.addEventListener('mousedown', handleClickOutside);
return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 모바일 메뉴 아이템 렌더링
  const MobileMenuItem = ({ item, depth = 0, activeTab, setActiveTab, setShowMobileMenu, theme, t }) => {
const hasSubmenus = item.submenus && item.submenus.length > 0;
const [isExpanded, setIsExpanded] = useState(false);

return (
  <div className={depth > 0 ? 'ml-3 sm:ml-4' : ''}>
    <button
      onClick={() => {
        if (hasSubmenus) {
          setIsExpanded(!isExpanded);
        } else {
          setActiveTab(item.id);
          setShowMobileMenu(false);
        }
      }}
      className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
        activeTab === item.id 
          ? (theme.accent === 'blue' 
              ? 'bg-blue-500/20 text-blue-400 font-bold' 
              : 'bg-emerald-500/20 text-emerald-400 font-bold')
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Icon type={item.icon} size={16} className="flex-shrink-0" />
        <span className="text-xs sm:text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">{item.labelKey ? t(item.labelKey) : item.label}</span>
        {item.alert && <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />}
      </div>
      {hasSubmenus && (
        <Icon type={isExpanded ? "chevronDown" : "chevronRight"} size={14} className="flex-shrink-0" />
      )}
    </button>
    {hasSubmenus && isExpanded && (
      <div className="bg-white/5">
        {item.submenus.map(sub => {
          const fullTabId = `${item.id}-${sub.id}`;
          return (
            <button
              key={sub.id}
              onClick={() => {
                setActiveTab(fullTabId);
                setShowMobileMenu(false);
              }}
              className={`w-full flex items-center gap-1.5 px-3 py-2 ml-5 sm:ml-7 text-left text-xs sm:text-sm transition-colors ${
                activeTab === fullTabId 
                  ? (theme.accent === 'blue' ? 'text-blue-400 font-bold' : 'text-emerald-400 font-bold')
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="w-1 h-1 rounded-full bg-gray-500 flex-shrink-0"></span>
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">{sub.labelKey ? t(sub.labelKey) : sub.label}</span>
            </button>
          );
        })}
      </div>
    )}
  </div>
);
  };

  return (
<>
  <header className="fixed top-0 inset-x-0 z-50 min-h-[clamp(2.75rem,7vw,4rem)] border-b border-white/5 bg-black/50 backdrop-blur-xl flex flex-wrap items-center justify-between gap-x-2 gap-y-2 px-[clamp(0.375rem,2vw,1.5rem)] py-2 min-w-0 overflow-visible">
    <div className="flex items-center gap-[clamp(0.375rem,2vw,1.5rem)] min-w-0 flex-1 basis-0 min-[520px]:basis-auto xl:flex-initial overflow-visible">
      <button 
        type="button"
        onClick={() => setShowMobileMenu(!showMobileMenu)}
        className="xl:hidden shrink-0 p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
      >
        <Icon type={showMobileMenu ? "x" : "menu"} size={18} />
      </button>

      <div className="flex items-center gap-[clamp(0.25rem,1.2vw,0.5rem)] font-bold text-white tracking-tight cursor-pointer min-w-0 shrink-0" onClick={() => setActiveTab(menuItems[0]?.id || 'dashboard')}>
        <div className={`rounded-lg flex items-center justify-center shrink-0 w-[clamp(1.375rem,3.5vw,1.75rem)] h-[clamp(1.375rem,3.5vw,1.75rem)] ${
          theme.accent === 'blue' 
            ? 'bg-blue-500/20 text-blue-500' 
            : theme.accent === 'emerald'
            ? 'bg-emerald-500/20 text-emerald-500'
            : 'bg-purple-500/20 text-purple-500'
        }`}>
          {role === 'player_common' ? <Icon type="zap" className="w-[clamp(0.75rem,2vw,1rem)] h-[clamp(0.75rem,2vw,1rem)]" fill="currentColor" /> : role === 'player_athlete' ? <Icon type="target" className="w-[clamp(0.75rem,2vw,1rem)] h-[clamp(0.75rem,2vw,1rem)]" /> : <Icon type="home" className="w-[clamp(0.75rem,2vw,1rem)] h-[clamp(0.75rem,2vw,1rem)]" />}
        </div>
        <span className="text-[clamp(0.7rem,calc(0.8vw+0.45rem),0.875rem)] whitespace-nowrap truncate max-w-[min(8rem,28vw)] sm:max-w-none">Sportition</span>
      </div>

      <nav className="hidden xl:flex flex-wrap items-center gap-x-0.5 gap-y-1 justify-start overflow-visible min-w-0 flex-1 xl:max-w-none py-0.5" aria-label="Main">
        {menuItems.map(item => (
          <NavMenuItem 
            key={item.id}
            item={item}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            theme={theme}
            t={t}
          />
        ))}
      </nav>
    </div>

    <div className="flex items-center gap-[clamp(0.25rem,1.5vw,0.75rem)] min-w-0 flex-1 sm:flex-1 justify-end flex-wrap sm:flex-nowrap w-full min-[520px]:w-auto overflow-visible">
      {role === 'gym' && (
        <button
          onClick={() => window.open('/attendance', '_blank', 'width=1920,height=1080,toolbar=no,location=no,status=no,menubar=no,scrollbars=no')}
          className="relative p-1.5 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-white/5 group"
          title="출석체크 키오스크 열기"
        >
          <Icon type="clipboard" size={16} className="sm:w-[18px] sm:h-[18px]" />
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-500 rounded-full border border-black animate-pulse" />
        </button>
      )}

      {isPlayerRole && (
        <div className="relative flex-1 min-w-0 max-w-none min-[520px]:max-w-md xl:max-w-lg 2xl:max-w-xl" ref={searchRef}>
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              placeholder={t('searchPlayers') || '선수 검색...'}
              className="w-full min-w-[12rem] pl-9 pr-9 py-2 sm:py-2.5 bg-white/[0.07] border border-white/20 rounded-xl text-sm sm:text-[15px] text-white placeholder-gray-400 shadow-inner shadow-black/20 focus:outline-none focus:border-blue-400/60 focus:bg-white/10 focus:ring-1 focus:ring-blue-500/30 transition-all"
            />
            <Icon 
              type="search" 
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none w-[clamp(0.8125rem,2vw,1rem)] h-[clamp(0.8125rem,2vw,1rem)]" 
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                <Icon type="x" className="w-[clamp(0.8125rem,2vw,1rem)] h-[clamp(0.8125rem,2vw,1rem)]" />
              </button>
            )}
          </div>

          {showSearchResults && searchQuery.trim().length > 0 && (
            <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-[#0A0A0A] border border-white/10 rounded-lg overflow-hidden shadow-2xl animate-fade-in-up max-h-96 overflow-y-auto">
              {playerResults.length > 0 ? (
                <div>
                  <div className="px-3 py-2 border-b border-white/5 bg-white/5">
                    <span className="text-xs text-gray-400">
                      {playerResults.length}명의 선수를 찾았습니다
                    </span>
                  </div>
                  {playerResults.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => {
                        setActiveTab(`opponent-profile-${player.id}`);
                        setSearchQuery('');
                        setShowSearchResults(false);
                      }}
                      className="w-full px-3 py-3 text-left transition-colors hover:bg-white/5 border-b border-white/5 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {(player.display_name || player.name || 'U').charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-white truncate">{player.display_name || player.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 whitespace-nowrap">
                                #{player.rank || '-'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className="text-yellow-400 font-medium">{player.tier}</span>
                              <span>•</span>
                              <span>승률 {player.win_rate || 0}%</span>
                              <span>•</span>
                              <span className="truncate">{player.boxing_style || '미등록'}</span>
                            </div>
                          </div>
                        </div>
                        <Icon type="arrowRight" size={14} className="text-gray-500 flex-shrink-0 ml-2" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Icon type="search" size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">검색 결과가 없습니다</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="relative" ref={langRef}>
        <button 
          onClick={() => setShowLangMenu(!showLangMenu)}
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-[clamp(0.125rem,0.8vw,0.375rem)] px-[clamp(0.25rem,1.2vw,0.5rem)] py-[clamp(0.25rem,1vw,0.375rem)] rounded-lg hover:bg-white/5 min-w-0"
        >
          <Icon type="globe" className="w-[clamp(0.8125rem,2vw,1rem)] h-[clamp(0.8125rem,2vw,1rem)] shrink-0" />
          <span className="text-[clamp(0.65rem,calc(0.5vw+0.5rem),0.875rem)] font-medium hidden xs:inline whitespace-nowrap">{language === 'ko' ? 'KR' : 'EN'}</span>
        </button>
        
        {showLangMenu && (
          <div className="absolute top-full right-0 mt-1.5 w-[clamp(7rem,35vw,8.5rem)] bg-[#0A0A0A] border border-white/10 rounded-lg overflow-hidden shadow-2xl animate-fade-in-up">
            <button
              onClick={() => { setLanguage('ko'); setShowLangMenu(false); }}
              className={`w-full px-[clamp(0.5rem,2vw,0.75rem)] py-[clamp(0.375rem,1.2vw,0.5rem)] text-left text-[clamp(0.6875rem,calc(0.4vw+0.55rem),0.875rem)] transition-colors flex items-center justify-between ${
                language === 'ko' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>한국어</span>
              {language === 'ko' && <span className="text-blue-400">✓</span>}
            </button>
            <button
              onClick={() => { setLanguage('en'); setShowLangMenu(false); }}
              className={`w-full px-[clamp(0.5rem,2vw,0.75rem)] py-[clamp(0.375rem,1.2vw,0.5rem)] text-left text-[clamp(0.6875rem,calc(0.4vw+0.55rem),0.875rem)] transition-colors flex items-center justify-between ${
                language === 'en' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>English</span>
              {language === 'en' && <span className="text-blue-400">✓</span>}
            </button>
          </div>
        )}
      </div>

      <div className="h-[clamp(0.875rem,2vw,1rem)] w-px bg-white/10 hidden sm:block shrink-0" />
      
      <div className="relative min-w-0" ref={profileRef}>
        <button 
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="flex items-center gap-[clamp(0.25rem,1.2vw,0.5rem)] group hover:bg-white/5 rounded-lg px-[clamp(0.125rem,1vw,0.375rem)] py-[clamp(0.125rem,0.8vw,0.25rem)] transition-colors max-w-[min(100%,14rem)]"
        >
          <div className="text-right hidden xl:block min-w-0 max-w-[clamp(5rem,18vw,12rem)]">
            <div className="text-[clamp(0.625rem,calc(0.35vw+0.5rem),0.75rem)] font-medium text-white group-hover:text-gray-300 truncate">
              {profile?.nickname || profile?.name || '사용자'}
            </div>
            <div className={`text-[clamp(0.5625rem,calc(0.3vw+0.45rem),0.625rem)] uppercase truncate ${
              theme.accent === 'blue' ? 'text-blue-400' : 'text-emerald-400'
            }`}>
              {profile?.tier || (role === 'gym' ? (language === 'ko' ? '체육관' : 'Gym') : 'Bronze III')}
            </div>
          </div>
          <div className="rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border border-white/10 flex items-center justify-center font-bold text-white shrink-0 w-[clamp(1.5rem,4vw,1.75rem)] h-[clamp(1.5rem,4vw,1.75rem)] text-[clamp(0.5625rem,calc(0.35vw+0.45rem),0.75rem)]">
            {(profile?.nickname || profile?.name || 'U').charAt(0)}
          </div>
        </button>

        {showProfileMenu && (
          <div className="absolute top-full right-0 mt-2 w-[min(12rem,calc(100vw-2rem))] bg-[#0A0A0A] border border-white/10 rounded-lg overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="px-[clamp(0.75rem,3vw,1rem)] py-[clamp(0.5rem,2vw,0.75rem)] border-b border-white/10">
              <div className="text-[clamp(0.8125rem,calc(0.35vw+0.65rem),0.875rem)] font-medium text-white mb-0.5 truncate">
                {profile?.nickname || profile?.name || '사용자'}
              </div>
              <div className="text-[clamp(0.65rem,calc(0.25vw+0.55rem),0.75rem)] text-gray-400 truncate">
                {profile?.email}
              </div>
            </div>
            
            <button
              onClick={() => {
                setActiveTab('mypage');
                setShowProfileMenu(false);
              }}
              className="w-full px-[clamp(0.75rem,3vw,1rem)] py-[clamp(0.5rem,2vw,0.75rem)] text-left text-[clamp(0.75rem,calc(0.3vw+0.6rem),0.875rem)] text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <Icon type="user" className="w-[clamp(0.875rem,2.2vw,1rem)] h-[clamp(0.875rem,2.2vw,1rem)] shrink-0" />
              <span>{t('myPage') || '마이페이지'}</span>
            </button>
            
            <button
              onClick={() => {
                setActiveTab('mypage-edit-profile');
                setShowProfileMenu(false);
              }}
              className="w-full px-[clamp(0.75rem,3vw,1rem)] py-[clamp(0.5rem,2vw,0.75rem)] text-left text-[clamp(0.75rem,calc(0.3vw+0.6rem),0.875rem)] text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <Icon type="edit" className="w-[clamp(0.875rem,2.2vw,1rem)] h-[clamp(0.875rem,2.2vw,1rem)] shrink-0" />
              <span>{t('editProfile') || '프로필 수정'}</span>
            </button>
            
            <button
              onClick={() => {
                setActiveTab('mypage-security');
                setShowProfileMenu(false);
              }}
              className="w-full px-[clamp(0.75rem,3vw,1rem)] py-[clamp(0.5rem,2vw,0.75rem)] text-left text-[clamp(0.75rem,calc(0.3vw+0.6rem),0.875rem)] text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <Icon type="shield" className="w-[clamp(0.875rem,2.2vw,1rem)] h-[clamp(0.875rem,2.2vw,1rem)] shrink-0" />
              <span>{t('accountSecurity') || '계정 보안'}</span>
            </button>

            <div className="border-t border-white/10">
              <button
                onClick={() => {
                  onLogout();
                  setShowProfileMenu(false);
                }}
                className="w-full px-[clamp(0.75rem,3vw,1rem)] py-[clamp(0.5rem,2vw,0.75rem)] text-left text-[clamp(0.75rem,calc(0.3vw+0.6rem),0.875rem)] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2"
              >
                <Icon type="logout" className="w-[clamp(0.875rem,2.2vw,1rem)] h-[clamp(0.875rem,2.2vw,1rem)] shrink-0" />
                <span>{t('logout') || '로그아웃'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </header>

  {showMobileMenu && (
    <>
      <div 
        className="fixed inset-0 bg-black/60 z-40 xl:hidden animate-fade-in"
        onClick={() => setShowMobileMenu(false)}
      />
      
      <div className="fixed top-0 left-0 h-full w-64 sm:w-72 bg-[#0A0A0A] border-r border-white/10 z-50 xl:hidden overflow-y-auto animate-fade-in-up">
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              theme.accent === 'blue' 
                ? 'bg-blue-500/20 text-blue-500' 
                : theme.accent === 'emerald'
                ? 'bg-emerald-500/20 text-emerald-500'
                : 'bg-purple-500/20 text-purple-500'
            }`}>
              {role === 'player_common' ? <Icon type="zap" size={16} fill="currentColor" /> : role === 'player_athlete' ? <Icon type="target" size={16} /> : <Icon type="home" size={16} />}
            </div>
            <span className="font-bold text-white text-sm">Menu</span>
          </div>
          <button 
            onClick={() => setShowMobileMenu(false)}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
          >
            <Icon type="x" size={18} />
          </button>
        </div>

        {isPlayerRole && (
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                placeholder={t('searchPlayers') || '선수 검색...'}
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
              />
              <Icon 
                type="search" 
                size={16} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" 
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  <Icon type="x" size={16} />
                </button>
              )}
            </div>

            {searchQuery.trim().length > 0 && (
              <div className="mt-2 max-h-64 overflow-y-auto bg-white/5 rounded-lg border border-white/10">
                {playerResults.length > 0 ? (
                  <div>
                    <div className="px-3 py-2 border-b border-white/5 bg-white/5">
                      <span className="text-xs text-gray-400">
                        {playerResults.length}명의 선수
                      </span>
                    </div>
                    {playerResults.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => {
                          setActiveTab(`opponent-profile-${player.id}`);
                          setSearchQuery('');
                          setShowSearchResults(false);
                          setShowMobileMenu(false);
                        }}
                        className="w-full px-3 py-2.5 text-left transition-colors hover:bg-white/5 border-b border-white/5 last:border-0"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {(player.display_name || player.name || 'U').charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-sm font-bold text-white truncate">{player.display_name || player.name}</span>
                              <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 whitespace-nowrap">
                                #{player.rank || '-'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                              <span className="text-yellow-400 font-medium">{player.tier}</span>
                              <span>•</span>
                              <span>{player.win_rate || 0}%</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-6 text-center text-gray-500">
                    <Icon type="search" size={24} className="mx-auto mb-1 opacity-50" />
                    <p className="text-xs">검색 결과 없음</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="py-1">
          {menuItems.map(item => (
            <MobileMenuItem 
              key={item.id}
              item={item}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setShowMobileMenu={setShowMobileMenu}
              theme={theme}
              t={t}
            />
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-2.5 border-t border-white/10 bg-[#0A0A0A]">
          <button
            onClick={() => {
              setActiveTab('mypage');
              setShowMobileMenu(false);
            }}
            className="flex items-center gap-2 mb-2 w-full hover:bg-white/5 rounded-lg p-1.5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border border-white/10 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
              {(profile?.nickname || profile?.name || 'U').charAt(0)}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-xs font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis">
                {profile?.nickname || profile?.name || '사용자'}
              </div>
              <div className={`text-[10px] whitespace-nowrap overflow-hidden text-ellipsis ${
                theme.accent === 'blue' ? 'text-blue-400' : 'text-emerald-400'
              }`}>
                {profile?.tier || (role === 'gym' ? (language === 'ko' ? '체육관' : 'Gym') : 'Bronze III')}
              </div>
            </div>
          </button>
          <button 
            onClick={() => {
              onLogout();
              setShowMobileMenu(false);
            }}
            className="w-full px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon type="logout" size={14} />
            <span>{t('logout') || '로그아웃'}</span>
          </button>
        </div>
      </div>
    </>
  )}
</>
  );
};

export { NavMenuItem, Navbar };

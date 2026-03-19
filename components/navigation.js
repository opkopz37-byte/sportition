'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon, THEME_ATHLETE, THEME_COACH, getMenuStructure } from '@/components/ui';

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
  className="relative"
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
>
  <button
    onClick={() => !hasSubmenus && setActiveTab(item.id)}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 relative ${
      activeTab === item.id ? 'text-white bg-white/5' : 'text-gray-500 hover:text-gray-300'
    }`}
  >
    <Icon type={item.icon} size={16} className={activeTab === item.id ? `text-${theme.accent}-400` : ''} />
    {t(item.labelKey)}
    {item.alert && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />}
  </button>

  {hasSubmenus && isOpen && (
    <div className="absolute top-full left-0 mt-2 w-48 bg-[#0A0A0A] border border-white/10 rounded-lg overflow-hidden shadow-2xl animate-fade-in-up z-50">
      {item.submenus.map((submenu) => (
        <button
          key={submenu.id}
          onClick={() => setActiveTab(`${item.id}-${submenu.id}`)}
          className="w-full px-4 py-3 text-left text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-between group"
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
  const theme = role === 'athlete' ? THEME_ATHLETE : THEME_COACH;
  const menuItems = getMenuStructure(t)[role];
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const langRef = useRef(null);
  const searchRef = useRef(null);

  // 글로벌 플레이어 검색 데이터
  const allPlayers = [
{ name: '김태양', tier: 'Diamond II', ranking: 42, winRate: 68.2, style: '아웃복서' },
{ name: '최강민', tier: 'Master', ranking: 1, winRate: 85.3, style: '올라운더' },
{ name: '박철수', tier: 'Master', ranking: 2, winRate: 82.1, style: '펀처' },
{ name: '이준호', tier: 'Diamond I', ranking: 28, winRate: 71.1, style: '인파이터' },
{ name: '박성민', tier: 'Diamond II', ranking: 35, winRate: 68.9, style: '올라운더' },
{ name: '최동훈', tier: 'Diamond I', ranking: 22, winRate: 73.1, style: '펀처' },
{ name: '김재욱', tier: 'Diamond III', ranking: 48, winRate: 65.6, style: '카운터 펀처' },
{ name: '정우성', tier: 'Diamond II', ranking: 40, winRate: 68.3, style: '아웃복서' },
{ name: '한석규', tier: 'Diamond II', ranking: 38, winRate: 70.8, style: '스워머' },
{ name: '김영희', tier: 'Diamond I', ranking: 30, winRate: 72.5, style: '테크니션' },
{ name: '정수진', tier: 'Diamond I', ranking: 25, winRate: 74.2, style: '아웃복서' },
{ name: '이민호', tier: 'Platinum I', ranking: 55, winRate: 64.3, style: '인파이터' },
{ name: '박지성', tier: 'Diamond III', ranking: 50, winRate: 66.8, style: '올라운더' },
{ name: '손흥민', tier: 'Master', ranking: 5, winRate: 80.5, style: '스피드스터' },
  ];

  // 검색 필터링
  const filteredPlayers = searchQuery.trim().length > 0
? allPlayers.filter(player => 
    player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.tier.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.style.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 8)
: [];

  useEffect(() => {
const handleClickOutside = (event) => {
  if (langRef.current && !langRef.current.contains(event.target)) {
    setShowLangMenu(false);
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
  <header className="fixed top-0 inset-x-0 z-50 h-12 xs:h-14 sm:h-16 border-b border-white/5 bg-black/50 backdrop-blur-xl flex items-center justify-between px-2 xs:px-3 sm:px-4 lg:px-6">
    <div className="flex items-center gap-2 sm:gap-6">
      <button 
        onClick={() => setShowMobileMenu(!showMobileMenu)}
        className="md:hidden p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
      >
        <Icon type={showMobileMenu ? "x" : "menu"} size={18} />
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2 font-bold text-white tracking-tight cursor-pointer" onClick={() => setActiveTab(menuItems[0].id)}>
        <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center ${
          theme.accent === 'blue' 
            ? 'bg-blue-500/20 text-blue-500' 
            : 'bg-emerald-500/20 text-emerald-500'
        }`}>
          {role === 'athlete' ? <Icon type="zap" size={14} className="sm:w-4 sm:h-4" fill="currentColor" /> : <Icon type="target" size={14} className="sm:w-4 sm:h-4" />}
        </div>
        <span className="text-xs sm:text-sm">Sportition</span>
      </div>

      <nav className="hidden md:flex items-center gap-1">
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

    <div className="flex items-center gap-1.5 sm:gap-3">
      {role === 'coach' && (
        <button
          onClick={() => window.open('attendance.html', '_blank', 'width=1920,height=1080,toolbar=no,location=no,status=no,menubar=no,scrollbars=no')}
          className="relative p-1.5 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-white/5 group"
          title="출석체크 키오스크 열기"
        >
          <Icon type="clipboard" size={16} className="sm:w-[18px] sm:h-[18px]" />
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-500 rounded-full border border-black animate-pulse" />
        </button>
      )}

      {role === 'athlete' && (
        <div className="relative" ref={searchRef}>
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
              className="w-32 sm:w-48 lg:w-64 pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
            />
            <Icon 
              type="search" 
              size={14} 
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none sm:w-4 sm:h-4" 
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                <Icon type="x" size={14} className="sm:w-4 sm:h-4" />
              </button>
            )}
          </div>

          {showSearchResults && searchQuery.trim().length > 0 && (
            <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-[#0A0A0A] border border-white/10 rounded-lg overflow-hidden shadow-2xl animate-fade-in-up max-h-96 overflow-y-auto">
              {filteredPlayers.length > 0 ? (
                <div>
                  <div className="px-3 py-2 border-b border-white/5 bg-white/5">
                    <span className="text-xs text-gray-400">
                      {filteredPlayers.length}명의 선수를 찾았습니다
                    </span>
                  </div>
                  {filteredPlayers.map((player, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setActiveTab(`opponent-profile-${player.name}`);
                        setSearchQuery('');
                        setShowSearchResults(false);
                      }}
                      className="w-full px-3 py-3 text-left transition-colors hover:bg-white/5 border-b border-white/5 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {player.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-white truncate">{player.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 whitespace-nowrap">
                                #{player.ranking}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className="text-yellow-400 font-medium">{player.tier}</span>
                              <span>•</span>
                              <span>승률 {player.winRate}%</span>
                              <span>•</span>
                              <span className="truncate">{player.style}</span>
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
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-lg hover:bg-white/5"
        >
          <Icon type="globe" size={14} className="sm:w-4 sm:h-4" />
          <span className="text-xs sm:text-sm font-medium hidden xs:inline">{language === 'ko' ? 'KR' : 'EN'}</span>
        </button>
        
        {showLangMenu && (
          <div className="absolute top-full right-0 mt-1.5 w-28 sm:w-32 bg-[#0A0A0A] border border-white/10 rounded-lg overflow-hidden shadow-2xl animate-fade-in-up">
            <button
              onClick={() => { setLanguage('ko'); setShowLangMenu(false); }}
              className={`w-full px-3 py-2 text-left text-xs sm:text-sm transition-colors flex items-center justify-between ${
                language === 'ko' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>한국어</span>
              {language === 'ko' && <span className="text-blue-400">✓</span>}
            </button>
            <button
              onClick={() => { setLanguage('en'); setShowLangMenu(false); }}
              className={`w-full px-3 py-2 text-left text-xs sm:text-sm transition-colors flex items-center justify-between ${
                language === 'en' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>English</span>
              {language === 'en' && <span className="text-blue-400">✓</span>}
            </button>
          </div>
        )}
      </div>

      <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
      <button onClick={onLogout} className="flex items-center gap-1.5 sm:gap-2 group">
        <div className="text-right hidden lg:block">
          <div className="text-[10px] sm:text-xs font-medium text-white group-hover:text-gray-300 whitespace-nowrap">
            {role === 'athlete' ? '김플레이어' : '강코치'}
          </div>
          <div className={`text-[9px] sm:text-[10px] uppercase whitespace-nowrap ${
            theme.accent === 'blue' ? 'text-blue-400' : 'text-emerald-400'
          }`}>
            {role === 'athlete' ? 'Diamond II' : language === 'ko' ? '헤드코치' : 'Head Coach'}
          </div>
        </div>
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center text-[10px] sm:text-xs">
          <Icon type="user" size={14} className="sm:w-4 sm:h-4" />
        </div>
      </button>
    </div>
  </header>

  {showMobileMenu && (
    <>
      <div 
        className="fixed inset-0 bg-black/60 z-40 md:hidden animate-fade-in"
        onClick={() => setShowMobileMenu(false)}
      />
      
      <div className="fixed top-0 left-0 h-full w-64 sm:w-72 bg-[#0A0A0A] border-r border-white/10 z-50 md:hidden overflow-y-auto animate-fade-in-up">
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              theme.accent === 'blue' 
                ? 'bg-blue-500/20 text-blue-500' 
                : 'bg-emerald-500/20 text-emerald-500'
            }`}>
              {role === 'athlete' ? <Icon type="zap" size={16} fill="currentColor" /> : <Icon type="target" size={16} />}
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

        {role === 'athlete' && (
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
                {filteredPlayers.length > 0 ? (
                  <div>
                    <div className="px-3 py-2 border-b border-white/5 bg-white/5">
                      <span className="text-xs text-gray-400">
                        {filteredPlayers.length}명의 선수
                      </span>
                    </div>
                    {filteredPlayers.map((player, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setActiveTab(`opponent-profile-${player.name}`);
                          setSearchQuery('');
                          setShowSearchResults(false);
                          setShowMobileMenu(false);
                        }}
                        className="w-full px-3 py-2.5 text-left transition-colors hover:bg-white/5 border-b border-white/5 last:border-0"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {player.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-sm font-bold text-white truncate">{player.name}</span>
                              <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 whitespace-nowrap">
                                #{player.ranking}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                              <span className="text-yellow-400 font-medium">{player.tier}</span>
                              <span>•</span>
                              <span>{player.winRate}%</span>
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
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center flex-shrink-0">
              <Icon type="user" size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis">
                {role === 'athlete' ? '김플레이어' : '강코치'}
              </div>
              <div className={`text-[10px] whitespace-nowrap overflow-hidden text-ellipsis ${
                theme.accent === 'blue' ? 'text-blue-400' : 'text-emerald-400'
              }`}>
                {role === 'athlete' ? 'Diamond II' : language === 'ko' ? '헤드코치' : 'Head Coach'}
              </div>
            </div>
          </div>
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

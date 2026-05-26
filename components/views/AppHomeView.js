'use client';

import { useState, useEffect, useCallback } from 'react';
import { searchPublicPlayerProfiles } from '@/lib/supabase';
import AttendanceCheckModal from '@/components/AttendanceCheckModal';

/**
 * 로그인 후 홈 — 다크 톤. 회원: 랭킹 바 + 검색 + 마이페이지·스킬. 체육관·관리자: 랭킹/티어 없이 검색 + 스파링·승인·회원.
 */
export default function AppHomeView({ setActiveTab, t = (k) => k, role = 'player_common' }) {
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [tick, setTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);

  const isGym = role === 'gym' || role === 'admin';

  useEffect(() => {
    if (isGym) {
      setLeaderboardRows([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { getMatchLeaderboard } = await import('@/lib/supabase');
        const { data } = await getMatchLeaderboard(120);
        if (cancelled || !data?.length) {
          setLeaderboardRows([]);
          return;
        }
        setLeaderboardRows(data);
      } catch {
        if (!cancelled) setLeaderboardRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGym]);

  const tickerLen = Math.min(12, leaderboardRows.length);

  useEffect(() => {
    if (tickerLen <= 1) return undefined;
    const id = setInterval(() => {
      setTick((x) => (x + 1) % tickerLen);
    }, 4500);
    return () => clearInterval(id);
  }, [tickerLen]);

  const loadSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const { data } = await searchPublicPlayerProfiles(searchQuery);
    setSearchResults(data || []);
    setShowResults(true);
  }, [searchQuery]);

  return (
    <div className="animate-fade-in-up w-full max-w-6xl mx-auto px-4 sm:px-6 pb-16 flex flex-col min-h-[calc(100dvh-6rem)]">
      <AttendanceCheckModal
        open={attendanceModalOpen}
        onClose={() => setAttendanceModalOpen(false)}
        onGoToSkills={() => setActiveTab?.('skills')}
      />
      {/* 체육관·관리자 계정은 랭킹/티어 미표시 — 본인 정보 빼고 순위 슬라이드만 표시 */}
      {!isGym && leaderboardRows.length > 0 && (
        <div className="w-full rounded-2xl border border-white/[0.1] bg-[#121212] overflow-hidden mb-8 sm:mb-10 shadow-sm">
          <div className="bg-black/30 px-3 sm:px-4 overflow-hidden h-14 flex items-center">
            <div className="relative w-full h-12 overflow-hidden">
              <div
                className="transition-transform duration-700 ease-in-out"
                style={{ transform: `translateY(-${tick * 3}rem)` }}
              >
                {leaderboardRows.slice(0, 12).map((row, i) => (
                  <button
                    key={row.id || i}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (row.id) setActiveTab(`opponent-profile-${row.id}`);
                    }}
                    style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                    className="h-12 flex items-center justify-center gap-2 sm:gap-3 w-full select-none active:bg-white/5 cursor-pointer"
                  >
                    <span className="text-amber-400 font-extrabold text-base sm:text-lg tabular-nums">#{row.rank_label || i + 1}</span>
                    <span className="text-white font-bold text-base sm:text-lg truncate">{row.display_name || row.name}</span>
                    <span className="text-violet-300 font-semibold text-sm sm:text-base">{row.tier}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center text-center w-full">
        {/* 로고 워드마크 — 흰색 굵은 SPORTITION (이미지 동일 스타일) */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-8 sm:mb-10 tracking-tight text-white"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', letterSpacing: '0.04em' }}
        >
          SPORTITION
        </h1>

        <div className="w-full max-w-6xl relative">
          <div className="flex w-full min-h-[3.25rem] items-center rounded-2xl border border-white/[0.1] bg-[#121212] pl-4 sm:pl-5 pr-1.5 py-1 shadow-inner focus-within:border-blue-500/35 focus-within:ring-1 focus-within:ring-blue-500/30">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadSearch();
              }}
              placeholder={t('recordSearchPlaceholder')}
              className="flex-1 min-w-0 bg-transparent border-0 py-3 sm:py-3.5 pr-3 text-sm sm:text-base text-white placeholder:text-gray-500 focus:outline-none focus:ring-0"
            />
            <button
              type="button"
              onClick={loadSearch}
              className="shrink-0 rounded-2xl border border-white/[0.12] bg-white/[0.08] hover:bg-white/[0.12] text-white font-medium px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base transition-colors"
            >
              {t('search')}
            </button>
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-white/[0.08] bg-[#121212] shadow-xl z-20 max-h-56 overflow-y-auto text-left">
              {searchResults.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(`opponent-profile-${player.id}`);
                    setShowResults(false);
                    setSearchQuery('');
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-white/[0.06] border-b border-white/[0.06] last:border-0"
                >
                  {player.display_name || player.name}
                </button>
              ))}
            </div>
          )}
          {showResults && searchQuery.trim() && searchResults.length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-white/[0.08] bg-[#121212] shadow-xl z-20 px-4 py-8 text-center">
              <svg className="mx-auto mb-2 w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <p className="text-gray-400 text-sm font-medium mb-1">&ldquo;{searchQuery}&rdquo; 검색 결과가 없어요</p>
              <p className="text-gray-600 text-xs">
                {t('noSearchResults') || '이름을 정확히 입력했는지 확인해보세요'}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('ranking')}
                className="mt-4 text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-gray-400 hover:text-gray-200 transition-colors border border-white/10"
              >
                전체 랭킹 보기 →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 역할별 퀵 액션 */}
      <div className="mt-10 sm:mt-14 flex flex-col gap-3 w-full max-w-6xl mx-auto">
        {!isGym ? (
          <>
            {/* 주요 액션 — 에메랄드 강조 */}
            <button
              type="button"
              onClick={() => setAttendanceModalOpen(true)}
              className="w-full py-4 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-base sm:text-lg transition-colors shadow-[0_0_20px_rgba(16,185,129,0.08)]"
            >
              {t('attendance')}
            </button>
            {/* 보조 액션 — 2열 그리드 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('mypage')}
                className="py-4 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 font-semibold text-base sm:text-lg transition-colors"
              >
                {t('myPage')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('skills')}
                className="py-4 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 font-semibold text-base sm:text-lg transition-colors"
              >
                {t('skillsNav')}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 체육관 주요 액션 — 스파링 강조 */}
            <button
              type="button"
              onClick={() => setActiveTab('match')}
              className="w-full py-4 rounded-xl border border-purple-500/40 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-bold text-base sm:text-lg transition-colors shadow-[0_0_20px_rgba(168,85,247,0.08)]"
            >
              {t('homeSparring')}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('approval')}
                className="py-4 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 font-semibold text-base sm:text-lg transition-colors"
              >
                {t('homeSkillApproval')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('players')}
                className="py-4 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 font-semibold text-base sm:text-lg transition-colors"
              >
                회원 관리/스킬 관리
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

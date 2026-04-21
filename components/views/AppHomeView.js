'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { searchPublicPlayerProfiles } from '@/lib/supabase';

/**
 * 로그인 후 홈 — 다크 톤. 회원: 랭킹 바 + 검색 + 마이페이지·스킬. 체육관·관리자: 랭킹/티어 없이 검색 + 스파링·승인·회원.
 */
export default function AppHomeView({ setActiveTab, t = (k) => k, role = 'player_common' }) {
  const { user, profile } = useAuth();
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [myRankLine, setMyRankLine] = useState(null);
  const [tick, setTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const isGym = role === 'gym' || role === 'admin';

  useEffect(() => {
    if (isGym) {
      setLeaderboardRows([]);
      setMyRankLine(null);
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
        if (user?.id) {
          const idx = data.findIndex((p) => p.id === user.id);
          const row = idx >= 0 ? data[idx] : null;
          setMyRankLine(
            row
              ? {
                  rank: row.rank_label || String(idx + 1),
                  name: row.display_name || profile?.nickname || profile?.name || '—',
                  tier: row.tier || profile?.tier || '—',
                  rankNum: idx + 1,
                }
              : {
                  rank: '—',
                  name: profile?.nickname || profile?.name || profile?.gym_name || '—',
                  tier: profile?.tier || '—',
                  rankNum: null,
                }
          );
        } else {
          setMyRankLine(null);
        }
      } catch {
        if (!cancelled) setLeaderboardRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGym, user?.id, profile?.nickname, profile?.name, profile?.tier, profile?.gym_name]);

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

  const displayName = profile?.nickname || profile?.name || profile?.gym_name || user?.email?.split('@')[0] || '—';
  const displayTier = myRankLine?.tier || profile?.tier || '—';
  const displayRank = myRankLine?.rank ?? '—';

  return (
    <div className="animate-fade-in-up w-full max-w-6xl mx-auto px-4 sm:px-6 pb-16 flex flex-col min-h-[calc(100dvh-6rem)]">
      {/* 체육관·관리자 계정은 랭킹/티어 미표시 */}
      {!isGym && (
        <div className="w-full rounded-2xl border border-white/[0.1] bg-[#121212] overflow-hidden mb-8 sm:mb-10 shadow-sm">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base">
            <span className="font-bold text-blue-400 shrink-0 tracking-wide text-xs sm:text-sm">
              {t('rankLabelShort')}
            </span>
            <div className="flex-1 min-w-0 flex items-center justify-center gap-2 sm:gap-3 text-white font-medium truncate px-1">
              <span className="truncate">{displayName}</span>
              <span className="text-gray-500 hidden xs:inline">·</span>
              <span className="text-violet-300 font-semibold shrink-0">{displayTier}</span>
            </div>
            <div className="flex items-center gap-0.5 text-blue-300 font-bold tabular-nums shrink-0">
              <span>{myRankLine?.rankNum != null ? `${myRankLine.rankNum}` : displayRank}</span>
              <span className="text-emerald-400 text-xs" aria-hidden>
                ▲
              </span>
            </div>
          </div>
          {leaderboardRows.length > 0 && (
            <div className="border-t border-white/[0.06] bg-black/30 px-3 py-0 text-xs sm:text-sm text-gray-400 overflow-hidden h-9 flex items-center">
              <div className="relative w-full h-7 overflow-hidden">
                <div
                  className="transition-transform duration-700 ease-in-out"
                  style={{
                    transform: `translateY(-${tick * 1.75}rem)`,
                  }}
                >
                  {leaderboardRows.slice(0, 12).map((row, i) => (
                    <div
                      key={row.id || i}
                      className="h-7 flex items-center justify-center gap-2 w-full"
                    >
                      <span className="text-amber-400/90 font-bold">#{row.rank_label || i + 1}</span>
                      <span className="text-gray-200 truncate">{row.display_name || row.name}</span>
                      <span className="text-gray-500">{row.tier}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center text-center w-full">
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-bold mb-8 sm:mb-10 tracking-tight bg-gradient-to-r from-blue-400 via-violet-400 to-purple-500 bg-clip-text text-transparent"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          Sportition
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
            <p className="absolute left-0 right-0 top-full mt-2 text-sm text-gray-500 text-center">
              {t('noSearchResults')}
            </p>
          )}
        </div>
      </div>

      {/* 역할별 퀵 액션 */}
      <div className="mt-10 sm:mt-14 flex flex-col gap-3 w-full max-w-6xl mx-auto">
        {!isGym ? (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('mypage')}
              className="w-full py-4 rounded-xl border border-white/[0.12] bg-[#121212] hover:bg-white/[0.06] text-white font-bold text-base sm:text-lg transition-colors"
            >
              {t('myPage')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('skills')}
              className="w-full py-4 rounded-xl border border-white/[0.12] bg-[#121212] hover:bg-white/[0.06] text-white font-bold text-base sm:text-lg transition-colors"
            >
              {t('skillsNav')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('match')}
              className="w-full py-4 rounded-xl border border-white/[0.12] bg-[#121212] hover:bg-white/[0.06] text-white font-bold text-base sm:text-lg transition-colors"
            >
              {t('homeSparring')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('approval')}
              className="w-full py-4 rounded-xl border border-white/[0.12] bg-[#121212] hover:bg-white/[0.06] text-white font-bold text-base sm:text-lg transition-colors"
            >
              {t('homeSkillApproval')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('players')}
              className="w-full py-4 rounded-xl border border-white/[0.12] bg-[#121212] hover:bg-white/[0.06] text-white font-bold text-base sm:text-lg transition-colors"
            >
              {t('homeMemberList')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

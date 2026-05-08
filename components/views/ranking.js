'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import ProfileAvatarImg from '@/components/ProfileAvatarImg';
import { useAuth } from '@/lib/AuthContext';
import { getMatchLeaderboard, getUserMatches } from '@/lib/supabase';
import { tierFamilyFromLabel, computeMatchPoints, getTierColor } from '@/lib/tierLadder';

const ITEMS_PER_PAGE = 50;
const RECENT_MATCHES_COLLAPSED = 1;
const RECENT_MATCHES_EXPANDED = 5;
/** 상위 티어 우선 (필터 탭 순서) */
const TIERS = ['All', 'Challenger', 'Grandmaster', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];

const getRoleBadgeClass = (role) => {
  if (role === 'player_common') return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
  if (role === 'player_athlete') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  if (role === 'gym') return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
  return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
};

const matchesNameQuery = (player, qLower) => {
  if (!qLower) return false;
  const name = String(player.display_name || '').toLowerCase();
  const legal = String(player.name || '').toLowerCase();
  return name.includes(qLower) || legal.includes(qLower);
};

const TierBoardView = ({
  t = (key) => key,
  setActiveTab,
  publicMode = false,
  onPlayerClick,
  initialSearchQuery = '',
}) => {
  const { profile, user } = useAuth();
  const isGymAccount = profile?.role === 'gym' || profile?.role === 'admin';
  const [selectedTier, setSelectedTier] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [players, setPlayers] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [recentMatchesExpanded, setRecentMatchesExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playerSearch, setPlayerSearch] = useState(() => (initialSearchQuery ? String(initialSearchQuery) : ''));
  const jumpDoneRef = useRef(false);
  const scrollDoneRef = useRef(false);

  useEffect(() => {
    if (initialSearchQuery == null || initialSearchQuery === '') return;
    setPlayerSearch(String(initialSearchQuery));
    setSelectedTier('All');
    setCurrentPage(1);
    jumpDoneRef.current = false;
    scrollDoneRef.current = false;
  }, [initialSearchQuery]);

  const goPlayer = (playerId) => {
    if (onPlayerClick) onPlayerClick(playerId);
    else if (setActiveTab) setActiveTab(`opponent-profile-${playerId}`);
  };

  useEffect(() => {
    const loadPlayers = async () => {
      setLoading(true);
      if (publicMode) {
        try {
          const res = await fetch('/api/tier-leaderboard', { credentials: 'same-origin' });
          if (res.ok) {
            const json = await res.json();
            setPlayers(json.data || []);
          } else {
            setPlayers([]);
          }
        } catch {
          setPlayers([]);
        }
      } else {
        const { data } = await getMatchLeaderboard();
        setPlayers(data || []);
      }
      setLoading(false);
    };

    loadPlayers();
  }, [publicMode]);

  useEffect(() => {
    const loadRecentMatches = async () => {
      if (publicMode || !user?.id || isGymAccount) {
        setRecentMatches([]);
        return;
      }
      const { data } = await getUserMatches(user.id, 20);
      const normalized = (data || []).map((match) => {
        const oppNickname = match.opponent?.nickname || null;
        const oppRealName = match.opponent?.name || null;
        const display = match.opponent_name || oppNickname || oppRealName || '상대 미상';
        return {
          id: match.id,
          opponent: display,
          opponentRealName: oppRealName && oppRealName !== display ? oppRealName : null,
          score: match.score || '-',
          method: (match.method || 'decision').toUpperCase(),
          result: match.result || 'draw',
          playedAt: match.played_at ? new Date(match.played_at).toISOString().split('T')[0] : '-',
          playedAtSort: match.played_at ? new Date(match.played_at).getTime() : 0,
        };
      });
      normalized.sort((a, b) => b.playedAtSort - a.playedAtSort);
      setRecentMatches(normalized);
    };

    loadRecentMatches();
  }, [user?.id, publicMode, isGymAccount]);

  useEffect(() => {
    setRecentMatchesExpanded(false);
  }, [user?.id]);

  const visibleRecentMatches = useMemo(() => {
    if (recentMatches.length === 0) return [];
    const limit = recentMatchesExpanded ? RECENT_MATCHES_EXPANDED : RECENT_MATCHES_COLLAPSED;
    return recentMatches.slice(0, limit);
  }, [recentMatches, recentMatchesExpanded]);

  const canExpandRecentMatches = recentMatches.length > RECENT_MATCHES_COLLAPSED;

  const filteredPlayers = useMemo(() => {
    let list =
      selectedTier === 'All'
        ? players
        : players.filter((player) => tierFamilyFromLabel(player.tier) === selectedTier);
    const q = playerSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const name = String(p.display_name || '').toLowerCase();
      const legal = String(p.name || '').toLowerCase();
      const gym = String(p.gym_name || '').toLowerCase();
      const style = String(p.boxing_style || '').toLowerCase();
      return name.includes(q) || legal.includes(q) || gym.includes(q) || style.includes(q);
    });
  }, [players, selectedTier, playerSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / ITEMS_PER_PAGE));
  const paginatedPlayers = filteredPlayers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    if (loading || jumpDoneRef.current || !initialSearchQuery?.trim()) return;
    if (filteredPlayers.length === 0) {
      jumpDoneRef.current = true;
      return;
    }
    const q = initialSearchQuery.trim().toLowerCase();
    const idx = filteredPlayers.findIndex((p) => matchesNameQuery(p, q));
    if (idx >= 0) {
      setCurrentPage(Math.floor(idx / ITEMS_PER_PAGE) + 1);
    }
    jumpDoneRef.current = true;
  }, [loading, filteredPlayers, initialSearchQuery]);

  useEffect(() => {
    if (loading || scrollDoneRef.current || !initialSearchQuery?.trim()) return;
    const q = initialSearchQuery.trim().toLowerCase();
    const hasTarget = paginatedPlayers.some((p) => matchesNameQuery(p, q));
    if (!hasTarget) return;
    const t = setTimeout(() => {
      const el = document.getElementById('tier-board-search-target');
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        scrollDoneRef.current = true;
      }
    }, 100);
    return () => clearTimeout(t);
  }, [loading, currentPage, paginatedPlayers, initialSearchQuery]);

  const searchQ = playerSearch.trim().toLowerCase();
  let firstHighlightAssigned = false;

  return (
    <div className="animate-fade-in-up w-full">
      <PageHeader
        title={publicMode ? t('publicTierBoardTitle') : t('tierBoard')}
        onBack={!publicMode && setActiveTab ? () => setActiveTab('home') : undefined}
      />

      {/* 검색 바 */}
      <div className="mb-3 sm:mb-4 relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          id="tier-board-player-search"
          type="search"
          value={playerSearch}
          onChange={(e) => {
            setPlayerSearch(e.target.value);
            setCurrentPage(1);
          }}
          placeholder={t('tierBoardSearchPlaceholder')}
          autoComplete="off"
          className="w-full pl-12 pr-4 py-3.5 bg-white/[0.04] border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-white/25 focus:bg-white/[0.06] transition-all text-base"
        />
      </div>

      {/* 티어 필터 칩 */}
      <div className="flex gap-2 mb-5 sm:mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {TIERS.map((tier) => (
          <button
            key={tier}
            onClick={() => {
              setSelectedTier(tier);
              setCurrentPage(1);
            }}
            className={`px-4 py-2.5 rounded-full font-semibold transition-all text-sm sm:text-base whitespace-nowrap flex-shrink-0 ${
              selectedTier === tier
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tier === 'All' ? '전체 티어' : tier}
          </button>
        ))}
      </div>

      {!publicMode && !isGymAccount && (
      <SpotlightCard className="p-3 xs:p-4 sm:p-5 mb-3 xs:mb-4 sm:mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 flex-1 min-w-0">
            <ProfileAvatarImg
              avatarUrl={profile?.avatar_url}
              name={profile?.nickname || profile?.name}
              className="w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 rounded-lg text-base xs:text-lg sm:text-xl"
              gradientClassName="bg-gradient-to-br from-blue-500 to-purple-500"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 mb-0.5 xs:mb-1">
                <span className={`px-1.5 py-0.5 xs:px-2 rounded-full text-[8px] xs:text-[9px] sm:text-[10px] font-bold whitespace-nowrap ${getRoleBadgeClass(profile?.role)}`}>
                  {profile?.role ? t(profile.role) : t('player_common')}
                </span>
                <div className="text-sm xs:text-base sm:text-lg font-bold text-white truncate">
                  {profile?.nickname || profile?.name || '사용자'}
                </div>
              </div>
              {(() => {
                const tc = getTierColor(profile?.tier || 'Bronze III');
                return (
                  <div
                    className={`px-1.5 xs:px-2 sm:px-2.5 py-0.5 rounded-full bg-gradient-to-r ${tc.bg} border ${tc.border} ${tc.text} text-[9px] xs:text-[10px] sm:text-xs font-bold inline-flex ${tc.glowClass || ''}`}
                    style={tc.shadow ? { boxShadow: tc.shadow } : undefined}
                  >
                    {profile?.tier || 'Bronze III'}
                  </div>
                );
              })()}
            </div>
          </div>
            <div className="text-right flex-shrink-0">
              <div className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                {profile?.match_points ?? computeMatchPoints(profile?.wins, profile?.draws, profile?.losses)}
              </div>
              <div className="text-[9px] xs:text-[10px] sm:text-xs text-gray-500">{t('victoryPoints')}</div>
            </div>
          </div>
      </SpotlightCard>
      )}

      {!publicMode && !isGymAccount && (
      <SpotlightCard className="p-3 xs:p-4 sm:p-5 mb-3 xs:mb-4 sm:mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h3 className="text-sm sm:text-base font-bold text-white">전적 분석</h3>
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">
              최근 {recentMatches.length}경기
            </span>
            {user?.id && (
              <button
                type="button"
                onClick={() => goPlayer(user.id)}
                className="text-[10px] sm:text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white whitespace-nowrap"
              >
                전체보기
              </button>
            )}
            {canExpandRecentMatches && (
              <button
                type="button"
                onClick={() => setRecentMatchesExpanded((prev) => !prev)}
                className="text-[10px] sm:text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white whitespace-nowrap"
              >
                {recentMatchesExpanded ? '접기' : '펼치기'}
              </button>
            )}
          </div>
        </div>
        {recentMatches.length === 0 ? (
          <div className="text-xs sm:text-sm text-gray-500 py-4 text-center">기록된 경기 전적이 없습니다.</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {visibleRecentMatches.map((m) => (
              <div key={m.id} className={`p-2.5 sm:p-3 rounded-lg border-l-4 ${
                m.result === 'win' ? 'bg-blue-900/50 border-l-blue-400 border border-blue-500/40' :
                m.result === 'loss' ? 'bg-red-900/50 border-l-red-400 border border-red-500/40' :
                'bg-zinc-900/55 border-l-gray-500 border border-zinc-600/40'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs sm:text-sm font-bold text-white truncate">
                    vs {m.opponent}
                    {m.opponentRealName ? (
                      <span className="text-[10px] sm:text-xs text-gray-400 font-medium ml-1">({m.opponentRealName})</span>
                    ) : null}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-400">{m.playedAt}</div>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] sm:text-xs">
                  <span className={m.result === 'win' ? 'text-blue-400 font-bold' : m.result === 'loss' ? 'text-red-400 font-bold' : 'text-gray-300 font-bold'}>
                    점수 {m.score}
                  </span>
                  <span className="text-gray-300">{m.method}</span>
                  <span className={m.result === 'win' ? 'text-blue-400' : m.result === 'loss' ? 'text-red-400' : 'text-gray-300'}>
                    {m.result === 'win' ? '승' : m.result === 'loss' ? '패' : '무'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SpotlightCard>
      )}

      {/* 컬럼 헤더 */}
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_5.5rem_7rem] sm:grid-cols-[2rem_minmax(0,1fr)_7rem_12rem] gap-2 sm:gap-4 px-2 sm:px-3 pb-2.5 sm:pb-3 mb-1 border-b border-white/10 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <div>#</div>
        <div>선수</div>
        <div>티어</div>
        <div className="text-center">승률</div>
      </div>

      {/* 랭킹 리스트 */}
      <div className="divide-y divide-white/5">
        {loading && (
          <div className="py-16 text-center text-gray-400 text-base">랭킹을 불러오는 중입니다...</div>
        )}

        {!loading && paginatedPlayers.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-base">표시할 선수가 없습니다.</div>
        )}

        {paginatedPlayers.map((player) => {
          const rank = player.rank_label || player.match_rank || '-';
          const isHighlight = Boolean(searchQ && matchesNameQuery(player, searchQ));
          const isFirstTarget = isHighlight && !firstHighlightAssigned;
          if (isFirstTarget) firstHighlightAssigned = true;
          const wins = Number(player.wins) || 0;
          const losses = Number(player.losses) || 0;
          const total = wins + losses;
          const winPct = total > 0 ? (wins / total) * 100 : 50;
          const displayWinRate = Number(player.win_rate) || (total > 0 ? Math.round((wins / total) * 100) : 0);

          return (
            <button
              key={player.id}
              type="button"
              id={isFirstTarget ? 'tier-board-search-target' : undefined}
              onClick={() => goPlayer(player.id)}
              className={`w-full py-3 sm:py-3.5 px-2 sm:px-3 hover:bg-white/[0.04] transition-all text-left group ${isHighlight ? 'ring-2 ring-cyan-400/45 rounded-lg' : ''}`}
            >
              <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_5.5rem_7rem] sm:grid-cols-[2rem_minmax(0,1fr)_7rem_12rem] gap-2 sm:gap-4 items-center">
                {/* 순위 */}
                <div className="text-sm sm:text-lg font-bold text-gray-500 tabular-nums">{rank}</div>

                {/* 선수 */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <ProfileAvatarImg
                    avatarUrl={player.avatar_url}
                    name={player.display_name}
                    className="w-8 h-8 sm:w-11 sm:h-11 rounded-full text-xs sm:text-base"
                    gradientClassName="bg-gradient-to-br from-blue-500/80 to-purple-600/80"
                  />
                  <h3 className="text-lg sm:text-xl font-bold text-white truncate leading-tight">
                    {player.display_name}
                  </h3>
                </div>

                {/* 티어 */}
                {(() => {
                  const tc = getTierColor(player.tier || '');
                  return (
                    <div
                      className={`inline-flex px-2 py-0.5 rounded-md bg-gradient-to-r ${tc.bg} border ${tc.border} text-sm sm:text-base font-bold truncate ${tc.text} ${tc.glowClass || ''}`}
                      style={tc.shadow ? { boxShadow: tc.shadow } : undefined}
                    >
                      {player.tier || 'Unranked'}
                    </div>
                  );
                })()}

                {/* 승률 바 + % */}
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <div className="relative flex h-5 sm:h-6 flex-1 min-w-0 rounded-md overflow-hidden bg-white/5">
                    <div
                      className="flex items-center justify-start pl-1 sm:pl-1.5 bg-blue-500/70 text-[9px] sm:text-[11px] font-bold text-white tabular-nums"
                      style={{ width: `${winPct}%` }}
                    >
                      {wins > 0 && <span className="whitespace-nowrap">{wins}승</span>}
                    </div>
                    <div
                      className="flex items-center justify-end pr-1 sm:pr-1.5 bg-red-500/70 text-[9px] sm:text-[11px] font-bold text-white tabular-nums"
                      style={{ width: `${100 - winPct}%` }}
                    >
                      {losses > 0 && <span className="whitespace-nowrap">{losses}패</span>}
                    </div>
                  </div>
                  <span className="text-[11px] sm:text-sm font-bold text-white tabular-nums flex-shrink-0 w-[2.25rem] sm:w-[2.75rem] text-right">
                    {displayWinRate}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 pt-5 border-t border-white/10">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
            >
              ←
            </button>

            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 rounded-lg font-bold transition-all ${currentPage === pageNum ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
            >
              →
            </button>
          </div>
          <div className="text-center mt-3 text-sm text-gray-500">
            #{(currentPage - 1) * ITEMS_PER_PAGE + 1} ~ #{Math.min(currentPage * ITEMS_PER_PAGE, filteredPlayers.length)} / 총 {filteredPlayers.length}명
          </div>
        </div>
      )}
    </div>
  );
};

export { TierBoardView };

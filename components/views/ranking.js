'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { getMatchLeaderboard, getUserMatches } from '@/lib/supabase';
import { tierFamilyFromLabel, computeMatchPoints } from '@/lib/tierLadder';

const ITEMS_PER_PAGE = 50;
const RECENT_MATCHES_COLLAPSED = 1;
const RECENT_MATCHES_EXPANDED = 5;
/** 상위 티어 우선 (필터 탭 순서) */
const TIERS = ['All', 'Challenger', 'Grandmaster', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];

const getTierColor = (tier = '') => {
  if (tier.includes('Challenger')) return { bg: 'from-red-600/25 to-orange-500/20', text: 'text-red-300', border: 'border-red-500/50' };
  if (tier.includes('Grandmaster')) return { bg: 'from-amber-500/25 to-rose-500/20', text: 'text-amber-300', border: 'border-amber-400/50' };
  if (tier.includes('Master')) return { bg: 'from-purple-500/20 to-pink-500/20', text: 'text-purple-400', border: 'border-purple-500/50' };
  if (tier.includes('Diamond')) return { bg: 'from-blue-500/20 to-cyan-500/20', text: 'text-blue-400', border: 'border-blue-500/50' };
  if (tier.includes('Platinum')) return { bg: 'from-emerald-500/20 to-green-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50' };
  if (tier.includes('Gold')) return { bg: 'from-yellow-500/20 to-amber-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' };
  if (tier.includes('Silver')) return { bg: 'from-gray-400/20 to-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' };
  return { bg: 'from-orange-600/20 to-orange-700/20', text: 'text-orange-400', border: 'border-orange-600/50' };
};

const getRoleBadgeClass = (role) => {
  if (role === 'player_common') return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
  if (role === 'player_athlete') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  if (role === 'gym') return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
  return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
};

const TierBoardView = ({ t = (key) => key, setActiveTab }) => {
  const { profile, user } = useAuth();
  const [selectedTier, setSelectedTier] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [players, setPlayers] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [recentMatchesExpanded, setRecentMatchesExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlayers = async () => {
      setLoading(true);
      const { data } = await getMatchLeaderboard();
      setPlayers(data || []);
      setLoading(false);
    };

    loadPlayers();
  }, []);

  useEffect(() => {
    const loadRecentMatches = async () => {
      if (!user?.id) {
        setRecentMatches([]);
        return;
      }
      const { data } = await getUserMatches(user.id, 20);
      const normalized = (data || []).map((match) => ({
        id: match.id,
        opponent: match.opponent_name || match.opponent?.nickname || match.opponent?.name || '상대 미상',
        score: match.score || '-',
        method: (match.method || 'decision').toUpperCase(),
        result: match.result || 'draw',
        playedAt: match.played_at ? new Date(match.played_at).toISOString().split('T')[0] : '-',
        playedAtSort: match.played_at ? new Date(match.played_at).getTime() : 0,
      }));
      normalized.sort((a, b) => b.playedAtSort - a.playedAtSort);
      setRecentMatches(normalized);
    };

    loadRecentMatches();
  }, [user?.id]);

  useEffect(() => {
    setRecentMatchesExpanded(false);
  }, [user?.id]);

  const visibleRecentMatches = useMemo(() => {
    if (recentMatches.length === 0) return [];
    const limit = recentMatchesExpanded ? RECENT_MATCHES_EXPANDED : RECENT_MATCHES_COLLAPSED;
    return recentMatches.slice(0, limit);
  }, [recentMatches, recentMatchesExpanded]);

  const canExpandRecentMatches = recentMatches.length > RECENT_MATCHES_COLLAPSED;

  const filteredPlayers = selectedTier === 'All'
    ? players
    : players.filter((player) => tierFamilyFromLabel(player.tier) === selectedTier);

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / ITEMS_PER_PAGE));
  const paginatedPlayers = filteredPlayers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={t('tierBoard')}
        description={`${t('tierBoardSubtitleRule')} · ${(t('tierBoardTotalPlayers') || '').replace('{n}', players.length.toLocaleString())}`}
      />

      <div className="mb-4 sm:mb-5 flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2">
        {TIERS.map((tier) => (
          <button
            key={tier}
            onClick={() => {
              setSelectedTier(tier);
              setCurrentPage(1);
            }}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-[11px] sm:text-xs whitespace-nowrap transition-all flex-shrink-0 ${
              selectedTier === tier
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tier === 'All' ? '전체 티어' : tier}
          </button>
        ))}
      </div>

      <SpotlightCard className="p-3 xs:p-4 sm:p-5 mb-3 xs:mb-4 sm:mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-base xs:text-lg sm:text-xl font-bold text-white flex-shrink-0">
              {(profile?.nickname || profile?.name || 'U').charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 mb-0.5 xs:mb-1">
                <span className={`px-1.5 py-0.5 xs:px-2 rounded-full text-[8px] xs:text-[9px] sm:text-[10px] font-bold whitespace-nowrap ${getRoleBadgeClass(profile?.role)}`}>
                  {profile?.role ? t(profile.role) : t('player_common')}
                </span>
                <div className="text-sm xs:text-base sm:text-lg font-bold text-white truncate">
                  {profile?.nickname || profile?.name || '사용자'}
                </div>
              </div>
              <div className="px-1.5 xs:px-2 sm:px-2.5 py-0.5 rounded-full bg-gradient-to-r from-blue-400 to-cyan-500 text-black text-[9px] xs:text-[10px] sm:text-xs font-bold inline-flex">
                {profile?.tier || 'Bronze III'}
              </div>
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
                onClick={() => setActiveTab(`opponent-profile-${user.id}`)}
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
              <div key={m.id} className={`p-2.5 sm:p-3 rounded-lg border ${
                m.result === 'win' ? 'bg-emerald-500/10 border-emerald-500/30' :
                m.result === 'loss' ? 'bg-red-500/10 border-red-500/30' :
                'bg-gray-500/10 border-gray-500/30'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs sm:text-sm font-bold text-white truncate">vs {m.opponent}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400">{m.playedAt}</div>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] sm:text-xs">
                  <span className="text-gray-300">점수 {m.score}</span>
                  <span className="text-gray-300">{m.method}</span>
                  <span className={m.result === 'win' ? 'text-emerald-400' : m.result === 'loss' ? 'text-red-400' : 'text-gray-300'}>
                    {m.result === 'win' ? '승' : m.result === 'loss' ? '패' : '무'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SpotlightCard>

      <SpotlightCard className="overflow-hidden">
        <div className="hidden sm:block bg-white/5 px-2 sm:px-4 py-2 border-b border-white/10 overflow-x-auto">
          <div className="grid grid-cols-12 gap-2 sm:gap-3 items-center text-[10px] sm:text-xs font-bold text-gray-400 uppercase min-w-[500px]">
            <div className="col-span-1">#</div>
            <div className="col-span-3">선수명</div>
            <div className="col-span-2">티어</div>
            <div className="col-span-2">{t('victoryPoints')}</div>
            <div className="col-span-3">스타일</div>
            <div className="col-span-1 text-right">승률</div>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {loading && (
            <div className="px-4 py-10 text-center text-gray-500">랭킹을 불러오는 중입니다...</div>
          )}

          {!loading && paginatedPlayers.length === 0 && (
            <div className="px-4 py-10 text-center text-gray-500">표시할 선수가 없습니다.</div>
          )}

          {paginatedPlayers.map((player) => {
            const tierColor = getTierColor(player.tier);
            const rank = player.rank_label || player.match_rank || '-';
            const isTopThree = Number.isInteger(player.match_rank) && player.match_rank <= 3;

            return (
              <div
                key={player.id}
                className={`px-2 xs:px-3 sm:px-4 py-2.5 xs:py-3 transition-all hover:bg-white/5 ${isTopThree ? 'bg-gradient-to-r from-white/5 to-transparent' : ''}`}
              >
                <div className="sm:hidden">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs bg-white/10 text-white">
                        {rank}
                      </div>
                      <button
                        onClick={() => setActiveTab(`opponent-profile-${player.id}`)}
                        className="flex items-center gap-2 hover:scale-105 transition-transform"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {(player.display_name || 'U').charAt(0)}
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-white text-sm hover:text-blue-400 transition-colors">
                            {player.display_name}
                          </div>
                          <div className="text-[9px] text-gray-500">{player.boxing_style || '스타일 미등록'}</div>
                        </div>
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-400">{player.match_points || 0}</div>
                      <div className="text-[9px] text-gray-500">{t('victoryPoints')}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <div className={`inline-flex px-2 py-1 rounded-lg bg-gradient-to-r ${tierColor.bg} border ${tierColor.border}`}>
                      <span className={`font-bold ${tierColor.text} whitespace-nowrap`}>{player.tier || 'Unranked'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span>승률 {player.win_rate || 0}%</span>
                      <span>•</span>
                      <span>{player.wins || 0}승 {player.losses || 0}패</span>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:grid grid-cols-12 gap-2 sm:gap-3 items-center">
                  <div className="col-span-1">
                    <div className="inline-flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg font-bold text-xs sm:text-sm bg-white/10 text-white">
                      {rank}
                    </div>
                  </div>

                  <div className="col-span-3">
                    <button
                      onClick={() => setActiveTab(`opponent-profile-${player.id}`)}
                      className="flex items-center gap-2 w-full hover:scale-105 transition-transform"
                    >
                      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                        {(player.display_name || 'U').charAt(0)}
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="font-bold text-white text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis hover:text-blue-400 transition-colors">
                          {player.display_name}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap">
                          {player.role === 'player_athlete' ? '선수' : '일반회원'}
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="col-span-2">
                    <div className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-gradient-to-r ${tierColor.bg} border ${tierColor.border}`}>
                      <span className={`font-bold text-[10px] sm:text-xs ${tierColor.text} whitespace-nowrap`}>{player.tier || 'Unranked'}</span>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="font-bold text-sm sm:text-base text-white whitespace-nowrap">{(player.match_points || 0).toLocaleString()}</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap">{t('victoryPoints')}</div>
                  </div>

                  <div className="col-span-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      <div className="px-1.5 sm:px-2 py-0.5 rounded-md bg-white/10 text-[9px] sm:text-[10px] text-gray-300 whitespace-nowrap">
                        {player.boxing_style || '스타일 미등록'}
                      </div>
                      {player.gym_name && (
                        <div className="px-1.5 sm:px-2 py-0.5 rounded-md bg-white/10 text-[9px] sm:text-[10px] text-gray-300 whitespace-nowrap">
                          {player.gym_name}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-1 text-right">
                    <div className="font-bold text-sm sm:text-base text-blue-400">{player.win_rate || 0}%</div>
                    <div className="text-xs text-gray-500">{player.wins || 0}승 {player.losses || 0}패</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 bg-white/5 border-t border-white/10">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all"
              >
                ←
              </button>

              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-lg font-bold transition-all ${currentPage === pageNum ? 'bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-400'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all"
              >
                →
              </button>
            </div>
            <div className="text-center mt-3 text-sm text-gray-500">
              #{(currentPage - 1) * ITEMS_PER_PAGE + 1} ~ #{Math.min(currentPage * ITEMS_PER_PAGE, filteredPlayers.length)} / 총 {filteredPlayers.length}명
            </div>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
};

export { TierBoardView };

'use client';

import { useState, useEffect } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import { translations } from '@/lib/translations';

/**
 * 비로그인 랜딩에서 검색 후 선수 선택 시 — /api/public-player 로 전적 조회
 */
export default function PublicPlayerRecordView({ playerId, onBack, language = 'ko' }) {
  const t = (key) => translations[language][key] || key;
  const [opponent, setOpponent] = useState(null);
  const [opponentMatches, setOpponentMatches] = useState([]);
  const [showAllOpponentMatches, setShowAllOpponentMatches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!playerId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public-player/${encodeURIComponent(playerId)}`, {
          credentials: 'same-origin',
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setOpponent(null);
          setOpponentMatches([]);
          setError(json.error || translations[language]?.publicPlayerLoadError || translations.ko.publicPlayerLoadError);
          setLoading(false);
          return;
        }
        setOpponent(json.profile || null);
        setOpponentMatches(json.matches || []);
      } catch {
        if (!cancelled) {
          setError(translations[language]?.publicPlayerLoadError || translations.ko.publicPlayerLoadError);
          setOpponent(null);
          setOpponentMatches([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId, language]);

  if (loading) {
    return (
      <div className="animate-fade-in-up min-h-[60vh] flex flex-col">
        <PageHeader
          title={t('publicPlayerLoadingTitle')}
          description={t('publicPlayerLoadingDesc')}
          onBack={onBack}
        />
        <SpotlightCard className="p-10 text-center text-gray-400">{t('pleaseWait')}</SpotlightCard>
      </div>
    );
  }

  if (error || !opponent) {
    return (
      <div className="animate-fade-in-up min-h-[60vh] flex flex-col">
        <PageHeader
          title={t('publicPlayerNotFoundTitle')}
          description={error || t('publicPlayerNotFoundDesc')}
          onBack={onBack}
        />
        <SpotlightCard className="p-10 text-center text-gray-400">{t('publicPlayerNotFoundDesc')}</SpotlightCard>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6 pb-8">
      <PageHeader title={`${opponent.display_name} ${t('publicPlayerRecordSuffix')}`} onBack={onBack} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SpotlightCard className="p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg border-2 border-purple-400/50">
                {(opponent.display_name || 'U').charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="text-2xl sm:text-3xl font-bold text-white">{opponent.display_name}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold border ${
                      opponent.role === 'player_athlete'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    }`}
                  >
                    {opponent.role === 'player_athlete' ? t('player_athlete') : t('player_common')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
                  <span className="font-bold text-yellow-400 whitespace-nowrap">{opponent.tier || 'Unranked'}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="whitespace-nowrap">
                    {t('nationalRanking')} #{opponent.rank || '-'}
                  </span>
                  {opponent.gym_name && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="whitespace-nowrap">{opponent.gym_name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-3 border border-blue-500/20">
                <div className="text-xs text-blue-300 mb-1 whitespace-nowrap">{t('totalMatches')}</div>
                <div className="text-2xl font-bold text-white">{opponent.total_matches || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-3 border border-emerald-500/20">
                <div className="text-xs text-emerald-300 mb-1 whitespace-nowrap">{t('record')}</div>
                <div className="text-lg font-bold text-white">
                  {opponent.wins || 0}승 {opponent.draws || 0}무 {opponent.losses || 0}패
                </div>
                <div className="text-xs text-emerald-400 mt-1">
                  {t('winRateShort')} {opponent.win_rate || 0}%
                </div>
              </div>
              <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-3 border border-red-500/20">
                <div className="text-xs text-red-300 mb-1 whitespace-nowrap">{t('koWins')}</div>
                <div className="text-2xl font-bold text-red-400">{opponent.ko_wins || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-3 border border-purple-500/20">
                <div className="text-xs text-purple-300 mb-1 whitespace-nowrap">{t('winStreak')}</div>
                <div className="text-2xl font-bold text-purple-400">{opponent.current_win_streak || 0}</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Icon type="activity" className="w-4 h-4" />
                {t('matchHistoryList')}
              </h4>
              {opponentMatches.length === 0 ? (
                <div className="text-xs text-gray-500">{t('noMatchesToShow')}</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(showAllOpponentMatches ? opponentMatches : opponentMatches.slice(0, 8)).map((match) => (
                    <div
                      key={match.id}
                      className={`p-3 rounded-lg border-l-4 ${
                        match.result === 'win'
                          ? 'bg-blue-900/50 border-l-blue-400 border border-blue-500/40'
                          : match.result === 'loss'
                            ? 'bg-red-900/50 border-l-red-400 border border-red-500/40'
                            : 'bg-zinc-900/55 border-l-gray-500 border border-zinc-600/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm text-white font-bold truncate">
                          vs {match.opponent_name || match.opponent?.nickname || match.opponent?.name || '—'}
                        </div>
                        <div className="text-xs text-gray-500 shrink-0">
                          {match.played_at ? new Date(match.played_at).toISOString().split('T')[0] : '-'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-300">
                        <span
                          className={
                            match.result === 'win'
                              ? 'text-blue-400 font-bold'
                              : match.result === 'loss'
                                ? 'text-red-400 font-bold'
                                : 'text-gray-300 font-bold'
                          }
                        >
                          {match.score || '-'}
                        </span>
                        <span>{(match.method || 'decision').toUpperCase()}</span>
                        <span
                          className={
                            match.result === 'win'
                              ? 'text-blue-400'
                              : match.result === 'loss'
                                ? 'text-red-400'
                                : 'text-gray-300'
                          }
                        >
                          {match.result === 'win' ? '승' : match.result === 'loss' ? '패' : '무'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {opponentMatches.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllOpponentMatches((p) => !p)}
                  className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                >
                  {showAllOpponentMatches ? t('collapse') : t('expand')}
                </button>
              )}
            </div>
          </SpotlightCard>
        </div>

        <div>
          <SpotlightCard className="p-6 bg-[#1a1a1a]">
            <h3 className="text-lg font-bold text-white mb-4">{t('tierInfo')}</h3>
            <div className="text-center mb-4">
              <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-1">
                {opponent.tier || 'Unranked'}
              </div>
              <div className="text-sm text-blue-300 font-semibold">
                {t('victoryPoints')} {opponent.match_points ?? opponent.tier_points ?? 0}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {t('nationalRanking')} #{opponent.rank || '-'}
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}

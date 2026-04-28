'use client';

import { useMemo, useState } from 'react';
import ProfileAvatarImg from '@/components/ProfileAvatarImg';
import { computeMatchRecords } from '@/lib/matchRecords';

/**
 * 전적 섹션 공통 렌더러 — 상대별 그룹 + 아코디언 펼침.
 *
 * 동작:
 *   · 매치를 opponentId 기준으로 그룹화 (한 상대당 1행)
 *   · 행 클릭 → 그 상대와의 모든 매치가 아래로 펼쳐짐
 *   · 빈 상태: "아직 경기를 진행하지 않았습니다"
 *
 * @param matches 정규화된 매치 배열 (`normalizeRawMatch` 가공)
 * @param onOpenOpponent 상대 프로필로 이동하는 콜백 — 닉네임 영역 옆 → 버튼 클릭 시 호출 (옵션)
 * @param limit 그룹 최대 표시 수 (default: 10)
 * @param showTiles 누적 기록 타일 표시 여부 (default: true)
 */
export default function MatchHistorySection({
  matches,
  onOpenOpponent,
  limit = 10,
  showTiles = true,
}) {
  const list = useMemo(() => matches || [], [matches]);
  const records = computeMatchRecords(list);
  const [expandedId, setExpandedId] = useState(null);

  // 상대별 그룹화 — opponentId 기준. 매치 시각 desc.
  const groups = useMemo(() => {
    const map = new Map();
    list.forEach((m, idx) => {
      const key = m.opponentId || `__unknown_${m.id || idx}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          opponentId: m.opponentId || null,
          opponent: m.opponent || '상대 미상',
          opponentRealName: m.opponentRealName || null,
          opponentAvatarUrl: m.opponentAvatarUrl || null,
          matches: [],
          wins: 0,
          losses: 0,
          draws: 0,
        });
      }
      const g = map.get(key);
      g.matches.push(m);
      if (m.result === 'win') g.wins += 1;
      else if (m.result === 'loss') g.losses += 1;
      else g.draws += 1;
    });
    // 그룹 정렬: 그룹 내 가장 최근 매치 시각 desc
    const arr = Array.from(map.values());
    arr.forEach((g) => {
      g.matches.sort((a, b) => new Date(b.played_at || 0) - new Date(a.played_at || 0));
      g.lastPlayedAt = g.matches[0]?.played_at ? new Date(g.matches[0].played_at).getTime() : 0;
    });
    arr.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
    return arr;
  }, [list]);

  if (list.length === 0) {
    return (
      <div className="py-10 text-center text-gray-400 text-base">아직 경기를 진행하지 않았습니다.</div>
    );
  }

  const displayed = groups.slice(0, limit);

  return (
    <>
      {/* 누적 기록 타일 */}
      {showTiles && records.tiles && (
        <div className="mb-4 grid grid-cols-4 gap-2">
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/8 text-center">
            <div className="text-base sm:text-lg font-bold text-white tabular-nums leading-none">{records.tiles.kos}</div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">KO승</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/8 text-center">
            <div className="text-base sm:text-lg font-bold text-white tabular-nums leading-none">{records.tiles.longestStreak}</div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">최장 연승</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/8 text-center">
            <div className="text-base sm:text-lg font-bold text-white tabular-nums leading-none">{records.tiles.totalWins}</div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">누적 승</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/8 text-center">
            <div className="text-base sm:text-lg font-bold text-white tabular-nums leading-none">
              {records.tiles.winRate}<span className="text-[10px] font-normal text-gray-500 ml-0.5">%</span>
            </div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">승률</div>
          </div>
        </div>
      )}

      {/* 상대별 그룹 카드 */}
      <div className="space-y-2.5">
        {displayed.map((g) => {
          const isOpen = expandedId === g.key;
          const total = g.matches.length;
          // 상대 전체 우열에 따라 카드 톤 결정
          const groupResult = g.wins > g.losses ? 'win' : g.losses > g.wins ? 'loss' : 'draw';
          const accent = groupResult === 'win' ? 'text-blue-300' : groupResult === 'loss' ? 'text-red-300' : 'text-gray-300';
          const bgClass = groupResult === 'win'
            ? 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-400/30 hover:border-blue-400/50'
            : groupResult === 'loss'
              ? 'bg-red-500/15 hover:bg-red-500/25 border-red-400/30 hover:border-red-400/50'
              : 'bg-white/[0.04] hover:bg-white/[0.07] border-white/10 hover:border-white/20';
          return (
            <div key={g.key} className={`border rounded-2xl overflow-hidden transition-all ${bgClass}`}>
              {/* 요약 행 — 클릭 시 펼침 */}
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : g.key)}
                className="w-full p-4 text-left flex items-center gap-4"
              >
                <div className="relative flex-shrink-0">
                  <ProfileAvatarImg
                    avatarUrl={g.opponentAvatarUrl}
                    name={g.opponent}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-white/15 text-lg"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500 whitespace-nowrap">vs</p>
                    <h4 className="text-lg sm:text-xl font-bold text-white truncate">
                      {g.opponent}
                      {g.opponentRealName ? (
                        <span className="text-sm sm:text-base text-gray-400 font-medium ml-1.5">({g.opponentRealName})</span>
                      ) : null}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-sm sm:text-base text-gray-300 flex-wrap">
                    <span className="font-semibold tabular-nums">{total}전</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-blue-300 font-semibold tabular-nums">{g.wins}승</span>
                    <span className="text-red-300 font-semibold tabular-nums">{g.losses}패</span>
                    <span className="text-gray-400 font-semibold tabular-nums">{g.draws}무</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right flex-shrink-0">
                  <div className={`text-2xl sm:text-3xl font-black tabular-nums leading-none ${accent}`}>
                    {g.wins}-{g.losses}{g.draws ? `-${g.draws}` : ''}
                  </div>
                  <svg
                    className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* 펼친 영역 — 그 상대와의 매치 디테일 */}
              {isOpen ? (
                <div className="border-t border-white/8 bg-black/20 px-3 sm:px-4 py-3 space-y-2">
                  {/* 상대 프로필로 가는 보조 버튼 */}
                  {onOpenOpponent && g.opponentId ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpenOpponent(g.opponentId); }}
                      className="w-full text-sm sm:text-base font-semibold text-cyan-300 hover:text-cyan-200 py-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      → 상대 프로필 보기
                    </button>
                  ) : null}

                  {g.matches.length === 0 ? (
                    <div className="py-6 text-center text-gray-400 text-sm">아직 경기를 진행하지 않았습니다.</div>
                  ) : (
                    g.matches.map((m) => {
                      const resultLabel = m.result === 'win' ? '승' : m.result === 'loss' ? '패' : '무';
                      const a = m.result === 'win' ? 'text-blue-300' : m.result === 'loss' ? 'text-red-300' : 'text-gray-300';
                      const dot = m.result === 'win' ? 'bg-blue-400' : m.result === 'loss' ? 'bg-red-400' : 'bg-gray-500';
                      return (
                        <div
                          key={m.id || `${m.played_at}-${m.score}`}
                          className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/8"
                        >
                          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${dot}`} aria-hidden />
                          <div className="flex-1 min-w-0">
                            {/* 1줄: vs 닉네임 (이름) — 매 행마다 명시 */}
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">vs</span>
                              <span className="text-base sm:text-lg text-white font-bold truncate">{g.opponent}</span>
                              {g.opponentRealName ? (
                                <span className="text-xs sm:text-sm text-gray-400 font-medium">({g.opponentRealName})</span>
                              ) : null}
                            </div>
                            {/* 2줄: 날짜 · 방식 · 점수 · 라운드 */}
                            <div className="flex items-center gap-1.5 flex-wrap text-sm text-gray-400">
                              <span className="whitespace-nowrap">{m.date}</span>
                              <span className="text-gray-600">·</span>
                              <span className="uppercase whitespace-nowrap">{m.method}</span>
                              <span className="text-gray-600">·</span>
                              <span className="tabular-nums whitespace-nowrap">{m.score}</span>
                              <span className="text-gray-600">·</span>
                              <span className="tabular-nums whitespace-nowrap">{m.rounds}R</span>
                            </div>
                          </div>
                          <span className={`text-xl sm:text-2xl font-black tabular-nums flex-shrink-0 ${a}`}>
                            {resultLabel}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

'use client';

import ProfileAvatarImg from '@/components/ProfileAvatarImg';
import { computeMatchRecords } from '@/lib/matchRecords';

/**
 * 전적 섹션 공통 렌더러.
 * 커리어 기록 타일 + 전적 리스트(통일된 카드 디자인) 한 세트를 출력한다.
 *
 * @param matches 정규화된 매치 배열 (최근 → 과거 순, `normalizeRawMatch`로 가공)
 * @param onOpenOpponent 상대 프로필로 이동하는 콜백 — (opponentId) => void (optional)
 * @param limit 리스트 최대 표시 수 (default: 10)
 * @param showTiles 기록 타일 표시 여부 (default: true)
 */
export default function MatchHistorySection({
  matches,
  onOpenOpponent,
  limit = 10,
  showTiles = true,
}) {
  const list = matches || [];
  const records = computeMatchRecords(list);
  const displayMatches = list.slice(0, limit);

  if (list.length === 0) {
    return (
      <div className="py-10 text-center text-gray-500 text-sm">표시할 전적이 없습니다.</div>
    );
  }

  return (
    <>
      {/* 기록 타일 */}
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

      {/* 전적 리스트 — 모든 매치가 동일한 카드 디자인 */}
      <div className="space-y-2.5">
        {displayMatches.map((match, i) => {
          const resultLabel = match.result === 'win' ? '승' : match.result === 'loss' ? '패' : '무';
          const accent = match.result === 'win' ? 'text-blue-300' : match.result === 'loss' ? 'text-red-300' : 'text-gray-300';
          const dotColor = match.result === 'win' ? 'bg-blue-400' : match.result === 'loss' ? 'bg-red-400' : 'bg-gray-500';
          const bgClass = match.result === 'win'
            ? 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-400/30 hover:border-blue-400/50'
            : match.result === 'loss'
            ? 'bg-red-500/15 hover:bg-red-500/25 border-red-400/30 hover:border-red-400/50'
            : 'bg-white/[0.04] hover:bg-white/[0.07] border-white/10 hover:border-white/20';
          const descIdx = list.length - 1 - i;
          const tags = (records.labelByDescIndex && records.labelByDescIndex[descIdx]) || [];
          return (
            <button
              key={match.id || i}
              type="button"
              onClick={() => { if (onOpenOpponent && match.opponentId) onOpenOpponent(match.opponentId); }}
              className={`w-full p-4 border rounded-2xl transition-all text-left flex items-center gap-4 group ${bgClass}`}
            >
              <div className="relative flex-shrink-0">
                <ProfileAvatarImg
                  avatarUrl={match.opponentAvatarUrl}
                  name={match.opponent}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-white/15 text-lg"
                />
                <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#1a1a1a] ${dotColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500 whitespace-nowrap">vs</p>
                  <h4 className="text-base sm:text-lg font-bold text-white truncate">{match.opponent}</h4>
                  {tags.length > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-[9px] font-bold tracking-wide text-amber-200 whitespace-nowrap">
                      {tags[0]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
                  <span className="whitespace-nowrap">{match.date}</span>
                  <span className="text-gray-700">·</span>
                  <span className="whitespace-nowrap uppercase">{match.method}</span>
                  {tags.length > 1 && (
                    <>
                      <span className="text-gray-700">·</span>
                      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-white/70">
                        {tags.slice(1).join(' · ')}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-2xl sm:text-3xl font-black tabular-nums leading-none ${accent}`}>
                  {resultLabel}
                </div>
                <div className="text-xs text-gray-500 mt-1 tabular-nums">
                  {match.score} · {match.rounds}R
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

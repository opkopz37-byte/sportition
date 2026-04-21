import { computeMatchPoints, getTierLabelFromMatchPoints } from './tierLadder.js';

/**
 * public_player_profiles 행 + matches 샘플로 티어보드와 동일한 순서의 랭킹 배열 생성.
 * 서버 API와 클라이언트 getMatchLeaderboard 가 공통 사용.
 */
export function computeMatchLeaderboard(players, matches, limit = 200) {
  const latestMatchByUser = {};
  (matches || []).forEach((match) => {
    const t = match?.played_at;
    if (!t) return;
    const uid = match.user_id;
    const oid = match.opponent_id;
    if (uid && !latestMatchByUser[uid]) latestMatchByUser[uid] = t;
    if (oid && !latestMatchByUser[oid]) latestMatchByUser[oid] = t;
  });

  const enriched = (players || []).map((player) => {
    const wins = Number(player.wins || 0);
    const losses = Number(player.losses || 0);
    const draws = Number(player.draws || 0);
    const totalMatches = Number(player.total_matches || wins + losses + draws || 0);
    const winRate =
      totalMatches > 0
        ? Number(((wins / totalMatches) * 100).toFixed(1))
        : Number(player.win_rate || 0);
    const matchPoints = computeMatchPoints(wins, draws, losses);
    const lastMatchAt = latestMatchByUser[player.id] || player.last_match_at || null;
    const qualified = totalMatches >= 5;

    const isGym = player.role === 'gym';
    const tierLabel = isGym ? player.tier : getTierLabelFromMatchPoints(matchPoints);
    return {
      ...player,
      wins,
      losses,
      draws,
      total_matches: totalMatches,
      win_rate: winRate,
      match_points: matchPoints,
      tier: tierLabel,
      tier_points: isGym ? player.tier_points : matchPoints,
      last_match_at: lastMatchAt,
      qualified_rank: qualified,
    };
  });

  enriched.sort((a, b) => {
    if (a.qualified_rank !== b.qualified_rank) return a.qualified_rank ? -1 : 1;
    if ((b.match_points || 0) !== (a.match_points || 0)) return (b.match_points || 0) - (a.match_points || 0);
    if ((b.win_rate || 0) !== (a.win_rate || 0)) return (b.win_rate || 0) - (a.win_rate || 0);
    if ((b.total_matches || 0) !== (a.total_matches || 0)) return (b.total_matches || 0) - (a.total_matches || 0);
    const aTime = a.last_match_at ? new Date(a.last_match_at).getTime() : 0;
    const bTime = b.last_match_at ? new Date(b.last_match_at).getTime() : 0;
    return bTime - aTime;
  });

  let qualifiedRank = 0;
  const ranked = enriched.map((player, index) => {
    const displayRank = index + 1;
    if (player.qualified_rank) {
      qualifiedRank += 1;
      return { ...player, match_rank: qualifiedRank, rank_label: `${displayRank}` };
    }
    return { ...player, match_rank: null, rank_label: `${displayRank}` };
  });

  const sliced = typeof limit === 'number' && limit > 0 ? ranked.slice(0, limit) : ranked;
  return sliced;
}

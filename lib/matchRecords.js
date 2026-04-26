/**
 * 경기 이력 기반 커리어 기록 계산 유틸.
 * 전적 섹션(마이페이지 대시보드·전체 전적·상대 프로필)에서 공통으로 사용한다.
 *
 * 입력은 정규화된 매치 배열:
 *   { opponentId, opponent, opponentAvatarUrl, date, played_at, result, method, score, rounds }
 * — 내림차순(최근 → 과거) 정렬 상태라 가정한다.
 */

const KO_METHODS = new Set(['KO', 'TKO', 'RSC']);

export function isKoMatch(m) {
  return KO_METHODS.has(String(m?.method || '').toUpperCase());
}

export function computeMatchRecords(matchesDesc) {
  if (!matchesDesc || !matchesDesc.length) {
    return { tiles: null, highlightMatch: null, labelByDescIndex: {} };
  }

  // 오래된 → 최근 순으로 재정렬(시점별 기록 추적)
  const chron = [...matchesDesc].sort((a, b) => {
    const da = a.played_at ? new Date(a.played_at).getTime() : 0;
    const db = b.played_at ? new Date(b.played_at).getTime() : 0;
    return da - db;
  });

  const chronLabels = new Array(chron.length).fill(null).map(() => []);
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let kos = 0;
  let streak = 0;
  let longestStreak = 0;
  let firstWinIdx = -1;
  let firstKoIdx = -1;

  chron.forEach((m, idx) => {
    const tags = chronLabels[idx];
    // '데뷔전' 라벨 제거 — 모든 매치 카드에서 노출 안 함
    if (m.result === 'win') {
      wins += 1;
      if (firstWinIdx < 0) {
        firstWinIdx = idx;
        tags.push('첫 승');
      }
      if (isKoMatch(m)) {
        kos += 1;
        if (firstKoIdx < 0) {
          firstKoIdx = idx;
          tags.push('첫 KO승');
        } else {
          tags.push('KO승');
        }
      }
      streak += 1;
      if (streak > longestStreak) longestStreak = streak;
      if (streak === 3 || streak === 5 || streak === 10) tags.push(`${streak}연승 달성`);
    } else if (m.result === 'loss') {
      losses += 1;
      streak = 0;
    } else {
      draws += 1;
      streak = 0;
    }
  });

  // 내림차순 → 오름차순 매핑
  const labelByDescIndex = {};
  for (let i = 0; i < chron.length; i += 1) {
    labelByDescIndex[chron.length - 1 - i] = chronLabels[i];
  }

  const recentKoWin = [...chron].reverse().find((m) => m.result === 'win' && isKoMatch(m));
  const recentWin = [...chron].reverse().find((m) => m.result === 'win');
  const highlightMatch = recentKoWin || recentWin || chron[chron.length - 1];

  // 승률 = 승 / (승+패+무) * 100  — 무를 분모에서 빼는 방식도 있지만 일반적인 정의 채택
  const totalMatches = wins + losses + draws;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  return {
    tiles: {
      kos,
      longestStreak,
      totalWins: wins,
      winRate,
    },
    highlightMatch,
    labelByDescIndex,
  };
}

/**
 * 원시 매치(Supabase row)를 전적 UI에 쓸 정규화 형태로 변환.
 */
export function normalizeRawMatch(m) {
  const playedAt = m.played_at ? new Date(m.played_at) : null;
  const dateLabel = playedAt && !Number.isNaN(playedAt.getTime())
    ? playedAt.toISOString().split('T')[0]
    : '-';
  const result = m.result === 'win' || m.result === 'loss' || m.result === 'draw' ? m.result : 'draw';
  return {
    opponentId: m.opponent?.id || m.opponent_id || null,
    opponent: m.opponent_name || m.opponent?.nickname || m.opponent?.name || '상대 미상',
    opponentAvatarUrl: m.opponent?.avatar_url || null,
    date: dateLabel,
    played_at: m.played_at,
    result,
    method: m.method || 'decision',
    score: m.score || '-',
    rounds: m.rounds || '-',
    id: m.id,
  };
}

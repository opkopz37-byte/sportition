/**
 * 티어 보드와 동일한 기준: 승점 = 승 × 3 + 무 × 1
 * 구간은 승점 누적에 따라 Bronze III → Master I 까지 18단계.
 */

export const MATCH_POINTS_WIN = 3;
export const MATCH_POINTS_DRAW = 1;

/** 승/무 기준 승점 (티어 보드·대시보드·프로필 공통) */
export function computeMatchPoints(wins, draws) {
  return (Number(wins) || 0) * MATCH_POINTS_WIN + (Number(draws) || 0) * MATCH_POINTS_DRAW;
}

/**
 * min 승점 이상이면 해당 티어 (동점이면 상위 구간 규칙: 높은 min 우선)
 * 순서: Bronze III(최저) … Master I(최고)
 */
export const TIER_STEPS = [
  { tier: 'Bronze III', min: 0 },
  { tier: 'Bronze II', min: 12 },
  { tier: 'Bronze I', min: 24 },
  { tier: 'Silver III', min: 36 },
  { tier: 'Silver II', min: 51 },
  { tier: 'Silver I', min: 66 },
  { tier: 'Gold III', min: 84 },
  { tier: 'Gold II', min: 105 },
  { tier: 'Gold I', min: 129 },
  { tier: 'Platinum III', min: 156 },
  { tier: 'Platinum II', min: 186 },
  { tier: 'Platinum I', min: 219 },
  { tier: 'Diamond III', min: 255 },
  { tier: 'Diamond II', min: 294 },
  { tier: 'Diamond I', min: 336 },
  { tier: 'Master III', min: 384 },
  { tier: 'Master II', min: 438 },
  { tier: 'Master I', min: 500 },
];

export function getTierLabelFromMatchPoints(points) {
  const p = Number(points) || 0;
  let label = TIER_STEPS[0].tier;
  for (let i = 0; i < TIER_STEPS.length; i++) {
    if (p >= TIER_STEPS[i].min) label = TIER_STEPS[i].tier;
  }
  return label;
}

/** 티어 탭 필터용: "Bronze III" → "Bronze" */
export function tierFamilyFromLabel(tierLabel) {
  if (!tierLabel || typeof tierLabel !== 'string') return '';
  const m = tierLabel.match(/^(Bronze|Silver|Gold|Platinum|Diamond|Master)/);
  return m ? m[1] : '';
}

/**
 * 다음 티어까지 필요한 승점, 현재 구간 내 진행률(0~1)
 */
export function getNextTierInfo(matchPoints) {
  const p = Number(matchPoints) || 0;
  let idx = 0;
  for (let i = 0; i < TIER_STEPS.length; i++) {
    if (p >= TIER_STEPS[i].min) idx = i;
  }
  const current = TIER_STEPS[idx];
  const next = TIER_STEPS[idx + 1];
  if (!next) {
    const softSpan = 300;
    return {
      currentLabel: current.tier,
      nextLabel: null,
      pointsToNext: 0,
      divisionMin: current.min,
      divisionMax: current.min + softSpan,
      progressInDivision: Math.min(1, (p - current.min) / softSpan),
    };
  }
  const pointsToNext = Math.max(0, next.min - p);
  const span = next.min - current.min;
  const progressInDivision = span > 0 ? Math.min(1, Math.max(0, (p - current.min) / span)) : 0;
  return {
    currentLabel: current.tier,
    nextLabel: next.tier,
    pointsToNext,
    divisionMin: current.min,
    divisionMax: next.min,
    progressInDivision,
  };
}

/** 원형 게이지용: 현재 티어 구간 대비 진행 (0~1) */
export function getTierRingProgress(matchPoints) {
  return getNextTierInfo(matchPoints).progressInDivision;
}

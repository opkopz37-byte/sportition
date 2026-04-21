/**
 * 티어 보드 규정 (2026 기준)
 * - 티어별 구간: 각 100점 (0~99 → 해당 티어, 100점 도달 시 다음 티어)
 * - 누적 랭크 점수: 매치 승 +20, 패 +17, 무승부 +18 (무승부는 중간값; 운영에서 조정 가능)
 * - 티어 순서 (최하 → 최상): Bronze III → … → Challenger I (24단계)
 */

export const POINTS_PER_DIVISION = 100;

export const MATCH_POINTS_WIN = 20;
export const MATCH_POINTS_LOSS = 17;
/** 무승부 미정 시 중간값 (승·패 사이) */
export const MATCH_POINTS_DRAW = 18;

const FAMILIES = [
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Master',
  'Grandmaster',
  'Challenger',
];

const ROMAN = ['III', 'II', 'I'];

/** Bronze III(min 0) … Challenger I(min 2300) */
export const TIER_STEPS = FAMILIES.flatMap((family, fi) =>
  ROMAN.map((roman, ri) => ({
    tier: `${family} ${roman}`,
    min: (fi * 3 + ri) * POINTS_PER_DIVISION,
  }))
);

/** 최상위 티어 라벨 (UI 폴백용) */
export const MAX_TIER_LABEL = TIER_STEPS[TIER_STEPS.length - 1].tier;

/**
 * 전적 기준 누적 랭크 점수 (티어 산정·랭킹 정렬에 공통 사용)
 */
export function computeMatchPoints(wins, draws, losses) {
  const w = Number(wins) || 0;
  const d = Number(draws) || 0;
  const l = Number(losses) || 0;
  return w * MATCH_POINTS_WIN + d * MATCH_POINTS_DRAW + l * MATCH_POINTS_LOSS;
}

/** 누적 랭크 점수 → 티어 라벨 */
export function getTierLabelFromMatchPoints(points) {
  const p = Number(points) || 0;
  let label = TIER_STEPS[0].tier;
  for (let i = 0; i < TIER_STEPS.length; i++) {
    if (p >= TIER_STEPS[i].min) label = TIER_STEPS[i].tier;
  }
  return label;
}

/**
 * 티어 탭 필터용: "Bronze III" → "Bronze"
 * Grandmaster는 Master와 구분, Challenger 별도
 */
export function tierFamilyFromLabel(tierLabel) {
  if (!tierLabel || typeof tierLabel !== 'string') return '';
  if (tierLabel.startsWith('Grandmaster')) return 'Grandmaster';
  if (tierLabel.startsWith('Challenger')) return 'Challenger';
  const m = tierLabel.match(/^(Bronze|Silver|Gold|Platinum|Diamond|Master)\b/);
  return m ? m[1] : '';
}

/**
 * 현재 티어 구간 내에서 다음 티어까지 필요한 점수, 구간 진행률(0~1)
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
    const span = POINTS_PER_DIVISION;
    const over = p - current.min;
    return {
      currentLabel: current.tier,
      nextLabel: null,
      pointsToNext: 0,
      divisionMin: current.min,
      divisionMax: current.min + span,
      progressInDivision: Math.min(1, Math.max(0, over / span)),
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

/** 원형 게이지: 현재 티어 구간 대비 진행 (0~1) */
export function getTierRingProgress(matchPoints) {
  return getNextTierInfo(matchPoints).progressInDivision;
}

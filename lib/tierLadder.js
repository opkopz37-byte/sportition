/**
 * 티어 보드 규정 (2026 기준)
 * - 티어별 구간: 각 100점 (0~99 → 해당 티어, 100점 도달 시 다음 티어)
 * - 누적 랭크 점수: 매치 승 +60, 패 -40, 무승부 +20 (양쪽 각각)
 * - 티어 순서 (최하 → 최상): Bronze III → … → Challenger I (24단계)
 * - 최소 점수: 0점 (음수 불가)
 */

export const POINTS_PER_DIVISION = 100;

export const MATCH_POINTS_WIN = 60;
export const MATCH_POINTS_LOSS = -40;
/** 무승부 = 양쪽 모두 +20점 */
export const MATCH_POINTS_DRAW = 20;

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
 * 패배 시 마이너스 점수이므로 최소값 0 보장
 */
export function computeMatchPoints(wins, draws, losses) {
  const w = Number(wins) || 0;
  const d = Number(draws) || 0;
  const l = Number(losses) || 0;
  const points = w * MATCH_POINTS_WIN + d * MATCH_POINTS_DRAW + l * MATCH_POINTS_LOSS;
  return Math.max(0, points);
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

/**
 * 티어별 고정 색상 팔레트 — 전 페이지 공통.
 * - bg: tailwind gradient stops (linear-gradient 용)
 * - text: 티어 라벨 글자 색
 * - border: 카드/배지 보더
 * - shadow: 외곽 글로우 (선택 — Challenger 등 화려한 티어용 inline style)
 * - glowClass: 추가 효과 클래스 (animation 등, globals.css 정의)
 *
 * 색 기준:
 *  - 브론즈   = 실제 동색 (#CD7F32)
 *  - 실버     = 은색
 *  - 골드     = 금색
 *  - 플래티넘 = 라이엇/오버워치 등 일반적인 청록(teal/cyan)
 *  - 다이아   = 라이트 사이안 (다이아몬드 광채)
 *  - 마스터   = 보라
 *  - 그랜드마스터 = 마젠타+바이올렛 (Riot Grandmaster 풍)
 *  - 챌린저   = 골드+사이안 빛+글로우 (LoL Challenger 풍, 가장 화려)
 */
export const TIER_COLORS = {
  Bronze: {
    bg: 'from-amber-700/30 to-orange-900/30',
    bar: 'from-amber-700 to-amber-500',          // 게이지/큰 숫자 그라디언트 (alpha 없음)
    text: 'text-amber-600',
    border: 'border-amber-700/50',
  },
  Silver: {
    bg: 'from-slate-300/20 to-slate-500/20',
    bar: 'from-slate-400 to-slate-200',
    text: 'text-slate-300',
    border: 'border-slate-300/40',
  },
  Gold: {
    bg: 'from-yellow-400/25 to-amber-500/25',
    bar: 'from-yellow-500 to-amber-400',
    text: 'text-yellow-400',
    border: 'border-yellow-400/60',
  },
  Platinum: {
    bg: 'from-teal-400/20 to-cyan-500/25',
    bar: 'from-teal-400 to-cyan-400',
    text: 'text-teal-300',
    border: 'border-teal-400/55',
  },
  Diamond: {
    bg: 'from-sky-300/25 to-cyan-300/25',
    bar: 'from-sky-300 to-cyan-200',
    text: 'text-sky-200',
    border: 'border-sky-300/60',
    shadow: '0 0 10px rgba(125,211,252,0.30)',
  },
  Master: {
    bg: 'from-purple-600/25 to-violet-600/25',
    bar: 'from-purple-500 to-violet-400',
    text: 'text-purple-300',
    border: 'border-purple-500/60',
  },
  Grandmaster: {
    bg: 'from-fuchsia-500/25 via-pink-500/20 to-violet-600/25',
    bar: 'from-fuchsia-500 via-pink-400 to-violet-500',
    text: 'text-fuchsia-300',
    border: 'border-fuchsia-400/60',
    shadow: '0 0 12px rgba(232,121,249,0.35), 0 0 22px rgba(167,139,250,0.20)',
  },
  Challenger: {
    bg: 'from-amber-300/35 via-cyan-300/25 to-amber-300/35',
    bar: 'from-amber-300 via-cyan-200 to-amber-300',
    text: 'text-amber-200',
    border: 'border-amber-300/70',
    shadow: '0 0 18px rgba(252,211,77,0.55), 0 0 36px rgba(34,211,238,0.30), 0 0 4px rgba(255,255,255,0.5) inset',
    glowClass: 'tier-challenger-glow',
  },
};

/**
 * 티어 라벨 → 컬러 팔레트.
 *  ex) "Master II" → TIER_COLORS.Master, "Bronze III" → TIER_COLORS.Bronze
 *  알 수 없는 라벨은 Bronze 폴백.
 */
export function getTierColor(tierLabel = '') {
  const family = tierFamilyFromLabel(tierLabel);
  return TIER_COLORS[family] || TIER_COLORS.Bronze;
}

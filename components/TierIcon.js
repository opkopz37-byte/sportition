'use client';

/**
 * 티어별 컬러 메달 아이콘.
 * - 티어 라벨 → tier family 추출 ("Bronze III" → Bronze)
 * - 각 티어에 맞는 그라디언트 + 글로우 적용
 * - 안쪽에 티어 첫 글자 (B / S / G / P / D / M / GM / C)
 *
 * Props:
 *   tier: string — 티어 라벨 (예: "Bronze III", "Master II", "Challenger")
 *   size: number — 픽셀 크기 (default 28)
 *   className: 추가 클래스
 */

import { TIER_COLORS, tierFamilyFromLabel } from '@/lib/tierLadder';

// 티어별 SVG 그라디언트 정의 — id 가 페이지 안에서 충돌 안 나게 family 별로 고정
const TIER_GRADIENTS = {
  Bronze: { from: '#b45309', to: '#f59e0b' },        // amber-700 → amber-500
  Silver: { from: '#cbd5e1', to: '#f1f5f9' },        // slate-300 → slate-100
  Gold: { from: '#eab308', to: '#fbbf24' },          // yellow-500 → amber-400
  Platinum: { from: '#2dd4bf', to: '#22d3ee' },      // teal-400 → cyan-400
  Diamond: { from: '#7dd3fc', to: '#a5f3fc' },       // sky-300 → cyan-200
  Master: { from: '#a855f7', to: '#c4b5fd' },        // purple-500 → violet-300
  Grandmaster: { from: '#d946ef', to: '#a78bfa' },   // fuchsia-500 → violet-400
  Challenger: { from: '#fcd34d', to: '#67e8f9' },    // amber-300 → cyan-300
};

const TIER_LETTER = {
  Bronze: 'B',
  Silver: 'S',
  Gold: 'G',
  Platinum: 'P',
  Diamond: 'D',
  Master: 'M',
  Grandmaster: 'GM',
  Challenger: 'C',
};

export default function TierIcon({ tier, size = 28, className = '' }) {
  const family = tierFamilyFromLabel(tier || 'Bronze') || 'Bronze';
  const grad = TIER_GRADIENTS[family] || TIER_GRADIENTS.Bronze;
  const letter = TIER_LETTER[family] || '?';
  const palette = TIER_COLORS[family] || TIER_COLORS.Bronze;
  const gradId = `tier-grad-${family}`;
  const isHigh = family === 'Diamond' || family === 'Master' || family === 'Grandmaster' || family === 'Challenger';

  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        filter: palette.shadow ? `drop-shadow(${palette.shadow})` : undefined,
      }}
      aria-label={`${family} 티어`}
      title={tier}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={grad.from} />
            <stop offset="100%" stopColor={grad.to} />
          </linearGradient>
        </defs>
        {/* 메달/방패 — 부드러운 6각 형태 */}
        <path
          d="M16 2 L26 7 L26 17 C26 24 21 28.5 16 30 C11 28.5 6 24 6 17 L6 7 Z"
          fill={`url(#${gradId})`}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="0.6"
        />
        {/* 안쪽 빛 */}
        <path
          d="M16 4.5 L23.5 8.5 L23.5 16.5 C23.5 22 20 25.7 16 27 C12 25.7 8.5 22 8.5 16.5 L8.5 8.5 Z"
          fill="rgba(255,255,255,0.10)"
        />
        {/* 글자 — 티어 약자 */}
        <text
          x="16"
          y={letter.length > 1 ? 18.5 : 20}
          textAnchor="middle"
          fontSize={letter.length > 1 ? 9 : 13}
          fontWeight="900"
          fill={isHigh ? 'rgba(20,16,40,0.9)' : 'rgba(20,16,8,0.85)'}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {letter}
        </text>
      </svg>
    </span>
  );
}

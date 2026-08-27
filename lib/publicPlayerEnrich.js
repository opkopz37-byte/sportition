import { getTierLabelFromMatchPoints } from './tierLadder.js';

/** public_player_profiles 행에 랭크 점수·티어 라벨 부여 — API Route는 이 파일만 import (supabase.js 전체 로드 방지) */
export function enrichPublicPlayerRow(row) {
  if (!row) return null;
  if (row.role === 'gym') return row;
  const mp = Number(row.tier_points) || 0;
  return {
    ...row,
    match_points: mp,
    tier: getTierLabelFromMatchPoints(mp),
    tier_points: mp,
  };
}

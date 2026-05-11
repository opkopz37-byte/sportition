'use client';

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

/**
 * punch_type 8단계:
 *   common_straight | common_hook | common_upper | common_advanced  (각 탭 일반)
 *   straight        | hook        | upper        | advanced     (각 탭 전문)
 *
 * 진행 룰: 다음 탭은 이전 탭의 "일반(common_X)" 스킬을 모두 마스터하면 해금
 */
const PUNCH_TABS = [
  {
    key: 'straight', label: '스트레이트', accent: 'cyan',
    common: 'common_straight', specific: 'straight',
    requires: null,
    nextLabel: '훅 스킬 배우러 가기',     next: 'hook',
  },
  {
    key: 'hook', label: '훅', accent: 'orange',
    common: 'common_hook', specific: 'hook',
    requires: 'common_straight',
    nextLabel: '어퍼 스킬 배우러 가기',   next: 'upper',
  },
  {
    key: 'upper', label: '어퍼', accent: 'violet',
    common: 'common_upper', specific: 'upper',
    requires: 'common_hook',
    nextLabel: '심화 스킬 배우러 가기', next: 'advanced',
  },
  {
    key: 'advanced', label: '심화', accent: 'rose',
    common: 'common_advanced', specific: 'advanced',
    requires: 'common_upper',
    nextLabel: null, next: null,
  },
];

/** 잠금 메시지에 쓰이는 탭 이름 */
const REQUIRES_LABEL = {
  common_straight: '스트레이트',
  common_hook: '훅',
  common_upper: '어퍼',
  common_advanced: '심화',
};


const ACCENT_THEME = {
  cyan: {
    tabActive: 'bg-gradient-to-br from-cyan-500/30 to-blue-600/10 border-cyan-400/70 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.25)]',
    tierLabel: 'text-cyan-200/80',
    line: 'via-cyan-400/25',
    nodeUnlocked: 'border-cyan-400/55 hover:border-cyan-300/85',
    nodeSelected: 'from-cyan-500/30 to-cyan-700/15 border-cyan-300/85 shadow-[0_0_24px_rgba(34,211,238,0.4)]',
    expBar: 'from-cyan-400 to-cyan-300',
    miniBar: 'bg-cyan-400',
    panelBorder: 'border-cyan-400/40',
    panelGlow: 'from-cyan-500/10',
    button: 'from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 shadow-cyan-900/40',
    expLabel: 'text-cyan-200',
  },
  orange: {
    tabActive: 'bg-gradient-to-br from-orange-500/30 to-red-600/10 border-orange-400/70 text-orange-200 shadow-[0_0_24px_rgba(251,146,60,0.25)]',
    tierLabel: 'text-orange-200/80',
    line: 'via-orange-400/25',
    nodeUnlocked: 'border-orange-400/55 hover:border-orange-300/85',
    nodeSelected: 'from-orange-500/30 to-orange-700/15 border-orange-300/85 shadow-[0_0_24px_rgba(251,146,60,0.4)]',
    expBar: 'from-orange-400 to-orange-300',
    miniBar: 'bg-orange-400',
    panelBorder: 'border-orange-400/40',
    panelGlow: 'from-orange-500/10',
    button: 'from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 shadow-orange-900/40',
    expLabel: 'text-orange-200',
  },
  violet: {
    tabActive: 'bg-gradient-to-br from-violet-500/30 to-fuchsia-600/10 border-violet-400/70 text-violet-200 shadow-[0_0_24px_rgba(167,139,250,0.25)]',
    tierLabel: 'text-violet-200/80',
    line: 'via-violet-400/25',
    nodeUnlocked: 'border-violet-400/55 hover:border-violet-300/85',
    nodeSelected: 'from-violet-500/30 to-violet-700/15 border-violet-300/85 shadow-[0_0_24px_rgba(167,139,250,0.4)]',
    expBar: 'from-violet-400 to-violet-300',
    miniBar: 'bg-violet-400',
    panelBorder: 'border-violet-400/40',
    panelGlow: 'from-violet-500/10',
    button: 'from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 shadow-violet-900/40',
    expLabel: 'text-violet-200',
  },
  rose: {
    tabActive: 'bg-gradient-to-br from-rose-500/30 to-red-600/10 border-rose-400/70 text-rose-200 shadow-[0_0_24px_rgba(244,63,94,0.25)]',
    tierLabel: 'text-rose-200/80',
    line: 'via-rose-400/25',
    nodeUnlocked: 'border-rose-400/55 hover:border-rose-300/85',
    nodeSelected: 'from-rose-500/30 to-rose-700/15 border-rose-300/85 shadow-[0_0_24px_rgba(244,63,94,0.4)]',
    expBar: 'from-rose-400 to-rose-300',
    miniBar: 'bg-rose-400',
    panelBorder: 'border-rose-400/40',
    panelGlow: 'from-rose-500/10',
    button: 'from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-rose-900/40',
    expLabel: 'text-rose-200',
  },
};

const MAX_EXP = 5;

/** EXP 단계별 그라디언트 — 채워질수록 차가운 → 뜨거운 색으로 */
function getExpGradient(exp, themeBar) {
  if (exp >= 5) return 'bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300';
  if (exp >= 4) return 'bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300';
  if (exp >= 3) return 'bg-gradient-to-r from-pink-400 via-rose-400 to-orange-400';
  if (exp >= 2) return 'bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400';
  if (exp >= 1) return `bg-gradient-to-r ${themeBar}`;
  return '';
}

function nodeDisplayTitle(node) {
  if (!node) return '';
  const t = node.display_title;
  return t != null && String(t).trim() !== '' ? String(t).trim() : node.name;
}

function computeDepths(nodes) {
  const depth = new Map();
  depth.set(1, 0);
  for (let iter = 0; iter < nodes.length + 10; iter += 1) {
    let changed = false;
    for (const n of nodes) {
      const nodeNum = Number(n.node_number);
      if (nodeNum === 1) continue;
      const parents = getParentNumbers(n);
      if (!parents.length) continue;
      let maxP = -1;
      let missing = false;
      for (const p of parents) {
        const pd = depth.get(p);
        if (pd === undefined) { missing = true; break; }
        maxP = Math.max(maxP, pd);
      }
      if (missing) continue;
      const nd = maxP + 1;
      if (depth.get(nodeNum) !== nd) {
        depth.set(nodeNum, nd);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const n of nodes) {
    const nodeNum = Number(n.node_number);
    if (!depth.has(nodeNum)) depth.set(nodeNum, 1);
  }
  return depth;
}

/**
 * 노드 잠금 해제 조건:
 *   - 루트 노드 (부모 없음): 항상 열림
 *   - 그 외: 부모 중 1개 이상이 "승단 승인" 됐을 때만 열림
 *     → 단순히 부모가 5/5 마스터해도 부족. 체육관 승인이 떨어져야 다음 스킬 가능.
 *     거절되면 거절된 스킬까지만 열려 있고, 자식은 잠금 상태.
 */
function isUnlocked(node, nodeByNumber, promotionByNodeId) {
  const parents = getParentNumbers(node);
  if (!parents.length) return true;
  return parents.some((pNum) => {
    const p = nodeByNumber.get(pNum);
    if (!p) return false;
    return promotionByNodeId?.[p.id]?.status === 'approved';
  });
}

/** parent_nodes 의 각 값이 string 으로 들어왔을 수 있어서 number 로 강제 변환 */
function getParentNumbers(node) {
  const raw = node?.parent_nodes;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const v of raw) {
    const num = Number(v);
    if (Number.isFinite(num)) out.push(num);
  }
  return out;
}

/** 자식 매핑: parent_node_number(숫자) → [child node ...] (node_number 오름차순) */
function buildChildrenMap(nodes) {
  const map = new Map();
  for (const n of nodes) {
    for (const pNum of getParentNumbers(n)) {
      if (!map.has(pNum)) map.set(pNum, []);
      map.get(pNum).push(n);
    }
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => Number(a.node_number) - Number(b.node_number));
  }
  return map;
}

/**
 * 트리 레이아웃 — 메인 체인은 가로, 분기는 새 행(아래)으로 떨어짐
 * 각 노드에 (col, row) 좌표 부여
 */
function computeTreeLayout(nodes) {
  const childrenByNum = buildChildrenMap(nodes);
  // visibleNumbers 도 number 로 강제 (Supabase 직접 추가 시 string 가능성)
  const visibleNumbers = new Set(nodes.map((n) => Number(n.node_number)));
  const positions = new Map();
  let maxCol = 0;
  let maxRow = 0;
  let nextFreeRow = 0;

  function walk(node, col, row) {
    if (positions.has(node.id)) return;
    positions.set(node.id, { col, row });
    if (col > maxCol) maxCol = col;
    if (row > maxRow) maxRow = row;
    if (row > nextFreeRow) nextFreeRow = row;

    const children = childrenByNum.get(Number(node.node_number)) || [];
    if (!children.length) return;

    walk(children[0], col + 1, row);
    for (let i = 1; i < children.length; i += 1) {
      nextFreeRow += 1;
      walk(children[i], col + 1, nextFreeRow);
    }
  }

  // 1) 진짜 루트 (부모 없음) — 보통 잽
  const realRoots = nodes.filter((n) => getParentNumbers(n).length === 0);
  for (const r of realRoots) {
    if (positions.has(r.id)) continue;
    if (positions.size > 0) nextFreeRow += 1;
    walk(r, 0, nextFreeRow);
  }

  // 2) common_X 고아 — row 0 가로 체인으로 배치
  const commonOrphans = nodes
    .filter((n) => {
      if (positions.has(n.id)) return false;
      const pt = n.punch_type;
      const isCommonNode = typeof pt === 'string' && pt.startsWith('common');
      if (!isCommonNode) return false;
      const parents = getParentNumbers(n);
      return parents.length === 0 || parents.every((p) => !visibleNumbers.has(p));
    })
    .sort((a, b) => Number(a.node_number) - Number(b.node_number));

  let row0LastCol = -1;
  for (const p of positions.values()) {
    if (p.row === 0 && p.col > row0LastCol) row0LastCol = p.col;
  }
  let curCol = row0LastCol + 1;
  for (const n of commonOrphans) {
    if (positions.has(n.id)) continue;
    // walk() 으로 처리하면 chain 형태의 common 자식들도 자연스럽게 row 0 으로 이어짐
    // (스트레이트 탭의 잽→common_straight 체인과 동일한 동작)
    walk(n, curCol, 0);
    // walk 후 row 0 의 가장 오른쪽 col 을 다시 찾아 다음 orphan 시작점 갱신
    let lastCol = curCol;
    for (const p of positions.values()) {
      if (p.row === 0 && p.col > lastCol) lastCol = p.col;
    }
    curCol = lastCol + 1;
  }

  // 3) 일반 고아 (common 아닌 노드) — 별도 row 로
  const otherOrphans = nodes.filter((n) => {
    if (positions.has(n.id)) return false;
    const parents = getParentNumbers(n);
    if (parents.length === 0) return false;
    return parents.every((p) => !visibleNumbers.has(p));
  });
  otherOrphans.sort((a, b) => Number(a.node_number) - Number(b.node_number));
  for (const o of otherOrphans) {
    if (positions.has(o.id)) continue;
    nextFreeRow += 1;
    walk(o, 0, nextFreeRow);
  }

  // 4) 안전망: 그래도 미배치된 노드
  for (const n of nodes) {
    if (positions.has(n.id)) continue;
    nextFreeRow += 1;
    walk(n, 0, nextFreeRow);
  }

  return { positions, maxCol, maxRow, childrenByNum };
}

/**
 * 형제 분기 락 — 같은 부모를 둔 형제 중 누군가 진행중(0<exp<5)이면 다른 형제는 잠금
 * 마스터(5/5)된 형제는 락에 영향 안 줌 → 다 끝내야 다른 분기 시작 가능
 */
function computeSiblingLockSet(nodes, expByNodeId, childrenByNum) {
  const locked = new Set();
  for (const n of nodes) {
    const parents = getParentNumbers(n);
    if (!parents.length) continue;
    const myExp = expByNodeId.get(n.id) || 0;
    if (myExp > 0) continue; // 이미 시작했으면 락 대상 아님
    let lockedByAny = false;
    for (const pNum of parents) {
      const siblings = childrenByNum.get(Number(pNum)) || [];
      if (siblings.length < 2) continue;
      for (const sib of siblings) {
        if (sib.id === n.id) continue;
        const sExp = expByNodeId.get(sib.id) || 0;
        if (sExp > 0 && sExp < 5) {
          lockedByAny = true;
          break;
        }
      }
      if (lockedByAny) break;
    }
    if (lockedByAny) locked.add(n.id);
  }
  return locked;
}

/** SVG 연결선 한 줄 — 부모→자식 1쌍 */
const ConnectorPath = memo(function ConnectorPath({
  parentPos, childPos,
  cardW, cardH, colGap, rowGap,
  state, // 'chain' | 'pulse' | 'alive' | 'locked' | 'dormant'
  themeAccent,
}) {
  const px = parentPos.col * (cardW + colGap) + cardW / 2;
  const py = parentPos.row * (cardH + rowGap) + cardH / 2;
  const cx = childPos.col * (cardW + colGap) + cardW / 2;
  const cy = childPos.row * (cardH + rowGap) + cardH / 2;
  const sameRow = parentPos.row === childPos.row;

  // 경로 정의
  let d;
  let arrowAt;
  if (sameRow) {
    const sx = px + cardW / 2;
    const ex = cx - cardW / 2;
    d = `M ${sx} ${py} L ${ex} ${cy}`;
    arrowAt = { x: ex, y: cy, dir: 'right' };
  } else {
    // L-자 분기: 부모 오른쪽 모서리 → 중간점에서 꺾어 아래 → 자식 왼쪽
    const sx = px + cardW / 2;
    const turnX = sx + colGap / 2;
    const ex = cx - cardW / 2;
    d = `M ${sx} ${py} L ${turnX} ${py} L ${turnX} ${cy} L ${ex} ${cy}`;
    arrowAt = { x: ex, y: cy, dir: 'right' };
  }

  // 색상·애니메이션
  let stroke = 'rgba(255,255,255,0.12)';
  let arrowFill = 'rgba(255,255,255,0.12)';
  let extraClass = '';

  if (state === 'chain') {
    stroke = 'rgba(252,211,77,0.95)';
    arrowFill = 'rgba(252,211,77,0.95)';
    extraClass = 'drop-shadow-[0_0_4px_rgba(252,211,77,0.7)]';
  } else if (state === 'pulse') {
    const colorMap = {
      cyan: 'rgba(34,211,238,0.85)',
      orange: 'rgba(251,146,60,0.85)',
      violet: 'rgba(167,139,250,0.85)',
    };
    stroke = colorMap[themeAccent] || 'rgba(255,255,255,0.6)';
    arrowFill = stroke;
    extraClass = 'chain-arrow-pulse';
  } else if (state === 'alive') {
    const colorMap = {
      cyan: 'rgba(34,211,238,0.6)',
      orange: 'rgba(251,146,60,0.6)',
      violet: 'rgba(167,139,250,0.6)',
    };
    stroke = colorMap[themeAccent] || 'rgba(255,255,255,0.4)';
    arrowFill = stroke;
  } else if (state === 'locked') {
    stroke = 'rgba(248,113,113,0.35)';
    arrowFill = 'rgba(248,113,113,0.35)';
  }

  // 화살표 머리 (삼각형) — 끝 지점에서 살짝 안쪽으로 들여와서 카드와 안 겹치게
  const ah = arrowAt;
  const arrowSize = 6;
  const arrowPath =
    ah.dir === 'right'
      ? `M ${ah.x} ${ah.y} L ${ah.x - arrowSize} ${ah.y - arrowSize / 1.4} L ${ah.x - arrowSize} ${ah.y + arrowSize / 1.4} Z`
      : '';

  return (
    <g className={extraClass}>
      <path
        d={d}
        stroke={stroke}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={state === 'pulse' ? 'chain-flow' : ''}
      />
      <path d={arrowPath} fill={arrowFill} stroke="none" />
    </g>
  );
});

/** 16방향 스파크 버스트 — 스킬 찍었을 때 카드 위에 오버레이 (크고 화려) */
const SkillBurst = memo(function SkillBurst({ mastered }) {
  // 16방향 스파크 — 가까운 8개 + 먼 8개
  const sparks = [];
  const inner = 60;
  const outer = 95;
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4;
    sparks.push({ sx: `${Math.cos(a) * inner}px`, sy: `${Math.sin(a) * inner}px`, delay: 0 });
  }
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    sparks.push({ sx: `${Math.cos(a) * outer}px`, sy: `${Math.sin(a) * outer}px`, delay: 0.05 });
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {/* 중앙 플래시 — 크게 */}
      <div
        className={`skill-burst-flash absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-24 sm:h-24 rounded-full ${
          mastered
            ? 'bg-[radial-gradient(circle,rgba(255,255,255,1)_0%,rgba(254,243,199,0.95)_25%,rgba(251,191,36,0.7)_55%,transparent_85%)]'
            : 'bg-[radial-gradient(circle,rgba(255,255,255,1)_0%,rgba(224,242,254,0.95)_25%,rgba(56,189,248,0.6)_55%,transparent_85%)]'
        }`}
      />
      {/* 외곽 충격 링 — 얇게 */}
      <div
        className={`skill-burst-ring absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 ${
          mastered ? 'border-amber-300/85' : 'border-white/70'
        }`}
      />
      {/* 16방향 스파크 */}
      {sparks.map((s, i) => (
        <span
          key={i}
          className="skill-spark"
          style={{ '--sx': s.sx, '--sy': s.sy, animationDelay: `${s.delay + i * 0.012}s` }}
        />
      ))}
      {/* 상승 텍스트 — 크고 굵게 */}
      <span
        className={`skill-popup absolute top-1 left-1/2 text-base sm:text-lg font-black tracking-wide whitespace-nowrap ${
          mastered ? 'text-amber-200 drop-shadow-[0_0_14px_rgba(251,191,36,1)]' : 'text-white drop-shadow-[0_0_14px_rgba(255,255,255,1)]'
        }`}
      >
        {mastered ? '★ MASTER!' : '+1 EXP'}
      </span>
    </div>
  );
});

/** 카드 색 팔레트 — 모듈 레벨 (재생성 방지) */
const CARD_TAB_PALETTE = {
  cyan:   { p: '34,211,238', s: '14,165,233' },
  orange: { p: '251,146,60', s: '249,115,22' },
  violet: { p: '167,139,250', s: '139,92,246' },
  rose:   { p: '244,63,94',  s: '225,29,72' },
};
const CARD_ZONE_PALETTE = {
  infighter: { p: '239,68,68',  s: '220,38,38' }, // red
  outboxer:  { p: '59,130,246', s: '37,99,235' }, // blue
};
const CARD_ZONE_LABEL = {
  infighter: '인파이팅',
  outboxer: '아웃복싱',
};

/** 노드 카드 — 트렌디 디자인 (그라디언트 보더 + 메시 배경 + 도트 텍스처) */
const SkillNodeCard = memo(function SkillNodeCard({ node, exp, unlocked, selected, dimmed, burst, burstKey, onSelect, themeAccent, softLocked }) {
  const mastered = exp >= MAX_EXP;
  const inProgress = exp > 0 && exp < MAX_EXP;
  const isCommon = typeof node?.punch_type === 'string' && node.punch_type.startsWith('common');
  // 다른 스킬 진행 중 차단 — 마스터/진행중 본인은 예외
  const isSoftLocked = softLocked && !mastered && !inProgress;
  const clickable = unlocked && !isSoftLocked;

  const zonePalette = CARD_ZONE_PALETTE[node?.zone];
  const palette = zonePalette || CARD_TAB_PALETTE[themeAccent] || CARD_TAB_PALETTE.cyan;
  const zoneLabel = CARD_ZONE_LABEL[node?.zone] || null;

  // 상태별 디자인 토큰
  let bgGradient;
  let borderGradient;
  let outerShadow = '';
  let textColor = '#ffffff';
  let progressColor = '';
  let numberColor = '#ffffff';
  let numberShadow = '';
  let isDashedBorder = false;

  if (mastered) {
    bgGradient = 'radial-gradient(ellipse at 25% 0%, rgba(251,191,36,0.55) 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(245,158,11,0.35) 0%, transparent 65%), linear-gradient(135deg, rgba(120,53,15,0.55), rgba(28,12,3,0.88))';
    borderGradient = 'linear-gradient(135deg, #fde047 0%, #fbbf24 35%, #f59e0b 70%, #fde047 100%)';
    outerShadow = '0 0 22px rgba(251,191,36,0.4), 0 0 44px rgba(251,191,36,0.14)';
    textColor = '#fef3c7';
    progressColor = 'linear-gradient(to right, #fbbf24, #fde047, #fbbf24)';
    numberColor = '#fde047';
    numberShadow = '0 0 6px rgba(251,191,36,0.6)';
  } else if (selected) {
    bgGradient = `radial-gradient(ellipse at 25% 0%, rgba(${palette.p},0.58) 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(${palette.s},0.4) 0%, transparent 65%), linear-gradient(135deg, rgba(15,23,42,0.55), rgba(2,6,23,0.88))`;
    borderGradient = `linear-gradient(135deg, rgba(${palette.p},1) 0%, rgba(255,255,255,0.7) 50%, rgba(${palette.p},1) 100%)`;
    outerShadow = `0 0 26px rgba(${palette.p},0.55), 0 0 56px rgba(${palette.p},0.18)`;
    progressColor = `linear-gradient(to right, rgba(${palette.p},1), rgba(${palette.s},1))`;
  } else if (unlocked) {
    if (isCommon) {
      bgGradient = 'radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.18) 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(255,255,255,0.06) 0%, transparent 60%), linear-gradient(135deg, rgba(15,23,42,0.65), rgba(2,6,23,0.82))';
      borderGradient = 'transparent';
      outerShadow = 'inset 0 1px 0 rgba(255,255,255,0.14)';
      textColor = 'rgba(255,255,255,0.95)';
      progressColor = 'linear-gradient(to right, rgba(255,255,255,0.85), rgba(255,255,255,0.6))';
      isDashedBorder = true;
    } else {
      bgGradient = `radial-gradient(ellipse at 25% 0%, rgba(${palette.p},0.42) 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(${palette.s},0.22) 0%, transparent 65%), linear-gradient(135deg, rgba(15,23,42,0.6), rgba(2,6,23,0.85))`;
      borderGradient = `linear-gradient(135deg, rgba(${palette.p},0.95) 0%, rgba(${palette.s},0.55) 50%, rgba(${palette.p},0.85) 100%)`;
      outerShadow = `0 0 14px rgba(${palette.p},0.28), inset 0 1px 0 rgba(255,255,255,0.1)`;
      progressColor = `linear-gradient(to right, rgba(${palette.p},1), rgba(${palette.s},1))`;
    }
  } else {
    bgGradient = 'linear-gradient(135deg, rgba(15,23,42,0.88), rgba(2,6,23,0.96))';
    borderGradient = 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))';
    outerShadow = '';
    textColor = '#475569';
    numberColor = '#475569';
  }

  const ringClass = selected ? 'ring-2 ring-white/30 ring-offset-2 ring-offset-slate-950' : '';
  const dimClass = dimmed && !selected ? 'opacity-25 saturate-50' : '';
  const lockedOpacity = !unlocked && !mastered ? 'opacity-60' : '';
  const softLockClass = isSoftLocked ? 'opacity-40 saturate-[0.6]' : '';
  const punchClass = burst ? 'skill-card-punch' : '';
  // 찍을 수 있는 상태 — 잠금 해제 + 마스터 아님 + 다른 스킬 진행중도 아님
  // (선택된/burst 중에는 효과 충돌 방지를 위해 잠시 끔)
  const isPickable = clickable && !mastered && !selected && !burst;
  const pickableGlowClass = isPickable ? 'skill-pickable-glow' : '';

  return (
    <button
      type="button"
      onClick={() => clickable && onSelect(node.id)}
      disabled={!clickable}
      data-skill-interactive
      title={node?.name || ''}
      aria-label={node?.name || ''}
      className={`group relative shrink-0 w-[94px] h-[64px] sm:w-[114px] sm:h-[74px] rounded-xl transition-all duration-200 ease-out ${ringClass} ${dimClass} ${lockedOpacity} ${softLockClass} ${punchClass} ${pickableGlowClass} ${
        clickable ? 'cursor-pointer hover:scale-[1.06] hover:-translate-y-0.5 active:scale-[1.02]' : 'cursor-not-allowed'
      }`}
      // 각 카드도 자체 GPU 레이어로 격리 — 한 카드의 burst/punch 애니메이션이
      // 인접 카드 paint 를 트리거하지 않게 (스킬 찍은 후 깜빡임의 핵심)
      style={{
        boxShadow: outerShadow,
        contain: 'layout paint',
        transform: 'translateZ(0)',
      }}
    >
      {/* 그라디언트 보더 (1.5px) — 또는 점선 (common) */}
      {isDashedBorder ? (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ border: '1.5px dashed rgba(255,255,255,0.4)' }}
          aria-hidden
        />
      ) : (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: borderGradient,
            padding: '1.5px',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
          aria-hidden
        />
      )}

      {/* 메시 그라디언트 배경 (보더 안쪽) */}
      <div
        className="absolute inset-[1.5px] rounded-[10px] overflow-hidden"
        style={{ background: bgGradient }}
        aria-hidden
      >
        {/* 도트 텍스처 — 미세 텍스처감 */}
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 0.5px, transparent 1px)',
            backgroundSize: '6px 6px',
          }}
        />
        {/* 상단 하이라이트 라인 */}
        <div className="absolute top-0 inset-x-2 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
        {/* 찍을 수 있는 노드 — 대각선 반짝임 스윕 */}
        {isPickable ? <div className="skill-pickable-shine" aria-hidden /> : null}
        {/* 찍을 수 있는 노드 — 좌상단/우하단 별빛 점 */}
        {isPickable ? (
          <>
            <span
              className="skill-pickable-twinkle absolute top-[3px] left-[3px] w-[3px] h-[3px] rounded-full bg-white"
              style={{ boxShadow: '0 0 6px rgba(255,255,255,0.95), 0 0 12px rgba(255,255,255,0.55)' }}
              aria-hidden
            />
            <span
              className="skill-pickable-twinkle absolute bottom-[5px] right-[5px] w-[2px] h-[2px] rounded-full bg-white"
              style={{ boxShadow: '0 0 5px rgba(255,255,255,0.85)', animationDelay: '0.6s' }}
              aria-hidden
            />
          </>
        ) : null}
      </div>

      {/* 하단 진행 라인 (보더 안쪽) */}
      {(inProgress || mastered) ? (
        <div className="absolute bottom-[1.5px] left-[1.5px] right-[1.5px] h-[2px] rounded-b-[10px] overflow-hidden bg-black/50">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${Math.min(100, (exp / MAX_EXP) * 100)}%`, background: progressColor }}
          />
        </div>
      ) : null}

      {/* 마스터 — 좌상단 별 */}
      {mastered ? (
        <span
          className="absolute top-1.5 left-2 text-[10px] leading-none drop-shadow-[0_0_5px_rgba(251,191,36,0.9)] z-10"
          style={{ color: '#fde047' }}
          aria-hidden
        >★</span>
      ) : null}

      {/* zone 라벨 — 우상단 (인파이팅 / 아웃복싱만) */}
      {zoneLabel ? (
        <span
          className="absolute top-1 right-1.5 text-[7px] sm:text-[8px] font-bold tracking-wider leading-none px-1 py-0.5 rounded-[3px] bg-black/40 backdrop-blur-sm z-[3]"
          style={{ color: `rgba(${palette.p},0.95)` }}
          aria-hidden
        >
          {zoneLabel}
        </span>
      ) : null}

      {/* style 라벨 — 좌상단 (style_tag 가 있을 때만, ★ 마스터 마크 자리에 양보) */}
      {!mastered && node?.style_tag ? (
        <span
          className="absolute top-1 left-1.5 text-[7px] sm:text-[8px] font-bold tracking-wider leading-none px-1 py-0.5 rounded-[3px] bg-white/10 backdrop-blur-sm z-[3] max-w-[58%] truncate"
          style={{ color: 'rgba(255,255,255,0.8)' }}
          aria-hidden
        >
          {node.style_tag}
        </span>
      ) : null}

      {/* 이름 — 정중앙. 글자수에 따라 폰트 자동 축소: 13자↑ → 한 단계 작게, 17자↑ → 두 단계 작게 */}
      {(() => {
        const title = nodeDisplayTitle(node);
        const len = (title || '').length;
        const sizeClass =
          len >= 17 ? 'text-[9px] sm:text-[10.5px] tracking-[-0.02em]'
          : len >= 13 ? 'text-[10px] sm:text-[11.5px] tracking-[-0.015em]'
          : 'text-[11px] sm:text-[12.5px] tracking-[-0.01em]';
        return (
          <div className="absolute inset-x-0 top-0 bottom-[14px] flex items-center justify-center px-2 pt-2 z-[2]">
            <span
              className={`font-bold leading-[1.12] text-center line-clamp-2 ${sizeClass}`}
              style={{ color: textColor }}
            >
              {title}
            </span>
          </div>
        );
      })()}

      {/* 숫자 — 우하단 게임 카운터 */}
      <div className="absolute bottom-[3px] right-2 flex items-baseline gap-[1px] leading-none z-[2]">
        <span
          className="text-[13px] sm:text-[14px] tabular-nums font-black"
          style={{ color: numberColor, textShadow: numberShadow }}
        >
          {exp}
        </span>
        <span
          className="text-[8px] sm:text-[9px] tabular-nums font-bold"
          style={{ color: mastered ? 'rgba(253,224,71,0.55)' : 'rgba(255,255,255,0.4)' }}
        >
          /{MAX_EXP}
        </span>
      </div>

      {/* 잠금 — 중앙 ✕ */}
      {!unlocked && !mastered ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]" aria-hidden>
          <div className="relative w-5 h-5 sm:w-6 sm:h-6 -translate-y-1.5">
            <span className="absolute top-1/2 left-1/2 w-full h-[1.5px] bg-white/30 rounded-full -translate-x-1/2 -translate-y-1/2 rotate-45" />
            <span className="absolute top-1/2 left-1/2 w-full h-[1.5px] bg-white/30 rounded-full -translate-x-1/2 -translate-y-1/2 -rotate-45" />
          </div>
        </div>
      ) : null}

      {burst ? <SkillBurst key={burstKey} mastered={mastered} /> : null}
    </button>
  );
});

/** 탭 해금 시네마틱 — 긴장 빌드업 → 흔들림 → BANG → 글래스 모달 */
function UnlockCelebration({ tab, onDone }) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!tab) return undefined;
    setShowModal(false);
    // 폭발 직후(약 3.0s) 모달 등장
    const t = setTimeout(() => setShowModal(true), 3100);
    return () => clearTimeout(t);
  }, [tab]);

  if (!tab) return null;

  const accentMap = {
    cyan:   { core: '#67e8f9', wave: 'rgba(34,211,238,0.85)',  glow: 'rgba(103,232,249,0.95)', border: 'border-cyan-300/60',   ring: 'ring-cyan-400/40',   bg: 'from-cyan-500/15 to-blue-700/10',     text: 'text-cyan-200',   divider: 'rgba(165,243,252,0.7)' },
    orange: { core: '#fdba74', wave: 'rgba(251,146,60,0.85)',  glow: 'rgba(253,186,116,0.95)', border: 'border-orange-300/60', ring: 'ring-orange-400/40', bg: 'from-orange-500/15 to-red-700/10',    text: 'text-orange-200', divider: 'rgba(254,215,170,0.7)' },
    violet: { core: '#c4b5fd', wave: 'rgba(167,139,250,0.85)', glow: 'rgba(196,181,253,0.95)', border: 'border-violet-300/60', ring: 'ring-violet-400/40', bg: 'from-violet-500/15 to-fuchsia-700/10', text: 'text-violet-200', divider: 'rgba(221,214,254,0.7)' },
    rose:   { core: '#fda4af', wave: 'rgba(244,63,94,0.85)',   glow: 'rgba(253,164,175,0.95)', border: 'border-rose-300/60',   ring: 'ring-rose-400/40',   bg: 'from-rose-500/15 to-red-700/10',      text: 'text-rose-200',   divider: 'rgba(254,205,211,0.7)' },
  };
  const accent = accentMap[tab.accent] || accentMap.cyan;
  const rays = Array.from({ length: 16 }, (_, i) => i * (360 / 16));

  // 빨려들어가는 입자 16개 (긴장 빌드업)
  const particles = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const dist = 240 + (i % 4) * 70;
    return { px: `${Math.cos(a) * dist}px`, py: `${Math.sin(a) * dist}px`, delay: `${(i % 5) * 0.1}s` };
  });

  // 부유 입자 24개 — 화면 곳곳에서 천천히 떠오름 (분위기)
  const floats = Array.from({ length: 24 }, (_, i) => {
    const seed = (i * 37) % 100;
    return {
      left: `${(seed * 1.3) % 100}%`,
      top: `${50 + (seed % 50)}%`,
      ox: `${((seed * 7) % 30) - 15}px`,
      fx: `${((seed * 11) % 80) - 40}px`,
      fy: `-${180 + (seed % 80)}px`,
      delay: `${(i * 0.08) % 2}s`,
      size: 2 + (i % 3),
    };
  });

  // 반짝임 18개 — 화면 곳곳에서 깜빡
  const sparkles = Array.from({ length: 18 }, (_, i) => {
    const seed = (i * 53) % 100;
    return {
      left: `${(seed * 1.6) % 100}%`,
      top: `${(seed * 0.9) % 100}%`,
      delay: `${(i * 0.15) % 2.4}s`,
      size: 3 + (i % 4),
    };
  });

  // 별가루 30개 — 폭발 후 흩어짐
  const confetti = Array.from({ length: 30 }, (_, i) => {
    const a = (i / 30) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 200 + Math.random() * 280;
    return {
      cx: `${Math.cos(a) * dist}px`,
      cy: `${Math.sin(a) * dist}px`,
      cr: `${Math.random() * 720 - 360}deg`,
      delay: `${Math.random() * 0.3}s`,
    };
  });

  const handleBgClick = (e) => {
    if (e.target === e.currentTarget) onDone?.();
  };

  return (
    <div
      className="unlock-overlay-fade fixed top-0 left-0 right-0 z-[300] overflow-hidden cursor-pointer"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
      role="dialog"
      aria-modal="true"
      onClick={handleBgClick}
    >
      {/* 1) 배경 페이드 + 블러 빌드업 (검은색으로 부드럽게) */}
      <div className="unlock-bg-build absolute inset-0 pointer-events-none" aria-hidden />

      {/* ⭐ 모달 등장 시점에 화면을 솔리드 어둡게 깔아서 뒤의 charging-core/입자 잔상 모두 가림 */}
      {showModal ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
          aria-hidden
        />
      ) : null}

      {/* 2) 비네트 (가장자리 어둡게) — 모달 표시 시엔 숨김 */}
      {!showModal ? (
        <div className="unlock-vignette absolute inset-0 pointer-events-none" aria-hidden />
      ) : null}

      {/* 1.5) 분위기 부유 입자 — 모달 표시 시엔 숨김 (잔상 차단) */}
      {!showModal && floats.map((f, i) => (
        <span
          key={`float-${i}`}
          className="unlock-float-particle absolute rounded-full pointer-events-none"
          style={{
            left: f.left,
            top: f.top,
            width: `${f.size}px`,
            height: `${f.size}px`,
            '--ox': f.ox,
            '--fx': f.fx,
            '--fy': f.fy,
            animationDelay: f.delay,
            background: accent.glow,
            boxShadow: `0 0 ${f.size * 2}px ${accent.glow}`,
          }}
          aria-hidden
        />
      ))}

      {/* 1.7) 반짝임 — 모달 표시 시엔 숨김 */}
      {!showModal && sparkles.map((s, i) => (
        <span
          key={`sparkle-${i}`}
          className="unlock-sparkle absolute rounded-full pointer-events-none"
          style={{
            left: s.left,
            top: s.top,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: s.delay,
            background: 'radial-gradient(circle, white 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
            boxShadow: `0 0 ${s.size * 3}px rgba(255,255,255,0.9)`,
          }}
          aria-hidden
        />
      ))}

      {/* 흔들림 wrapper — 모든 폭발 요소를 감싸 흔들림 적용 */}
      {/* 흔들림 wrapper — 모든 폭발 요소 (charging-core/bang/광선/충격파/플래시/별가루)
          모달 등장 시점부터는 통째로 unmount → 잔상 0 */}
      {!showModal ? (
      <div className="unlock-shake absolute inset-0 pointer-events-none" aria-hidden>
        {/* 3) 빨려들어가는 입자 */}
        {particles.map((p, i) => (
          <span
            key={i}
            className="unlock-particle absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full"
            style={{
              '--px': p.px,
              '--py': p.py,
              animationDelay: p.delay,
              background: accent.glow,
              boxShadow: `0 0 8px ${accent.glow}`,
            }}
          />
        ))}

        {/* 4) 충전 코어 (긴장 — 호흡하며 점점 빛남) */}
        <div
          className="unlock-charging-core absolute top-1/2 left-1/2 w-40 h-40 sm:w-52 sm:h-52 rounded-full"
          style={{
            '--glow': accent.glow,
            background: `radial-gradient(circle, #ffffff 0%, ${accent.core} 28%, ${accent.wave} 60%, transparent 82%)`,
          }}
        />

        {/* 5) BANG 광선 16방향 */}
        {rays.map((deg) => (
          <span
            key={deg}
            className="unlock-bang-ray absolute top-1/2 left-1/2 w-2 sm:w-3 h-[180vmax] rounded-full"
            style={{
              '--rd': `${deg}deg`,
              background: `linear-gradient(to top, transparent 4%, ${accent.wave} 45%, rgba(255,255,255,1) 60%, ${accent.wave} 75%, transparent 96%)`,
            }}
          />
        ))}

        {/* 6) BANG 충격파 — 3겹 시간차 */}
        <div
          className="unlock-bang-shock absolute top-1/2 left-1/2 w-40 h-40 sm:w-48 sm:h-48 rounded-full border-[6px]"
          style={{ borderColor: accent.wave }}
        />
        <div
          className="unlock-bang-shock absolute top-1/2 left-1/2 w-40 h-40 sm:w-48 sm:h-48 rounded-full border-[3px]"
          style={{ borderColor: 'rgba(255,255,255,0.9)', animationDelay: '2.85s' }}
        />
        <div
          className="unlock-bang-shock absolute top-1/2 left-1/2 w-40 h-40 sm:w-48 sm:h-48 rounded-full border-2"
          style={{ borderColor: accent.wave, animationDelay: '3.0s' }}
        />

        {/* 7) BANG 폭발 코어 */}
        <div
          className="unlock-bang-core absolute top-1/2 left-1/2 w-40 h-40 sm:w-52 sm:h-52 rounded-full"
          style={{
            background: `radial-gradient(circle, #ffffff 0%, ${accent.core} 25%, ${accent.wave} 55%, transparent 80%)`,
          }}
        />

        {/* 8) 흰 플래시 */}
        <div className="unlock-bang-flash absolute inset-0 bg-white" />

        {/* 8.5) 별가루 — 폭발 후 사방으로 흩어짐 */}
        {confetti.map((c, i) => (
          <span
            key={`confetti-${i}`}
            className="unlock-confetti absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-sm"
            style={{
              '--cx': c.cx,
              '--cy': c.cy,
              '--cr': c.cr,
              animationDelay: `calc(2.9s + ${c.delay})`,
              background: i % 3 === 0 ? '#ffffff' : accent.core,
              boxShadow: `0 0 6px ${accent.glow}`,
            }}
            aria-hidden
          />
        ))}
      </div>
      ) : null}

      {/* 9) 글래스 모달 — 폭발 후 등장. 화면 정중앙, 사용자가 닫을 때까지 유지 */}
      {showModal ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
          <div
            className={`unlock-modal-in pointer-events-auto relative w-full max-w-[min(92vw,420px)] max-h-[80dvh] overflow-y-auto rounded-3xl border-2 ${accent.border} backdrop-blur-2xl shadow-[0_0_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] ring-4 ${accent.ring} cursor-default`}
            style={{ background: `linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onDone}
              aria-label="닫기"
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white transition-all text-base font-light"
            >
              ✕
            </button>
            <div
              className="absolute -inset-1 opacity-50 pointer-events-none"
              style={{ background: `radial-gradient(circle at 30% 20%, ${accent.glow}, transparent 60%)` }}
              aria-hidden
            />
            <div className="relative px-7 pt-10 pb-8 text-center">
              <p className={`text-[11px] sm:text-xs font-black tracking-[0.55em] uppercase ${accent.text} drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]`}>
                UNLOCKED
              </p>
              <h2 className="text-4xl sm:text-5xl font-black text-white mt-3 drop-shadow-[0_0_24px_rgba(255,255,255,0.6)] tracking-tight">
                축하합니다
              </h2>
              <div
                className="mx-auto mt-5 h-px w-16 opacity-60"
                style={{ background: `linear-gradient(to right, transparent, ${accent.divider}, transparent)` }}
                aria-hidden
              />
              <p className={`text-lg sm:text-xl font-bold mt-5 ${accent.text}`}>
                {tab.label} 스킬이
              </p>
              <p className={`text-lg sm:text-xl font-bold ${accent.text}`}>
                오픈되었습니다
              </p>
              <p className="text-[11px] text-white/35 mt-7 tracking-wider">
                X 또는 배경을 눌러 닫기
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 카테고리 라벨 — punch_type 8단계 + 레거시 'common' */
const PUNCH_LABEL = {
  common: '공통·기본기',
  common_straight: '스트레이트 일반',
  common_hook: '훅 일반',
  common_upper: '어퍼 일반',
  common_advanced: '심화 일반',
  straight: '스트레이트 전문',
  hook: '훅 전문',
  upper: '어퍼 전문',
  advanced: '심화 전문',
};
const PUNCH_COLOR = {
  common: 'text-slate-200 border-slate-300/40 bg-slate-500/15',
  common_straight: 'text-slate-200 border-slate-300/40 bg-slate-500/15',
  common_hook: 'text-slate-200 border-slate-300/40 bg-slate-500/15',
  common_upper: 'text-slate-200 border-slate-300/40 bg-slate-500/15',
  common_advanced: 'text-slate-200 border-slate-300/40 bg-slate-500/15',
  straight: 'text-cyan-200 border-cyan-400/30 bg-cyan-500/10',
  hook: 'text-orange-200 border-orange-400/30 bg-orange-500/10',
  upper: 'text-violet-200 border-violet-400/30 bg-violet-500/10',
  advanced: 'text-rose-200 border-rose-400/30 bg-rose-500/10',
};
const PUNCH_GROUP_ORDER = [
  'common', 'common_straight', 'straight',
  'common_hook', 'hook',
  'common_upper', 'upper',
  'common_advanced', 'advanced',
];

/** 스킬 요약 페이지 뷰 — 카테고리별 세로 리스트, 게임 카드 형태 */
function SkillSummaryPage({ nodes, expByNodeId, onBack }) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeExp = expByNodeId instanceof Map ? expByNodeId : new Map();
  const sorted = [...safeNodes].sort((a, b) => (Number(a?.node_number) || 0) - (Number(b?.node_number) || 0));
  const totalExp = sorted.reduce((s, n) => s + (safeExp.get(n.id) || 0), 0);
  const masteredCount = sorted.filter((n) => (safeExp.get(n.id) || 0) >= MAX_EXP).length;
  const startedCount = sorted.filter((n) => (safeExp.get(n.id) || 0) > 0).length;

  // 카테고리별로 묶기
  const groups = PUNCH_GROUP_ORDER
    .map((key) => ({ key, nodes: sorted.filter((n) => (n?.punch_type || 'common') === key) }))
    .filter((g) => g.nodes.length > 0);

  // ── 성향 분석 — 찍은 스킬들의 EXP 가중 합으로 펀치 타입/존 비율 산출 ──
  // EXP 1~5 그대로 가중치로 사용 → 같은 노드라도 더 많이 찍을수록 비중 ↑
  const punchWeights = { straight: 0, hook: 0, upper: 0, advanced: 0 };
  const zoneWeights = { infighter: 0, outboxer: 0 };
  let totalPunchWeight = 0;
  let totalZoneWeight = 0;
  for (const n of sorted) {
    const exp = safeExp.get(n.id) || 0;
    if (exp <= 0) continue;
    const pt = String(n?.punch_type || '');
    // common_X / X 모두 같은 펀치군으로 합산
    if (pt.includes('straight') || pt === 'common') punchWeights.straight += exp;
    else if (pt.includes('hook')) punchWeights.hook += exp;
    else if (pt.includes('upper')) punchWeights.upper += exp;
    else if (pt.includes('advanced')) punchWeights.advanced += exp;
    totalPunchWeight += exp;
    if (n?.zone === 'infighter') { zoneWeights.infighter += exp; totalZoneWeight += exp; }
    else if (n?.zone === 'outboxer') { zoneWeights.outboxer += exp; totalZoneWeight += exp; }
  }
  const pct = (v, total) => (total > 0 ? Math.round((v / total) * 100) : 0);
  // 대표 펀치 (최대값) — 동률이면 우선순위 straight > hook > upper > advanced
  const topPunchKey = totalPunchWeight === 0
    ? null
    : ['straight', 'hook', 'upper', 'advanced']
        .reduce((best, k) => (punchWeights[k] > punchWeights[best] ? k : best), 'straight');
  const topPunchLabel = { straight: '스트레이트', hook: '훅', upper: '어퍼', advanced: '심화' }[topPunchKey] || '—';
  // 존 성향 — 60% 이상 우세하면 우세 라벨, 그 외 균형
  const inPct = pct(zoneWeights.infighter, totalZoneWeight);
  const outPct = pct(zoneWeights.outboxer, totalZoneWeight);
  const zoneLabel = totalZoneWeight === 0
    ? '미정'
    : inPct >= 60 ? '인파이터'
    : outPct >= 60 ? '아웃복서'
    : '균형형';
  // 종합 성향 — 1~2 단어
  const styleLabel = totalPunchWeight === 0
    ? '—'
    : `${zoneLabel} · ${topPunchLabel} 위주`;

  return (
    <div className="animate-fade-in-up space-y-3 sm:space-y-4">
      {/* 헤더 */}
      <div className="px-3 sm:px-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-white/85 transition-colors"
          aria-label="돌아가기"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">SKILL SUMMARY</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">내 스킬 요약</h1>
        </div>
      </div>

      {/* 성향 표 — 찍은 스킬 기반 (간략) */}
      <SpotlightCard className="p-3 sm:p-4 border border-white/12 bg-gradient-to-br from-slate-900/90 to-slate-950/90">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">성향</p>
          <p className="text-sm sm:text-base font-extrabold text-white truncate">{styleLabel}</p>
        </div>
        <div className="grid grid-cols-[64px_1fr_44px] gap-x-2 sm:gap-x-3 gap-y-1.5 text-[11px] sm:text-xs items-center">
          {[
            { key: 'straight', label: '스트레이트', color: 'bg-cyan-400' },
            { key: 'hook',     label: '훅',         color: 'bg-orange-400' },
            { key: 'upper',    label: '어퍼',       color: 'bg-violet-400' },
            { key: 'advanced', label: '심화',       color: 'bg-rose-400' },
          ].map((row) => {
            const p = pct(punchWeights[row.key], totalPunchWeight);
            return (
              <Fragment key={row.key}>
                <span className="text-white/70 font-semibold whitespace-nowrap">{row.label}</span>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div className={`h-full ${row.color} transition-all duration-500`} style={{ width: `${p}%` }} />
                </div>
                <span className="text-right tabular-nums text-white/70 font-bold">{p}%</span>
              </Fragment>
            );
          })}
          {totalZoneWeight > 0 ? (
            <>
              <span className="text-white/70 font-semibold whitespace-nowrap pt-1">존</span>
              <div className="h-1.5 rounded-full bg-white/8 overflow-hidden flex pt-1">
                <div className="h-1.5 bg-red-400 transition-all duration-500" style={{ width: `${inPct}%` }} aria-label="인파이팅" />
                <div className="h-1.5 bg-blue-400 transition-all duration-500" style={{ width: `${outPct}%` }} aria-label="아웃복싱" />
              </div>
              <span className="text-right tabular-nums text-white/60 font-bold pt-1">{inPct}/{outPct}</span>
            </>
          ) : null}
        </div>
      </SpotlightCard>

      {/* 통계 */}
      <SpotlightCard className="p-3 sm:p-4 border border-white/12 bg-gradient-to-br from-slate-900/90 to-slate-950/90">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">마스터</p>
            <p className="text-lg sm:text-2xl font-extrabold tabular-nums text-amber-300 truncate">{masteredCount}<span className="text-xs sm:text-sm text-white/40 ml-1">개</span></p>
          </div>
          <div className="min-w-0 border-l border-white/10 pl-2 sm:pl-4">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">진행 중</p>
            <p className="text-lg sm:text-2xl font-extrabold tabular-nums text-cyan-300 truncate">{startedCount - masteredCount}<span className="text-xs sm:text-sm text-white/40 ml-1">개</span></p>
          </div>
          <div className="min-w-0 border-l border-white/10 pl-2 sm:pl-4">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">누적 EXP</p>
            <p className="text-lg sm:text-2xl font-extrabold tabular-nums text-violet-300 truncate">{totalExp}</p>
          </div>
        </div>
      </SpotlightCard>

      {/* 카테고리별 세로 카드 리스트 */}
      <div className="space-y-4 sm:space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            <div className={`inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full border text-xs font-bold ${PUNCH_COLOR[g.key] || PUNCH_COLOR.common}`}>
              {PUNCH_LABEL[g.key] || g.key} <span className="opacity-60">·</span> <span className="opacity-80 tabular-nums">{g.nodes.filter((n) => (safeExp.get(n.id) || 0) >= MAX_EXP).length}/{g.nodes.length}</span>
            </div>
            <div className="space-y-2">
              {g.nodes.map((n) => {
                const exp = safeExp.get(n.id) || 0;
                const mastered = exp >= MAX_EXP;
                const started = exp > 0;
                const fillPct = Math.min(100, (exp / MAX_EXP) * 100);
                return (
                  <div
                    key={n.id}
                    className={`relative rounded-xl border-2 px-4 py-3 transition-all overflow-hidden ${
                      mastered
                        ? 'border-amber-300/70 bg-gradient-to-r from-amber-500/25 via-amber-600/15 to-yellow-700/10 shadow-[0_0_18px_rgba(251,191,36,0.25)]'
                        : started
                          ? 'border-cyan-400/50 bg-gradient-to-r from-cyan-500/15 via-cyan-600/10 to-blue-700/5'
                          : 'border-white/8 bg-slate-900/60 opacity-40 saturate-50'
                    }`}
                  >
                    {/* 측면 라벨 라인 */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      mastered ? 'bg-amber-300' : started ? 'bg-cyan-400' : 'bg-white/15'
                    }`} aria-hidden />

                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm sm:text-base font-extrabold truncate ${
                          mastered ? 'text-amber-50' : started ? 'text-white' : 'text-slate-500'
                        }`}>
                          {nodeDisplayTitle(n)}
                        </p>
                        {/* 진행 바 */}
                        <div className="mt-2 h-1.5 rounded-full bg-black/40 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-700 ${
                              mastered
                                ? 'bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300'
                                : 'bg-gradient-to-r from-cyan-400 to-cyan-300'
                            }`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`text-base font-black tabular-nums ${
                          mastered ? 'text-amber-300' : started ? 'text-cyan-200' : 'text-slate-600'
                        }`}>
                          {exp}<span className="text-xs text-white/30">/{MAX_EXP}</span>
                        </span>
                        {mastered ? (
                          <p className="text-[9px] font-black tracking-wider text-amber-300 mt-0.5">MASTER</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 인라인 EXP 패널 — 선택한 카드 옆에 펼쳐짐 (위: 추가 버튼 / 아래: EXP) */
function InlineExpPanel({
  node, exp, sp, unlocked, busy, theme, onAddSkill,
  blockedByOther, blockedByName,
  promotionStatus = 'none', onSubmitPromotion,
  globallyLocked = false,        // 다른 스킬이 심사 대기 중 — 전체 잠금
  globalLockName = '',           // 심사 대기 중인 스킬 이름
}) {
  const mastered = exp >= MAX_EXP;
  const cost = Math.max(1, Number(node?.point_cost ?? 1) || 1); // 최소 1 SP 강제
  const canAfford = sp >= cost;
  const fillPct = Math.min(100, (exp / MAX_EXP) * 100);
  const expGradient = getExpGradient(exp, theme.expBar);
  // 활성(찍을 수 있는) 상태일 때만 펄스 — "찍어주세요" 신호
  const canAdd = unlocked && !busy && !mastered && canAfford && !blockedByOther && !globallyLocked;

  // 마스터 후 승단 심사 버튼 — 상태별 분기
  const isPending = promotionStatus === 'pending' || promotionStatus === 'reviewing';
  const isApproved = promotionStatus === 'approved';
  const isRejected = promotionStatus === 'rejected';
  // ⛔ 전역 잠금(다른 스킬 심사 중) 일 때는 재신청도 불가
  const canSubmitPromo = mastered && (promotionStatus === 'none' || isRejected) && !globallyLocked;

  return (
    <div
      data-skill-interactive
      className={`shrink-0 w-[168px] sm:w-[200px] h-[64px] sm:h-[74px] rounded-xl border-2 ${theme.panelBorder} bg-slate-900/95 px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-[0_0_24px_rgba(15,23,42,0.6)] overflow-hidden flex flex-col gap-1 relative`}
    >
      <div className={`absolute -inset-1 bg-gradient-to-br ${theme.panelGlow} via-transparent to-transparent pointer-events-none`} aria-hidden />

      {/* 위: 마스터된 경우 → 승단 심사 버튼, 아니면 스킬 추가 버튼 */}
      {mastered ? (
        <button
          type="button"
          onClick={canSubmitPromo ? onSubmitPromotion : undefined}
          disabled={!canSubmitPromo || busy}
          title={globallyLocked && !isPending ? `'${globalLockName}' 의 승단 심사가 진행 중입니다` : undefined}
          className={`relative w-full px-1.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-all ${
            isApproved
              ? 'bg-amber-400/20 border border-amber-300/50 text-amber-200 cursor-default'
              : isPending
                ? 'bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 cursor-not-allowed'
                : globallyLocked
                  ? 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
                  : isRejected
                    ? 'bg-rose-500/15 border border-rose-400/40 text-rose-200 hover:bg-rose-500/25 active:scale-[0.98] skill-add-pulse'
                    : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow active:scale-[0.98] skill-add-pulse'
          }`}
        >
          {isApproved
            ? '★ 승단 완료'
            : isPending
              ? '심사 대기 중…'
              : globallyLocked
                ? '심사 진행 중 — 잠금'
                : isRejected
                  ? '★ 재신청'
                  : busy
                    ? '신청 중...'
                    : '★ 승단 심사 신청'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onAddSkill}
          disabled={!canAdd}
          title={
            globallyLocked
              ? `'${globalLockName}' 의 승단 심사가 진행 중입니다`
              : blockedByOther
                ? `'${blockedByName}' 을(를) 먼저 마스터하세요`
                : undefined
          }
          className={`relative w-full px-1.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-all ${
            globallyLocked || !unlocked || !canAfford || blockedByOther
              ? 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
              : `bg-gradient-to-r ${theme.button} text-white shadow active:scale-[0.98] ${canAdd ? 'skill-add-pulse' : ''}`
          }`}
        >
          {globallyLocked
            ? '심사 진행 중 — 잠금'
            : blockedByOther
              ? `${blockedByName} 먼저`
              : !unlocked
                ? '선행 필요'
                : !canAfford
                  ? `SP 부족`
                  : busy
                    ? '추가 중...'
                    : `+ 추가 · ${cost} SP`}
        </button>
      )}

      {/* 아래: EXP 바 — 단계별 색 + 시머 효과 */}
      <div className="relative">
        <div className="flex items-baseline justify-between mb-0.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-white/40">EXP</span>
          <span className={`text-[9px] sm:text-[10px] font-bold tabular-nums ${mastered ? 'text-amber-300' : theme.expLabel}`}>{exp}/{MAX_EXP}</span>
        </div>
        <div className="h-2 sm:h-2.5 rounded-full bg-black/50 border border-white/10 overflow-hidden relative">
          {/* 채워진 부분 — 단계별 색 + 시머 오버레이 */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out overflow-hidden ${expGradient} ${exp > 0 ? 'exp-shimmer' : ''}`}
            style={{ width: `${fillPct}%` }}
          />
          {/* 칸 구분선 */}
          <div className="absolute inset-0 flex pointer-events-none">
            {Array.from({ length: Math.max(0, MAX_EXP - 1) }).map((_, i) => (
              <div key={i} className="flex-1 border-r border-black/40" />
            ))}
            <div className="flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 스킬 트리 — 메인 가로 체인 + 분기는 아래로 떨어짐 (SVG 연결선) */
function SkillTree({
  nodes, expByNodeId, nodeByNumber,
  selectedId, burstNodeId, burstKey,
  theme, themeAccent,
  onSelectNode, onAddSkill, sp, busy, hasSelection,
  nextTabCta,
  inProgressNodeId, inProgressNodeName,
  promotionByNodeId, onSubmitPromotion,
  pendingPromotionNodeId, pendingPromotionName,
}) {
  // 카드/간격 (모바일·데스크톱 분리)
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(min-width: 640px)');
    const apply = () => setIsWide(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  // 카드 가로폭 +10px (긴 이름 가독성 ↑) — 높이는 동일 유지
  const cardW = isWide ? 114 : 94;
  const cardH = isWide ? 74 : 64;
  const colGap = isWide ? 22 : 16;
  const rowGap = isWide ? 26 : 20;
  const panelW = isWide ? 200 : 168;

  const layout = useMemo(() => computeTreeLayout(nodes), [nodes]);
  const { positions, maxCol, maxRow, childrenByNum } = layout;

  // 형제 락
  const siblingLockSet = useMemo(
    () => computeSiblingLockSet(nodes, expByNodeId, childrenByNum),
    [nodes, expByNodeId, childrenByNum]
  );

  // 선택 체인 (조상 모두)
  const selectedChainSet = useMemo(() => {
    const set = new Set();
    if (selectedId == null) return set;
    const start = nodes.find((n) => n.id === selectedId);
    if (!start) return set;
    const visit = (n) => {
      if (!n || set.has(n.id)) return;
      set.add(n.id);
      for (const pNum of getParentNumbers(n)) {
        const p = nodeByNumber.get(pNum);
        if (p) visit(p);
      }
    };
    visit(start);
    return set;
  }, [selectedId, nodes, nodeByNumber]);

  // 연결선 목록
  const connectors = useMemo(() => {
    const arr = [];
    for (const node of nodes) {
      const cPos = positions.get(node.id);
      if (!cPos) continue;
      for (const pNum of getParentNumbers(node)) {
        const parent = nodeByNumber.get(pNum);
        if (!parent) continue;
        const pPos = positions.get(parent.id);
        if (!pPos) continue;

        const parentExp = expByNodeId.get(parent.id) || 0;
        const childExp = expByNodeId.get(node.id) || 0;
        const inChain = selectedChainSet.has(parent.id) && selectedChainSet.has(node.id);
        const childLocked = siblingLockSet.has(node.id);
        const parentSatisfied = parentExp >= 1;

        let state = 'dormant';
        if (inChain) state = 'chain';
        else if (childLocked) state = 'locked';
        else if (parentSatisfied && childExp === 0) state = 'pulse'; // 다음 선택지 강조
        else if (parentSatisfied) state = 'alive';

        arr.push({
          key: `${parent.id}-${node.id}`,
          parentPos: pPos,
          childPos: cPos,
          state,
        });
      }
    }
    return arr;
  }, [nodes, nodeByNumber, positions, expByNodeId, selectedChainSet, siblingLockSet]);

  if (!nodes.length) return null;

  // 다음 탭 CTA 위치 — 메인 spine(row 0) 의 마지막 "기본(common) 스킬" 바로 오른쪽
  let lastCommonRow0Col = -1;
  for (const n of nodes) {
    const pt = n?.punch_type;
    const isCommonNode = typeof pt === 'string' && pt.startsWith('common');
    if (!isCommonNode) continue;
    const p = positions.get(n.id);
    if (!p || p.row !== 0) continue;
    if (p.col > lastCommonRow0Col) lastCommonRow0Col = p.col;
  }
  // common 이 row 0 에 없으면(드뭄) → 트리 전체 max col 로 폴백
  let lastSpineCol = lastCommonRow0Col;
  if (lastSpineCol < 0) {
    lastSpineCol = 0;
    for (const p of positions.values()) {
      if (p && p.col > lastSpineCol) lastSpineCol = p.col;
    }
  }
  const ctaCol = lastSpineCol + 1;
  const showCta = nextTabCta && nextTabCta.show;
  const ctaW = isWide ? 200 : 168;

  // 전체 캔버스 크기 (선택된 노드의 패널이 마지막 열을 넘지 않도록 여유 추가)
  const baseRightPad = panelW + 16;
  const ctaRightPad = showCta ? ctaCol * (cardW + colGap) + ctaW + 24 : 0;
  const totalW = Math.max((maxCol + 1) * (cardW + colGap) + baseRightPad, ctaRightPad);
  const totalH = (maxRow + 1) * (cardH + rowGap);

  return (
    <div className="relative overflow-x-auto overflow-y-hidden pb-3">
      <div
        className="relative"
        style={{
          width: totalW,
          height: totalH,
          minWidth: '100%',
          // ⭐ GPU 레이어 격리 — 외부 페이지 변화(SpotlightCard re-render 등)가 트리 paint 트리거 안 함.
          //   contain: layout style paint → 자식 변화가 부모로 새지 않음
          //   isolation: isolate → 별도 stacking context (z-index 충돌 방지)
          //   transform: translateZ(0) → 강제 GPU layer (모바일 합성 안정화)
          contain: 'layout style paint',
          isolation: 'isolate',
          transform: 'translateZ(0)',
        }}
      >
        {/* SVG 연결선 레이어 */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={totalW}
          height={totalH}
          aria-hidden
        >
          {connectors.map((c) => (
            <ConnectorPath
              key={c.key}
              parentPos={c.parentPos}
              childPos={c.childPos}
              cardW={cardW}
              cardH={cardH}
              colGap={colGap}
              rowGap={rowGap}
              state={c.state}
              themeAccent={themeAccent}
            />
          ))}
        </svg>

        {/* 카드들 */}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const exp = expByNodeId.get(node.id) || 0;
          const sibLocked = siblingLockSet.has(node.id);
          const unlocked = !sibLocked && isUnlocked(node, nodeByNumber, promotionByNodeId || {});
          const isSelected = node.id === selectedId;
          return (
            <div
              key={node.id}
              data-skill-row={node.id}
              className="absolute"
              style={{
                left: pos.col * (cardW + colGap),
                top: pos.row * (cardH + rowGap),
                width: cardW,
                height: cardH,
              }}
            >
              <SkillNodeCard
                node={node}
                exp={exp}
                unlocked={unlocked}
                selected={isSelected}
                dimmed={hasSelection}
                burst={burstNodeId === node.id}
                burstKey={burstKey}
                onSelect={onSelectNode}
                themeAccent={themeAccent}
                /* 다른 스킬 진행 중 OR 다른 스킬 심사 중 → 이 카드는 잠김 */
                softLocked={
                  (Boolean(inProgressNodeId) && inProgressNodeId !== node.id)
                  || (Boolean(pendingPromotionNodeId) && pendingPromotionNodeId !== node.id)
                }
              />
            </div>
          );
        })}

        {/* 다음 탭 CTA — 스킬 노드와 동일한 디자인 (그라디언트 보더 + 메시 배경 + 도트 텍스처) */}
        {showCta ? (() => {
          // 다음 탭 액센트에 맞춰 SkillNodeCard 와 동일한 팔레트 사용
          const nextPalette = CARD_TAB_PALETTE[nextTabCta.accent] || CARD_TAB_PALETTE.cyan;
          const ctaBgGradient = `radial-gradient(ellipse at 25% 0%, rgba(${nextPalette.p},0.42) 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(${nextPalette.s},0.22) 0%, transparent 65%), linear-gradient(135deg, rgba(15,23,42,0.6), rgba(2,6,23,0.85))`;
          const ctaBorderGradient = `linear-gradient(135deg, rgba(${nextPalette.p},0.95) 0%, rgba(${nextPalette.s},0.55) 50%, rgba(${nextPalette.p},0.85) 100%)`;
          const ctaShadow = `0 0 18px rgba(${nextPalette.p},0.32), 0 0 36px rgba(${nextPalette.p},0.12), inset 0 1px 0 rgba(255,255,255,0.10)`;
          const ctaTextColor = `rgba(${nextPalette.p},1)`;
          return (
            <div
              data-skill-interactive
              className="absolute"
              style={{
                left: ctaCol * (cardW + colGap),
                top: 0,
                width: ctaW,
                height: cardH,
              }}
            >
              <button
                type="button"
                onClick={nextTabCta.onClick}
                className="group relative w-full h-full rounded-xl transition-all duration-200 ease-out cursor-pointer hover:scale-[1.04] hover:-translate-y-0.5 active:scale-[1.02] skill-add-pulse"
                style={{
                  boxShadow: ctaShadow,
                  contain: 'layout paint',
                  transform: 'translateZ(0)',
                }}
              >
                {/* 그라디언트 보더 (1.5px) — SkillNodeCard 와 동일한 mask 트릭 */}
                <div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    background: ctaBorderGradient,
                    padding: '1.5px',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                  aria-hidden
                />

                {/* 메시 그라디언트 배경 (보더 안쪽) */}
                <div
                  className="absolute inset-[1.5px] rounded-[10px] overflow-hidden"
                  style={{ background: ctaBgGradient }}
                  aria-hidden
                >
                  {/* 도트 텍스처 */}
                  <div
                    className="absolute inset-0 opacity-[0.16]"
                    style={{
                      backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 0.5px, transparent 1px)',
                      backgroundSize: '6px 6px',
                    }}
                  />
                  {/* 상단 하이라이트 라인 */}
                  <div className="absolute top-0 inset-x-2 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                </div>

                {/* 콘텐츠 — 라벨 + 화살표 */}
                <div className="relative z-[2] w-full h-full flex items-center justify-center gap-2 px-2">
                  <span
                    className="text-[11px] sm:text-[12.5px] font-bold leading-[1.12] text-center tracking-[-0.01em]"
                    style={{ color: ctaTextColor }}
                  >
                    {nextTabCta.label}
                  </span>
                  <span
                    className="text-base sm:text-lg font-black shrink-0 group-hover:translate-x-1 transition-transform"
                    style={{ color: ctaTextColor }}
                    aria-hidden
                  >
                    →
                  </span>
                </div>
              </button>
            </div>
          );
        })() : null}

        {/* 선택 노드 옆 EXP 패널 */}
        {selectedId && positions.has(selectedId) ? (() => {
          const sel = nodes.find((n) => n.id === selectedId);
          const pos = positions.get(selectedId);
          if (!sel || !pos) return null;
          const exp = expByNodeId.get(sel.id) || 0;
          const sibLocked = siblingLockSet.has(sel.id);
          const unlocked = !sibLocked && isUnlocked(sel, nodeByNumber, promotionByNodeId || {});
          return (
            <div
              className="absolute"
              style={{
                left: pos.col * (cardW + colGap) + cardW + 12,
                top: pos.row * (cardH + rowGap),
                width: panelW,
                height: cardH,
              }}
            >
              <InlineExpPanel
                node={sel}
                exp={exp}
                sp={sp}
                unlocked={unlocked}
                busy={busy}
                theme={theme}
                onAddSkill={() => onAddSkill(sel.id)}
                blockedByOther={Boolean(inProgressNodeId) && inProgressNodeId !== sel.id}
                blockedByName={inProgressNodeName}
                /* 다른 스킬이 심사 대기 중 — 본인 노드 제외 모두 잠금 */
                globallyLocked={Boolean(pendingPromotionNodeId) && pendingPromotionNodeId !== sel.id}
                globalLockName={pendingPromotionName}
                promotionStatus={promotionByNodeId?.[sel.id]?.status || 'none'}
                onSubmitPromotion={() => onSubmitPromotion?.(sel.id)}
              />
            </div>
          );
        })() : null}
      </div>
    </div>
  );
}

/** 메인 뷰 */
const ActiveSkillsView = ({ setActiveTab, onBack }) => {
  const { user, loading: authLoading } = useAuth();
  const [dataLoading, setDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [treeNodes, setTreeNodes] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [skillPoints, setSkillPoints] = useState(0);
  const [skillResetTickets, setSkillResetTickets] = useState(0);
  // 본인 승단 심사 신청 — { node_id: { status, ... } } 맵
  const [promotionByNodeId, setPromotionByNodeId] = useState({});
  // 승단 신청 확인 모달 — 표시할 노드 (null = 닫힘)
  const [promotionConfirmNode, setPromotionConfirmNode] = useState(null);
  // 신청 완료 토스트 메시지 (3초 후 자동 사라짐)
  const [promotionResultMessage, setPromotionResultMessage] = useState('');
  const [selectedTab, setSelectedTab] = useState('straight');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // 진행 중인 스킬 (0 < exp < 5) — 마스터될 때까지 다른 스킬 추가 차단
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [burstNodeId, setBurstNodeId] = useState(null);
  const [burstKey, setBurstKey] = useState(0);
  const [celebrationTab, setCelebrationTab] = useState(null);
  const celebratedTabsRef = useRef(null);
  const burstTimerRef = useRef(null);
  const initialFocusDoneRef = useRef(false);

  useEffect(() => () => { if (burstTimerRef.current) clearTimeout(burstTimerRef.current); }, []);

  /** 선택된 노드를 화면에 잘 보이게 자동 포커스 (가로 스크롤 + 세로 정렬).
   *  탭 전환 직후엔 카드 DOM 이 아직 마운트 안 되어있을 수 있어 retry 적용. */
  useEffect(() => {
    if (selectedNodeId == null) return undefined;
    const id = selectedNodeId;
    let attempt = 0;
    let timer = null;
    const tryFocus = () => {
      const row = document.querySelector(`[data-skill-row="${id}"]`);
      if (!row) {
        // 최대 ~1.2초까지 재시도 (탭 전환 + 트리 레이아웃 안정 대기)
        if (attempt < 8) {
          attempt += 1;
          timer = setTimeout(tryFocus, 150);
        }
        return;
      }
      row.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      requestAnimationFrame(() => {
        const rect = row.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const margin = 24;
        if (rect.top < margin) {
          window.scrollBy({ top: rect.top - margin - 60, behavior: 'smooth' });
        } else if (rect.bottom > vh - margin) {
          window.scrollBy({ top: rect.bottom - vh + margin + 20, behavior: 'smooth' });
        }
      });
    };
    timer = setTimeout(tryFocus, 80);
    return () => { if (timer) clearTimeout(timer); };
  }, [selectedNodeId]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setDataLoading(true);
    setErrorMessage('');
    try {
      const {
        getSkillTreeNodes,
        getUserSkillNodeProgress,
        getUserSkillWallet,
        getMyPromotionRequests,
      } = await import('@/lib/supabase');
      // 4개 fetch 병렬 — 노드/진행/지갑/승단 신청 (서로 독립)
      const [nodesRes, progRes, walletRes, promoRes] = await Promise.all([
        getSkillTreeNodes(),
        getUserSkillNodeProgress(user.id),
        getUserSkillWallet(user.id),
        getMyPromotionRequests(),
      ]);
      const { data: nodes, error: nodesError } = nodesRes;
      if (nodesError) throw nodesError;

      const filtered = (nodes || []).filter((n) => n.zone !== 'legendary');
      setTreeNodes(filtered);

      const { data: progRows, error: progError } = progRes;
      if (progError) {
        setErrorMessage('진행 데이터를 불러오지 못했습니다. sql/33_redesign_skill_tree.sql 적용 여부를 확인해 주세요.');
        setProgressRows([]);
      } else {
        setProgressRows(progRows || []);
      }
      const { data: wallet } = walletRes;
      if (wallet) {
        setSkillPoints(Number(wallet.skill_points ?? 0));
        setSkillResetTickets(Number(wallet.skill_reset_tickets ?? 0));
      }
      // 승단 신청 → node_id 별 최신 1건 (가장 최근 requested_at 우선) 으로 매핑
      const promoRows = Array.isArray(promoRes?.data) ? promoRes.data : [];
      const promoMap = {};
      for (const r of promoRows) {
        if (!r?.node_id) continue;
        // RPC 가 requested_at desc 로 반환 → 첫 번째가 최신
        if (!promoMap[r.node_id]) {
          promoMap[r.node_id] = {
            id: r.id,
            status: r.status,
            requestedAt: r.requested_at,
            resolvedAt: r.resolved_at,
            notes: r.notes,
          };
        }
      }
      setPromotionByNodeId(promoMap);
    } catch (e) {
      console.error('[ActiveSkillsView] load:', e);
      setErrorMessage(e?.message || '스킬 데이터를 불러오지 못했습니다.');
    } finally {
      setDataLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // 페이지가 다시 활성화되면 데이터 동기화 (체육관에서 거절·승인 처리한 결과 즉시 반영)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onFocus = () => { loadData(); };
    const onVis = () => { if (document.visibilityState === 'visible') loadData(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loadData]);

  // 출석 모달 [레벨업 신청] → sessionStorage 로 전달된 노드 ID 자동 선택 + 탭 전환
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!treeNodes.length) return;
    let raw = null;
    try {
      raw = window.sessionStorage.getItem('skill_focus_node_id');
    } catch { /* ignore */ }
    if (!raw) return;
    try { window.sessionStorage.removeItem('skill_focus_node_id'); } catch { /* ignore */ }
    const focusId = Number(raw);
    if (!Number.isFinite(focusId)) return;
    const node = treeNodes.find((n) => Number(n.id) === focusId);
    if (!node) return;
    // 노드의 punch_type 으로 탭 자동 전환
    const pt = node.punch_type || '';
    if (pt === 'common_hook' || pt === 'hook') setSelectedTab('hook');
    else if (pt === 'common_upper' || pt === 'upper') setSelectedTab('upper');
    else if (pt === 'common_advanced' || pt === 'advanced') setSelectedTab('advanced');
    else setSelectedTab('straight');
    setSelectedNodeId(node.id);
    initialFocusDoneRef.current = true; // 초기 자동 포커스 로직과 충돌 방지
  }, [treeNodes]);

  const expByNodeId = useMemo(() => {
    const m = new Map();
    for (const r of progressRows || []) {
      m.set(r.node_id, Number(r.exp_level || 0));
    }
    return m;
  }, [progressRows]);

  const nodeByNumber = useMemo(() => {
    const m = new Map();
    for (const n of treeNodes) {
      const num = Number(n.node_number);
      if (Number.isFinite(num)) m.set(num, n);
    }
    return m;
  }, [treeNodes]);

  const depthMap = useMemo(() => computeDepths(treeNodes), [treeNodes]);

  const nodesForTab = useMemo(() => {
    const tab = PUNCH_TABS.find((t) => t.key === selectedTab) || PUNCH_TABS[0];
    return treeNodes.filter((n) => {
      const pt = n.punch_type;
      // 새 분류 8단계
      if (pt === tab.common) return true;
      if (pt === tab.specific) return true;
      // 레거시 'common' / punch_type 누락 백워드 호환 — 스트레이트 탭에 노출
      // (sql/37 미적용 환경 또는 Supabase 직접 추가로 punch_type 미설정인 노드 대비)
      if (tab.key === 'straight' && (pt === 'common' || pt == null || pt === '')) return true;
      return false;
    });
  }, [treeNodes, selectedTab]);

  const sortedNodesForTab = useMemo(() => {
    const arr = [...nodesForTab];
    arr.sort((a, b) => {
      const da = depthMap.get(Number(a.node_number)) ?? 0;
      const db = depthMap.get(Number(b.node_number)) ?? 0;
      if (da !== db) return da - db;
      return Number(a.node_number) - Number(b.node_number);
    });
    return arr;
  }, [nodesForTab, depthMap]);



  /** 진입 시: 진행 기록이 있으면 그 탭으로 이동만, 자동 선택은 안 함 */
  useEffect(() => {
    if (initialFocusDoneRef.current) return;
    if (!treeNodes.length) return;
    if (!progressRows.length) {
      // 처음 들어온 유저 — 자동 선택 X (사용자가 직접 누르도록)
      initialFocusDoneRef.current = true;
      return;
    }
    let latest = null;
    for (const r of progressRows) {
      const ts = r.updated_at ? new Date(r.updated_at).getTime() : 0;
      if (!latest || ts > latest.ts) latest = { row: r, ts };
    }
    if (!latest) {
      initialFocusDoneRef.current = true;
      return;
    }
    const node = treeNodes.find((n) => n.id === latest.row.node_id);
    if (!node) {
      initialFocusDoneRef.current = true;
      return;
    }
    // 마지막 진행 노드의 punch_type 으로 탭만 전환 (선택은 안 함)
    const pt = node.punch_type || '';
    if (pt === 'common_hook' || pt === 'hook') setSelectedTab('hook');
    else if (pt === 'common_upper' || pt === 'upper') setSelectedTab('upper');
    else if (pt === 'common_advanced' || pt === 'advanced') setSelectedTab('advanced');
    else setSelectedTab('straight');
    initialFocusDoneRef.current = true;
  }, [treeNodes, progressRows]);

  // (자동 다음 노드 포커스는 폐기 — 사용자가 직접 다음 노드를 클릭)

  /** 진행 중(0<exp<MAX_EXP)인 노드 — 마스터 전까지 다른 스킬 추가 차단.
   *  ⚠️ 재마스터(거절 후 exp>=5, max>5) 는 별도 흐름이라 in-progress 로 보지 않음.
   *      → 0<exp<5 인 노드만 forward in-progress 로 봄. */
  const inProgressNode = useMemo(() => {
    for (const n of treeNodes) {
      const e = expByNodeId.get(n.id) || 0;
      if (e > 0 && e < MAX_EXP) return n;
    }
    return null;
  }, [treeNodes, expByNodeId]);
  const inProgressNodeId = inProgressNode?.id ?? null;
  const inProgressNodeName = inProgressNode ? nodeDisplayTitle(inProgressNode) : '';

  /** 처리 안 된 마스터 노드 — 5/5 인데 승단 승인 안 받은 상태.
   *  미신청 / pending / reviewing / rejected 모두 포함.
   *  락 해제 조건: 그 노드 promotion status='approved'.
   *  우선순위: pending(4) > reviewing(3) > rejected(2) > unsubmitted(1) */
  const pendingPromotion = useMemo(() => {
    const STATUS_PRIORITY = { pending: 4, reviewing: 3, rejected: 2, unsubmitted: 1 };
    let best = null;
    for (const n of treeNodes) {
      const exp = expByNodeId.get(n.id) || 0;
      if (exp < MAX_EXP) continue; // 5/5 만 검토
      const r = promotionByNodeId?.[n.id];
      const status = r?.status || 'unsubmitted';
      if (status === 'approved') continue; // 승인된 건 락 아님
      const prio = STATUS_PRIORITY[status] || 0;
      if (!best || prio > best.prio) {
        best = { nodeId: n.id, node: n, status, prio };
      }
    }
    return best ? { nodeId: best.nodeId, node: best.node, status: best.status } : null;
  }, [promotionByNodeId, treeNodes, expByNodeId]);
  const pendingPromotionName = pendingPromotion?.node ? nodeDisplayTitle(pendingPromotion.node) : '';

  // 락 사유별 메시지
  const lockMessage = (() => {
    if (!pendingPromotion) return '';
    switch (pendingPromotion.status) {
      case 'pending':
        return `'${pendingPromotionName}' 의 승단 심사 대기 중입니다.\n심사 결과가 나올 때까지 다른 스킬을 찍을 수 없습니다.`;
      case 'reviewing':
        return `'${pendingPromotionName}' 의 승단 심사가 진행 중입니다.\n심사 결과가 나올 때까지 다른 스킬을 찍을 수 없습니다.`;
      case 'rejected':
        return `'${pendingPromotionName}' 의 승단이 거절되었습니다.\n재신청 후 승인 받기 전에는 다른 스킬을 찍을 수 없습니다.`;
      default: // 'unsubmitted'
        return `'${pendingPromotionName}' 을(를) 마스터했습니다.\n승단 심사 신청 후 승인 받기 전에는 다른 스킬을 찍을 수 없습니다.`;
    }
  })();

  const handleAddSkill = useCallback(async (nodeId) => {
    // ref 기반 동기 락 — React state 갱신 전 빠른 연타도 차단
    if (busyRef.current) return;

    // ⛔ 5/5 마스터 + 승단 미승인 노드가 있으면 다른 스킬 투자 차단
    if (pendingPromotion && pendingPromotion.nodeId !== nodeId) {
      alert(lockMessage);
      return;
    }

    // 다른 forward in-progress 노드가 있으면 차단 (마스터는 5 고정)
    const blocking = treeNodes.find((n) => {
      if (n.id === nodeId) return false;
      const e = expByNodeId.get(n.id) || 0;
      return e > 0 && e < MAX_EXP;
    });
    if (blocking) {
      alert(`'${nodeDisplayTitle(blocking)}' 을(를) 먼저 마스터해야 다른 스킬을 찍을 수 있습니다.`);
      return;
    }

    busyRef.current = true;
    setBusy(true);
    try {
      const { addSkillExpRpc } = await import('@/lib/supabase');
      const { data, error } = await addSkillExpRpc(nodeId);
      if (error) {
        const msg = error.message || '스킬 추가에 실패했습니다.';
        // "이미 마스터한 스킬입니다" 등 — 클라이언트 캐시가 오래되었을 가능성 ↑
        // 데이터를 새로 받아 와서 UI 를 DB 와 동기화 (체육관이 거절 후 fail_count 가 +1 된 상황 등)
        const stale = /마스터|이미|already/.test(msg);
        if (stale) {
          await loadData();
          alert(`${msg}\n\n최신 데이터로 새로고침했습니다. 다시 시도해 주세요.`);
        } else {
          alert(msg);
        }
        return;
      }
      const newExp = Number(data?.out_exp_level ?? data?.exp_level ?? 0);
      const newSp = Number(data?.out_sp_remaining ?? data?.sp_remaining ?? skillPoints);
      setSkillPoints(newSp);
      setProgressRows((prev) => {
        const others = prev.filter((r) => r.node_id !== nodeId);
        return [...others, { node_id: nodeId, exp_level: newExp, updated_at: new Date().toISOString() }];
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([40, 20, 60]);
      setBurstNodeId(nodeId);
      setBurstKey((k) => k + 1);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      burstTimerRef.current = setTimeout(() => {
        setBurstNodeId(null);
      }, 1100);
    } catch (e) {
      console.error('[handleAddSkill]', e);
      alert(e?.message || '스킬 추가 중 오류가 발생했습니다.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [skillPoints, treeNodes, expByNodeId, loadData, pendingPromotion, lockMessage]);

  // 마스터 스킬 → 승단 심사 신청 — 커스텀 모달로 확인 받음
  // 모달 트리거: handleSubmitPromotion(nodeId) → setPromotionConfirmNode(node)
  // 실제 제출: confirmSubmitPromotion()
  const handleSubmitPromotion = useCallback((nodeId) => {
    if (busyRef.current) return;
    const node = treeNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const exp = expByNodeId.get(nodeId) || 0;
    if (exp < MAX_EXP) {
      alert('스킬을 마스터(5/5) 한 후에 승단 심사를 신청할 수 있습니다.');
      return;
    }
    setPromotionConfirmNode(node);
  }, [treeNodes, expByNodeId]);

  const confirmSubmitPromotion = useCallback(async () => {
    const node = promotionConfirmNode;
    if (!node || busyRef.current) return;
    setPromotionConfirmNode(null);
    busyRef.current = true;
    setBusy(true);
    try {
      const { submitMasterExamRequestRpc } = await import('@/lib/supabase');
      const { error } = await submitMasterExamRequestRpc(node.id);
      if (error) {
        const msg = error.message || '승단 심사 신청에 실패했습니다.';
        // "마스터되지 않음" 류는 체육관 거절로 max 가 +1 됐는데 클라이언트가 모르는 케이스
        // 데이터 다시 받고 사용자에게 안내
        const stale = /마스터/.test(msg);
        if (stale) {
          await loadData();
          alert(`${msg}\n\n체육관 심사 결과로 SP 맥스가 변경되었을 수 있습니다.\n최신 상태로 새로고침했으니 다시 확인해 주세요.`);
        } else {
          alert(msg);
        }
        return;
      }
      // 신청 목록만 다시 불러와 즉시 반영
      const { getMyPromotionRequests } = await import('@/lib/supabase');
      const { data: promoRows } = await getMyPromotionRequests();
      const map = {};
      for (const r of promoRows || []) {
        if (!r?.node_id) continue;
        if (!map[r.node_id]) {
          map[r.node_id] = { id: r.id, status: r.status, requestedAt: r.requested_at, resolvedAt: r.resolved_at, notes: r.notes };
        }
      }
      setPromotionByNodeId(map);
      setPromotionResultMessage(`'${nodeDisplayTitle(node)}' 승단 심사를 체육관에 신청했습니다.`);
    } catch (e) {
      console.error('[confirmSubmitPromotion]', e);
      alert(e?.message || '승단 심사 신청 중 오류가 발생했습니다.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [promotionConfirmNode, loadData]);

  const handleResetSkillTree = useCallback(async () => {
    if (busyRef.current) return;
    if (skillResetTickets < 1) {
      alert('스킬 초기화권이 없습니다.');
      return;
    }
    const ok = window.confirm(
      '스킬 초기화권 1장을 사용해 모든 스킬 진행을 초기화하시겠어요?\n사용한 SP는 환급됩니다.'
    );
    if (!ok) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const { resetSkillTreeWithTicketRpc } = await import('@/lib/supabase');
      const { error } = await resetSkillTreeWithTicketRpc();
      if (error) {
        alert(error.message || '초기화에 실패했습니다.');
        return;
      }
      // 진행 + 선택 + 축하 기록 모두 초기화 → 다시 처음부터
      setSelectedNodeId(null);
      initialFocusDoneRef.current = false;
      celebratedTabsRef.current = new Set();
      try {
        // 모든 버전 키 제거 (호환성)
        window.localStorage.removeItem('skill_celebrated_tabs');
        window.localStorage.removeItem('skill_celebrated_tabs_v2');
        window.localStorage.removeItem('skill_celebrated_tabs_v3');
        window.localStorage.removeItem('skill_celebrated_tabs_v4');
      } catch {
        /* ignore */
      }
      await loadData();
    } catch (e) {
      console.error('[handleResetSkillTree]', e);
      alert(e?.message || '초기화 중 오류가 발생했습니다.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [skillResetTickets, loadData]);

  const currentTab = PUNCH_TABS.find((tab) => tab.key === selectedTab) || PUNCH_TABS[0];
  const theme = ACCENT_THEME[currentTab.accent];

  /**
   * 탭 진행 완료 검사 — 다음 탭 해금 / CTA 표시 조건
   *  - 해당 탭의 common 노드가 1개 이상 있으면: common 전체 마스터
   *  - common 노드가 없으면(분류 미완): specific 노드 전체 마스터로 대체
   *  - 둘 다 없으면 false
   *  - 레거시 'common' 도 straight 탭에서 인정
   *
   *  ⚠️ 모든 hook 은 early return 보다 위에 있어야 함 (React Hooks 규칙)
   */
  const isTabAdvanced = useCallback((tabKey) => {
    const tab = PUNCH_TABS.find((t) => t.key === tabKey);
    if (!tab) return false;
    // 1순위: common_X (또는 straight 탭의 레거시 common)
    const commonNodes = treeNodes.filter((n) =>
      n.punch_type === tab.common || (tab.key === 'straight' && n.punch_type === 'common')
    );
    if (commonNodes.length > 0) {
      return commonNodes.every((n) => (expByNodeId.get(n.id) || 0) >= MAX_EXP);
    }
    // 2순위 폴백: specific
    const specificNodes = treeNodes.filter((n) => n.punch_type === tab.specific);
    if (specificNodes.length === 0) return false;
    return specificNodes.every((n) => (expByNodeId.get(n.id) || 0) >= MAX_EXP);
  }, [treeNodes, expByNodeId]);

  /** 탭 클릭 — 단순 전환만 (celebration 은 아래 useEffect 가 자동 처리) */
  const handleTabClick = useCallback((tab) => {
    setSelectedTab(tab.key);
    setSelectedNodeId(null);
  }, []);

  /**
   * 해금된 탭에 처음 진입 시 축하 이펙트 자동 발사 (탭당 1회).
   * - selectedTab 변화로 트리거 → 탭 클릭 / CTA 버튼 / 자동 탭 이동 모두 커버.
   * - 선행 탭 마스터 + 미경험 + DB 데이터 로드 완료 조건 충족 시 fire.
   * - localStorage v4 — 이전 버전 캐시 무시하고 새로 시작.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (dataLoading) return;       // 데이터 로드 전엔 isTabAdvanced 가 잘못된 false 반환 가능
    if (!selectedTab) return;
    const tab = PUNCH_TABS.find((t) => t.key === selectedTab);
    if (!tab || !tab.requires) return; // 첫 탭(스트레이트)은 해금 개념 없음

    // localStorage 캐시 lazy 로드
    if (celebratedTabsRef.current === null) {
      try {
        const raw = window.localStorage.getItem('skill_celebrated_tabs_v4');
        celebratedTabsRef.current = raw ? new Set(JSON.parse(raw)) : new Set();
      } catch {
        celebratedTabsRef.current = new Set();
      }
    }
    if (celebratedTabsRef.current.has(tab.key)) return; // 이미 축하 본 탭

    // 선행 탭 진행 완료(common 전체 마스터) 검사
    const reqKey = tab.requires === 'common_straight' ? 'straight'
      : tab.requires === 'common_hook' ? 'hook'
      : tab.requires === 'common_upper' ? 'upper'
      : tab.requires === 'common_advanced' ? 'advanced'
      : null;
    if (!reqKey || !isTabAdvanced(reqKey)) return; // 아직 해금 안 됨 → 축하 패스

    // 첫 진입 — 이펙트 발사 + 영구 기록
    celebratedTabsRef.current.add(tab.key);
    try {
      window.localStorage.setItem(
        'skill_celebrated_tabs_v4',
        JSON.stringify(Array.from(celebratedTabsRef.current))
      );
    } catch {
      /* ignore */
    }
    setCelebrationTab(tab);
  }, [selectedTab, isTabAdvanced, dataLoading]);

  // 승단 신청 토스트 자동 닫힘 (3초) — 모든 hook 호출은 early return 이전에
  useEffect(() => {
    if (!promotionResultMessage) return undefined;
    const timer = setTimeout(() => setPromotionResultMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [promotionResultMessage]);

  // 요약 페이지 모드 — 트리 전체를 대체 (모든 hook 호출 이후)
  if (summaryOpen) {
    return (
      <SkillSummaryPage
        nodes={treeNodes}
        expByNodeId={expByNodeId}
        onBack={() => setSummaryOpen(false)}
      />
    );
  }

  /** 현재 탭이 잠겨있는지 — 선행 탭이 진행 완료됐는지 */
  const requiresTabKey = currentTab.requires === 'common_straight' ? 'straight'
    : currentTab.requires === 'common_hook' ? 'hook'
    : currentTab.requires === 'common_upper' ? 'upper'
    : currentTab.requires === 'common_advanced' ? 'advanced'
    : null;
  const tabUnlocked = !requiresTabKey || isTabAdvanced(requiresTabKey);

  /** 다음 탭 CTA 표시 — 현재 탭이 진행 완료됐는지 */
  const currentTabReady = isTabAdvanced(currentTab.key);

  return (
    <div className="animate-fade-in-up space-y-3 sm:space-y-4">
      {/* 탭 해금 축하 오버레이 */}
      <UnlockCelebration tab={celebrationTab} onDone={() => setCelebrationTab(null)} />

      {/* ⭐ 승단 심사 신청 확인 모달 */}
      {promotionConfirmNode ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(12,16,36,0.92)' }}
          onClick={() => setPromotionConfirmNode(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border-2 border-amber-300/60 overflow-hidden shadow-[0_0_40px_rgba(251,191,36,0.35)]"
            style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(15,23,42,0.95) 60%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <p className="text-[10px] font-black tracking-[0.4em] uppercase text-amber-300 mb-2">Master Promotion</p>
              <h3 className="text-2xl font-black text-white mb-1 leading-tight">승단 심사 신청</h3>
              <div className="my-4 px-4 py-3 rounded-xl bg-black/30 border border-white/10">
                <p className="text-[10px] tracking-[0.2em] uppercase text-amber-300/80 mb-1">Skill</p>
                <p className="text-base sm:text-lg font-bold text-white">{nodeDisplayTitle(promotionConfirmNode)}</p>
                <p className="text-[11px] text-emerald-300/80 mt-1">5/5 마스터 완료</p>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                이 스킬에 대한 승단 심사를<br />소속 체육관에 신청하시겠어요?
              </p>
              <p className="text-[11px] text-amber-200/60 mt-2">
                심사가 진행되는 동안엔 다시 신청할 수 없습니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 bg-black/40">
              <button
                type="button"
                onClick={() => setPromotionConfirmNode(null)}
                className="py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 font-semibold transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmSubmitPromotion}
                className="py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-extrabold transition-all active:scale-[0.98]"
              >
                신청하기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 신청 완료 토스트 */}
      {promotionResultMessage ? (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] px-5 py-3 rounded-2xl border border-emerald-400/50 shadow-[0_0_30px_rgba(52,211,153,0.4)]"
          style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))' }}
        >
          <p className="text-sm sm:text-base font-bold text-white text-center whitespace-nowrap">
            ★ {promotionResultMessage}
          </p>
        </div>
      ) : null}

      {/* 처리 안 된 마스터 노드 배너 — 다른 스킬 잠금 안내 */}
      {pendingPromotion ? (() => {
        const bannerLabel = (() => {
          switch (pendingPromotion.status) {
            case 'pending':    return '승단 심사 대기 중';
            case 'reviewing':  return '승단 심사 진행 중';
            case 'rejected':   return '승단 거절 — 재신청 필요';
            default:           return '승단 심사 신청 필요';
          }
        })();
        const bannerHint = (() => {
          switch (pendingPromotion.status) {
            case 'pending':
            case 'reviewing':  return '· 심사가 끝날 때까지 다른 스킬 투자 잠금';
            case 'rejected':   return '· 재신청 후 승인 받기 전까지 다른 스킬 잠금';
            default:           return '· 승단 신청 + 승인 받기 전까지 다른 스킬 잠금';
          }
        })();
        return (
          <div className="mx-3 sm:mx-4 px-3 py-2.5 rounded-xl border border-cyan-400/40 bg-cyan-500/10 flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-cyan-400/20 border border-cyan-300/50 text-cyan-200 text-sm flex-shrink-0">
              ★
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold tracking-wider text-cyan-300/80 uppercase mb-0.5">{bannerLabel}</div>
              <div className="text-sm text-white truncate">
                <span className="font-extrabold text-cyan-100">{pendingPromotionName}</span>
                <span className="text-white/70"> {bannerHint}</span>
              </div>
            </div>
          </div>
        );
      })() : null}

      {/* 페이지 타이틀 + 요약 버튼 */}
      <div className="px-3 sm:px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {setActiveTab && onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="뒤로가기"
              className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all flex items-center justify-center group"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-white transition-colors">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          )}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">스킬</h1>
        </div>
        <button
          type="button"
          onClick={() => setSummaryOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] hover:border-white/25 transition-all text-xs sm:text-sm font-semibold text-white/85"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <circle cx="3.5" cy="6" r="1" />
            <circle cx="3.5" cy="12" r="1" />
            <circle cx="3.5" cy="18" r="1" />
          </svg>
          내 스킬 요약
        </button>
      </div>

      {/* 상단 — SP + 초기화권 */}
      <SpotlightCard className="p-3 sm:p-4 border border-white/12 bg-gradient-to-br from-slate-900/90 to-slate-950/90">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* SP */}
          <div className="min-w-0 shrink-0">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">스킬 포인트</p>
            <p className="text-lg sm:text-2xl font-extrabold tabular-nums text-cyan-300 truncate">
              {skillPoints}<span className="text-xs sm:text-sm text-cyan-400/60 ml-1">SP</span>
            </p>
          </div>

          <div className="h-9 w-px bg-white/10" />

          {/* 초기화권 + 사용 버튼 */}
          <div className="min-w-0 flex-1 flex items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">초기화권</p>
              <p className="text-lg sm:text-2xl font-extrabold tabular-nums text-violet-300 truncate">
                {skillResetTickets}<span className="text-xs sm:text-sm text-violet-300/60 ml-1">장</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetSkillTree}
              disabled={busy || skillResetTickets < 1}
              className="shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border-2 border-violet-400/45 bg-violet-500/15 text-xs sm:text-sm font-bold text-violet-100 hover:bg-violet-500/25 hover:border-violet-300/65 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-violet-500/15"
            >
              트리 초기화
            </button>
          </div>
        </div>
      </SpotlightCard>

      {errorMessage ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-100">{errorMessage}</div>
      ) : null}

      {/* 탭 — 1 → 2 → 3 순차 진행 시각화 */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {PUNCH_TABS.map((tab, idx) => {
          const active = tab.key === selectedTab;
          const tabTheme = ACCENT_THEME[tab.accent];
          const isLast = idx === PUNCH_TABS.length - 1;
          return (
            <Fragment key={tab.key}>
              <button
                type="button"
                onClick={() => handleTabClick(tab)}
                className={`flex-1 min-w-0 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border-2 inline-flex items-center justify-center gap-1.5 ${
                  active
                    ? tabTheme.tabActive
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white/85 hover:border-white/20'
                }`}
              >
                <span
                  className={`shrink-0 inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[9px] sm:text-[10px] font-black tabular-nums ${
                    active ? 'bg-white/15 text-white' : 'bg-white/10 text-white/50'
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="truncate">{tab.label}</span>
              </button>
              {!isLast ? (
                <span
                  className="shrink-0 text-white/35 text-sm sm:text-base font-bold select-none"
                  aria-hidden
                >
                  →
                </span>
              ) : null}
            </Fragment>
          );
        })}
      </div>

      {/* 탭 잠금 경고 배너 (현재 탭이 잠겼을 때만) */}
      {!tabUnlocked ? (
        <div className="rounded-xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-amber-700/5 px-4 py-3 flex items-center gap-3">
          <span className="text-xl shrink-0">🔒</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-100">{currentTab.label} 탭은 아직 잠겨 있어요</p>
            <p className="text-xs text-amber-200/70 mt-0.5">
              <span className="font-semibold text-amber-100">{REQUIRES_LABEL[currentTab.requires]}</span> 일반 스킬을 모두 마스터하면 해금됩니다.
            </p>
          </div>
        </div>
      ) : null}

      {dataLoading || authLoading ? (
        <SpotlightCard className="p-8 text-center text-sm text-white/60">불러오는 중...</SpotlightCard>
      ) : !user?.id ? (
        <SpotlightCard className="p-4 border border-amber-500/25 bg-amber-500/[0.06]">
          <p className="text-sm text-amber-100/90">로그인이 필요합니다.</p>
        </SpotlightCard>
      ) : sortedNodesForTab.length === 0 ? (
        <SpotlightCard className="p-8 text-center text-sm text-white/60">표시할 스킬이 없습니다.</SpotlightCard>
      ) : (
        <div
          onClick={(e) => {
            if (!e.target.closest('[data-skill-interactive]')) {
              setSelectedNodeId(null);
            }
          }}
        >
          <SpotlightCard className={`p-3 sm:p-5 border border-white/12 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95 ${!tabUnlocked ? 'opacity-50 pointer-events-none' : ''} ${busy ? 'pointer-events-none' : ''}`}>
            <SkillTree
              nodes={sortedNodesForTab}
              expByNodeId={expByNodeId}
              nodeByNumber={nodeByNumber}
              selectedId={selectedNodeId}
              burstNodeId={burstNodeId}
              burstKey={burstKey}
              theme={theme}
              themeAccent={currentTab.accent}
              onSelectNode={setSelectedNodeId}
              onAddSkill={handleAddSkill}
              promotionByNodeId={promotionByNodeId}
              onSubmitPromotion={handleSubmitPromotion}
              sp={skillPoints}
              busy={busy}
              hasSelection={selectedNodeId != null}
              inProgressNodeId={inProgressNodeId}
              inProgressNodeName={inProgressNodeName}
              pendingPromotionNodeId={pendingPromotion?.nodeId ?? null}
              pendingPromotionName={pendingPromotionName}
              nextTabCta={(() => {
                if (!currentTabReady || !currentTab.next) return null;
                const nextTabConfig = PUNCH_TABS.find((tab) => tab.key === currentTab.next);
                if (!nextTabConfig) return null;
                return {
                  show: true,
                  label: currentTab.nextLabel,
                  onClick: () => handleTabClick(nextTabConfig),
                  accent: nextTabConfig.accent, // 'cyan' | 'orange' | 'violet' | 'rose'
                };
              })()}
            />
          </SpotlightCard>
        </div>
      )}
    </div>
  );
};

export { ActiveSkillsView };

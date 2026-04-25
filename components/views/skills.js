'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function isUnlocked(node, expByNodeId, nodeByNumber) {
  const parents = getParentNumbers(node);
  if (!parents.length) return true;
  return parents.some((pNum) => {
    const p = nodeByNumber.get(pNum);
    if (!p) return false;
    return (expByNodeId.get(p.id) || 0) >= 1;
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
function ConnectorPath({
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
}

/** 16방향 스파크 버스트 — 스킬 찍었을 때 카드 위에 오버레이 (크고 화려) */
function SkillBurst({ mastered }) {
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
}

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
function SkillNodeCard({ node, exp, unlocked, selected, dimmed, burst, burstKey, onSelect, themeAccent, softLocked }) {
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
      className={`group relative shrink-0 w-[82px] h-[64px] sm:w-[104px] sm:h-[74px] rounded-xl transition-all duration-200 ease-out ${ringClass} ${dimClass} ${lockedOpacity} ${softLockClass} ${punchClass} ${pickableGlowClass} ${
        clickable ? 'cursor-pointer hover:scale-[1.06] hover:-translate-y-0.5 active:scale-[1.02]' : 'cursor-not-allowed'
      }`}
      style={{ boxShadow: outerShadow }}
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
            style={{ width: `${(exp / MAX_EXP) * 100}%`, background: progressColor }}
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

      {/* 이름 — 정중앙 */}
      <div className="absolute inset-x-0 top-0 bottom-[14px] flex items-center justify-center px-2 pt-2 z-[2]">
        <span
          className="text-[11px] sm:text-[12.5px] font-bold leading-[1.12] text-center line-clamp-2 tracking-[-0.01em]"
          style={{ color: textColor }}
        >
          {nodeDisplayTitle(node)}
        </span>
      </div>

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
}

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

      {/* 2) 비네트 (가장자리 어둡게) */}
      <div className="unlock-vignette absolute inset-0 pointer-events-none" aria-hidden />

      {/* 1.5) 분위기 부유 입자 — 화면 곳곳에서 천천히 떠오름 */}
      {floats.map((f, i) => (
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

      {/* 1.7) 반짝임 — 화면 곳곳에서 깜빡 */}
      {sparkles.map((s, i) => (
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
                const fillPct = (exp / MAX_EXP) * 100;
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
function InlineExpPanel({ node, exp, sp, unlocked, busy, theme, onAddSkill, blockedByOther, blockedByName }) {
  const mastered = exp >= MAX_EXP;
  const cost = Number(node?.point_cost ?? 1);
  const canAfford = sp >= cost;
  const fillPct = (exp / MAX_EXP) * 100;
  const expGradient = getExpGradient(exp, theme.expBar);
  // 활성(찍을 수 있는) 상태일 때만 펄스 — "찍어주세요" 신호
  const canAdd = unlocked && !busy && !mastered && canAfford && !blockedByOther;

  return (
    <div
      data-skill-interactive
      className={`shrink-0 w-[168px] sm:w-[200px] h-[64px] sm:h-[74px] rounded-xl border-2 ${theme.panelBorder} bg-slate-900/95 px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-[0_0_24px_rgba(15,23,42,0.6)] overflow-hidden flex flex-col gap-1 relative`}
    >
      <div className={`absolute -inset-1 bg-gradient-to-br ${theme.panelGlow} via-transparent to-transparent pointer-events-none`} aria-hidden />

      {/* 위: 스킬 추가 버튼 — 활성이면 펄스 */}
      <button
        type="button"
        onClick={onAddSkill}
        disabled={!canAdd}
        title={blockedByOther ? `'${blockedByName}' 을(를) 먼저 마스터하세요` : undefined}
        className={`relative w-full px-1.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-all ${
          mastered
            ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 cursor-not-allowed'
            : !unlocked || !canAfford || blockedByOther
              ? 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
              : `bg-gradient-to-r ${theme.button} text-white shadow active:scale-[0.98] ${canAdd ? 'skill-add-pulse' : ''}`
        }`}
      >
        {mastered
          ? '마스터'
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
            {Array.from({ length: MAX_EXP - 1 }).map((_, i) => (
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
  const cardW = isWide ? 104 : 82;
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
        style={{ width: totalW, height: totalH, minWidth: '100%' }}
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
          const unlocked = !sibLocked && isUnlocked(node, expByNodeId, nodeByNumber);
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
                softLocked={Boolean(inProgressNodeId) && inProgressNodeId !== node.id}
              />
            </div>
          );
        })}

        {/* 다음 탭 CTA — 메인 spine 끝 자리에 인라인 카드 형태 */}
        {showCta ? (
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
              className={`group w-full h-full rounded-xl border-2 ${nextTabCta.borderClass} bg-gradient-to-r ${nextTabCta.bgClass} text-white font-bold text-xs sm:text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 px-2 skill-add-pulse`}
            >
              <span className="leading-tight text-center">{nextTabCta.label}</span>
              <span className="text-base group-hover:translate-x-1 transition-transform shrink-0">→</span>
            </button>
          </div>
        ) : null}

        {/* 선택 노드 옆 EXP 패널 */}
        {selectedId && positions.has(selectedId) ? (() => {
          const sel = nodes.find((n) => n.id === selectedId);
          const pos = positions.get(selectedId);
          if (!sel || !pos) return null;
          const exp = expByNodeId.get(sel.id) || 0;
          const sibLocked = siblingLockSet.has(sel.id);
          const unlocked = !sibLocked && isUnlocked(sel, expByNodeId, nodeByNumber);
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
              />
            </div>
          );
        })() : null}
      </div>
    </div>
  );
}

/** 메인 뷰 */
const ActiveSkillsView = () => {
  const { user, loading: authLoading } = useAuth();
  const [dataLoading, setDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [treeNodes, setTreeNodes] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [skillPoints, setSkillPoints] = useState(0);
  const [skillResetTickets, setSkillResetTickets] = useState(0);
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

  /** 선택된 노드를 화면에 잘 보이게 자동 포커스 (가로 스크롤 + 세로 정렬) */
  useEffect(() => {
    if (selectedNodeId == null) return;
    const id = selectedNodeId;
    // 패널 마운트·레이아웃 안정 후 스크롤
    const timer = setTimeout(() => {
      const row = document.querySelector(`[data-skill-row="${id}"]`);
      if (!row) return;
      // 1) 가로 스크롤 컨테이너 안에서 카드+패널이 가운데 오도록
      row.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      // 2) 모바일에서 티어 섹션 자체가 뷰포트 밖이면 살짝 보이도록 살짝만 세로 스크롤
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
    }, 80);
    return () => clearTimeout(timer);
  }, [selectedNodeId]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setDataLoading(true);
    setErrorMessage('');
    try {
      const { getSkillTreeNodes, getUserSkillNodeProgress, getUserSkillWallet } = await import('@/lib/supabase');
      const { data: nodes, error: nodesError } = await getSkillTreeNodes();
      if (nodesError) throw nodesError;

      const filtered = (nodes || []).filter((n) => n.zone !== 'legendary');
      setTreeNodes(filtered);

      const [{ data: progRows, error: progError }, { data: wallet }] = await Promise.all([
        getUserSkillNodeProgress(user.id),
        getUserSkillWallet(user.id),
      ]);
      if (progError) {
        setErrorMessage('진행 데이터를 불러오지 못했습니다. sql/33_redesign_skill_tree.sql 적용 여부를 확인해 주세요.');
        setProgressRows([]);
      } else {
        setProgressRows(progRows || []);
      }
      if (wallet) {
        setSkillPoints(Number(wallet.skill_points ?? 0));
        setSkillResetTickets(Number(wallet.skill_reset_tickets ?? 0));
      }
    } catch (e) {
      console.error('[ActiveSkillsView] load:', e);
      setErrorMessage(e?.message || '스킬 데이터를 불러오지 못했습니다.');
    } finally {
      setDataLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

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

  /** 진행 중(0<exp<5)인 노드 — 마스터 전까지 다른 스킬 추가 차단 */
  const inProgressNode = useMemo(() => {
    for (const n of treeNodes) {
      const e = expByNodeId.get(n.id) || 0;
      if (e > 0 && e < MAX_EXP) return n;
    }
    return null;
  }, [treeNodes, expByNodeId]);
  const inProgressNodeId = inProgressNode?.id ?? null;
  const inProgressNodeName = inProgressNode ? nodeDisplayTitle(inProgressNode) : '';

  const handleAddSkill = useCallback(async (nodeId) => {
    // ref 기반 동기 락 — React state 갱신 전 빠른 연타도 차단
    if (busyRef.current) return;

    // 다른 진행 중 스킬이 있으면 차단 (마스터 전까지 다른 스킬 추가 불가)
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
        alert(error.message || '스킬 추가에 실패했습니다.');
        return;
      }
      const newExp = Number(data?.out_exp_level ?? data?.exp_level ?? 0);
      const newSp = Number(data?.out_sp_remaining ?? data?.sp_remaining ?? skillPoints);
      setSkillPoints(newSp);
      setProgressRows((prev) => {
        const others = prev.filter((r) => r.node_id !== nodeId);
        return [...others, { node_id: nodeId, exp_level: newExp, updated_at: new Date().toISOString() }];
      });
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
  }, [skillPoints, treeNodes, expByNodeId]);

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

  // 요약 페이지 모드 — 트리 전체를 대체
  if (summaryOpen) {
    return (
      <SkillSummaryPage
        nodes={treeNodes}
        expByNodeId={expByNodeId}
        onBack={() => setSummaryOpen(false)}
      />
    );
  }

  /**
   * 탭 진행 완료 검사 — 다음 탭 해금 / CTA 표시 조건
   *  - 해당 탭의 common 노드가 1개 이상 있으면: common 전체 마스터
   *  - common 노드가 없으면(분류 미완): specific 노드 전체 마스터로 대체
   *  - 둘 다 없으면 false
   *  - 레거시 'common' 도 straight 탭에서 인정
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

  /** 현재 탭이 잠겨있는지 — 선행 탭이 진행 완료됐는지 */
  const requiresTabKey = currentTab.requires === 'common_straight' ? 'straight'
    : currentTab.requires === 'common_hook' ? 'hook'
    : currentTab.requires === 'common_upper' ? 'upper'
    : currentTab.requires === 'common_advanced' ? 'advanced'
    : null;
  const tabUnlocked = !requiresTabKey || isTabAdvanced(requiresTabKey);

  /** 다음 탭 CTA 표시 — 현재 탭이 진행 완료됐는지 */
  const currentTabReady = isTabAdvanced(currentTab.key);

  /** 해금된 탭을 처음 클릭할 때 축하 이펙트 트리거 (탭마다 1회) */
  const handleTabClick = useCallback((tab) => {
    setSelectedTab(tab.key);
    setSelectedNodeId(null);

    if (typeof window === 'undefined') return;
    if (!tab.requires) return; // 첫 탭(스트레이트)은 해금 개념 없음

    // localStorage 캐시 초기화
    if (celebratedTabsRef.current === null) {
      try {
        const raw = window.localStorage.getItem('skill_celebrated_tabs_v3');
        celebratedTabsRef.current = raw ? new Set(JSON.parse(raw)) : new Set();
      } catch {
        celebratedTabsRef.current = new Set();
      }
    }
    if (celebratedTabsRef.current.has(tab.key)) return; // 이미 본 탭

    // 선행 탭 진행 완료 검사
    const reqKey = tab.requires === 'common_straight' ? 'straight'
      : tab.requires === 'common_hook' ? 'hook'
      : tab.requires === 'common_upper' ? 'upper'
      : tab.requires === 'common_advanced' ? 'advanced'
      : null;
    if (!reqKey || !isTabAdvanced(reqKey)) return; // 아직 해금 안 됨

    // 처음 진입 — 이펙트 발사
    celebratedTabsRef.current.add(tab.key);
    try {
      window.localStorage.setItem(
        'skill_celebrated_tabs_v3',
        JSON.stringify(Array.from(celebratedTabsRef.current))
      );
    } catch {
      /* ignore */
    }
    setCelebrationTab(tab);
  }, [isTabAdvanced]);

  return (
    <div className="animate-fade-in-up space-y-3 sm:space-y-4">
      {/* 탭 해금 축하 오버레이 */}
      <UnlockCelebration tab={celebrationTab} onDone={() => setCelebrationTab(null)} />

      {/* 페이지 타이틀 + 요약 버튼 */}
      <div className="px-3 sm:px-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">스킬</h1>
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
              sp={skillPoints}
              busy={busy}
              hasSelection={selectedNodeId != null}
              inProgressNodeId={inProgressNodeId}
              inProgressNodeName={inProgressNodeName}
              nextTabCta={(() => {
                if (!currentTabReady || !currentTab.next) return null;
                const nextTabConfig = PUNCH_TABS.find((tab) => tab.key === currentTab.next);
                if (!nextTabConfig) return null;
                const nextTheme = ACCENT_THEME[nextTabConfig.accent];
                const borderMap = {
                  cyan: 'border-cyan-300/60',
                  orange: 'border-orange-300/60',
                  violet: 'border-violet-300/60',
                  rose: 'border-rose-300/60',
                };
                return {
                  show: true,
                  label: currentTab.nextLabel,
                  onClick: () => handleTabClick(nextTabConfig),
                  bgClass: nextTheme.button,
                  borderClass: borderMap[nextTabConfig.accent] || 'border-white/30',
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

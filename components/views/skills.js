'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

/** 맵·목록: 짧은 노드 제목 (기획 5장). 없으면 DB name */
function nodeDisplayTitle(node) {
  if (!node) return '';
  const t = node.display_title;
  return t != null && String(t).trim() !== '' ? String(t).trim() : node.name;
}

/** 맵 노드 하단 부제 (목업 소제목). DB map_subtitle */
function nodeMapSubtitle(node) {
  if (!node) return '';
  const t = node.map_subtitle;
  return t != null && String(t).trim() !== '' ? String(t).trim() : '';
}

/** 제목과 동일·중복인 부제는 맵에 그리지 않음 (이중 글자 완화) */
function mapSubtitleVisible(node) {
  const sub = nodeMapSubtitle(node);
  if (!sub) return false;
  const title = nodeDisplayTitle(node);
  if (String(title).trim().toLowerCase() === String(sub).trim().toLowerCase()) return false;
  return true;
}

function nodeIsMilestone(node) {
  return node?.is_milestone === true || node?.is_milestone === 'true';
}


/** 필터: 맵 하이라이트·아래 목록 공통 */
const zoneMatchesFilter = (zone, filter) => {
  if (filter === 'all') return true;
  if (filter === 'legendary') return zone === 'legendary';
  return zone === filter;
};

const getNodeShapeClass = (node) => {
  if (node.zone === 'legendary' || node.node_type === 'legendary_socket') {
    return 'rotate-45 rounded-xl';
  }
  return 'rounded-xl';
};

const SELECTION_RING_CLASS =
  'ring-[3px] ring-amber-300/90 ring-offset-2 ring-offset-[#141c32]';

const getUnlockedNodeToneClass = (_node, isSelected) => {
  const selected = isSelected ? SELECTION_RING_CLASS : '';
  const base =
    'font-bold border-2 scale-[1.02] z-20 shadow-[0_2px_14px_rgba(15,23,42,0.35)]';
  return `bg-gradient-to-br from-[#4a3d22] to-[#2e2614] text-[#fff8e7] border-[#e6c565]/88 ${base} ${selected}`;
};

const getUnlockedBottomAccentClass = () =>
  'bg-gradient-to-r from-transparent via-amber-400/88 to-transparent';

const getNodeToneClass = ({ node, isUnlocked, isSelected, isDimmed, isUnlockableOnly, isLocked }) => {
  if (isUnlocked) {
    return getUnlockedNodeToneClass(node, isSelected);
  }

  const selected = isSelected ? SELECTION_RING_CLASS : '';

  if (isUnlockableOnly) {
    const opacity = isDimmed ? 'opacity-60' : 'opacity-100';
    return `bg-[#1e2d42]/95 text-slate-100 border border-cyan-400/50 shadow-[0_0_8px_rgba(34,211,238,0.18)] ${opacity} ${selected}`;
  }

  const bgClass = 'bg-[#2a3148]/92';
  const borderClass = 'border-slate-400/45';
  const opacity = isDimmed ? 'opacity-50' : (isLocked ? 'opacity-82' : 'opacity-98');
  const textTone = isDimmed ? 'text-slate-500' : 'text-slate-200';

  return `${bgClass} ${textTone} border ${borderClass} shadow-sm ${opacity} ${selected}`;
};

const getNodeSizeClass = (node, hasSubtitle) => {
  if (node.zone === 'legendary') return 'w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12';
  if (node.node_type === 'socket') {
    return 'min-w-[4rem] min-h-[2.1rem] max-w-[6rem] px-1 py-0.5 sm:min-w-[5.5rem] sm:min-h-[2.4rem]';
  }
  if (hasSubtitle || nodeIsMilestone(node)) {
    return 'min-w-[4.25rem] min-h-[2.75rem] max-w-[6.75rem] px-1 py-1 sm:min-w-[5.75rem] sm:max-w-[8rem] sm:min-h-[3.25rem]';
  }
  return 'min-w-[4rem] min-h-[2.1rem] max-w-[6rem] px-1 py-0.5 sm:min-w-[5.5rem] sm:max-w-[7.25rem] sm:min-h-[2.5rem]';
};

const MAX_NON_FORK_INVEST = 1;

function nonForkInvestmentCount(nodeId, unlockedIds, progressByNodeId) {
  const pr = progressByNodeId.get(nodeId);
  const raw = pr?.investment_count;
  if (raw != null && raw !== undefined) return Number(raw);
  if (unlockedIds.has(nodeId)) return 1;
  return 0;
}

function parentsSatisfiedForDisplay(node, unlockedIds, progressByNodeId, nodeByNumber) {
  if (!node?.parent_nodes?.length) return true;
  return node.parent_nodes.some((pNum) => {
    const pNode = nodeByNumber.get(pNum);
    if (!pNode) return false;
    if (pNode.is_fork) {
      const pr = progressByNodeId.get(pNode.id);
      if (!pr || pr.promotion_status !== 'passed') return false;
      return Number(pr.chosen_branch_node_number) === Number(node.node_number);
    }
    return unlockedIds.has(pNode.id);
  });
}

function nodeReadyForEdge(n, unlockedIds, progressByNodeId) {
  if (!n?.is_fork) return unlockedIds.has(n.id);
  const pr = progressByNodeId.get(n.id);
  if (pr?.promotion_status === 'passed') return true;
  return (pr?.investment_count || 0) > 0;
}

function isForkNodeActive(node, unlockedIds, progressByNodeId) {
  if (!node?.is_fork) return unlockedIds.has(node.id);
  const pr = progressByNodeId.get(node.id);
  if (!pr) return false;
  if (pr.promotion_status === 'passed') return true;
  return (pr.investment_count || 0) > 0 || pr.promotion_status === 'pending';
}

/** 부모→자식 연결선: 포크 부모는 승단 완료 후 선택한 분기와 일치할 때만 */
function parentEdgeSatisfied(parentNode, childNode, unlockedIds, progressByNodeId) {
  if (!parentNode?.is_fork) return unlockedIds.has(parentNode.id);
  const pr = progressByNodeId.get(parentNode.id);
  if (!pr || pr.promotion_status !== 'passed') return false;
  return Number(pr.chosen_branch_node_number) === Number(childNode.node_number);
}

/** 기록한 노드에서 위로 선행만 추적해 “진행 경로” 하이라이트용 */
function collectPathRelatedNodeIds(treeNodes, unlockedNodeIds, progressByNodeId, nodeByNumber) {
  const ids = new Set();
  const visitUp = (nodeNum) => {
    const n = nodeByNumber.get(nodeNum);
    if (!n) return;
    ids.add(n.id);
    for (const p of n.parent_nodes || []) {
      visitUp(p);
    }
  };
  for (const n of treeNodes) {
    const active = n.is_fork
      ? isForkNodeActive(n, unlockedNodeIds, progressByNodeId)
      : unlockedNodeIds.has(n.id);
    if (active) visitUp(n.node_number);
  }
  if (ids.size === 0) {
    const root = treeNodes.find((x) => x.node_number === SKILL_TREE_ENTRY_NODE_NUMBER);
    if (root) ids.add(root.id);
  }
  return ids;
}

/** 스킬 맵 실제 좌표계 (표시용 % 좌표는 이 크기 기준) */
const SKILL_MAP_WIDTH = 2200;
const SKILL_MAP_HEIGHT = 1520;

/** DB `position_x` / `position_y`(0~100) 그대로 사용. 노드 간 선형 재매핑·열 간격 보정 없음(개별 좌표 독립). */
function mapCoordFromDb(value) {
  const v = Number(value);
  if (Number.isNaN(v)) return 50;
  return Math.min(300, Math.max(0, v));
}

/** 중앙 직선 스파인: 1(잽)에서 시작 → 26 → 생활체육대회(421~423) 한 줄로 통합 배치 */
const CENTER_SPINE_UNIFIED_ORDER = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
  421, 422, 423,
];
/** 맵 세로 논리 좌표 상한(비튜토리얼 DB clamp). 스파인은 이보다 클 수 있음 → paddedMaxYPct로 정규화 */
const MAP_COORD_EXTENT = 100;
/** 튜토리얼 중앙 스파인: 연속 노드 사이 세로 간격(논리 좌표, 잽 기준 시작은 아래 START+GAP) */
const SPINE_UNIFIED_STEP_Y = 5;
const SPINE_UNIFIED_START_Y = 5;
/** '중앙 수직축: 기본기' 배지 ↔ 첫 노드(잽) 사이 */
const SPINE_BADGE_TO_FIRST_NODE_GAP = 8;
/** 스파인 최하단·범례용 하단 여백(논리 좌표에 합산 → top% 분모) */
const MAP_VERTICAL_TAIL_PAD_PCT = 24;

function applyUnifiedCenterSpineY(positionById, nodes) {
  const byNum = new Map(nodes.map((n) => [n.node_number, n]));
  const spineNodes = CENTER_SPINE_UNIFIED_ORDER.map((num) => byNum.get(num)).filter(Boolean);
  const y0 = SPINE_UNIFIED_START_Y + SPINE_BADGE_TO_FIRST_NODE_GAP;
  spineNodes.forEach((node, i) => {
    const pos = positionById.get(node.id);
    if (pos) {
      pos.y = y0 + i * SPINE_UNIFIED_STEP_Y;
    }
  });
}

const ZOOM_MIN = 0.12;
const ZOOM_MAX = 2.05;
const ZOOM_DEFAULT = 0.82;
const ZOOM_STEP_FACTOR = 1.12;

/** 좁은 화면에서도 노드 텍스트가 읽히도록 최소 줌 0.55 보장 — 맵이 화면보다 크면 패닝으로 탐색 */
function computeFitZoomForViewportWidth(widthPx) {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return ZOOM_DEFAULT;
  const scaledWAtDefault = SKILL_MAP_WIDTH * ZOOM_DEFAULT;
  if (widthPx >= scaledWAtDefault) return ZOOM_DEFAULT;
  const raw = (widthPx * 0.92) / SKILL_MAP_WIDTH;
  return Math.max(0.55, Math.min(ZOOM_DEFAULT, raw));
}

/** SVG viewBox 높이 (가로 100과 맞춤) */
const VIEWBOX_H = 56;

/** 하단 범례(목업과 동일 색 체계) */
const SKILL_MAP_LEGEND = [
  { key: 'common', dot: 'bg-white', label: '공통' },
  { key: 'c', dot: 'bg-blue-400', label: '(C) 회피' },
  { key: 'g', dot: 'bg-cyan-400', label: '(G) 공격' },
  { key: 'a', dot: 'bg-violet-400', label: '(A) 카운터' },
  { key: 'ik', dot: 'bg-emerald-400', label: '(I/K) 고도화' },
  { key: 'n', dot: 'bg-red-400', label: '(N) 압박' },
  { key: 'r', dot: 'bg-orange-400', label: '(R) 바디' },
  { key: 't', dot: 'bg-amber-300', label: '(T) 고도화' },
];

/** DB map_lane → 엣지 색 (활성/비활성) */
const MAP_LANE_EDGE = {
  common: { active: 'rgba(212,175,55,0.92)', inactive: 'rgba(212,175,55,0.22)' },
  c: { active: 'rgba(96,165,250,0.9)', inactive: 'rgba(96,165,250,0.2)' },
  g: { active: 'rgba(34,211,238,0.9)', inactive: 'rgba(34,211,238,0.2)' },
  a: { active: 'rgba(167,139,250,0.9)', inactive: 'rgba(167,139,250,0.2)' },
  ik: { active: 'rgba(52,211,153,0.9)', inactive: 'rgba(52,211,153,0.2)' },
  n: { active: 'rgba(248,113,113,0.9)', inactive: 'rgba(248,113,113,0.2)' },
  r: { active: 'rgba(251,146,60,0.9)', inactive: 'rgba(251,146,60,0.2)' },
  t: { active: 'rgba(252,211,77,0.9)', inactive: 'rgba(252,211,77,0.2)' },
};

const ZONE_ORDER = { tutorial: 0, infighter: 1, outboxer: 2, legendary: 3 };

/** 스킬 트리 유일 시작 노드 — 잽. 부모 없음은 이 번호만 허용. */
const SKILL_TREE_ENTRY_NODE_NUMBER = 1;

/** parent_nodes 기반 단계(depth) 계산 — 선행 노드를 찍으면 다음 단계 */
function computeSkillTreeDepths(nodes) {
  const depth = new Map();
  depth.set(SKILL_TREE_ENTRY_NODE_NUMBER, 0);

  for (let iter = 0; iter < nodes.length + 10; iter += 1) {
    let changed = false;
    for (const n of nodes) {
      if (n.node_number === SKILL_TREE_ENTRY_NODE_NUMBER) continue;
      let nd;
      if (!n.parent_nodes?.length) {
        // 루트는 잽만 — 무부모인 다른 노드는 잽부터 이어지지 않은 데이터로 여기서는 건너뜀
        continue;
      } else {
        let maxP = -1;
        let missing = false;
        for (const p of n.parent_nodes) {
          const pd = depth.get(p);
          if (pd === undefined) {
            missing = true;
            break;
          }
          maxP = Math.max(maxP, pd);
        }
        if (missing) continue;
        nd = maxP + 1;
      }
      if (depth.get(n.node_number) !== nd) {
        depth.set(n.node_number, nd);
        changed = true;
      }
    }
    if (!changed) break;
  }

  for (const n of nodes) {
    if (!depth.has(n.node_number)) depth.set(n.node_number, 1);
  }
  return depth;
}

function spreadInRange(count, xMin, xMax) {
  if (count <= 0) return [];
  if (count === 1) return [(xMin + xMax) / 2];
  return Array.from({ length: count }, (_, i) => xMin + (i / (count - 1)) * (xMax - xMin));
}

/** true: DB `position_x`/`position_y`(0~100) 직접 사용. 스파인 1~26·421~423만 y 통합(applyUnifiedCenterSpineY). */
const MAP_LAYOUT_USE_DB_COORDINATES = true;

const SPINE_CENTER_X = 50;
/** 같은 depth에 tutorial이 여러 개일 때 세로 간격(%). 가로는 벌리지 않음(엑셀 E열 한 줄). */
const SPINE_STACK_DY = 2.65;
/** 좌·우 진영 고정 X. 같은 단계에서 형제는 가로가 아니라 Y로만 쌓음(엑셀 C/G·N/R 분기). */
const OUT_ZONE_X = 26;
const IN_ZONE_X = 74;
const SIDE_STACK_DY = 3.25;

/**
 * 중앙 세로 스파인 = 공통 기본기(tutorial) · 좌 = 아웃복싱 · 우 = 인파이팅 · 아래로 심화
 * 공통 기본기는 항상 x=50 직선(엑셀 한 열). 같은 단계에 여러 튜토리얼이 있으면 y만 살짝 나눔.
 * 아웃·인은 고정 X 열에서만 배치하고, 같은 단계의 형제는 가로가 아니라 Y로만 쌓음.
 */
function computeSkillTreeLayout(nodes) {
  if (!nodes?.length) {
    return {
      positionById: new Map(),
      depthMap: new Map(),
      maxDepth: 0,
      mapMaxYPct: 5,
      paddedMaxYPct: 100,
      mapContentHeightPx: SKILL_MAP_HEIGHT,
      mapViewBoxH: VIEWBOX_H,
    };
  }

  const depthMap = computeSkillTreeDepths(nodes);
  const maxDepth = Math.max(0, ...nodes.map((n) => depthMap.get(n.node_number) ?? 0));

  if (MAP_LAYOUT_USE_DB_COORDINATES) {
    const positionById = new Map();
    for (const n of nodes) {
      const d = depthMap.get(n.node_number) ?? 0;
      const role =
        n.zone === 'tutorial'
          ? 'spine'
          : n.zone === 'outboxer'
            ? 'outboxer'
            : n.zone === 'infighter'
              ? 'infighter'
              : 'other';
      positionById.set(n.id, {
        x: mapCoordFromDb(n.position_x),
        y: mapCoordFromDb(n.position_y),
        depth: d,
        role,
      });
    }
    /** 튜토리얼 중앙 스파인(1~26, 421~423)만 y를 통합 배치 — 그 외(배잽 424·아웃/인 등)는 DB 좌표 그대로 */
    applyUnifiedCenterSpineY(positionById, nodes);

    let mapMaxYPct = 0;
    for (const pos of positionById.values()) {
      mapMaxYPct = Math.max(mapMaxYPct, pos.y);
    }
    /** 튜토리얼 스파인 간격 10으로 y가 100 초과 가능 → 전체 맵 높이에 맞춰 top%/SVG 정규화 */
    const paddedMaxYPct = mapMaxYPct + MAP_VERTICAL_TAIL_PAD_PCT;
    const mapViewBoxH = Math.max(VIEWBOX_H, (paddedMaxYPct / 100) * VIEWBOX_H);
    const mapContentHeightPx = SKILL_MAP_HEIGHT * (Math.max(100, paddedMaxYPct) / 100);

    return {
      positionById,
      depthMap,
      maxDepth,
      mapMaxYPct,
      paddedMaxYPct,
      mapContentHeightPx,
      mapViewBoxH,
    };
  }

  const byDepth = new Map();
  for (const n of nodes) {
    const d = depthMap.get(n.node_number) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d).push(n);
  }

  const positionById = new Map();

  const sortRow = (arr) =>
    [...arr].sort((a, b) => {
      const za = ZONE_ORDER[a.zone] ?? 9;
      const zb = ZONE_ORDER[b.zone] ?? 9;
      if (za !== zb) return za - zb;
      return a.node_number - b.node_number;
    });

  for (let d = 0; d <= maxDepth; d += 1) {
    const row = byDepth.get(d);
    if (!row?.length) continue;

    const y = 5 + (d / Math.max(maxDepth, 1)) * 88;

    const tut = sortRow(row.filter((n) => n.zone === 'tutorial'));
    const out = sortRow(row.filter((n) => n.zone === 'outboxer'));
    const inf = sortRow(row.filter((n) => n.zone === 'infighter'));
    const leg = sortRow(row.filter((n) => n.zone === 'legendary'));
    const other = sortRow(
      row.filter((n) => !['tutorial', 'infighter', 'outboxer', 'legendary'].includes(n.zone))
    );

    /** 공통 기본기: 엑셀 E열처럼 한 열에만 쌓임 — 항상 x=50, 겹칠 때만 y를 세로로 분할 */
    tut.forEach((n, i) => {
      const stackOff =
        tut.length <= 1 ? 0 : (i - (tut.length - 1) / 2) * SPINE_STACK_DY;
      positionById.set(n.id, {
        x: SPINE_CENTER_X,
        y: y + stackOff,
        depth: d,
        role: 'spine',
      });
    });

    /** 아웃복싱: 왼쪽 고정 열, 형제는 Y로만 분산 */
    out.forEach((n, i) => {
      const stackOff =
        out.length <= 1 ? 0 : (i - (out.length - 1) / 2) * SIDE_STACK_DY;
      positionById.set(n.id, {
        x: OUT_ZONE_X,
        y: y + stackOff,
        depth: d,
        role: 'outboxer',
      });
    });

    /** 인파이팅: 오른쪽 고정 열, 형제는 Y로만 분산 */
    inf.forEach((n, i) => {
      const stackOff =
        inf.length <= 1 ? 0 : (i - (inf.length - 1) / 2) * SIDE_STACK_DY;
      positionById.set(n.id, {
        x: IN_ZONE_X,
        y: y + stackOff,
        depth: d,
        role: 'infighter',
      });
    });

    /** 전설: 중앙 띠에 가깝게 */
    spreadInRange(leg.length, 48.5, 51.5).forEach((x, i) => {
      positionById.set(leg[i].id, { x, y, depth: d, role: 'legendary' });
    });

    spreadInRange(other.length, 40, 60).forEach((x, i) => {
      positionById.set(other[i].id, { x, y, depth: d, role: 'other' });
    });
  }

  return {
    positionById,
    depthMap,
    maxDepth,
    mapMaxYPct: 5,
    paddedMaxYPct: 100,
    mapContentHeightPx: SKILL_MAP_HEIGHT,
    mapViewBoxH: VIEWBOX_H,
  };
}

/** yPct: 맵 논리 y. yExtentPct: 맵 세로 범위(보통 paddedMaxYPct, 스파인 간격 10이면 100 초과). */
function toSvgXY(xPct, yPct, viewBoxH = VIEWBOX_H, yExtentPct = MAP_COORD_EXTENT) {
  const den = Math.max(1e-6, Number(yExtentPct));
  return { x: Number(xPct), y: (Number(yPct) / den) * viewBoxH };
}

/** 노드 박스 반경(뷰박스 단위): 측면·위·아래 연결 지점 — 목업처럼 중심이 아닌 가장자리에서 나감 */
const NODE_EDGE_HALF_X = 2.35;
const NODE_EDGE_HALF_Y = 1.12;

function applyEdgeAnchor(pt, side) {
  switch (side) {
    case 'right':
      return { x: pt.x + NODE_EDGE_HALF_X, y: pt.y };
    case 'left':
      return { x: pt.x - NODE_EDGE_HALF_X, y: pt.y };
    case 'bottom':
      return { x: pt.x, y: pt.y + NODE_EDGE_HALF_Y };
    case 'top':
      return { x: pt.x, y: pt.y - NODE_EDGE_HALF_Y };
    default:
      return { ...pt };
  }
}

/** 부모→자식 방향에 따라 출발/도착 면 선택 (좌우 열: 옆면, 수직 스파인: 위·아래) */
function pickEdgeAnchorSides(pxPct, pyPct, cxPct, cyPct, viewBoxH = VIEWBOX_H, yExtentPct = MAP_COORD_EXTENT) {
  const p = toSvgXY(pxPct, pyPct, viewBoxH, yExtentPct);
  const c = toSvgXY(cxPct, cyPct, viewBoxH, yExtentPct);
  const dx = c.x - p.x;
  const dy = c.y - p.y;
  const horizDominant = Math.abs(dx) >= Math.abs(dy) * (100 / viewBoxH);
  if (horizDominant) {
    return dx >= 0 ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' };
  }
  return dy >= 0 ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' };
}

/** ㄱ자 경로: 좌우 열 사다리·스파인 수직이 목업에 가깝게 */
function edgePathElbow(sx, sy, ex, ey, horizontalFirst) {
  const tol = 0.06;
  if (Math.abs(sx - ex) < tol && Math.abs(sy - ey) < tol) return `M ${sx} ${sy}`;
  if (Math.abs(sy - ey) < tol) return `M ${sx} ${sy} L ${ex} ${ey}`;
  if (Math.abs(sx - ex) < tol) return `M ${sx} ${sy} L ${ex} ${ey}`;
  if (horizontalFirst) return `M ${sx} ${sy} L ${ex} ${sy} L ${ex} ${ey}`;
  return `M ${sx} ${sy} L ${sx} ${ey} L ${ex} ${ey}`;
}

function skillEdgePathD(parentNode, node, cx, cy, viewBoxH = VIEWBOX_H, yExtentPct = MAP_COORD_EXTENT) {
  const pxPct = cx(parentNode);
  const pyPct = cy(parentNode);
  const cxPct = cx(node);
  const cyPct = cy(node);
  const sides = pickEdgeAnchorSides(pxPct, pyPct, cxPct, cyPct, viewBoxH, yExtentPct);
  const pCenter = toSvgXY(pxPct, pyPct, viewBoxH, yExtentPct);
  const cCenter = toSvgXY(cxPct, cyPct, viewBoxH, yExtentPct);
  const start = applyEdgeAnchor(pCenter, sides.from);
  const end = applyEdgeAnchor(cCenter, sides.to);
  const horizFirst = sides.from === 'right' || sides.from === 'left';
  return edgePathElbow(start.x, start.y, end.x, end.y, horizFirst);
}

/** 맵 좌표(px): 노드 중심 — 뷰포트 컬링용 */
function getNodePixelPos(node, skillTreeLayout, mapH) {
  const lay = skillTreeLayout?.positionById?.get(node.id);
  const yDen = skillTreeLayout?.paddedMaxYPct ?? 100;
  const leftPct = lay ? lay.x : mapCoordFromDb(node?.position_x ?? 50);
  const topPct = lay
    ? (lay.y / Math.max(1e-6, yDen)) * 100
    : (mapCoordFromDb(node?.position_y ?? 50) / Math.max(1e-6, yDen)) * 100;
  return {
    nx: (leftPct / 100) * SKILL_MAP_WIDTH,
    ny: (topPct / 100) * mapH,
  };
}

/** 노드 대략 크기 (픽셀, 맵 좌표계) — 프레이밍용 */
function getNodeApproxSize(node) {
  const mapSub = mapSubtitleVisible(node) ? nodeMapSubtitle(node) : '';
  const milestone = nodeIsMilestone(node);
  if (node.zone === 'legendary') return { w: 80, h: 80 };
  if (node.node_type === 'socket') return { w: 90, h: 50 };
  if (mapSub || milestone) return { w: 110, h: 70 };
  return { w: 90, h: 55 };
}

function computeFrameZoom(node, _skillTreeLayout, _mapH, vw, vh) {
  const size = getNodeApproxSize(node);
  const paddingFactor = 5.5;
  const targetW = size.w * paddingFactor;
  const targetH = size.h * paddingFactor;
  const zoomW = vw / targetW;
  const zoomH = vh / targetH;
  const rawZ = Math.min(zoomW, zoomH);
  return Math.min(ZOOM_MAX * 0.7, Math.max(ZOOM_MIN * 2.5, rawZ));
}

/** 뷰포트(화면)를 맵 좌표계로 투영한 축정렬 사각형 (+ margin) */
function viewportBoundsInMapSpace(vw, vh, pan, z, marginPx) {
  const zi = Math.max(z, 1e-6);
  return {
    x0: -pan.x / zi - marginPx,
    x1: (-pan.x + vw) / zi + marginPx,
    y0: -pan.y / zi - marginPx,
    y1: (-pan.y + vh) / zi + marginPx,
  };
}

const SKILL_MAP_CULL_MARGIN_PX = 340;

/** 선택 노드와 직접 연결된 부모·자식 — 컬링 시 엣지 단절 방지 */
function idsLinkedToSelectedNode(selectedNodeId, treeNodes, nodeByNumber) {
  if (!selectedNodeId || !Array.isArray(treeNodes)) return null;
  const sel = treeNodes.find((n) => n?.id === selectedNodeId);
  if (!sel) return null;
  const out = new Set();
  for (const pNum of sel.parent_nodes || []) {
    const p = nodeByNumber?.get(pNum);
    if (p?.id) out.add(p.id);
  }
  const selNum = Number(sel.node_number);
  for (const n of treeNodes) {
    if (!n?.id) continue;
    if (n.parent_nodes?.some((pn) => Number(pn) === selNum)) out.add(n.id);
  }
  return out;
}

function nodeCenterInMapBounds(nx, ny, bounds) {
  const pad = 140;
  return nx + pad >= bounds.x0 && nx - pad <= bounds.x1 && ny + pad >= bounds.y0 && ny - pad <= bounds.y1;
}

/** 맵 노드 버튼 — 부모 리렌더와 분리 */
const SkillMapNode = memo(function SkillMapNode({
  node,
  leftPct,
  topPct,
  isSelected,
  isUnlocked,
  isHighlighted,
  isUnlockableOnly,
  isLocked,
  mapSub,
  nfInvCount,
  onSelectNode,
}) {
  const milestone = nodeIsMilestone(node);
  const shapeClass = getNodeShapeClass(node);
  const sizeClass = getNodeSizeClass(node, Boolean(mapSub));
  const toneClass = getNodeToneClass({
    node,
    isUnlocked,
    isSelected,
    isDimmed: !isHighlighted,
    isUnlockableOnly,
    isLocked,
  });

  return (
    <button
      type="button"
      onClick={() => onSelectNode?.(node.id)}
      className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-[1.03] ${
        isSelected ? 'z-[25]' : 'z-[5]'
      }`}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
      }}
    >
      <div className="relative">
        <div
          className={`${sizeClass} ${shapeClass} ${toneClass} border-2 flex flex-col items-center justify-center gap-1 relative transition-all overflow-hidden ${
            isSelected ? 'shadow-[0_0_14px_rgba(0,0,0,0.45)]' : ''
          } ${node.is_fork && !isUnlocked ? 'ring-2 ring-amber-500/65 ring-offset-1 ring-offset-[#141c32]' : ''} ${milestone && isUnlocked ? 'ring-1 ring-amber-400/40' : ''}`}
        >
          {isUnlocked && (
            <div
              className={`pointer-events-none absolute bottom-0.5 left-1 right-1 h-[2px] rounded-full opacity-95 ${getUnlockedBottomAccentClass()}`}
              aria-hidden
            />
          )}
          {node.zone === 'legendary' || node.node_type === 'legendary_socket' ? (
            <span className="text-[10px] sm:text-[12px] font-bold leading-none -rotate-45 text-inherit" aria-hidden>
              ★
            </span>
          ) : (
            <>
              {isLocked && (
                <span className="absolute top-0.5 right-0.5 text-[8px] leading-none opacity-70 z-10">🔒</span>
              )}
              {milestone && (
                <span className="text-[10px] sm:text-[11px] leading-none z-[1]" aria-hidden>
                  🏆
                </span>
              )}
              <span
                className={`text-[8px] sm:text-[10px] md:text-[11px] font-semibold leading-tight text-center line-clamp-3 px-0.5 z-[1] ${
                  isUnlocked ? 'text-inherit' : 'text-slate-400'
                }`}
              >
                {nodeDisplayTitle(node)}
              </span>
              {mapSub ? (
                <span
                  className={`text-[7px] sm:text-[8px] font-medium leading-tight text-center line-clamp-2 px-0.5 z-[1] ${
                    isUnlocked ? 'text-inherit opacity-80' : 'text-slate-500'
                  }`}
                >
                  {mapSub}
                </span>
              ) : null}
            </>
          )}
        </div>

        {!node.is_fork && nfInvCount > 0 && MAX_NON_FORK_INVEST > 1 && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 flex flex-col items-center gap-0.5 pointer-events-none max-w-[min(12rem,calc(100vw-2rem))]">
            <p className="text-[6px] sm:text-[7px] text-cyan-300/90 tabular-nums">
              {nfInvCount}/{MAX_NON_FORK_INVEST}
            </p>
          </div>
        )}
      </div>
    </button>
  );
});

/** 맵 뷰포트·패닝·줌·SVG·노드 — memo로 요약/상세 패널 리렌더와 분리 */
const SkillTreeMapPanel = memo(function SkillTreeMapPanel({
  user,
  errorMessage,
  treeNodes = [],
  skillTreeLayout = {},
  nodeByNumber = new Map(),
  unlockedNodeIds = new Set(),
  progressByNodeId = new Map(),
  highlightedNodeIds = new Set(),
  selectedNodeId,
  onSelectNode = () => {},
}) {
  const [mapNavigateMode, setMapNavigateMode] = useState(false);
  const [skillMapHelpOpen, setSkillMapHelpOpen] = useState(false);

  const skillViewportRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [isPanningMap, setIsPanningMap] = useState(false);
  const panDragRef = useRef({
    active: false,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    originPanX: 0,
    originPanY: 0,
  });
  const pointersRef = useRef(new Map());
  const pinchRef = useRef({ active: false, startDist: 1, startZoom: ZOOM_DEFAULT });
  const mapCenteredRef = useRef(false);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(ZOOM_DEFAULT);
  const mapTransformLayerRef = useRef(null);
  const panGestureActiveRef = useRef(false);
  const pinchGestureActiveRef = useRef(false);
  const wheelPanSettleTimerRef = useRef(null);
  const wheelZoomUiRafRef = useRef(null);
  const wheelCullSuppressTimerRef = useRef(null);
  const [suppressViewportCull, setSuppressViewportCull] = useState(false);
  const prevSelectedForFocusRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const [mapCullDisabledMobile, setMapCullDisabledMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setMapCullDisabledMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const selectionLinkedNodeIds = useMemo(
    () => idsLinkedToSelectedNode(selectedNodeId, treeNodes, nodeByNumber),
    [selectedNodeId, treeNodes, nodeByNumber]
  );

  const clampPan = useCallback(
    (x, y, vw = viewportSize.w, vh = viewportSize.h, z = zoomRef.current) => {
      const w = vw;
      const h = vh;
      if (w <= 0 || h <= 0) return { x, y };
      const mapH = skillTreeLayout?.mapContentHeightPx ?? SKILL_MAP_HEIGHT;
      const sw = SKILL_MAP_WIDTH * z;
      const sh = mapH * z;
      const minX = Math.min(0, w - sw);
      const minY = Math.min(0, h - sh);
      return {
        x: Math.min(0, Math.max(minX, x)),
        y: Math.min(0, Math.max(minY, y)),
      };
    },
    [viewportSize.w, viewportSize.h, skillTreeLayout?.mapContentHeightPx]
  );

  const applyMapTransformDom = useCallback(() => {
    const el = mapTransformLayerRef.current;
    if (!el) return;
    const { x, y } = panRef.current;
    const z = zoomRef.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
  }, []);

  const scheduleWheelZoomUiSync = useCallback(() => {
    if (wheelZoomUiRafRef.current != null) return;
    wheelZoomUiRafRef.current = requestAnimationFrame(() => {
      wheelZoomUiRafRef.current = null;
      setZoom(zoomRef.current);
      setPan({ ...panRef.current });
    });
  }, []);

  const mapContentHeightPx = skillTreeLayout?.mapContentHeightPx ?? SKILL_MAP_HEIGHT;

  const visibleNodeIds = useMemo(() => {
    const vw = viewportSize.w;
    const vh = viewportSize.h;
    if (suppressViewportCull || mapCullDisabledMobile || vw <= 0 || vh <= 0) {
      return new Set((treeNodes || []).map((n) => n?.id).filter(Boolean));
    }
    const b = viewportBoundsInMapSpace(vw, vh, pan, zoom, SKILL_MAP_CULL_MARGIN_PX);
    const ids = new Set();
    for (const n of treeNodes || []) {
      if (!n?.id) continue;
      const { nx, ny } = getNodePixelPos(n, skillTreeLayout, mapContentHeightPx);
      if (nodeCenterInMapBounds(nx, ny, b)) ids.add(n.id);
    }
    if (selectedNodeId) ids.add(selectedNodeId);
    if (selectionLinkedNodeIds) {
      for (const id of selectionLinkedNodeIds) ids.add(id);
    }
    return ids;
  }, [
    treeNodes,
    skillTreeLayout,
    mapContentHeightPx,
    viewportSize.w,
    viewportSize.h,
    pan,
    zoom,
    suppressViewportCull,
    mapCullDisabledMobile,
    selectedNodeId,
    selectionLinkedNodeIds,
  ]);

  const nodesToRender = useMemo(() => {
    if (!Array.isArray(treeNodes)) return [];
    if (suppressViewportCull) return treeNodes;
    return treeNodes.filter((n) => n && visibleNodeIds.has(n.id));
  }, [treeNodes, visibleNodeIds, suppressViewportCull]);

  const edgesToRender = useMemo(() => {
    if (!Array.isArray(treeNodes)) return [];
    return treeNodes.flatMap((node) => {
      if (!node || !node.parent_nodes || node.parent_nodes.length === 0) return [];
      return node.parent_nodes.map((parentNum) => {
        const parentNode = nodeByNumber?.get(parentNum);
        if (!parentNode) return null;
        const cx = (n) => Number(skillTreeLayout?.positionById?.get(n?.id)?.x ?? n?.position_x ?? 50);
        const cy = (n) =>
          Number(
            skillTreeLayout?.positionById?.get(n?.id)?.y ?? mapCoordFromDb(n?.position_y ?? 50)
          );
        const edgeD = skillEdgePathD(
          parentNode,
          node,
          cx,
          cy,
          skillTreeLayout?.mapViewBoxH ?? VIEWBOX_H,
          skillTreeLayout?.paddedMaxYPct ?? 100
        );
        const childLit = node.is_fork
          ? nodeReadyForEdge(node, unlockedNodeIds, progressByNodeId)
          : (unlockedNodeIds?.has(node.id) || false);
        const isActiveLine =
          parentEdgeSatisfied(parentNode, node, unlockedNodeIds, progressByNodeId) && childLit;
        const filtered = !(
          (highlightedNodeIds?.has(node.id) || false) && (highlightedNodeIds?.has(parentNode.id) || false)
        );
        const pathHighlight =
          (highlightedNodeIds?.has(parentNode.id) || false) &&
          (highlightedNodeIds?.has(node.id) || false);
        const showEdge =
          suppressViewportCull ||
          visibleNodeIds.has(parentNode.id) ||
          visibleNodeIds.has(node.id) ||
          pathHighlight;
        if (!showEdge) return null;
        const spineEdge = parentNode.zone === 'tutorial' && node.zone === 'tutorial';
        const laneKey = (node.map_lane && String(node.map_lane).toLowerCase()) || '';
        const laneStroke = laneKey && MAP_LANE_EDGE[laneKey];
        let stroke = 'rgba(120,133,158,0.58)';
        if (laneStroke) {
          stroke = isActiveLine ? laneStroke.active : laneStroke.inactive;
        } else if (isActiveLine && spineEdge) stroke = 'rgba(212,175,55,0.92)';
        else if (isActiveLine && node.zone === 'legendary') stroke = 'rgba(250,204,21,0.95)';
        else if (isActiveLine && node.zone === 'infighter') stroke = 'rgba(251,146,60,0.9)';
        else if (isActiveLine && node.zone === 'outboxer') stroke = 'rgba(45,212,191,0.88)';
        else if (!isActiveLine && node.zone === 'infighter') stroke = 'rgba(251,146,60,0.2)';
        else if (!isActiveLine && node.zone === 'outboxer') stroke = 'rgba(45,212,191,0.2)';
        else if (!isActiveLine && node.zone === 'legendary') stroke = 'rgba(250,204,21,0.22)';
        else if (!isActiveLine && spineEdge) stroke = 'rgba(212,175,55,0.22)';
        return {
          key: `${parentNode.id}-${node.id}`,
          d: edgeD,
          stroke,
          strokeWidth: isActiveLine ? 0.5 : 0.32,
          opacity: filtered ? 0.16 : 1,
        };
      });
    }).filter(Boolean);
  }, [
    treeNodes,
    nodeByNumber,
    skillTreeLayout,
    unlockedNodeIds,
    progressByNodeId,
    highlightedNodeIds,
    suppressViewportCull,
    visibleNodeIds,
  ]);

  const applyZoomAtPoint = useCallback(
    (nextZoom, focalX, focalY, syncMode = 'react') => {
      const z0 = zoomRef.current;
      const z1 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
      if (Math.abs(z1 - z0) < 1e-6) return;
      const px = panRef.current.x;
      const py = panRef.current.y;
      const mapX = (focalX - px) / z0;
      const mapY = (focalY - py) / z0;
      const newPanX = focalX - mapX * z1;
      const newPanY = focalY - mapY * z1;
      const nextPan = clampPan(newPanX, newPanY, viewportSize.w, viewportSize.h, z1);
      zoomRef.current = z1;
      panRef.current = nextPan;
      if (pinchGestureActiveRef.current) {
        applyMapTransformDom();
        return;
      }
      if (syncMode === 'raf') {
        applyMapTransformDom();
        scheduleWheelZoomUiSync();
        return;
      }
      setZoom(z1);
      setPan(nextPan);
    },
    [viewportSize.w, viewportSize.h, clampPan, applyMapTransformDom, scheduleWheelZoomUiSync]
  );

  useLayoutEffect(() => {
    if (panGestureActiveRef.current || pinchGestureActiveRef.current) return;
    panRef.current = pan;
    zoomRef.current = zoom;
    applyMapTransformDom();
  }, [pan, zoom, applyMapTransformDom]);

  const zoomInCenter = useCallback(() => {
    const el = skillViewportRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    applyZoomAtPoint(zoomRef.current * ZOOM_STEP_FACTOR, width / 2, height / 2);
  }, [applyZoomAtPoint]);

  const zoomOutCenter = useCallback(() => {
    const el = skillViewportRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    applyZoomAtPoint(zoomRef.current / ZOOM_STEP_FACTOR, width / 2, height / 2);
  }, [applyZoomAtPoint]);

  const resetMapZoom = useCallback(() => {
    const el = skillViewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const z = computeFitZoomForViewportWidth(rect.width);
    zoomRef.current = z;
    const mapH = skillTreeLayout?.mapContentHeightPx ?? SKILL_MAP_HEIGHT;
    const sw = SKILL_MAP_WIDTH * z;
    const sh = mapH * z;
    const p = clampPan((rect.width - sw) / 2, (rect.height - sh) / 2, rect.width, rect.height, z);
    panRef.current = p;
    setZoom(z);
    setPan(p);
  }, [clampPan, skillTreeLayout?.mapContentHeightPx]);

  useLayoutEffect(() => {
    const el = skillViewportRef.current;
    if (!el) return undefined;

    const mapH = skillTreeLayout?.mapContentHeightPx ?? SKILL_MAP_HEIGHT;

    const applySize = (width, height) => {
      setViewportSize({ w: width, h: height });
      if (!mapCenteredRef.current && width > 0 && height > 0) {
        mapCenteredRef.current = true;
        const fitZ = computeFitZoomForViewportWidth(width);
        zoomRef.current = fitZ;
        setZoom(fitZ);
        const sw = SKILL_MAP_WIDTH * fitZ;
        const sh = mapH * fitZ;
        const nextPan = {
          x: (width - sw) / 2,
          y: (height - sh) / 2,
        };
        panRef.current = nextPan;
        setPan(nextPan);
        return;
      }
      setPan((prev) => {
        const z = zoomRef.current;
        const sw = SKILL_MAP_WIDTH * z;
        const sh = mapH * z;
        const minX = Math.min(0, width - sw);
        const minY = Math.min(0, height - sh);
        return {
          x: Math.min(0, Math.max(minX, prev.x)),
          y: Math.min(0, Math.max(minY, prev.y)),
        };
      });
    };

    applySize(el.getBoundingClientRect().width, el.getBoundingClientRect().height);
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      applySize(width, height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [skillTreeLayout?.mapContentHeightPx]);

  useEffect(() => {
    if (!mapNavigateMode) {
      panDragRef.current = {
        active: false,
        pointerId: null,
        startClientX: 0,
        startClientY: 0,
        originPanX: 0,
        originPanY: 0,
      };
      pointersRef.current.clear();
      pinchRef.current.active = false;
      setIsPanningMap(false);
    }
  }, [mapNavigateMode]);

  useEffect(() => {
    if (!skillMapHelpOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setSkillMapHelpOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skillMapHelpOpen]);

  useEffect(() => {
    if (selectedNodeId == null) return;
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      prevSelectedForFocusRef.current = selectedNodeId;
      return;
    }
    if (suppressViewportCull || isPanningMap) return;
    if (prevSelectedForFocusRef.current === selectedNodeId) return;
    const node = treeNodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    const vw = viewportSize.w;
    const vh = viewportSize.h;
    if (vw <= 0 || vh <= 0) return;
    prevSelectedForFocusRef.current = selectedNodeId;
    const mapH = skillTreeLayout?.mapContentHeightPx ?? SKILL_MAP_HEIGHT;
    const { nx, ny } = getNodePixelPos(node, skillTreeLayout, mapH);
    
    const targetZ = computeFrameZoom(node, skillTreeLayout, mapH, vw, vh);
    const panX = vw / 2 - nx * targetZ;
    const panY = vh / 2 - ny * targetZ;
    const next = clampPan(panX, panY, vw, vh, targetZ);
    
    zoomRef.current = targetZ;
    panRef.current = next;
    applyMapTransformDom();
    setZoom(targetZ);
    setPan(next);
  }, [
    selectedNodeId,
    suppressViewportCull,
    isPanningMap,
    treeNodes,
    viewportSize.w,
    viewportSize.h,
    skillTreeLayout,
    clampPan,
    applyMapTransformDom,
  ]);

  useEffect(() => {
    if (!mapNavigateMode) return undefined;
    const el = skillViewportRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSuppressViewportCull(true);
      if (wheelCullSuppressTimerRef.current != null) clearTimeout(wheelCullSuppressTimerRef.current);
      wheelCullSuppressTimerRef.current = setTimeout(() => {
        wheelCullSuppressTimerRef.current = null;
        setSuppressViewportCull(false);
      }, 200);
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (e.ctrlKey) {
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        else if (e.deltaMode === 2) dy *= Math.max(rect.height, 320);
        const delta = -dy;
        const step = Math.sign(delta) * Math.min(Math.abs(delta) * 0.003, 0.18);
        const z0 = zoomRef.current;
        applyZoomAtPoint(z0 * (1 + step), mx, my, 'raf');
      } else {
        let dx = e.deltaX;
        let dy = e.deltaY;
        if (e.deltaMode === 1) { dx *= 18; dy *= 18; }
        else if (e.deltaMode === 2) { dx *= rect.width; dy *= rect.height; }
        const next = clampPan(
          panRef.current.x - dx,
          panRef.current.y - dy,
          viewportSize.w,
          viewportSize.h,
          zoomRef.current
        );
        panRef.current = next;
        applyMapTransformDom();
        if (wheelPanSettleTimerRef.current != null) clearTimeout(wheelPanSettleTimerRef.current);
        wheelPanSettleTimerRef.current = setTimeout(() => {
          wheelPanSettleTimerRef.current = null;
          setPan({ ...panRef.current });
        }, 140);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true });
      if (wheelPanSettleTimerRef.current != null) {
        clearTimeout(wheelPanSettleTimerRef.current);
        wheelPanSettleTimerRef.current = null;
      }
      if (wheelCullSuppressTimerRef.current != null) {
        clearTimeout(wheelCullSuppressTimerRef.current);
        wheelCullSuppressTimerRef.current = null;
      }
    };
  }, [mapNavigateMode, applyZoomAtPoint, clampPan, viewportSize.w, viewportSize.h, applyMapTransformDom]);

  const handleSkillMapPointerDown = (e) => {
    /** 모바일 WebKit: target이 Text 노드면 closest 없음 → 부모 Element 사용 (nodeType 1 = Element) */
    const raw = e.target;
    const fromEl = raw && raw.nodeType === 1 ? raw : raw?.parentElement;
    if (fromEl?.closest?.('button[type="button"]')) return;
    if (!mapNavigateMode) return;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2) {
      pinchGestureActiveRef.current = true;
      panGestureActiveRef.current = false;
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchRef.current = {
        active: true,
        startDist: Math.max(dist, 1),
        startZoom: zoomRef.current,
      };
      panDragRef.current.active = false;
      const prevPid = panDragRef.current.pointerId;
      if (prevPid != null) {
        try {
          skillViewportRef.current?.releasePointerCapture(prevPid);
        } catch {
          /* ignore */
        }
      }
      panDragRef.current.pointerId = null;
      setIsPanningMap(false);
      setSuppressViewportCull(true);
      return;
    }

    if (e.button !== 0 && e.button !== 1 && e.pointerType === 'mouse') return;

    const el = skillViewportRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    panGestureActiveRef.current = true;
    panDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originPanX: panRef.current.x,
      originPanY: panRef.current.y,
    };
    setIsPanningMap(true);
    setSuppressViewportCull(true);
  };

  const handleSkillMapPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchRef.current.active) {
      const el = skillViewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const ratio = dist / pinchRef.current.startDist;
      const z1 = pinchRef.current.startZoom * ratio;
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
      applyZoomAtPoint(z1, midX, midY);
      return;
    }

    if (!panDragRef.current.active || panDragRef.current.pointerId !== e.pointerId) return;
    const d = panDragRef.current;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    const next = clampPan(d.originPanX + dx, d.originPanY + dy, viewportSize.w, viewportSize.h, zoomRef.current);
    panRef.current = next;
    applyMapTransformDom();
  };

  const endSkillMapPan = (e) => {
    const wasPinching = pinchGestureActiveRef.current;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current.active = false;
      pinchGestureActiveRef.current = false;
    }

    if (wasPinching && !pinchGestureActiveRef.current) {
      setZoom(zoomRef.current);
      setPan({ ...panRef.current });
    }

    if (panDragRef.current.active && panDragRef.current.pointerId === e.pointerId) {
      panGestureActiveRef.current = false;
      panDragRef.current.active = false;
      panDragRef.current.pointerId = null;
      setIsPanningMap(false);
      setPan({ ...panRef.current });
      try {
        skillViewportRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    const stillPanning = panDragRef.current.active;
    const stillPinching = Boolean(pinchRef.current.active && pointersRef.current.size >= 2);
    setSuppressViewportCull(Boolean(stillPanning || stillPinching));
  };

  return (
    <>
      <div className="w-full min-w-0 max-w-full">
        <div className="rounded-lg sm:rounded-xl overflow-hidden border border-amber-400/22 sm:border-amber-300/28 shadow-[0_8px_40px_rgba(15,23,42,0.38)] ring-1 ring-amber-950/20">
          <div className="px-3 xs:px-4 sm:px-5 pt-3 sm:pt-4 pb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between bg-gradient-to-r from-[#252238] via-[#1e2238] to-[#1c2034]">
            <div className="min-w-0 w-full sm:flex-1 sm:w-auto">
              <p className="text-base sm:text-xl md:text-2xl font-bold text-white tracking-tight break-words">
                스포티션 복싱 스킬 트리
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between xs:justify-end gap-2 sm:gap-3 w-full min-w-0 sm:w-auto sm:shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={mapNavigateMode}
                onClick={() => setMapNavigateMode((v) => !v)}
                title={mapNavigateMode ? '맵 탐색 중 — 누르면 스크롤 모드' : '맵 탐색 모드로 전환'}
                className={`rounded-xl border w-9 h-9 flex items-center justify-center text-base transition-all shrink-0 ${
                  mapNavigateMode
                    ? 'border-white/20 bg-white/[0.08] text-slate-300 hover:bg-white/[0.12]'
                    : 'border-amber-400/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/28'
                }`}
                aria-label={mapNavigateMode ? '스크롤 모드로 전환' : '맵 탐색 모드로 전환'}
              >
                {mapNavigateMode ? '✕' : '🗺'}
              </button>
              <div className="flex items-center gap-0.5 rounded-xl border border-white/18 bg-white/[0.06] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <button
                  type="button"
                  onClick={zoomOutCenter}
                  disabled={zoom <= ZOOM_MIN + 0.001}
                  className="min-w-[2rem] rounded-lg px-2 py-1.5 text-base font-bold leading-none text-white hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent"
                  aria-label="축소"
                >
                  −
                </button>
                <span className="min-w-[2.85rem] text-center text-[10px] sm:text-xs font-semibold tabular-nums text-slate-300">
                  {(zoom * 100).toFixed(0)}%
                </span>
                <button
                  type="button"
                  onClick={zoomInCenter}
                  disabled={zoom >= ZOOM_MAX - 0.001}
                  className="min-w-[2rem] rounded-lg px-2 py-1.5 text-base font-bold leading-none text-white hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent"
                  aria-label="확대"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={resetMapZoom}
                  className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-400 hover:bg-white/10 hover:text-white"
                  title="줌·위치 초기화"
                  aria-label="줌 초기화"
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
          <div
            ref={skillViewportRef}
            tabIndex={-1}
            className={`relative w-full overflow-hidden bg-[#141c32] select-none outline-none focus:outline-none ${
              mapNavigateMode ? (isPanningMap ? 'cursor-grabbing touch-none' : 'cursor-grab touch-none') : 'cursor-default touch-pan-y'
            }`}
            style={{
              height: 'clamp(280px, 52dvh, 640px)',
              overscrollBehavior: mapNavigateMode ? 'contain' : 'auto',
              touchAction: mapNavigateMode ? 'none' : 'pan-y',
            }}
            onPointerDown={handleSkillMapPointerDown}
            onPointerMove={handleSkillMapPointerMove}
            onPointerUp={endSkillMapPan}
            onPointerCancel={endSkillMapPan}
          >
            {user?.id && treeNodes.length === 0 && !errorMessage && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/45 px-4 text-center pointer-events-none">
                <p className="text-sm text-slate-200 max-w-md">
                  불러온 스킬 노드가 없습니다. DB에 <code className="text-cyan-300/90">skill_tree_nodes</code> 시드가 들어 있는지
                  확인해 주세요.
                </p>
              </div>
            )}
            <div
              ref={mapTransformLayerRef}
              className="absolute top-0 left-0 will-change-transform overflow-visible"
              style={{
                width: SKILL_MAP_WIDTH,
                height: skillTreeLayout?.mapContentHeightPx ?? SKILL_MAP_HEIGHT,
                transformOrigin: '0 0',
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse 80% 50% at 20% 0%, #3d3468, transparent 76%), radial-gradient(ellipse 80% 50% at 80% 100%, #4a2848, transparent 76%), linear-gradient(135deg, #242038 0%, #232a42 50%, #2a2238 100%)',
                }}
              />

              <svg
                className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                style={{ overflow: 'visible' }}
                viewBox={`0 0 100 ${skillTreeLayout?.mapViewBoxH ?? VIEWBOX_H}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="spineBeam" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(212,175,55,0.55)" />
                    <stop offset="50%" stopColor="rgba(251,191,36,0.35)" />
                    <stop offset="100%" stopColor="rgba(180,83,9,0.25)" />
                  </linearGradient>
                </defs>
                <line
                  x1={SPINE_CENTER_X}
                  y1={2}
                x2={SPINE_CENTER_X}
                y2={(skillTreeLayout?.mapViewBoxH ?? VIEWBOX_H) - 2}
                  stroke="url(#spineBeam)"
                  strokeWidth={0.75}
                  opacity={0.42}
                />
                <line
                  x1={SPINE_CENTER_X}
                  y1={2}
                x2={SPINE_CENTER_X}
                y2={(skillTreeLayout?.mapViewBoxH ?? VIEWBOX_H) - 2}
                  stroke="rgba(253,230,138,0.22)"
                  strokeWidth={0.18}
                />

                {edgesToRender.map((edge) => (
                  <path
                    key={edge.key}
                    d={edge.d}
                    fill="none"
                    stroke={edge.stroke}
                    strokeWidth={edge.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={edge.opacity}
                  />
                ))}
              </svg>

              {Array.isArray(nodesToRender) &&
                nodesToRender.map((node) => {
                  if (!node || !node.id) return null;
                  const nfPr = node.is_fork ? progressByNodeId.get(node.id) : null;
                  const forkDone = nfPr?.promotion_status === 'passed';
                  const isUnlocked = node.is_fork
                    ? isForkNodeActive(node, unlockedNodeIds, progressByNodeId)
                    : (unlockedNodeIds?.has(node.id) ?? false);
                  const isSelected = node.id === selectedNodeId;
                  const isHighlighted = highlightedNodeIds?.has(node.id) || false;
                  const parentsOk = parentsSatisfiedForDisplay(node, unlockedNodeIds, progressByNodeId, nodeByNumber);
                  const isUnlockableOnly = !isUnlocked && parentsOk && (!node.is_fork || !forkDone);
                  const isLocked =
                    !isUnlocked &&
                    Boolean(node.parent_nodes?.length) &&
                    !parentsOk &&
                    node.node_number !== SKILL_TREE_ENTRY_NODE_NUMBER;
                  const mapSub = mapSubtitleVisible(node) ? nodeMapSubtitle(node) : '';
                  const lay = skillTreeLayout?.positionById?.get(node.id);
                  const yDen = skillTreeLayout?.paddedMaxYPct ?? 100;
                  const leftPct = lay ? lay.x : mapCoordFromDb(node?.position_x ?? 50);
                  const topPct = lay
                    ? (lay.y / Math.max(1e-6, yDen)) * 100
                    : (mapCoordFromDb(node?.position_y ?? 50) / Math.max(1e-6, yDen)) * 100;
                  const nfInvCount =
                    !node.is_fork && node.id ? nonForkInvestmentCount(node.id, unlockedNodeIds, progressByNodeId) : 0;

                  return (
                    <SkillMapNode
                      key={node.id}
                      node={node}
                      leftPct={leftPct}
                      topPct={topPct}
                      isSelected={isSelected}
                      isUnlocked={isUnlocked}
                      isHighlighted={isHighlighted}
                      isUnlockableOnly={isUnlockableOnly}
                      isLocked={isLocked}
                      mapSub={mapSub}
                      nfInvCount={nfInvCount}
                      onSelectNode={onSelectNode}
                    />
                  );
                })}

              <div className="absolute left-0 right-0 top-6 flex justify-between items-start px-8 sm:px-12 pointer-events-none z-[8]">
                <div className="w-[32%] text-left">
                  <span className="inline-block px-4 py-2 rounded-lg bg-[#1e2d52]/95 border border-[#4a6fb8]/55 text-[#93c4f8] font-semibold text-[8px] sm:text-[10px] shadow-sm">아웃복싱 계보</span>
                </div>
                <div className="w-[36%] text-center">
                  <span className="inline-block px-6 py-2.5 rounded-full bg-[#2a2048]/95 border border-[#6a5090]/55 text-[#d8c8f8] font-semibold text-[8px] sm:text-[10px] shadow-[0_0_18px_rgba(106,80,144,0.35)]">중앙 수직축: 기본기</span>
                </div>
                <div className="w-[32%] text-right">
                  <span className="inline-block px-4 py-2 rounded-lg bg-[#4a2030]/95 border border-[#c05070]/45 text-[#f0a0b0] font-semibold text-[8px] sm:text-[10px] shadow-sm">인파이팅 계보</span>
                </div>
              </div>

              <div className="absolute left-0 right-0 bottom-0 z-[12] pointer-events-none flex justify-center px-1 pb-2 pt-6 bg-gradient-to-t from-[#141c32]/95 via-[#141c32]/50 to-transparent">
                <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 max-w-full rounded-lg border border-white/18 bg-slate-900/35 px-2.5 py-1.5 backdrop-blur-sm shadow-[0_-4px_24px_rgba(15,23,42,0.35)]">
                  {SKILL_MAP_LEGEND.map((item) => (
                    <span
                      key={item.key}
                      className="inline-flex items-center gap-1 text-[7px] sm:text-[8px] text-slate-200/95 whitespace-nowrap"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dot}`} />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="absolute bottom-5 right-4 z-[30] flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/12 text-[13px] font-bold text-slate-100 shadow-[0_4px_20px_rgba(15,23,42,0.35)] backdrop-blur-md pointer-events-auto hover:bg-white/18 transition-colors"
              title="맵 범례·연결선 안내"
              aria-label="맵 범례·연결선 안내 열기"
              aria-expanded={skillMapHelpOpen}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setSkillMapHelpOpen(true);
              }}
            >
              ?
            </button>
          </div>
        </div>
      </div>

      {skillMapHelpOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSkillMapHelpOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="skill-map-help-title"
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0f1020] p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="skill-map-help-title" className="text-lg font-bold text-white mb-2">
              맵 범례·연결선 안내
            </h2>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              노드 사이 선 색은 맵 레인(예: C 회피, G 공격, N 압박, R 바디)을 뜻합니다. 맵 하단 범례와 동일합니다.
            </p>
            <ul className="space-y-2 text-sm text-gray-300 mb-5">
              {SKILL_MAP_LEGEND.map((item) => (
                <li key={item.key} className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                  {item.label}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 font-semibold text-white transition-colors"
              onClick={() => setSkillMapHelpOpen(false)}
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
});

/** 해금·진행 행에서 가장 최근 활동 시각이 있는 노드 id (맵 초기 포커스용) */
function pickMostRecentActivityNodeId(unlockRows, progRows, normalizedTreeNodes) {
  const validIds = new Set();
  for (const n of normalizedTreeNodes || []) {
    if (n?.id != null) validIds.add(n.id);
  }
  const latestByNode = new Map();
  for (const r of unlockRows || []) {
    const nid = r?.node_id;
    if (!validIds.has(nid)) continue;
    const ts = r.unlocked_at ? new Date(r.unlocked_at).getTime() : 0;
    const prev = latestByNode.get(nid) ?? 0;
    if (ts > prev) latestByNode.set(nid, ts);
  }
  for (const r of progRows || []) {
    const nid = r?.node_id;
    if (!validIds.has(nid)) continue;
    const ts = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    const prev = latestByNode.get(nid) ?? 0;
    if (ts > prev) latestByNode.set(nid, ts);
  }
  let bestId = null;
  let bestTs = -1;
  for (const [nid, ts] of latestByNode) {
    if (ts > bestTs) {
      bestTs = ts;
      bestId = nid;
    }
  }
  return bestTs > 0 ? bestId : null;
}

const ActiveSkillsView = ({ t = (key) => key }) => {
  const { user, loading: authLoading } = useAuth();
  const [dataLoading, setDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [treeNodes, setTreeNodes] = useState([]);
  const [unlockedNodeIds, setUnlockedNodeIds] = useState(() => new Set());
  const [progressRows, setProgressRows] = useState([]);
  const [skillPoints, setSkillPoints] = useState(0);
  const [activeFilter] = useState('all');
  const [highlightMode] = useState('none');
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const skillTreeLayout = useMemo(() => computeSkillTreeLayout(treeNodes), [treeNodes]);

  const handleSelectNodeFromMap = useCallback(
    (id) => {
      setSelectedNodeId(id);
    },
    []
  );

  const loadSkillData = useCallback(async () => {
    if (!user?.id) return;

    setDataLoading(true);
    setErrorMessage('');

    try {
      const { getSkillTreeNodes, getUserSkillUnlocks, getUserSkillNodeProgress, getUserSkillWallet, getUserProfile } =
        await import('@/lib/supabase');

      const { data: nodes, error: nodesError } = await getSkillTreeNodes();
      if (nodesError) throw nodesError;

      const normalizedTreeNodes = (nodes || [])
        .filter((n) => n.node_type !== 'legendary_socket')
        .sort((a, b) => a.node_number - b.node_number);
      setTreeNodes(normalizedTreeNodes);

      const [{ data: unlockRows, error: unlockError }, { data: progRows, error: progError }, { data: wallet, error: walletError }] =
        await Promise.all([getUserSkillUnlocks(user.id), getUserSkillNodeProgress(user.id), getUserSkillWallet(user.id)]);

      if (walletError) console.warn('[ActiveSkillsView] 스킬 지갑:', walletError);
      if (wallet && !walletError) {
        setSkillPoints(Number(wallet.skill_points ?? 0));
      } else {
        const { data: profileData, error: profileError } = await getUserProfile(user.id);
        if (profileError) console.warn('[ActiveSkillsView] 프로필(지갑 대체):', profileError);
        setSkillPoints(Number(profileData?.skill_points ?? 0));
      }

      if (progError) {
        const msg = progError.message || '';
        if (msg.includes('user_skill_node_progress') || progError.code === '42P01' || progError.code === 'PGRST205') {
          setErrorMessage(
            (prev) =>
              prev ||
              '승단·갈림길 기능을 쓰려면 sql/08_skill_promotion.sql을 Supabase에 적용해 주세요.'
          );
          setProgressRows([]);
        } else {
          console.warn('[ActiveSkillsView] progress:', progError);
          setProgressRows([]);
        }
      } else {
        setProgressRows(progRows || []);
      }

      if (unlockError) {
        const msg = unlockError.message || '';
        if (msg.includes('user_skill_unlocks') || unlockError.code === '42P01' || unlockError.code === 'PGRST205') {
          setErrorMessage(
            '스킬 포인트로 노드를 찍으려면 DB 준비가 필요합니다. Supabase 대시보드 → SQL Editor에서 프로젝트의 sql/07_skill_points_tree.sql 전체를 실행한 뒤, 이 페이지를 새로고침하세요.'
          );
          setUnlockedNodeIds(new Set());
        } else {
          throw unlockError;
        }
      } else {
        setUnlockedNodeIds(new Set((unlockRows || []).map((r) => r.node_id)));
      }

      const ids = new Set((unlockRows || []).map((r) => r.node_id));
      const progMap = new Map((progRows || []).map((r) => [r.node_id, r]));
      setSelectedNodeId((prev) => {
        if (prev && normalizedTreeNodes.some((n) => n.id === prev)) return prev;
        const recentId = pickMostRecentActivityNodeId(
          unlockError ? [] : unlockRows,
          progError ? [] : progRows,
          normalizedTreeNodes
        );
        if (recentId != null) return recentId;
        const firstUnlocked = normalizedTreeNodes.find((n) => {
          if (!n.is_fork) return ids.has(n.id);
          return isForkNodeActive(n, ids, progMap);
        });
        return firstUnlocked?.id || normalizedTreeNodes[0]?.id || null;
      });
    } catch (error) {
      console.error('[ActiveSkillsView] 데이터 로드 에러:', error);
      setErrorMessage(error?.message || '스킬 정보를 불러오지 못했습니다.');
    } finally {
      setDataLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setTreeNodes([]);
      setUnlockedNodeIds(new Set());
      setProgressRows([]);
      setSkillPoints(0);
      setSelectedNodeId(null);
      setErrorMessage('');
      return;
    }
    loadSkillData();
  }, [authLoading, user?.id, loadSkillData]);

  const nodeByNumber = useMemo(
    () => new Map(treeNodes.map((node) => [node.node_number, node])),
    [treeNodes]
  );

  const progressByNodeId = useMemo(() => {
    const m = new Map();
    (progressRows || []).forEach((r) => m.set(r.node_id, r));
    return m;
  }, [progressRows]);

  const unlockedNodesList = useMemo(
    () =>
      treeNodes.filter((n) => {
        if (!n.is_fork) return unlockedNodeIds.has(n.id);
        return isForkNodeActive(n, unlockedNodeIds, progressByNodeId);
      }),
    [treeNodes, unlockedNodeIds, progressByNodeId]
  );

  const zoneFilteredIds = useMemo(() => {
    if (activeFilter === 'all') return new Set(treeNodes.map((n) => n.id));
    return new Set(treeNodes.filter((n) => zoneMatchesFilter(n.zone, activeFilter)).map((n) => n.id));
  }, [activeFilter, treeNodes]);

  const pathRelatedIds = useMemo(
    () => collectPathRelatedNodeIds(treeNodes, unlockedNodeIds, progressByNodeId, nodeByNumber),
    [treeNodes, unlockedNodeIds, progressByNodeId, nodeByNumber]
  );

  const highlightedNodeIds = useMemo(() => {
    if (highlightMode === 'path') {
      const inter = new Set();
      for (const id of pathRelatedIds) {
        if (zoneFilteredIds.has(id)) inter.add(id);
      }
      return inter;
    }
    return zoneFilteredIds;
  }, [highlightMode, zoneFilteredIds, pathRelatedIds]);

  const tutorialCount = unlockedNodesList.filter((n) => n.zone === 'tutorial').length;
  const infighterCount = unlockedNodesList.filter((n) => n.zone === 'infighter').length;
  const outboxerCount = unlockedNodesList.filter((n) => n.zone === 'outboxer').length;

  const pageLoading = authLoading || dataLoading;

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-3 xs:space-y-5 w-full min-w-0 max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 box-border">
      <PageHeader
        title={t('activeSkills')}
      />

      {errorMessage && (
        <SpotlightCard className="p-4 border-l-4 border-red-500">
          <p className="text-sm text-red-300">{errorMessage}</p>
        </SpotlightCard>
      )}

      {!user?.id && (
        <SpotlightCard className="p-4 border border-amber-500/25 bg-amber-500/[0.06]">
          <p className="text-sm text-amber-100/90">
            로그인한 계정에서만 스킬 트리와 찍은 노드 정보를 불러올 수 있습니다. 상단에서 로그인한 뒤 다시 열어 주세요.
          </p>
        </SpotlightCard>
      )}

      <SpotlightCard className="border border-white/12 bg-gradient-to-r from-[#1e2238]/80 to-[#1a1e30]/80 px-5 py-4">
        <div className="flex items-center gap-6">
          <div className="shrink-0 min-w-[4rem]">
            <p className="text-lg font-extrabold tracking-tight text-white leading-tight">스킬 요약</p>
          </div>
          <div className="w-px self-stretch bg-white/10 shrink-0" />
          <div className="flex items-center gap-5 flex-1 justify-between overflow-x-auto">
            {[
              { label: '기록', value: unlockedNodesList.length, color: 'text-white' },
              { label: 'SP', value: skillPoints, color: 'text-cyan-300' },
              { label: '기본', value: tutorialCount, color: 'text-slate-300' },
              { label: '인파', value: infighterCount, color: 'text-orange-300' },
              { label: '아웃', value: outboxerCount, color: 'text-emerald-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col items-center shrink-0">
                <span className="text-base font-semibold text-gray-300 mb-0.5">{label}</span>
                <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </SpotlightCard>

      <div className="w-full">
        <SkillTreeMapPanel
          user={user}
          errorMessage={errorMessage}
          treeNodes={treeNodes}
          skillTreeLayout={skillTreeLayout}
          nodeByNumber={nodeByNumber}
          unlockedNodeIds={unlockedNodeIds}
          progressByNodeId={progressByNodeId}
          highlightedNodeIds={highlightedNodeIds}
          selectedNodeId={selectedNodeId}
          onSelectNode={handleSelectNodeFromMap}
        />
      </div>
    </div>
  );
};

export { ActiveSkillsView };

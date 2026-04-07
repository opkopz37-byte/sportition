'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

const FILTERS = ['all', 'tutorial', 'infighter', 'outboxer', 'legendary'];

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

function nodeIsMilestone(node) {
  return node?.is_milestone === true || node?.is_milestone === 'true';
}

/** 상세: 엑셀·현장 원문명. 없으면 name */
function nodeSourceName(node) {
  if (!node) return '';
  const t = node.source_name;
  return t != null && String(t).trim() !== '' ? String(t).trim() : node.name;
}

const getTypeBadge = (type) => {
  if (type === 'tutorial') {
    return { label: '공통·기본', className: 'bg-slate-500/15 text-slate-200 border-slate-400/30' };
  }
  if (type === 'infighter') {
    return { label: '인파이터', className: 'bg-orange-500/15 text-orange-200 border-orange-400/30' };
  }

  if (type === 'outboxer') {
    return { label: '아웃복서', className: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' };
  }

  if (type === 'legendary') {
    return { label: '전설', className: 'bg-yellow-500/15 text-yellow-200 border-yellow-400/30' };
  }

  return { label: '기타', className: 'bg-white/10 text-gray-300 border-white/10' };
};

const getFilterLabel = (filter) => {
  switch (filter) {
    case 'tutorial':
      return '공통·기본';
    case 'infighter':
      return '인파이터';
    case 'outboxer':
      return '아웃복서';
    case 'legendary':
      return '전설';
    default:
      return '전체';
  }
};

/** 필터: 맵 하이라이트·아래 목록 공통 */
const zoneMatchesFilter = (zone, filter) => {
  if (filter === 'all') return true;
  if (filter === 'legendary') return zone === 'legendary';
  return zone === filter;
};

const getStyleSummaryFromUnlocks = (unlockedNodes) => {
  const tutorial = unlockedNodes.filter((n) => n.zone === 'tutorial').length;
  const infighter = unlockedNodes.filter((n) => n.zone === 'infighter').length;
  const outboxer = unlockedNodes.filter((n) => n.zone === 'outboxer').length;

  if (infighter === 0 && outboxer === 0) {
    return {
      label: '로드맵 시작 전',
      description:
        tutorial > 0
          ? `공통·기본 노드 ${tutorial}개를 기록했습니다. 인파이터·아웃복서 쪽으로도 훈련 기록을 이어 가 보세요.`
          : '출석으로 쌓인 포인트로 맵에서 노드를 선택해 훈련 기록을 남기면 로드맵이 열립니다.',
      className: 'from-gray-500/20 to-white/5 border-white/10',
    };
  }

  if (infighter === outboxer) {
    return {
      label: '밸런스 로드맵',
      description: `인파이터·아웃복서를 비슷하게 기록한 상태입니다.${tutorial ? ` 공통 ${tutorial}개 포함.` : ''}`,
      className: 'from-violet-500/20 to-indigo-500/10 border-violet-400/20',
    };
  }

  if (infighter > outboxer) {
    return {
      label: '인파이터 중심',
      description: '근거리·압박 쪽 훈련 기록이 더 많습니다.',
      className: 'from-orange-500/20 to-red-500/10 border-orange-400/20',
    };
  }

  return {
    label: '아웃복서 중심',
    description: '거리·운영 쪽 훈련 기록이 더 많습니다.',
    className: 'from-emerald-500/20 to-cyan-500/10 border-emerald-400/20',
  };
};

const getNodeSymbol = (node, isUnlocked) => {
  if (isUnlocked) {
    if (node.zone === 'legendary') return '✦';
    if (node.zone === 'tutorial') return '◎';
    return '★';
  }
  if (node.zone === 'legendary') return '✦';
  if (node.zone === 'tutorial') return '◎';
  return '•';
};

const getNodeShapeClass = (node) => {
  if (node.zone === 'legendary' || node.node_type === 'legendary_socket') {
    return 'rotate-45 rounded-xl';
  }
  return 'rounded-xl';
};

/** 로드맵 스킬트리 톤: 해금 시 밝은 흰색, 미해금 시 각 존별 옅은 테두리와 어두운 배경 */
const getNodeToneClass = ({ node, isUnlocked, isSelected, isDimmed, isUnlockableOnly, isLocked }) => {
  if (isUnlocked) {
    const selected = isSelected ? 'ring-4 ring-white/50 ring-offset-2 ring-offset-[#070818]' : '';
    return `bg-white text-black border border-white font-bold shadow-[0_0_20px_rgba(255,255,255,1)] scale-[1.05] z-20 ${selected}`;
  }

  // Base background for all locked/inactive nodes
  const bgClass = 'bg-[#151423]/90 backdrop-blur-sm';
  let borderClass = 'border-slate-700/50';

  if (node.zone === 'outboxer') borderClass = 'border-[#2860a4]/70';
  else if (node.zone === 'infighter') borderClass = 'border-[#9c2b4e]/70';
  else if (node.zone === 'tutorial') borderClass = 'border-[#5b3c88]/70';
  else if (node.zone === 'legendary') borderClass = 'border-amber-400/70';

  const selected = isSelected ? 'ring-2 ring-slate-400/50 ring-offset-2 ring-offset-[#070818]' : '';
  const opacity = isDimmed ? 'opacity-30' : (isLocked ? 'opacity-60' : 'opacity-90');

  return `${bgClass} text-slate-400 border ${borderClass} shadow-sm ${opacity} ${selected}`;
};

const getNodeSizeClass = (node, hasSubtitle) => {
  if (node.zone === 'legendary') return 'w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10';
  if (node.node_type === 'socket') return 'min-w-[4rem] min-h-[2rem] max-w-[6rem] px-1 py-1 sm:min-w-[4.75rem]';
  if (hasSubtitle || nodeIsMilestone(node)) {
    return 'min-w-[4.25rem] min-h-[2.85rem] max-w-[7rem] px-1 py-1 sm:min-w-[5rem] sm:max-w-[7.25rem]';
  }
  return 'min-w-[4rem] min-h-[2rem] max-w-[6rem] px-1 py-1 sm:min-w-[4.75rem] sm:max-w-[6.5rem]';
};

const nodePointCost = (node) => Number(node?.point_cost ?? 1);

const MAX_NON_FORK_INVEST = 5;

/** 비포크: 노드당 누적 찍기 횟수 (진행 행 없고 unlock만 있는 레거시는 1로 간주) */
function nonForkInvestmentCount(nodeId, unlockedIds, progressByNodeId) {
  const pr = progressByNodeId.get(nodeId);
  const raw = pr?.investment_count;
  if (raw != null && raw !== undefined) return Number(raw);
  if (unlockedIds.has(nodeId)) return 1;
  return 0;
}

/** 승단 실패 n회 기준 필요 투자 횟수 (5회 이상이면 0 = 신청만) */
function requiredForkInvestments(failCount) {
  const f = Number(failCount) || 0;
  if (f >= 5) return 0;
  return 5 * (f + 1);
}

function parentsSatisfiedForDisplay(node, unlockedIds, progressByNodeId, nodeByNumber) {
  if (!node?.parent_nodes?.length) return true;
  return node.parent_nodes.every((pNum) => {
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
    const root = treeNodes.find((x) => x.node_number === 1) || treeNodes[0];
    if (root) ids.add(root.id);
  }
  return ids;
}

function walkUpChain(node, nodeByNumber) {
  const chain = [node];
  let cur = node;
  for (let i = 0; i < 48; i += 1) {
    if (!cur?.parent_nodes?.length) break;
    const p = nodeByNumber.get(cur.parent_nodes[0]);
    if (!p) break;
    chain.unshift(p);
    cur = p;
  }
  return chain;
}

const getRoadmapInterpretation = (unlockedNodes, tutorialCount, infighterCount, outboxerCount) => {
  if (unlockedNodes.length === 0) {
    return {
      tendency: '아직 기록된 훈련 항목이 없습니다.',
      stageHint: '시작 단계 — 공통 기본기부터 로드맵을 열 수 있습니다.',
      expansion: '아웃복서(거리·운영)와 인파이터(근거리·압박) 양쪽 모두 선택할 수 있습니다.',
    };
  }
  if (infighterCount === 0 && outboxerCount === 0) {
    return {
      tendency: `공통·기본기 중심으로 ${tutorialCount}개 항목을 기록 중입니다.`,
      stageHint: '분기 계열로 확장하기 전 단계입니다.',
      expansion: '준비가 되면 아웃복서·인파이터 쪽으로 자유롭게 이어갈 수 있습니다.',
    };
  }
  if (infighterCount > 0 && outboxerCount > 0) {
    return {
      tendency: `공통 ${tutorialCount}개 포함 · 인파이터 ${infighterCount} · 아웃복서 ${outboxerCount}로 양쪽을 함께 밟고 있습니다.`,
      stageHint: '양 계열을 오가며 로드맵을 넓히는 단계입니다.',
      expansion: '한쪽만 고정하지 않고 선행만 지키며 계속 확장할 수 있습니다.',
    };
  }
  if (infighterCount > outboxerCount) {
    return {
      tendency: `공통 ${tutorialCount}개 포함 · 인파이터 쪽 기록이 더 많습니다.`,
      stageHint: '근거리·압박 흐름을 주로 밟는 단계입니다.',
      expansion: '거리·운영(아웃복서) 쪽도 선행만 맞추면 언제든 연결할 수 있습니다.',
    };
  }
  return {
    tendency: `공통 ${tutorialCount}개 포함 · 아웃복서 쪽 기록이 더 많습니다.`,
    stageHint: '거리·운영 흐름을 주로 밟는 단계입니다.',
    expansion: '근거리·압박(인파이터) 쪽도 선행만 맞추면 언제든 연결할 수 있습니다.',
  };
};

/** 스킬 맵 실제 좌표계 (표시용 % 좌표는 이 크기 기준) */
const SKILL_MAP_WIDTH = 2200;
const SKILL_MAP_HEIGHT = 1232;

const ZOOM_MIN = 0.28;
const ZOOM_MAX = 2.05;
const ZOOM_DEFAULT = 0.58;

/** SVG viewBox 높이 (가로 100과 맞춤) */
const VIEWBOX_H = 56;

/** 목업 Tier: depth → 좌측 세로 라벨 (5단계 고정) */
function tierLabelForDepth(d) {
  if (d <= 0) return { line1: 'Tier 1', line2: '입문' };
  if (d === 1) return { line1: 'Tier 2', line2: '심화' };
  if (d === 2) return { line1: 'Tier 3', line2: '전술' };
  if (d === 3) return { line1: 'Tier 4', line2: '마스터' };
  return { line1: 'Tier 5', line2: '최종' };
}

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

/** parent_nodes 기반 단계(depth) 계산 — 선행 노드를 찍으면 다음 단계 */
function computeSkillTreeDepths(nodes) {
  const depth = new Map();
  depth.set(1, 0);

  for (let iter = 0; iter < nodes.length + 10; iter += 1) {
    let changed = false;
    for (const n of nodes) {
      if (n.node_number === 1) continue;
      let nd;
      if (!n.parent_nodes?.length) {
        nd = 0;
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
    if (!depth.has(n.node_number)) depth.set(n.node_number, 0);
  }
  return depth;
}

function spreadInRange(count, xMin, xMax) {
  if (count <= 0) return [];
  if (count === 1) return [(xMin + xMax) / 2];
  return Array.from({ length: count }, (_, i) => xMin + (i / (count - 1)) * (xMax - xMin));
}

/** true: DB position_x / position_y(0~100)로 노드 배치 — 목업 다열·층 배치 */
const MAP_LAYOUT_USE_DB_COORDINATES = true;

const SPINE_CENTER_X = 50;
/** 같은 depth에 tutorial이 여러 개일 때 세로 간격(%). 가로는 벌리지 않음(엑셀 E열 한 줄). */
const SPINE_STACK_DY = 2.2;
/** 좌·우 진영 고정 X. 같은 단계에서 형제는 가로가 아니라 Y로만 쌓음(엑셀 C/G·N/R 분기). */
const OUT_ZONE_X = 26;
const IN_ZONE_X = 74;
const SIDE_STACK_DY = 2.8;

/**
 * 중앙 세로 스파인 = 공통 기본기(tutorial) · 좌 = 아웃복싱 · 우 = 인파이팅 · 아래로 심화
 * 공통 기본기는 항상 x=50 직선(엑셀 한 열). 같은 단계에 여러 튜토리얼이 있으면 y만 살짝 나눔.
 * 아웃·인은 고정 X 열에서만 배치하고, 같은 단계의 형제는 가로가 아니라 Y로만 쌓음.
 */
/** DB 맵: 비슷한 y(%)를 한 행으로 묶어 티어 가로줄과 노드 행을 맞춤 */
function mergeCloseSortedYs(sorted, eps = 0.55) {
  if (!sorted.length) return [];
  const out = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const y = sorted[i];
    const last = out[out.length - 1];
    if (y - last <= eps) out[out.length - 1] = (last + y) / 2;
    else out.push(y);
  }
  return out;
}

function computeMapRowGuideLines(nodes) {
  if (!nodes?.length) return [];
  const ys = nodes
    .map((n) => Number(n.position_y))
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => a - b);
  const uniq = [...new Set(ys)];
  const merged = mergeCloseSortedYs(uniq, 0.55);
  const n = merged.length;
  const many = n > 16;
  return merged.map((yPct, i) => {
    const ratio = n <= 1 ? 0 : i / (n - 1);
    const depthBucket =
      ratio < 0.17 ? 0 : ratio < 0.34 ? 1 : ratio < 0.5 ? 2 : ratio < 0.66 ? 3 : 4;
    const tl = tierLabelForDepth(depthBucket);
    const label = many ? `${tl.line1} ${tl.line2}` : `${tl.line1} · ${tl.line2}`;
    return {
      key: `map-row-${i}-${yPct.toFixed(2)}`,
      yPct,
      ySvg: (yPct / 100) * VIEWBOX_H,
      label,
    };
  });
}

function computeSkillTreeLayout(nodes) {
  if (!nodes?.length) {
    return { positionById: new Map(), depthMap: new Map(), maxDepth: 0, mapRowGuideLines: [] };
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
        x: Number(n.position_x),
        y: Number(n.position_y),
        depth: d,
        role,
      });
    }
    return {
      positionById,
      depthMap,
      maxDepth,
      mapRowGuideLines: computeMapRowGuideLines(nodes),
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

    const y = 6 + (d / Math.max(maxDepth, 1)) * 86;

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

  return { positionById, depthMap, maxDepth, mapRowGuideLines: [] };
}

function toSvgXY(xPct, yPct) {
  return { x: Number(xPct), y: (Number(yPct) / 100) * VIEWBOX_H };
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
function pickEdgeAnchorSides(pxPct, pyPct, cxPct, cyPct) {
  const p = toSvgXY(pxPct, pyPct);
  const c = toSvgXY(cxPct, cyPct);
  const dx = c.x - p.x;
  const dy = c.y - p.y;
  const horizDominant = Math.abs(dx) >= Math.abs(dy) * (100 / VIEWBOX_H);
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

function skillEdgePathD(parentNode, node, cx, cy) {
  const pxPct = cx(parentNode);
  const pyPct = cy(parentNode);
  const cxPct = cx(node);
  const cyPct = cy(node);
  const sides = pickEdgeAnchorSides(pxPct, pyPct, cxPct, cyPct);
  const pCenter = toSvgXY(pxPct, pyPct);
  const cCenter = toSvgXY(cxPct, cyPct);
  const start = applyEdgeAnchor(pCenter, sides.from);
  const end = applyEdgeAnchor(cCenter, sides.to);
  const horizFirst = sides.from === 'right' || sides.from === 'left';
  return edgePathElbow(start.x, start.y, end.x, end.y, horizFirst);
}

const ActiveSkillsView = ({ t = (key) => key, setActiveTab }) => {
  const { user, profile, loading: authLoading } = useAuth();
  const [dataLoading, setDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [treeNodes, setTreeNodes] = useState([]);
  const [unlockedNodeIds, setUnlockedNodeIds] = useState(() => new Set());
  const [progressRows, setProgressRows] = useState([]);
  const [skillPoints, setSkillPoints] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all');
  /** none: 구역 필터만 | path: 기록 기준 선행 경로 | stage: 단계(깊이)만 */
  const [highlightMode, setHighlightMode] = useState('none');
  const [stageDepth, setStageDepth] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

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

  const clampPan = useCallback((x, y, vw = viewportSize.w, vh = viewportSize.h, z = zoomRef.current) => {
    const w = vw;
    const h = vh;
    if (w <= 0 || h <= 0) return { x, y };
    const sw = SKILL_MAP_WIDTH * z;
    const sh = SKILL_MAP_HEIGHT * z;
    const minX = Math.min(0, w - sw);
    const minY = Math.min(0, h - sh);
    return {
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    };
  }, [viewportSize.w, viewportSize.h]);

  useLayoutEffect(() => {
    const el = skillViewportRef.current;
    if (!el) return undefined;

    const applySize = (width, height) => {
      setViewportSize({ w: width, h: height });
      setPan((prev) => {
        const z = zoomRef.current;
        const sw = SKILL_MAP_WIDTH * z;
        const sh = SKILL_MAP_HEIGHT * z;
        if (!mapCenteredRef.current && width > 0 && height > 0) {
          mapCenteredRef.current = true;
          return {
            x: (width - sw) / 2,
            y: (height - sh) / 2,
          };
        }
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
  }, []);

  useEffect(() => {
    const el = skillViewportRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= Math.max(rect.height, 320);
      const delta = -dy;
      const step = Math.sign(delta) * Math.min(Math.abs(delta) * 0.0021, 0.14);
      const z0 = zoomRef.current;
      const z1 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z0 * (1 + step)));
      if (Math.abs(z1 - z0) < 1e-6) return;
      const panX = panRef.current.x;
      const panY = panRef.current.y;
      const mapX = (mx - panX) / z0;
      const mapY = (my - panY) / z0;
      const newPanX = mx - mapX * z1;
      const newPanY = my - mapY * z1;
      zoomRef.current = z1;
      setZoom(z1);
      setPan(clampPan(newPanX, newPanY, viewportSize.w, viewportSize.h, z1));
    };

    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [viewportSize.w, viewportSize.h, clampPan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const handleSkillMapPointerDown = (e) => {
    if (e.target.closest('button[type="button"]')) return;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2) {
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
      return;
    }

    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const el = skillViewportRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    panDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originPanX: panRef.current.x,
      originPanY: panRef.current.y,
    };
    setIsPanningMap(true);
  };

  const handleSkillMapPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchRef.current.active) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const ratio = dist / pinchRef.current.startDist;
      const z1 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchRef.current.startZoom * ratio));
      zoomRef.current = z1;
      setZoom(z1);
      setPan((prev) => clampPan(prev.x, prev.y, viewportSize.w, viewportSize.h, z1));
      return;
    }

    if (!panDragRef.current.active || panDragRef.current.pointerId !== e.pointerId) return;
    const d = panDragRef.current;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    setPan(clampPan(d.originPanX + dx, d.originPanY + dy, viewportSize.w, viewportSize.h, zoomRef.current));
  };

  const endSkillMapPan = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current.active = false;
    }

    if (panDragRef.current.active && panDragRef.current.pointerId === e.pointerId) {
      panDragRef.current.active = false;
      panDragRef.current.pointerId = null;
      setIsPanningMap(false);
      try {
        skillViewportRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const loadSkillData = useCallback(async () => {
    if (!user?.id) return;

    setDataLoading(true);
    setErrorMessage('');

    try {
      const { getSkillTreeNodes, getUserSkillUnlocks, getUserSkillNodeProgress, getUserProfile } = await import(
        '@/lib/supabase'
      );

      const { data: nodes, error: nodesError } = await getSkillTreeNodes();
      if (nodesError) throw nodesError;

      const normalizedTreeNodes = (nodes || [])
        .filter((n) => n.node_type !== 'legendary_socket')
        .sort((a, b) => a.node_number - b.node_number);
      setTreeNodes(normalizedTreeNodes);

      const [{ data: unlockRows, error: unlockError }, { data: progRows, error: progError }, { data: profileData, error: profileError }] =
        await Promise.all([getUserSkillUnlocks(user.id), getUserSkillNodeProgress(user.id), getUserProfile(user.id)]);

      if (profileError) console.warn('[ActiveSkillsView] 프로필:', profileError);
      setSkillPoints(Number(profileData?.skill_points ?? 0));

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
        const firstUnlocked = normalizedTreeNodes.find((n) => {
          if (!n.is_fork) return ids.has(n.id);
          return isForkNodeActive(n, ids, progMap);
        });
        return firstUnlocked?.id || normalizedTreeNodes[0]?.id || null;
      });
    } catch (error) {
      console.error('[ActiveSkillsView] 데이터 로드 에러:', error);
      setErrorMessage(error?.message || '액티브 스킬 정보를 불러오지 못했습니다.');
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

  const childrenByParentNum = useMemo(() => {
    const m = new Map();
    for (const n of treeNodes) {
      for (const p of n.parent_nodes || []) {
        if (!m.has(p)) m.set(p, []);
        m.get(p).push(n);
      }
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.node_number - b.node_number);
    }
    return m;
  }, [treeNodes]);

  const skillTreeLayout = useMemo(() => computeSkillTreeLayout(treeNodes), [treeNodes]);

  useEffect(() => {
    const max = skillTreeLayout.maxDepth;
    if (stageDepth > max) setStageDepth(Math.max(0, max));
  }, [skillTreeLayout.maxDepth, stageDepth]);

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
    if (highlightMode === 'stage') {
      const inter = new Set();
      for (const n of treeNodes) {
        const d = skillTreeLayout.depthMap.get(n.node_number) ?? 0;
        if (d === stageDepth && zoneFilteredIds.has(n.id)) inter.add(n.id);
      }
      return inter;
    }
    return zoneFilteredIds;
  }, [
    highlightMode,
    stageDepth,
    zoneFilteredIds,
    pathRelatedIds,
    treeNodes,
    skillTreeLayout.depthMap,
  ]);

  const buildSummary = useMemo(() => getStyleSummaryFromUnlocks(unlockedNodesList), [unlockedNodesList]);

  const tutorialCount = unlockedNodesList.filter((n) => n.zone === 'tutorial').length;
  const infighterCount = unlockedNodesList.filter((n) => n.zone === 'infighter').length;
  const outboxerCount = unlockedNodesList.filter((n) => n.zone === 'outboxer').length;
  const legendaryCount = unlockedNodesList.filter((n) => n.zone === 'legendary').length;

  const roadmapInterpretation = useMemo(
    () => getRoadmapInterpretation(unlockedNodesList, tutorialCount, infighterCount, outboxerCount),
    [unlockedNodesList, tutorialCount, infighterCount, outboxerCount]
  );

  const selectedNode = treeNodes.find((node) => node.id === selectedNodeId) || null;

  const selectedRelated = useMemo(() => {
    if (!selectedNode) return null;
    const parents = (selectedNode.parent_nodes || [])
      .map((num) => nodeByNumber.get(num))
      .filter(Boolean);
    const children = childrenByParentNum.get(selectedNode.node_number) || [];
    const sameZonePeers = treeNodes
      .filter((n) => n.zone === selectedNode.zone && n.id !== selectedNode.id)
      .slice(0, 14);
    const chain = walkUpChain(selectedNode, nodeByNumber);
    const flowText = chain.map((n) => n.name).join(' → ');
    return { parents, children, sameZonePeers, flowText };
  }, [selectedNode, nodeByNumber, childrenByParentNum, treeNodes]);

  const filteredUnlockedNodes = useMemo(
    () => unlockedNodesList.filter((n) => zoneMatchesFilter(n.zone, activeFilter)),
    [activeFilter, unlockedNodesList]
  );

  const parentsSatisfiedForSelected = useMemo(() => {
    if (!selectedNode) return true;
    return parentsSatisfiedForDisplay(selectedNode, unlockedNodeIds, progressByNodeId, nodeByNumber);
  }, [selectedNode, unlockedNodeIds, progressByNodeId, nodeByNumber]);

  const selectedPointCost = selectedNode ? nodePointCost(selectedNode) : 0;
  const canAffordSelected = skillPoints >= selectedPointCost;

  const selectedNonForkInv = useMemo(() => {
    if (!selectedNode || selectedNode.is_fork) return 0;
    return nonForkInvestmentCount(selectedNode.id, unlockedNodeIds, progressByNodeId);
  }, [selectedNode, unlockedNodeIds, progressByNodeId]);

  const nonForkInvestMaxed = Boolean(
    selectedNode && !selectedNode.is_fork && selectedNonForkInv >= MAX_NON_FORK_INVEST
  );
  const canInvestNonFork = Boolean(
    selectedNode &&
      !selectedNode.is_fork &&
      !nonForkInvestMaxed &&
      parentsSatisfiedForSelected
  );

  const selectedForkProgress = selectedNode?.is_fork ? progressByNodeId.get(selectedNode.id) : null;
  const selectedFailCount = Number(selectedForkProgress?.promotion_fail_count ?? 0);
  const selectedInvestCount = Number(selectedForkProgress?.investment_count ?? 0);
  const selectedRequiredInv = selectedNode?.is_fork ? requiredForkInvestments(selectedFailCount) : 1;
  const forkPassed = selectedForkProgress?.promotion_status === 'passed';
  const forkPending = selectedForkProgress?.promotion_status === 'pending';

  const canInvestFork = Boolean(
    selectedNode?.is_fork &&
      !forkPassed &&
      !forkPending &&
      parentsSatisfiedForSelected &&
      selectedFailCount < 5 &&
      (selectedRequiredInv === 0 || selectedInvestCount < selectedRequiredInv)
  );

  const canSubmitPromotion = Boolean(
    selectedNode?.is_fork &&
      selectedForkProgress &&
      !forkPassed &&
      !forkPending &&
      (selectedFailCount >= 5 || selectedInvestCount >= selectedRequiredInv)
  );

  const handleInvestNode = async (nodeId) => {
    try {
      setIsApplying(true);
      const { investSkillNodeRpc } = await import('@/lib/supabase');
      const { data, error } = await investSkillNodeRpc(nodeId);

      if (error) {
        alert(error.message || '포인트 반영에 실패했습니다.');
        return;
      }

      if (data && typeof data === 'object' && data.ok === false) {
        alert(data.error || '포인트 반영에 실패했습니다.');
        return;
      }

      if (data && typeof data === 'object' && data.skill_points != null) {
        setSkillPoints(data.skill_points);
      }

      await loadSkillData();
    } catch (error) {
      console.error('[ActiveSkillsView] 스킬 포인트 사용 에러:', error);
      alert('포인트를 반영하는 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleSubmitPromotion = async (forkNodeId) => {
    try {
      setIsApplying(true);
      const { submitSkillPromotionRequestRpc } = await import('@/lib/supabase');
      const { error } = await submitSkillPromotionRequestRpc(forkNodeId);
      if (error) {
        alert(error.message || '승단 신청에 실패했습니다.');
        return;
      }
      await loadSkillData();
    } catch (error) {
      console.error('[ActiveSkillsView] 승단 신청 에러:', error);
      alert('승단 신청 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  const pageLoading = authLoading || dataLoading;

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-3 xs:space-y-5 w-full max-w-[100vw] overflow-x-hidden px-3 sm:px-4 lg:px-6">
      <PageHeader
        title={t('activeSkills')}
        description="중앙은 공통 기본기 스파인, 왼쪽은 아웃복싱·오른쪽은 인파이팅으로 확장됩니다. 위에서 아래로 심화되며, 선행을 채운 뒤 기록합니다. 맵은 드래그·휠로 탐색합니다."
        onBack={() => setActiveTab('roadmap-skill-tree')}
      >
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('roadmap-skill-tree')}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-all"
          >
            스킬 가이드
          </button>
        </div>
      </PageHeader>

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

      <SpotlightCard className={`p-6 border bg-gradient-to-br ${buildSummary.className}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/30 border border-white/10 text-[11px] sm:text-xs text-gray-300 mb-3">
              <span>로드맵 요약</span>
            </div>
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 leading-snug">{buildSummary.label}</h3>
            <p className="text-xs sm:text-sm text-gray-300/95 max-w-2xl leading-relaxed mb-3">{buildSummary.description}</p>
            <div className="space-y-1.5 text-[11px] sm:text-xs text-gray-400 max-w-2xl leading-relaxed border-t border-white/10 pt-3">
              <p>
                <span className="text-gray-500 font-medium">현재 훈련 경향 · </span>
                {roadmapInterpretation.tendency}
              </p>
              <p>
                <span className="text-gray-500 font-medium">진행 상태 · </span>
                {roadmapInterpretation.stageHint}
              </p>
              <p>
                <span className="text-gray-500 font-medium">확장 방향 · </span>
                {roadmapInterpretation.expansion}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full lg:w-auto lg:min-w-[280px] shrink-0">
            <div className="rounded-xl bg-black/30 border border-white/10 p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5">기록한 노드</div>
              <div className="text-lg sm:text-xl font-bold text-white tabular-nums">{unlockedNodesList.length}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/10 p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5">스킬 포인트</div>
              <div className="text-lg sm:text-xl font-bold text-cyan-300 tabular-nums">{skillPoints}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/10 p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5">공통·기본</div>
              <div className="text-lg sm:text-xl font-bold text-slate-200 tabular-nums">{tutorialCount}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/10 p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5">인파이터</div>
              <div className="text-lg sm:text-xl font-bold text-orange-300 tabular-nums">{infighterCount}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/10 p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5">아웃복서</div>
              <div className="text-lg sm:text-xl font-bold text-emerald-300 tabular-nums">{outboxerCount}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/10 p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5">전설</div>
              <div className="text-lg sm:text-xl font-bold text-yellow-400 tabular-nums">{legendaryCount}</div>
            </div>
          </div>
        </div>
      </SpotlightCard>

      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-500 w-full sm:w-auto sm:mr-1">구역 필터</span>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
                  isActive
                    ? 'bg-white/12 text-white border-white/20 shadow-sm'
                    : 'bg-white/[0.04] text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                {getFilterLabel(filter)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-500 w-full sm:w-auto sm:mr-1">보기</span>
          <button
            type="button"
            onClick={() => setHighlightMode('none')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
              highlightMode === 'none'
                ? 'bg-white/12 text-white border-white/20 shadow-sm'
                : 'bg-white/[0.04] text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200'
            }`}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => setHighlightMode('path')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
              highlightMode === 'path'
                ? 'bg-white/12 text-white border-white/20 shadow-sm'
                : 'bg-white/[0.04] text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200'
            }`}
          >
            진행 경로만
          </button>
          <button
            type="button"
            onClick={() => {
              setHighlightMode('stage');
              setStageDepth(0);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
              highlightMode === 'stage'
                ? 'bg-white/12 text-white border-white/20 shadow-sm'
                : 'bg-white/[0.04] text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200'
            }`}
          >
            단계별
          </button>
          {highlightMode === 'stage' && (
            <div className="flex flex-wrap gap-1 w-full sm:w-auto sm:pl-2">
              {Array.from({ length: skillTreeLayout.maxDepth + 1 }, (_, d) => {
                const active = stageDepth === d;
                return (
                  <button
                    key={`stage-${d}`}
                    type="button"
                    onClick={() => setStageDepth(d)}
                    className={`px-2 py-1 rounded-md text-xs font-semibold tabular-nums border transition-all ${
                      active
                        ? 'bg-cyan-500/20 text-cyan-100 border-cyan-400/40'
                        : 'bg-white/[0.04] text-gray-400 border-transparent hover:bg-white/10'
                    }`}
                  >
                    {d === 0 ? '기초' : `단계 ${d + 1}`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="w-screen max-w-[100vw] relative left-1/2 -translate-x-1/2">
      <div className="rounded-none sm:rounded-xl overflow-hidden border-y border-amber-900/30 sm:border border-amber-500/20 shadow-[0_0_60px_rgba(0,0,0,0.65)] ring-1 ring-amber-950/40">
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-2 bg-[#12111d]">
          <div className="min-w-0">
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight truncate">
              스포티션 복싱 스킬 트리
            </p>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              입문부터 생활체육대회까지
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[10px] sm:text-xs text-slate-400">해금 스킬</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#d2a8ff] tabular-nums tracking-wide">
                {unlockedNodesList.length}
                <span className="text-slate-500 font-semibold text-lg mx-1"> / </span>
                <span className="text-slate-400 text-lg">{treeNodes.length || 0}</span>
              </p>
            </div>
          </div>
        </div>
        <div
          ref={skillViewportRef}
          tabIndex={-1}
          className={`relative w-full overflow-hidden bg-[#070818] select-none touch-none outline-none focus:outline-none ${
            isPanningMap ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            height: 'min(calc(100dvh - 11rem), 920px)',
            minHeight: '440px',
            overscrollBehavior: 'contain',
          }}
          onPointerDown={handleSkillMapPointerDown}
          onPointerMove={handleSkillMapPointerMove}
          onPointerUp={endSkillMapPan}
          onPointerCancel={endSkillMapPan}
        >
          {user?.id && treeNodes.length === 0 && !errorMessage && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 px-4 text-center pointer-events-none">
              <p className="text-sm text-gray-300 max-w-md">
                불러온 스킬 노드가 없습니다. DB에 <code className="text-cyan-300/90">skill_tree_nodes</code> 시드가 들어 있는지
                확인해 주세요.
              </p>
            </div>
          )}
          <div
            className="absolute top-0 left-0 will-change-transform"
            style={{
              width: SKILL_MAP_WIDTH,
              height: SKILL_MAP_HEIGHT,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 80% 50% at 20% 0%, #171131, transparent 80%), radial-gradient(ellipse 80% 50% at 80% 100%, #2a122e, transparent 80%), linear-gradient(135deg, #131222 0%, #151322 50%, #1b1220 100%)',
              }}
            />

            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 56" preserveAspectRatio="none">
              <defs>
                <linearGradient id="spineBeam" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(212,175,55,0.55)" />
                  <stop offset="50%" stopColor="rgba(251,191,36,0.35)" />
                  <stop offset="100%" stopColor="rgba(180,83,9,0.25)" />
                </linearGradient>
                <filter id="spineGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <line
                x1={SPINE_CENTER_X}
                y1={1.2}
                x2={SPINE_CENTER_X}
                y2={54.8}
                stroke="url(#spineBeam)"
                strokeWidth={1.1}
                opacity={0.85}
                filter="url(#spineGlow)"
              />
              <line
                x1={SPINE_CENTER_X}
                y1={1.2}
                x2={SPINE_CENTER_X}
                y2={54.8}
                stroke="rgba(253,230,138,0.25)"
                strokeWidth={0.2}
              />

              {MAP_LAYOUT_USE_DB_COORDINATES && skillTreeLayout.mapRowGuideLines?.length
                ? skillTreeLayout.mapRowGuideLines.map((row) => {
                    const fs = skillTreeLayout.mapRowGuideLines.length > 18 ? 0.72 : 0.85;
                    return (
                      <g key={row.key}>
                        <line
                          x1={0}
                          y1={row.ySvg}
                          x2={100}
                          y2={row.ySvg}
                          stroke="rgba(148,163,184,0.12)"
                          strokeWidth={0.22}
                        />
                        <text
                          x={1.2}
                          y={row.ySvg - 0.35}
                          fill="rgba(203,213,225,0.42)"
                          fontSize={fs}
                          fontWeight={600}
                          style={{ fontFamily: 'system-ui, sans-serif' }}
                        >
                          {row.label}
                        </text>
                      </g>
                    );
                  })
                : Array.from({ length: skillTreeLayout.maxDepth + 1 }, (_, d) => {
                    const yPct = 6 + (d / Math.max(skillTreeLayout.maxDepth, 1)) * 86;
                    const y = (yPct / 100) * VIEWBOX_H;
                    const tl = tierLabelForDepth(d);
                    const tierLine =
                      skillTreeLayout.maxDepth > 6
                        ? `${tl.line1} ${tl.line2}`
                        : `${tl.line1} · ${tl.line2}`;
                    return (
                      <g key={`tier-${d}`}>
                        <line
                          x1={0}
                          y1={y}
                          x2={100}
                          y2={y}
                          stroke="rgba(148,163,184,0.12)"
                          strokeWidth={0.22}
                        />
                        <text
                          x={1.2}
                          y={y - 0.38}
                          fill="rgba(203,213,225,0.42)"
                          fontSize={skillTreeLayout.maxDepth > 6 ? 0.82 : 0.92}
                          fontWeight={600}
                          style={{ fontFamily: 'system-ui, sans-serif' }}
                        >
                          {tierLine}
                        </text>
                      </g>
                    );
                  })}

              {treeNodes.flatMap((node) => {
                if (!node.parent_nodes || node.parent_nodes.length === 0) return [];

                return node.parent_nodes.map((parentNum) => {
                  const parentNode = nodeByNumber.get(parentNum);
                  if (!parentNode) return null;

                  const cx = (n) => Number(skillTreeLayout.positionById.get(n.id)?.x ?? n.position_x);
                  const cy = (n) => Number(skillTreeLayout.positionById.get(n.id)?.y ?? n.position_y);

                  const edgeD = skillEdgePathD(parentNode, node, cx, cy);
                  const childLit = node.is_fork
                    ? nodeReadyForEdge(node, unlockedNodeIds, progressByNodeId)
                    : unlockedNodeIds.has(node.id);
                  const isActiveLine =
                    parentEdgeSatisfied(parentNode, node, unlockedNodeIds, progressByNodeId) && childLit;
                  const filtered = !(
                    highlightedNodeIds.has(node.id) && highlightedNodeIds.has(parentNode.id)
                  );

                  const spineEdge = parentNode.zone === 'tutorial' && node.zone === 'tutorial';
                  const laneKey = (node.map_lane && String(node.map_lane).toLowerCase()) || '';
                  const laneStroke = laneKey && MAP_LANE_EDGE[laneKey];

                  let stroke = 'rgba(71,85,105,0.35)';
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

                  return (
                    <path
                      key={`${parentNode.id}-${node.id}`}
                      d={edgeD}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={isActiveLine ? 0.5 : 0.32}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={filtered ? 0.16 : 1}
                      style={{
                        filter: isActiveLine ? `drop-shadow(0 0 3px ${stroke})` : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    />
                  );
                });
              })}
            </svg>

            {treeNodes.map((node) => {
              const nfPr = node.is_fork ? progressByNodeId.get(node.id) : null;
              const forkDone = nfPr?.promotion_status === 'passed';
              const isUnlocked = node.is_fork
                ? isForkNodeActive(node, unlockedNodeIds, progressByNodeId)
                : unlockedNodeIds.has(node.id);
              const isSelected = node.id === selectedNodeId;
              const isHighlighted = highlightedNodeIds.has(node.id);
              const parentsOk = parentsSatisfiedForDisplay(node, unlockedNodeIds, progressByNodeId, nodeByNumber);
              const isUnlockableOnly = !isUnlocked && parentsOk && (!node.is_fork || !forkDone);
              const isLocked =
                !isUnlocked && Boolean(node.parent_nodes?.length) && !parentsOk && node.node_number !== 1;
              const mapSub = nodeMapSubtitle(node);
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
              const symbol = getNodeSymbol(node, isUnlocked);
              const lay = skillTreeLayout.positionById.get(node.id);
              const leftPct = lay ? lay.x : Number(node.position_x);
              const topPct = lay ? lay.y : Number(node.position_y);
              const nfInvCount = !node.is_fork
                ? nonForkInvestmentCount(node.id, unlockedNodeIds, progressByNodeId)
                : 0;

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNodeId(node.id)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-[1.03] z-[5]"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                  }}
                >
                  <div className="relative">
                    {isUnlocked && (
                      <div
                        className={`absolute inset-0 blur-md opacity-35 ${
                          node.zone === 'infighter'
                            ? 'bg-amber-500'
                            : node.zone === 'outboxer'
                              ? 'bg-teal-400'
                              : node.zone === 'legendary'
                                ? 'bg-amber-300'
                                : 'bg-amber-200'
                        }`}
                        style={{ transform: 'scale(1.15)' }}
                      />
                    )}

                    <div
                      className={`${sizeClass} ${shapeClass} ${toneClass} border-2 flex flex-col items-center justify-center gap-0.5 relative backdrop-blur-[2px] transition-all overflow-hidden ${
                        isSelected ? 'shadow-[0_0_20px_rgba(251,191,36,0.35)]' : ''
                      } ${milestone && isUnlocked ? 'ring-1 ring-amber-200/35' : ''}`}
                    >
                      {node.zone === 'legendary' || node.node_type === 'legendary_socket' ? (
                        <span className="text-[8px] sm:text-[9px] font-bold leading-none -rotate-45">{symbol}</span>
                      ) : (
                        <>
                          {node.is_fork && (
                            <span className="absolute top-0.5 left-0.5 text-[5px] sm:text-[6px] font-bold text-amber-300/95 z-10">
                              갈림
                            </span>
                          )}
                          {isLocked && (
                            <span className="absolute top-0.5 right-0.5 text-[6px] leading-none opacity-80 z-10">🔒</span>
                          )}
                          {milestone && (
                            <span className="text-[7px] sm:text-[8px] leading-none z-[1]" aria-hidden>
                              🏆
                            </span>
                          )}
                          <span
                            className={`text-[6px] sm:text-[7px] md:text-[8px] font-semibold leading-tight text-center line-clamp-3 px-0.5 z-[1] ${
                              isUnlocked ? 'text-white' : 'text-slate-500'
                            }`}
                          >
                            {nodeDisplayTitle(node)}
                          </span>
                          {mapSub ? (
                            <span
                              className={`text-[4.5px] sm:text-[5px] font-medium leading-tight text-center line-clamp-2 px-0.5 z-[1] ${
                                isUnlocked ? 'text-slate-300/90' : 'text-slate-600'
                              }`}
                            >
                              {mapSub}
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>

                    {!node.is_fork && nfInvCount > 0 && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 pointer-events-none">
                        <p className="text-[6px] sm:text-[7px] text-cyan-300/90 tabular-nums">
                          {nfInvCount}/{MAX_NON_FORK_INVEST}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            <div className="absolute left-0 right-0 top-6 flex justify-between items-start px-8 sm:px-12 pointer-events-none z-[8]">
              <div className="w-[32%] text-left">
                <span className="inline-block px-4 py-2 rounded-lg bg-[#141b3e] border border-[#2a4d80] text-[#71a6e7] font-semibold text-[8px] sm:text-[10px]">아웃복싱 계보</span>
              </div>
              <div className="w-[36%] text-center">
                <span className="inline-block px-6 py-2.5 rounded-full bg-[#1e1531] border border-[#523181] text-[#bda7e2] font-semibold text-[8px] sm:text-[10px] drop-shadow-[0_0_15px_rgba(82,49,129,0.6)]">중앙 수직축: 기본기</span>
              </div>
              <div className="w-[32%] text-right">
                <span className="inline-block px-4 py-2 rounded-lg bg-[#3e1423] border border-[#8f213b] text-[#e06b83] font-semibold text-[8px] sm:text-[10px]">인파이팅 계보</span>
              </div>
            </div>

            <div className="absolute left-0 right-0 bottom-0 z-[12] pointer-events-none flex justify-center px-1 pb-2 pt-10 bg-gradient-to-t from-[#070818] via-[#070818]/95 to-transparent">
              <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 max-w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 backdrop-blur-sm shadow-[0_-4px_24px_rgba(0,0,0,0.45)]">
                {SKILL_MAP_LEGEND.map((item) => (
                  <span
                    key={item.key}
                    className="inline-flex items-center gap-1 text-[7px] sm:text-[8px] text-slate-300/95 whitespace-nowrap"
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
            className="absolute bottom-5 right-4 z-[30] flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-[13px] font-bold text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.45)] backdrop-blur-md pointer-events-auto hover:bg-white/10 transition-colors"
            title="범례·연결선 색은 맵 레인(C 회피, G 공격, N 압박, R 바디 등)을 뜻합니다."
            aria-label="맵 도움말"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            ?
          </button>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:items-start">
        <SpotlightCard className="p-5 xl:sticky xl:top-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Icon type="target" size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">선택한 훈련 항목</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                맵에서 노드를 누르면 선행 조건·필요 포인트·반복 기록 한도를 확인할 수 있습니다.
              </p>
            </div>
          </div>

          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-bold border ${
                  selectedNode.zone === 'tutorial'
                    ? 'bg-slate-500/15 text-slate-200 border-slate-300/30'
                    : selectedNode.zone === 'infighter'
                      ? 'bg-orange-500/15 text-orange-200 border-orange-400/30'
                      : selectedNode.zone === 'outboxer'
                        ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
                        : 'bg-yellow-500/15 text-yellow-200 border-yellow-400/30'
                }`}>
                  {selectedNode.zone === 'tutorial' ? '공통·기본' : selectedNode.zone === 'infighter' ? '인파이터' : selectedNode.zone === 'outboxer' ? '아웃복서' : '전설'}
                </span>
                <span className="px-2 py-1 rounded-full text-xs font-bold border bg-white/5 text-gray-300 border-white/10">
                  {selectedNode.node_type === 'basic' ? '기본 노드' : selectedNode.node_type === 'socket' ? '확장 노드' : '전설 노드'}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="text-base sm:text-lg md:text-xl font-bold text-white mb-1">{nodeDisplayTitle(selectedNode)}</h4>
                  {nodeMapSubtitle(selectedNode) ? (
                    <p className="text-xs text-slate-400 mb-1">{nodeMapSubtitle(selectedNode)}</p>
                  ) : null}
                  <p className="text-[11px] sm:text-xs text-gray-500">노드 #{selectedNode.node_number}</p>
                  {nodeSourceName(selectedNode) &&
                  nodeSourceName(selectedNode) !== nodeDisplayTitle(selectedNode) ? (
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-1 leading-relaxed">
                      원문명: <span className="text-slate-300">{nodeSourceName(selectedNode)}</span>
                    </p>
                  ) : null}
                  {selectedNode.name_en ? (
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-1">영문: {selectedNode.name_en}</p>
                  ) : null}
                </div>
                {selectedNode.description ? (
                  <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                    <p className="text-[10px] font-bold text-amber-200/80 uppercase tracking-wide mb-1.5">설명</p>
                    <p className="text-xs sm:text-sm text-slate-200/95 leading-relaxed whitespace-pre-wrap">{selectedNode.description}</p>
                  </div>
                ) : null}
                {selectedNode.training_intent ? (
                  <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                    <p className="text-[10px] font-bold text-cyan-200/80 uppercase tracking-wide mb-1.5">훈련 의도</p>
                    <p className="text-xs sm:text-sm text-slate-300/95 leading-relaxed whitespace-pre-wrap">{selectedNode.training_intent}</p>
                  </div>
                ) : null}
                {selectedNode.flow_summary ? (
                  <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                    <p className="text-[10px] font-bold text-violet-200/80 uppercase tracking-wide mb-1.5">연결 흐름</p>
                    <p className="text-xs sm:text-sm text-slate-300/95 leading-relaxed">{selectedNode.flow_summary}</p>
                  </div>
                ) : null}
                {!selectedNode.description && !selectedNode.training_intent && !selectedNode.flow_summary ? (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    상세 설명·훈련 의도는 DB에 채워지면 여기에 표시됩니다. 맵에서는 짧은 제목만 보입니다.
                  </p>
                ) : null}
              </div>

              {selectedNode.is_fork ? (
                <>
                  {forkPassed && (
                    <div className="rounded-xl bg-white/5 border border-emerald-500/25 p-4 space-y-2">
                      <p className="text-sm font-bold text-emerald-200">승단 완료</p>
                      <p className="text-[11px] sm:text-xs text-gray-400">
                        선택한 분기: 노드 #{selectedForkProgress?.chosen_branch_node_number ?? '—'}
                      </p>
                    </div>
                  )}
                  {forkPending && (
                    <div className="rounded-xl bg-white/5 border border-amber-500/30 p-4 space-y-2">
                      <p className="text-sm font-bold text-amber-200">승단 심사 대기 중</p>
                      <p className="text-[11px] sm:text-xs text-gray-400">
                        소속 체육관에서 승단을 처리할 때까지 기다려 주세요.
                      </p>
                    </div>
                  )}
                  {!forkPassed && !forkPending && (
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                      <div className="rounded-lg bg-black/30 border border-white/10 p-3 text-xs space-y-1">
                        <div className="flex justify-between text-gray-400">
                          <span>승단 실패</span>
                          <span className="text-white font-bold tabular-nums">{selectedFailCount} / 5</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>누적 투자</span>
                          <span className="text-white font-bold tabular-nums">
                            {selectedInvestCount}
                            {selectedRequiredInv > 0 ? ` / ${selectedRequiredInv}` : ' (신청만 가능)'}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>필요 포인트(1회)</span>
                          <span className="text-white font-bold">{selectedPointCost === 0 ? '무료' : `${selectedPointCost} SP`}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>보유 포인트</span>
                          <span className="text-cyan-200 font-bold">{skillPoints} SP</span>
                        </div>
                      </div>

                      {!parentsSatisfiedForSelected && (
                        <p className="text-[11px] sm:text-xs text-amber-200/90">
                          선행 조건을 충족해야 갈림길에 투자할 수 있습니다.
                        </p>
                      )}
                      {parentsSatisfiedForSelected && canInvestFork && !canAffordSelected && selectedPointCost > 0 && (
                        <p className="text-[11px] sm:text-xs text-amber-200/90">스킬 포인트가 부족합니다.</p>
                      )}

                      {canInvestFork && (
                        <button
                          type="button"
                          onClick={() => handleInvestNode(selectedNode.id)}
                          disabled={isApplying || !canAffordSelected}
                          className="w-full px-3 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-sm font-bold text-white transition-all disabled:opacity-45 disabled:cursor-not-allowed"
                        >
                          {isApplying
                            ? '처리 중...'
                            : selectedPointCost === 0
                              ? '훈련 기록 (무료)'
                              : `${selectedPointCost} SP로 기록하기`}
                        </button>
                      )}

                      {canSubmitPromotion && (
                        <button
                          type="button"
                          onClick={() => handleSubmitPromotion(selectedNode.id)}
                          disabled={isApplying}
                          className="w-full px-3 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-sm font-bold text-white transition-all disabled:opacity-45 disabled:cursor-not-allowed"
                        >
                          {isApplying ? '처리 중...' : '체육관에 승단 신청'}
                        </button>
                      )}

                      {!canInvestFork && !canSubmitPromotion && parentsSatisfiedForSelected && (
                        <p className="text-[11px] sm:text-xs text-gray-500">
                          {selectedFailCount >= 5
                            ? '아래 버튼으로 승단 신청만 하면 됩니다.'
                            : '필요 투자를 채우면 승단 신청이 열립니다.'}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <div className="rounded-lg bg-black/30 border border-white/10 p-3 text-xs">
                    <div className="flex justify-between text-gray-400 mb-2">
                      <span>훈련 기록 (반복)</span>
                      <span className="text-white font-bold tabular-nums">
                        {selectedNonForkInv} / {MAX_NON_FORK_INVEST}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      같은 항목에 최대 {MAX_NON_FORK_INVEST}번까지 포인트로 기록을 남길 수 있습니다.
                    </p>
                  </div>

                  {nonForkInvestMaxed ? (
                    <div className="rounded-xl bg-white/5 border border-emerald-500/25 p-4 space-y-2">
                      <p className="text-sm font-bold text-emerald-200">이 항목 기록 완료</p>
                      <p className="text-[11px] sm:text-xs text-gray-400 leading-relaxed">
                        {MAX_NON_FORK_INVEST}번 모두 기록했습니다. 다른 노드를 골라 로드맵을 이어 가세요.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-black/30 border border-white/10 p-3">
                          <div className="text-gray-400 mb-1">1회 필요 포인트</div>
                          <div className="font-bold text-white">{selectedPointCost === 0 ? '무료' : `${selectedPointCost} SP`}</div>
                        </div>
                        <div className="rounded-lg bg-black/30 border border-white/10 p-3">
                          <div className="text-gray-400 mb-1">보유 포인트</div>
                          <div className="font-bold text-cyan-200">{skillPoints} SP</div>
                        </div>
                      </div>

                      {!parentsSatisfiedForSelected && (
                        <p className="text-[11px] sm:text-xs text-amber-200/90">
                          선행 노드를 모두 찍어야 이 노드를 찍을 수 있습니다.
                        </p>
                      )}
                      {parentsSatisfiedForSelected && canInvestNonFork && !canAffordSelected && selectedPointCost > 0 && (
                        <p className="text-[11px] sm:text-xs text-amber-200/90">스킬 포인트가 부족합니다. 출석으로 포인트를 모아 주세요.</p>
                      )}

                      <button
                        type="button"
                        onClick={() => handleInvestNode(selectedNode.id)}
                        disabled={isApplying || !canInvestNonFork || !canAffordSelected}
                        className="w-full px-3 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-sm font-bold text-white transition-all disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        {isApplying
                          ? '처리 중...'
                          : selectedPointCost === 0
                            ? `훈련 기록하기 (${selectedNonForkInv + 1}/${MAX_NON_FORK_INVEST})`
                            : `${selectedPointCost} SP로 기록 (${selectedNonForkInv + 1}/${MAX_NON_FORK_INVEST})`}
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>
          ) : (
            <div className="text-sm text-gray-400 leading-relaxed">맵에서 노드를 선택하면 상세가 여기에 표시됩니다.</div>
          )}
        </SpotlightCard>

        <SpotlightCard className="p-5 xl:sticky xl:top-4">
          <h3 className="text-lg font-bold text-white mb-1">연결·같은 계열</h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            선행에서 이어지는 흐름과 같은 구역의 다른 항목을 빠르게 살펴봅니다.
          </p>
          {selectedNode && selectedRelated ? (
            <div className="space-y-5 text-sm">
              <div>
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">선행 스킬</h4>
                {selectedRelated.parents.length ? (
                  <ul className="space-y-1.5">
                    {selectedRelated.parents.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedNodeId(p.id)}
                          className="text-left text-gray-200 hover:text-cyan-200 transition-colors underline-offset-2 hover:underline"
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">없음 (시작점)</p>
                )}
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">다음 연결</h4>
                {selectedRelated.children.length ? (
                  <ul className="space-y-1.5">
                    {selectedRelated.children.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedNodeId(c.id)}
                          className="text-left text-gray-200 hover:text-cyan-200 transition-colors underline-offset-2 hover:underline"
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">파생 노드가 없거나 아직 공개되지 않았습니다.</p>
                )}
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">같은 계열 (참고)</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRelated.sameZonePeers.length === 0 ? (
                    <p className="text-gray-500 text-xs">같은 구역의 다른 항목이 없습니다.</p>
                  ) : (
                    selectedRelated.sameZonePeers.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setSelectedNodeId(n.id)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-colors max-w-[11rem] truncate"
                        title={n.name}
                      >
                        {n.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">관련 흐름 (선행 체인)</h4>
                <p className="text-xs text-gray-300 leading-relaxed break-words">{selectedRelated.flowText}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 leading-relaxed">맵에서 노드를 선택하면 연결 정보가 표시됩니다.</p>
          )}
        </SpotlightCard>
      </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-white">기록한 항목</h3>
            <span className="text-[11px] text-gray-500">구역 필터가 적용된 목록입니다.</span>
          </div>
          {filteredUnlockedNodes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUnlockedNodes.map((node) => {
                const typeBadge = getTypeBadge(
                  node.zone === 'tutorial'
                    ? 'tutorial'
                    : node.zone === 'infighter'
                      ? 'infighter'
                      : node.zone === 'outboxer'
                        ? 'outboxer'
                        : node.zone === 'legendary'
                          ? 'legendary'
                          : 'neutral'
                );

                return (
                  <SpotlightCard key={node.id} className="p-5 overflow-hidden">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold border ${typeBadge.className}`}>
                            {typeBadge.label}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-white">{node.name}</h3>
                        <p className="text-[11px] sm:text-sm text-gray-400">노드 #{node.node_number}</p>
                      </div>

                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm sm:text-base flex-shrink-0">
                        {node.zone === 'legendary' ? '✦' : '★'}
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-gray-400 leading-relaxed">
                      포인트로 기록한 항목입니다. 위 필터에 맞춰 맵과 이 목록이 함께 정리됩니다.
                    </div>
                  </SpotlightCard>
                );
              })}
            </div>
          ) : (
            <SpotlightCard className="p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <Icon type="target" size={28} className="text-gray-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">아직 기록한 항목이 없습니다</h3>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                포인트가 있으면 맵에서 노드를 골라 훈련 기록을 남길 수 있습니다. 필터는 맵과 아래 목록에 같이 적용됩니다.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('roadmap-skill-tree')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-lg text-white font-bold transition-all"
                >
                  스킬 가이드
                </button>
              </div>
            </SpotlightCard>
          )}

          <SpotlightCard className="p-5">
            <h3 className="text-lg font-bold text-white mb-2">포인트·로드맵 안내</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              출석이 반영될 때마다 스킬 포인트가 쌓입니다. 맵에서 선행을 채운 뒤 원하는 항목에 기록하면 되고, 같은 노드에 여러 번 기록해 강도를 올릴 수 있습니다.
            </p>
          </SpotlightCard>
        </div>
    </div>
  );
};

export { ActiveSkillsView };

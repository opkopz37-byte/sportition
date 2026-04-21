'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

const FILTERS = ['all', 'tutorial', 'infighter', 'outboxer'];

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
      label: '인파이터 · 아웃복서 균형',
      description: `두 진영 기록 수가 같습니다.${tutorial ? ` 공통·기본 ${tutorial}개 포함.` : ''}`,
      className: 'from-violet-500/15 to-slate-900/40 border-violet-400/15',
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

const getNodeShapeClass = (node) => {
  if (node.zone === 'legendary' || node.node_type === 'legendary_socket') {
    return 'rotate-45 rounded-xl';
  }
  return 'rounded-xl';
};

const SELECTION_RING_CLASS =
  'ring-[3px] ring-amber-300/90 ring-offset-2 ring-offset-[#141c32]';

/** 해금 노드 — 단일 골드 톤 */
const getUnlockedNodeToneClass = (node, isSelected) => {
  const selected = isSelected ? SELECTION_RING_CLASS : '';
  const base =
    'font-bold border-2 scale-[1.02] z-20 shadow-[0_2px_14px_rgba(15,23,42,0.35)]';
  return `bg-gradient-to-br from-[#4a3d22] to-[#2e2614] text-[#fff8e7] border-[#e6c565]/88 ${base} ${selected}`;
};

const getUnlockedBottomAccentClass = () =>
  'bg-gradient-to-r from-transparent via-amber-400/88 to-transparent';

/** 로드맵 스킬트리 톤 */
const getNodeToneClass = ({ node, isUnlocked, isSelected, isDimmed, isUnlockableOnly, isLocked }) => {
  if (isUnlocked) {
    return getUnlockedNodeToneClass(node, isSelected);
  }

  const bgClass = 'bg-[#2a3148]/92';
  const borderClass = 'border-slate-400/45';
  const selected = isSelected ? SELECTION_RING_CLASS : '';
  const opacity = isDimmed ? 'opacity-50' : (isLocked ? 'opacity-82' : 'opacity-98');
  const textTone = isDimmed ? 'text-slate-500' : 'text-slate-200';

  return `${bgClass} ${textTone} border ${borderClass} shadow-sm ${opacity} ${selected}`;
};

const getNodeSizeClass = (node, hasSubtitle) => {
  if (node.zone === 'legendary') return 'w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10';
  if (node.node_type === 'socket') {
    return 'min-w-[3.25rem] min-h-[1.75rem] max-w-[5.25rem] px-0.5 py-0.5 sm:min-w-[4.75rem] sm:min-h-[2rem]';
  }
  if (hasSubtitle || nodeIsMilestone(node)) {
    return 'min-w-[3.5rem] min-h-[2.35rem] max-w-[6rem] px-0.5 py-0.5 sm:min-w-[5rem] sm:max-w-[7.25rem] sm:min-h-[2.85rem]';
  }
  return 'min-w-[3.25rem] min-h-[1.75rem] max-w-[5.5rem] px-0.5 py-0.5 sm:min-w-[4.75rem] sm:max-w-[6.5rem] sm:min-h-[2rem]';
};

const nodePointCost = (node) => Number(node?.point_cost ?? 1);

const MAX_NON_FORK_INVEST = 1;

/** 비포크: 노드당 누적 찍기 횟수 (진행 행 없고 unlock만 있는 레거시는 1로 간주) */
function nonForkInvestmentCount(nodeId, unlockedIds, progressByNodeId) {
  const pr = progressByNodeId.get(nodeId);
  const raw = pr?.investment_count;
  if (raw != null && raw !== undefined) return Number(raw);
  if (unlockedIds.has(nodeId)) return 1;
  return 0;
}

/** 승단 실패 n회 기준 필요 투자 횟수 (DB required_investments_for_fork 와 동기화: 1회 / 5회 이상이면 0 = 신청만) */
function requiredForkInvestments(failCount) {
  const f = Number(failCount) || 0;
  if (f >= 5) return 0;
  return 1;
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

const getRoadmapInterpretation = (unlockedNodes, tutorialCount, infighterCount, outboxerCount) => {
  if (unlockedNodes.length === 0) {
    return {
      tendency: '아직 기록된 훈련 항목이 없습니다.',
      stageHint: '시작 단계 — 잽부터 로드맵을 열 수 있습니다.',
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

/** 매우 좁은 폰에서도 맵 전체 가로에 맞출 수 있도록 (초기·리셋 줌에만 사용) */
const ZOOM_MIN = 0.12;
const ZOOM_MAX = 2.05;
const ZOOM_DEFAULT = 0.58;
/** 버튼·단축 줌 한 단계 배율 */
const ZOOM_STEP_FACTOR = 1.12;

/** 스포티션 복싱 스킬 트리 맵: 좁은 뷰포트에서 가로가 잘리지 않도록 줌을 낮춤. 넓은 화면은 ZOOM_DEFAULT 유지 */
function computeFitZoomForViewportWidth(widthPx) {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return ZOOM_DEFAULT;
  const scaledWAtDefault = SKILL_MAP_WIDTH * ZOOM_DEFAULT;
  if (widthPx >= scaledWAtDefault) return ZOOM_DEFAULT;
  const raw = (widthPx * 0.92) / SKILL_MAP_WIDTH;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_DEFAULT, raw));
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

/** 선택 노드를 뷰포트에 꽉 차게 프레이밍하는 줌 계산 */
function computeFrameZoom(node, skillTreeLayout, mapH, vw, vh) {
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
          } ${milestone && isUnlocked ? 'ring-1 ring-amber-400/40' : ''}`}
        >
          {isUnlocked && (
            <div
              className={`pointer-events-none absolute bottom-0.5 left-1 right-1 h-[2px] rounded-full opacity-95 ${getUnlockedBottomAccentClass()}`}
              aria-hidden
            />
          )}
          {node.zone === 'legendary' || node.node_type === 'legendary_socket' ? (
            <span className="text-[7px] sm:text-[8px] font-bold leading-none -rotate-45 text-inherit" aria-hidden>
              ★
            </span>
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
                  isUnlocked ? 'text-inherit' : 'text-slate-400'
                }`}
              >
                {nodeDisplayTitle(node)}
              </span>
              {mapSub ? (
                <span
                  className={`text-[4.5px] sm:text-[5px] font-medium leading-tight text-center line-clamp-2 px-0.5 z-[1] ${
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
  t = (key) => key,
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
  unlockedCount = 0,
  totalNodes = 0,
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
              <p className="text-[11px] sm:text-sm text-slate-300/95 mt-1 leading-snug">{t?.('skillMapModeHint') || ''}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between xs:justify-end gap-2 sm:gap-3 w-full min-w-0 sm:w-auto sm:shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={mapNavigateMode}
                onClick={() => setMapNavigateMode((v) => !v)}
                className={`rounded-xl border px-3 py-2 text-[11px] sm:text-xs font-bold transition-all shrink-0 ${
                  mapNavigateMode
                    ? 'border-white/22 bg-white/[0.08] text-slate-100 hover:bg-white/[0.12]'
                    : 'border-amber-400/50 bg-amber-500/22 text-amber-50 shadow-[0_0_18px_rgba(251,191,36,0.22)] hover:bg-amber-500/28 hover:border-amber-400/65'
                }`}
              >
                {mapNavigateMode ? (t?.('skillMapNavigateMode') || '맵 탐색') : (t?.('skillMapPageScrollMode') || '페이지 스크롤')}
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
              <div className="text-right">
                <p className="text-[10px] sm:text-xs text-slate-400">해금 스킬</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#d2a8ff] tabular-nums tracking-wide">
                  {unlockedCount}
                  <span className="text-slate-500 font-semibold text-lg mx-1"> / </span>
                  <span className="text-slate-400 text-lg">{totalNodes || 0}</span>
                </p>
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

const ActiveSkillsView = ({ t = (key) => key, setActiveTab }) => {
  const { user, profile, loading: authLoading } = useAuth();
  const [dataLoading, setDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [treeNodes, setTreeNodes] = useState([]);
  const [unlockedNodeIds, setUnlockedNodeIds] = useState(() => new Set());
  const [progressRows, setProgressRows] = useState([]);
  const [skillPoints, setSkillPoints] = useState(0);
  const [skillResetTickets, setSkillResetTickets] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all');
  /** none: 구역 필터만 | path: 기록 기준 선행 경로 */
  const [highlightMode, setHighlightMode] = useState('none');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  /** 모바일(좁은 뷰): 상세 시트는 맵 탭 시에만 펼침, 진입 시 강제로 덮지 않음 */
  const [mobileSkillSheetOpen, setMobileSkillSheetOpen] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsNarrowViewport(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

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
        setSkillResetTickets(Number(wallet.skill_reset_tickets ?? 0));
      } else {
        const { data: profileData, error: profileError } = await getUserProfile(user.id);
        if (profileError) console.warn('[ActiveSkillsView] 프로필(지갑 대체):', profileError);
        setSkillPoints(Number(profileData?.skill_points ?? 0));
        setSkillResetTickets(Number(profileData?.skill_reset_tickets ?? 0));
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
      setSkillResetTickets(0);
      setSelectedNodeId(null);
      setMobileSkillSheetOpen(false);
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

  const handleResetSkillTree = async () => {
    if (skillResetTickets < 1) {
      alert('스킬 초기화권이 없습니다.');
      return;
    }
    const confirmed = window.confirm(
      '스킬 트리를 초기화할까요?\n\n• 찍은 모든 노드·갈림길 진행·체육관 승단 신청이 삭제됩니다.\n• 사용했던 스킬 포인트는 환급됩니다.\n• 스킬 초기화권 1장이 소모됩니다.'
    );
    if (!confirmed) return;
    try {
      setIsApplying(true);
      const { resetSkillTreeWithTicketRpc } = await import('@/lib/supabase');
      const { data, error } = await resetSkillTreeWithTicketRpc();
      if (error) {
        alert(error.message || '초기화에 실패했습니다.');
        return;
      }
      if (data && typeof data === 'object' && data.ok === false) {
        alert(data.error || '초기화에 실패했습니다.');
        return;
      }
      if (data && typeof data === 'object' && data.skill_points != null) {
        setSkillPoints(Number(data.skill_points));
      }
      if (data && typeof data === 'object' && data.skill_reset_tickets != null) {
        setSkillResetTickets(Number(data.skill_reset_tickets));
      }
      const refunded = data?.refunded_points != null ? Number(data.refunded_points) : null;
      await loadSkillData();
      if (refunded != null && refunded > 0) {
        alert(`초기화가 완료되었습니다. ${refunded} SP가 환급되었습니다.`);
      } else {
        alert('초기화가 완료되었습니다.');
      }
    } catch (e) {
      console.error('[ActiveSkillsView] 스킬 초기화:', e);
      alert('초기화 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

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
    <div className="animate-fade-in-up space-y-3 xs:space-y-5 w-full min-w-0 max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 box-border">
      <PageHeader
        title={t('activeSkills')}
        description="중앙 스파인은 잽에서 시작해 공통 기본기로 이어지고, 왼쪽은 아웃복싱·오른쪽은 인파이팅으로 확장됩니다. 위에서 아래로 심화되며, 선행을 채운 뒤 기록합니다. 맵은 드래그·휠로 탐색합니다."
        onBack={() => setActiveTab('skills')}
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

      <SpotlightCard className={`border bg-gradient-to-br ${buildSummary.className} transition-all ${summaryExpanded ? 'p-5 sm:p-6' : 'p-3 sm:p-4'}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">스킬 요약</p>
            <h3 className="text-base sm:text-lg font-bold text-white leading-tight truncate">{buildSummary.label}</h3>
          </div>
          <button
            type="button"
            onClick={() => setSummaryExpanded(!summaryExpanded)}
            className="shrink-0 w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            aria-label={summaryExpanded ? '요약 접기' : '요약 펼치기'}
          >
            {summaryExpanded ? '−' : '+'}
          </button>
        </div>

        {summaryExpanded && (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm text-gray-300/95 leading-relaxed max-w-xl">{buildSummary.description}</p>
              <dl className="grid gap-2 text-[11px] sm:text-xs text-gray-400 max-w-xl rounded-lg bg-white/[0.06] border border-white/10 p-3">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2 sm:items-baseline">
                  <dt className="text-gray-500 shrink-0 sm:w-24">훈련 경향</dt>
                  <dd className="text-gray-300 min-w-0">{roadmapInterpretation.tendency}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2 sm:items-baseline border-t border-white/5 pt-2">
                  <dt className="text-gray-500 shrink-0 sm:w-24">진행</dt>
                  <dd className="text-gray-300 min-w-0">{roadmapInterpretation.stageHint}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2 sm:items-baseline border-t border-white/5 pt-2">
                  <dt className="text-gray-500 shrink-0 sm:w-24">확장</dt>
                  <dd className="text-gray-300 min-w-0">{roadmapInterpretation.expansion}</dd>
                </div>
              </dl>
            </div>

            <div className="w-full lg:max-w-[min(100%,22rem)] shrink-0 flex flex-col gap-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
              <div className="rounded-xl bg-white/[0.07] border border-white/12 p-3 sm:p-3.5">
                <div className="text-[10px] text-gray-400 mb-0.5">기록 노드</div>
                <div className="text-lg font-bold text-white tabular-nums">{unlockedNodesList.length}</div>
              </div>
              <div className="rounded-xl bg-white/[0.07] border border-white/12 p-3 sm:p-3.5">
                <div className="text-[10px] text-gray-400 mb-0.5">스킬 포인트</div>
                <div className="text-lg font-bold text-cyan-300 tabular-nums">{skillPoints}</div>
              </div>
              <div className="rounded-xl bg-white/[0.07] border border-white/12 p-3 sm:p-3.5">
                <div className="text-[10px] text-gray-400 mb-0.5">공통·기본</div>
                <div className="text-lg font-bold text-slate-200 tabular-nums">{tutorialCount}</div>
              </div>
              <div className="rounded-xl bg-white/[0.07] border border-white/12 p-3 sm:p-3.5">
                <div className="text-[10px] text-gray-400 mb-0.5">인파이터</div>
                <div className="text-lg font-bold text-orange-300 tabular-nums">{infighterCount}</div>
              </div>
              <div className="rounded-xl bg-white/[0.07] border border-white/12 p-3 sm:p-3.5">
                <div className="text-[10px] text-gray-400 mb-0.5">아웃복서</div>
                <div className="text-lg font-bold text-emerald-300 tabular-nums">{outboxerCount}</div>
              </div>
              <div className="rounded-xl bg-white/[0.07] border border-white/12 p-3 sm:p-3.5">
                <div className="text-[10px] text-gray-400 mb-0.5">전설</div>
                <div className="text-lg font-bold text-yellow-400 tabular-nums">{legendaryCount}</div>
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.06] border border-white/12 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] text-gray-500">초기화권</div>
                  <div className="text-base font-bold text-violet-300 tabular-nums">{skillResetTickets}장</div>
                </div>
                <button
                  type="button"
                  onClick={handleResetSkillTree}
                  disabled={isApplying || skillResetTickets < 1}
                  className="px-3 py-2 rounded-lg border border-violet-500/35 bg-violet-950/40 text-xs font-bold text-violet-100 hover:bg-violet-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  트리 초기화
                </button>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                해금·진행·승단 신청을 초기화하고 사용 SP를 환급합니다. 권이 있을 때만 가능합니다.
              </p>
              </div>
            </div>
          </div>
        )}

        {!summaryExpanded && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <div className="text-center">
              <div className="text-[9px] text-gray-400">기록</div>
              <div className="text-sm font-bold text-white tabular-nums">{unlockedNodesList.length}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-gray-400">SP</div>
              <div className="text-sm font-bold text-cyan-300 tabular-nums">{skillPoints}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-gray-400">기본</div>
              <div className="text-sm font-bold text-slate-200 tabular-nums">{tutorialCount}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-gray-400">인파</div>
              <div className="text-sm font-bold text-orange-300 tabular-nums">{infighterCount}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-gray-400">아웃</div>
              <div className="text-sm font-bold text-emerald-300 tabular-nums">{outboxerCount}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-gray-400">전설</div>
              <div className="text-sm font-bold text-yellow-400 tabular-nums">{legendaryCount}</div>
            </div>
          </div>
        )}
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
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start relative">
        <div className="w-full lg:flex-1 min-w-0">
          <SkillTreeMapPanel
            t={t}
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
            unlockedCount={unlockedNodesList.length}
            totalNodes={treeNodes.length}
          />
        </div>

        {selectedNode && isNarrowViewport && mobileSkillSheetOpen ? (
          <div
            role="presentation"
            className="fixed inset-0 z-[40] bg-slate-950/55 lg:hidden"
            onClick={() => setMobileSkillSheetOpen(false)}
          />
        ) : null}

        {selectedNode && isNarrowViewport && !mobileSkillSheetOpen ? (
          <div className="fixed bottom-0 left-0 right-0 z-[45] lg:hidden border-t border-white/18 bg-[#1a2238]/96 backdrop-blur-md px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(15,23,42,0.4)]">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3 text-left min-h-[2.75rem]"
              onClick={() => setMobileSkillSheetOpen(true)}
            >
              <span className="text-sm font-semibold text-white truncate min-w-0">{nodeDisplayTitle(selectedNode)}</span>
              <span className="text-[11px] font-semibold text-cyan-300/95 shrink-0">상세 ▲</span>
            </button>
          </div>
        ) : null}

        <div
          className={`
          w-full lg:w-[min(420px,38%)] lg:sticky lg:top-4 lg:self-start
          fixed bottom-0 left-0 right-0 lg:relative
          ${selectedNode && mobileSkillSheetOpen ? 'max-lg:translate-y-0' : 'max-lg:translate-y-full'}
          lg:translate-y-0
          transition-transform duration-300 ease-out
          z-50 lg:z-auto
          max-h-[70dvh] lg:max-h-[calc(100dvh-6rem)]
        `}
        >
          <div className="lg:hidden h-16 bg-gradient-to-t from-slate-900/45 to-transparent absolute bottom-full left-0 right-0 pointer-events-none" />
          
          <div className="min-w-0 w-full h-full">
        <SpotlightCard className="p-4 sm:p-5 border border-white/12 h-full overflow-y-auto
          rounded-t-2xl lg:rounded-xl
          shadow-[0_-4px_28px_rgba(15,23,42,0.38)] lg:shadow-[0_0_28px_rgba(15,23,42,0.22)]
        ">
          <div className="flex items-start gap-3 pb-3 mb-4 border-b border-white/10">
            <div className="lg:hidden w-12 h-1 rounded-full bg-white/20 mx-auto mb-2 absolute top-2 left-1/2 -translate-x-1/2" />
            <div className="w-8 h-8 shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center lg:mt-0 mt-4">
              <Icon type="target" size={16} className="text-white" />
            </div>
            <div className="min-w-0 flex-1 lg:mt-0 mt-4">
              <h3 className="text-base sm:text-lg font-bold text-white">선택한 훈련 항목</h3>
              <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed mt-0.5 hidden lg:block">
                맵에서 노드를 누르면 상세 정보를 확인할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileSkillSheetOpen(false)}
              className="lg:hidden shrink-0 w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors mt-4"
              aria-label="상세 닫기"
            >
              ✕
            </button>
          </div>

          {selectedNode ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                <div className="lg:col-span-5 space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
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
                  <div>
                    <h4 className="text-lg sm:text-xl font-bold text-white leading-snug">{nodeDisplayTitle(selectedNode)}</h4>
                    {nodeMapSubtitle(selectedNode) ? (
                      <p className="text-xs text-slate-400 mt-1">{nodeMapSubtitle(selectedNode)}</p>
                    ) : null}
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-1.5 tabular-nums">노드 #{selectedNode.node_number}</p>
                    {nodeSourceName(selectedNode) &&
                    nodeSourceName(selectedNode) !== nodeDisplayTitle(selectedNode) ? (
                      <p className="text-[11px] sm:text-xs text-slate-400 mt-2 leading-relaxed">
                        원문명: <span className="text-slate-300">{nodeSourceName(selectedNode)}</span>
                      </p>
                    ) : null}
                    {selectedNode.name_en ? (
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-1">영문: {selectedNode.name_en}</p>
                    ) : null}
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-3 min-w-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedNode.description ? (
                      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 sm:min-h-[5.5rem]">
                        <p className="text-[10px] font-bold text-amber-200/80 uppercase tracking-wide mb-1.5">설명</p>
                        <p className="text-xs sm:text-sm text-slate-200/95 leading-relaxed whitespace-pre-wrap">{selectedNode.description}</p>
                      </div>
                    ) : null}
                    {selectedNode.training_intent ? (
                      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 sm:min-h-[5.5rem]">
                        <p className="text-[10px] font-bold text-cyan-200/80 uppercase tracking-wide mb-1.5">훈련 의도</p>
                        <p className="text-xs sm:text-sm text-slate-300/95 leading-relaxed whitespace-pre-wrap">{selectedNode.training_intent}</p>
                      </div>
                    ) : null}
                  </div>
                  {selectedNode.flow_summary ? (
                    <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                      <p className="text-[10px] font-bold text-violet-200/80 uppercase tracking-wide mb-1.5">연결 흐름</p>
                      <p className="text-xs sm:text-sm text-slate-300/95 leading-relaxed">{selectedNode.flow_summary}</p>
                    </div>
                  ) : null}
                  {!selectedNode.description && !selectedNode.training_intent && !selectedNode.flow_summary ? (
                    <p className="text-[11px] text-slate-500 leading-relaxed rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      상세 설명·훈련 의도는 DB에 채워지면 여기에 표시됩니다. 맵에서는 짧은 제목만 보입니다.
                    </p>
                  ) : null}
                </div>
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
                      <div className="rounded-lg bg-white/[0.07] border border-white/12 p-3 text-xs space-y-1">
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
                          선행 노드 중 하나 이상을 충족해야 갈림길에 투자할 수 있습니다.
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
                  <div className="rounded-lg bg-white/[0.07] border border-white/12 p-3 text-xs">
                    <div className="flex justify-between text-gray-400 mb-2">
                      <span>훈련 기록</span>
                      <span className="text-white font-bold tabular-nums">
                        {selectedNonForkInv >= 1 ? '기록함' : '미기록'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      노드당 1회만 포인트로 기록할 수 있습니다.
                    </p>
                  </div>

                  {nonForkInvestMaxed ? (
                    <div className="rounded-xl bg-white/5 border border-emerald-500/25 p-4 space-y-2">
                      <p className="text-sm font-bold text-emerald-200">이 항목 기록 완료</p>
                      <p className="text-[11px] sm:text-xs text-gray-400 leading-relaxed">
                        이 노드에는 이미 기록했습니다. 다른 노드를 골라 로드맵을 이어 가세요.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-white/[0.07] border border-white/12 p-3">
                          <div className="text-gray-400 mb-1">1회 필요 포인트</div>
                          <div className="font-bold text-white">{selectedPointCost === 0 ? '무료' : `${selectedPointCost} SP`}</div>
                        </div>
                        <div className="rounded-lg bg-white/[0.07] border border-white/12 p-3">
                          <div className="text-gray-400 mb-1">보유 포인트</div>
                          <div className="font-bold text-cyan-200">{skillPoints} SP</div>
                        </div>
                      </div>

                      {!parentsSatisfiedForSelected && (
                        <p className="text-[11px] sm:text-xs text-amber-200/90">
                          선행 노드 중 하나 이상을 찍어야 이 노드를 찍을 수 있습니다.
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
                            ? '훈련 기록하기'
                            : `${selectedPointCost} SP로 기록하기`}
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>
          ) : (
            <div className="text-xs sm:text-sm text-gray-400 leading-relaxed">맵에서 노드를 선택하면 상세가 여기에 표시됩니다.</div>
          )}
        </SpotlightCard>
          </div>
        </div>
      </div>

      <SpotlightCard className="p-5">
        <h3 className="text-lg font-bold text-white mb-2">포인트·로드맵 안내</h3>
        <p className="text-sm text-gray-400 leading-relaxed">
          출석이 반영될 때마다 스킬 포인트가 쌓입니다. 맵에서 선행을 채운 뒤 원하는 항목에 기록하면 되고, 같은 노드에 여러 번 기록해 강도를 올릴 수 있습니다.
        </p>
      </SpotlightCard>
    </div>
  );
};

export { ActiveSkillsView };

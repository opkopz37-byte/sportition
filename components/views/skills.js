'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

const FILTERS = ['all', 'infighter', 'outboxer', 'legendary'];

const getTypeBadge = (type) => {
  if (type === 'infighter') {
    return { label: '인파이터', className: 'bg-orange-500/15 text-orange-200 border-orange-400/30' };
  }

  if (type === 'outboxer') {
    return { label: '아웃복서', className: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' };
  }

  return { label: '중립', className: 'bg-white/10 text-gray-300 border-white/10' };
};

const getFilterLabel = (filter) => {
  switch (filter) {
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

const getStyleSummaryFromUnlocks = (unlockedNodes) => {
  const infighter = unlockedNodes.filter((n) => n.zone === 'infighter').length;
  const outboxer = unlockedNodes.filter((n) => n.zone === 'outboxer').length;

  if (infighter === 0 && outboxer === 0) {
    return {
      label: '미설정',
      description: '출석으로 모은 스킬 포인트로 트리에서 노드를 찍어 보세요.',
      className: 'from-gray-500/20 to-white/5 border-white/10',
    };
  }

  if (infighter === outboxer) {
    return {
      label: '밸런스 빌드',
      description: '인파이터·아웃복서 노드를 비슷하게 찍은 상태입니다.',
      className: 'from-violet-500/20 to-indigo-500/10 border-violet-400/20',
    };
  }

  if (infighter > outboxer) {
    return {
      label: '인파이터 중심',
      description: '근거리·압박 계열 노드를 더 많이 찍었습니다.',
      className: 'from-orange-500/20 to-red-500/10 border-orange-400/20',
    };
  }

  return {
    label: '아웃복서 중심',
    description: '거리·운영 계열 노드를 더 많이 찍었습니다.',
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

  if (node.zone === 'tutorial') {
    return 'rounded-full';
  }

  if (node.node_type === 'socket') {
    return 'rounded-2xl';
  }

  return 'rounded-xl';
};

const getNodeToneClass = ({ node, isUnlocked, isSelected, isDimmed, isUnlockableOnly, isLocked }) => {
  if (isLocked) {
    return `border-white/20 bg-zinc-900/90 text-gray-500 ${isDimmed ? 'opacity-35' : 'opacity-80'}`;
  }

  const inactiveBase = isUnlockableOnly
    ? 'border-white/15 bg-black/50 text-gray-300'
    : 'border-white/10 bg-black/40 text-gray-500';

  if (!isUnlocked) {
    return `${inactiveBase} ${isDimmed ? 'opacity-30' : 'opacity-70'}`;
  }

  const selected = isSelected ? 'ring-1 ring-white/50 scale-[1.04] z-20' : '';

  if (node.zone === 'legendary') {
    return `border-yellow-300/70 bg-gradient-to-br from-yellow-300 via-amber-500 to-orange-600 text-white shadow-[0_0_12px_rgba(251,191,36,0.35)] ${selected}`;
  }

  if (node.zone === 'tutorial') {
    return `border-slate-200/70 bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 text-slate-950 shadow-[0_0_10px_rgba(226,232,240,0.22)] ${selected}`;
  }

  if (node.zone === 'infighter') {
    return `border-orange-200/70 bg-gradient-to-br from-orange-300 via-red-500 to-orange-700 text-white shadow-[0_0_12px_rgba(249,115,22,0.28)] ${selected}`;
  }

  return `border-emerald-200/70 bg-gradient-to-br from-emerald-300 via-teal-500 to-cyan-700 text-white shadow-[0_0_12px_rgba(16,185,129,0.26)] ${selected}`;
};

const getNodeSizeClass = (node) => {
  if (node.zone === 'legendary') return 'w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9';
  if (node.zone === 'tutorial') return 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8';
  if (node.node_type === 'socket') return 'w-6 h-6 sm:w-7 sm:h-7 md:w-7 md:h-7';
  return 'w-6 h-6 sm:w-7 sm:h-7 md:w-7 md:h-7';
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

/** 스킬 맵 실제 좌표계 (표시용 % 좌표는 이 크기 기준) */
const SKILL_MAP_WIDTH = 2200;
const SKILL_MAP_HEIGHT = 1232;

const ZOOM_MIN = 0.38;
const ZOOM_MAX = 1.65;
const ZOOM_DEFAULT = 0.58;

/** SVG viewBox 높이 (가로 100과 맞춤) */
const VIEWBOX_H = 56;

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

/**
 * DB 좌표 대신 그래프 단계·진영별로 배치해 트리가 위→아래로 읽히게 함
 */
function computeSkillTreeLayout(nodes) {
  if (!nodes?.length) {
    return { positionById: new Map(), depthMap: new Map(), maxDepth: 0 };
  }

  const depthMap = computeSkillTreeDepths(nodes);
  const maxDepth = Math.max(0, ...nodes.map((n) => depthMap.get(n.node_number) ?? 0));

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

    const y = 7 + (d / Math.max(maxDepth, 1)) * 86;

    const tut = sortRow(row.filter((n) => n.zone === 'tutorial'));
    const inf = sortRow(row.filter((n) => n.zone === 'infighter'));
    const out = sortRow(row.filter((n) => n.zone === 'outboxer'));
    const leg = sortRow(row.filter((n) => n.zone === 'legendary'));
    const other = sortRow(
      row.filter((n) => !['tutorial', 'infighter', 'outboxer', 'legendary'].includes(n.zone))
    );

    spreadInRange(tut.length, 38, 62).forEach((x, i) => {
      positionById.set(tut[i].id, { x, y, depth: d });
    });
    spreadInRange(inf.length, 14, 44).forEach((x, i) => {
      positionById.set(inf[i].id, { x, y, depth: d });
    });
    spreadInRange(out.length, 56, 86).forEach((x, i) => {
      positionById.set(out[i].id, { x, y, depth: d });
    });
    spreadInRange(leg.length, 47, 53).forEach((x, i) => {
      positionById.set(leg[i].id, { x, y, depth: d });
    });
    spreadInRange(other.length, 32, 68).forEach((x, i) => {
      positionById.set(other[i].id, { x, y, depth: d });
    });
  }

  return { positionById, depthMap, maxDepth };
}

function toSvgXY(xPct, yPct) {
  return { x: Number(xPct), y: (Number(yPct) / 100) * VIEWBOX_H };
}

function edgePathD(x1, y1, x2, y2) {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
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
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = -e.deltaY;
      const factor = 1 + delta * 0.0014;
      const z0 = zoomRef.current;
      const z1 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z0 * factor));
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

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
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

      const normalizedTreeNodes = (nodes || []).sort((a, b) => a.node_number - b.node_number);
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

  const skillTreeLayout = useMemo(() => computeSkillTreeLayout(treeNodes), [treeNodes]);

  const unlockedNodesList = useMemo(
    () =>
      treeNodes.filter((n) => {
        if (!n.is_fork) return unlockedNodeIds.has(n.id);
        return isForkNodeActive(n, unlockedNodeIds, progressByNodeId);
      }),
    [treeNodes, unlockedNodeIds, progressByNodeId]
  );

  const highlightedNodeIds = useMemo(() => {
    if (activeFilter === 'all') return new Set(treeNodes.map((n) => n.id));
    return new Set(
      unlockedNodesList
        .filter((n) =>
          activeFilter === 'legendary' ? n.zone === 'legendary' : n.zone === activeFilter
        )
        .map((n) => n.id)
    );
  }, [activeFilter, treeNodes, unlockedNodesList]);

  const buildSummary = useMemo(() => getStyleSummaryFromUnlocks(unlockedNodesList), [unlockedNodesList]);

  const infighterCount = unlockedNodesList.filter((n) => n.zone === 'infighter').length;
  const outboxerCount = unlockedNodesList.filter((n) => n.zone === 'outboxer').length;
  const legendaryCount = unlockedNodesList.filter((n) => n.zone === 'legendary').length;

  const selectedNode = treeNodes.find((node) => node.id === selectedNodeId) || null;

  const filteredUnlockedNodes = useMemo(() => {
    if (activeFilter === 'all') return unlockedNodesList;
    return unlockedNodesList.filter((n) =>
      activeFilter === 'legendary' ? n.zone === 'legendary' : n.zone === activeFilter
    );
  }, [activeFilter, unlockedNodesList]);

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
        alert(error.message || '스킬 포인트 사용에 실패했습니다.');
        return;
      }

      if (data && typeof data === 'object' && data.ok === false) {
        alert(data.error || '스킬 포인트 사용에 실패했습니다.');
        return;
      }

      if (data && typeof data === 'object' && data.skill_points != null) {
        setSkillPoints(data.skill_points);
      }

      await loadSkillData();
    } catch (error) {
      console.error('[ActiveSkillsView] 스킬 포인트 사용 에러:', error);
      alert('스킬 포인트를 사용하는 중 오류가 발생했습니다.');
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
    <div className="animate-fade-in-up space-y-4 xs:space-y-6">
      <PageHeader
        title={t('activeSkills')}
        description="출석으로 받은 스킬 포인트를 써서 트리에 스킬을 찍고 빌드를 만듭니다"
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/30 border border-white/10 text-[11px] sm:text-xs text-gray-300 mb-3">
              <span>현재 세팅</span>
            </div>
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2">{buildSummary.label}</h3>
            <p className="text-xs sm:text-sm text-gray-300 max-w-2xl">{buildSummary.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 min-w-[220px] sm:min-w-[260px]">
            <div className="rounded-xl bg-black/30 border border-white/10 p-4">
              <div className="text-[11px] sm:text-xs text-gray-400 mb-1">찍은 노드</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-white">{unlockedNodesList.length}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/10 p-4">
              <div className="text-[11px] sm:text-xs text-gray-400 mb-1">스킬 포인트</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-cyan-300">{skillPoints}</div>
            </div>
          </div>
        </div>
      </SpotlightCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xs:gap-4">
        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-[11px] sm:text-xs text-gray-400 mb-1">찍은 노드</div>
            <div className="text-base sm:text-lg md:text-2xl font-bold text-white">{unlockedNodesList.length}</div>
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-[11px] sm:text-xs text-gray-400 mb-1">인파이터</div>
            <div className="text-base sm:text-lg md:text-2xl font-bold text-orange-300">{infighterCount}</div>
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-[11px] sm:text-xs text-gray-400 mb-1">아웃복서</div>
            <div className="text-base sm:text-lg md:text-2xl font-bold text-emerald-300">{outboxerCount}</div>
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-[11px] sm:text-xs text-gray-400 mb-1">전설 노드</div>
            <div className="text-base sm:text-lg md:text-2xl font-bold text-yellow-400">{legendaryCount}</div>
          </div>
        </SpotlightCard>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                isActive
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {getFilterLabel(filter)}
            </button>
          );
        })}
      </div>

      <SpotlightCard className="p-0 overflow-hidden border border-white/10">
        <div className="px-3 pt-2 pb-1 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-black/20">
          <p className="text-[10px] sm:text-xs text-gray-500">
            드래그로 이동 · 휠로 확대/축소 · 터치는 두 손가락으로 핀치
          </p>
          <span className="text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap tabular-nums">
            줌 {(zoom * 100).toFixed(0)}%
          </span>
        </div>
        <div
          ref={skillViewportRef}
          className={`relative w-full overflow-hidden bg-[#05060a] select-none touch-none ${
            isPanningMap ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ height: 'min(72vh, 720px)', minHeight: '380px' }}
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
            <div className="absolute inset-0 bg-[#06070c]" />
            <div
              className="absolute inset-0 opacity-[0.55]"
              style={{ clipPath: 'polygon(0 0, 62% 0, 48% 100%, 0 100%)', background: 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(124,45,18,0.06) 58%, transparent 100%)' }}
            />
            <div
              className="absolute inset-0 opacity-[0.55]"
              style={{ clipPath: 'polygon(38% 0, 100% 0, 100% 100%, 52% 100%)', background: 'linear-gradient(315deg, rgba(16,185,129,0.16), rgba(6,78,59,0.05) 58%, transparent 100%)' }}
            />
            <div
              className="absolute inset-0 opacity-40"
              style={{ clipPath: 'polygon(48.7% 0, 51.3% 0, 100% 100%, 97.4% 100%)', background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))' }}
            />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)',
                backgroundSize: '56px 56px',
              }}
            />

            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 56" preserveAspectRatio="none">
              {Array.from({ length: skillTreeLayout.maxDepth + 1 }, (_, d) => {
                const yPct = 7 + (d / Math.max(skillTreeLayout.maxDepth, 1)) * 86;
                const y = (yPct / 100) * VIEWBOX_H;
                return (
                  <g key={`tier-${d}`}>
                    <line
                      x1={0}
                      y1={y}
                      x2={100}
                      y2={y}
                      stroke="rgba(148,163,184,0.12)"
                      strokeWidth={0.25}
                      strokeDasharray="3 10"
                    />
                    <text
                      x={2}
                      y={y - 0.35}
                      fill="rgba(148,163,184,0.45)"
                      fontSize={1.6}
                      style={{ fontFamily: 'system-ui, sans-serif' }}
                    >
                      {d === 0 ? '시작' : `단계 ${d + 1}`}
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

                  const p1 = toSvgXY(cx(parentNode), cy(parentNode));
                  const p2 = toSvgXY(cx(node), cy(node));
                  const childLit = node.is_fork
                    ? nodeReadyForEdge(node, unlockedNodeIds, progressByNodeId)
                    : unlockedNodeIds.has(node.id);
                  const isActiveLine =
                    parentEdgeSatisfied(parentNode, node, unlockedNodeIds, progressByNodeId) && childLit;
                  const filtered = activeFilter !== 'all' && !(highlightedNodeIds.has(node.id) || highlightedNodeIds.has(parentNode.id));

                  let stroke = 'rgba(148,163,184,0.22)';
                  if (isActiveLine && node.zone === 'infighter') stroke = 'rgba(249,115,22,0.88)';
                  if (isActiveLine && node.zone === 'outboxer') stroke = 'rgba(16,185,129,0.82)';
                  if (isActiveLine && node.zone === 'legendary') stroke = 'rgba(250,204,21,0.92)';
                  if (!isActiveLine && node.zone === 'infighter') stroke = 'rgba(249,115,22,0.22)';
                  if (!isActiveLine && node.zone === 'outboxer') stroke = 'rgba(16,185,129,0.22)';
                  if (!isActiveLine && node.zone === 'legendary') stroke = 'rgba(250,204,21,0.22)';

                  return (
                    <path
                      key={`${parentNode.id}-${node.id}`}
                      d={edgePathD(p1.x, p1.y, p2.x, p2.y)}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={isActiveLine ? 0.55 : 0.35}
                      strokeDasharray={isActiveLine ? '0' : '1.2 2'}
                      opacity={filtered ? 0.18 : 1}
                      style={{
                        filter: isActiveLine ? `drop-shadow(0 0 4px ${stroke})` : 'none',
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
              const isHighlighted = activeFilter === 'all' || highlightedNodeIds.has(node.id);
              const parentsOk = parentsSatisfiedForDisplay(node, unlockedNodeIds, progressByNodeId, nodeByNumber);
              const isUnlockableOnly = !isUnlocked && parentsOk && (!node.is_fork || !forkDone);
              const isLocked =
                !isUnlocked && Boolean(node.parent_nodes?.length) && !parentsOk && node.node_number !== 1;
              const shapeClass = getNodeShapeClass(node);
              const sizeClass = getNodeSizeClass(node);
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
              const stageNum = (lay?.depth ?? skillTreeLayout.depthMap.get(node.node_number) ?? 0) + 1;
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
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none flex flex-col items-center gap-0.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-white/35 tabular-nums">
                        {stageNum}
                      </span>
                      {node.is_fork && (
                        <span className="text-[7px] sm:text-[8px] font-bold text-amber-300/90">갈림</span>
                      )}
                    </div>

                    {isUnlocked && (
                      <div
                        className={`absolute inset-0 blur-md opacity-45 ${
                          node.zone === 'infighter'
                            ? 'bg-orange-500'
                            : node.zone === 'outboxer'
                              ? 'bg-emerald-500'
                              : node.zone === 'legendary'
                                ? 'bg-yellow-400'
                                : 'bg-slate-300'
                        }`}
                        style={{ transform: 'scale(1.2)' }}
                      />
                    )}

                    <div className={`${sizeClass} ${shapeClass} ${toneClass} border flex items-center justify-center relative backdrop-blur-sm transition-all`}>
                      {isLocked ? (
                        <span className="text-[9px] sm:text-[10px] leading-none opacity-90">🔒</span>
                      ) : (
                        <span className={`text-[7px] sm:text-[8px] md:text-[9px] font-bold leading-none ${node.zone === 'legendary' ? '-rotate-45' : ''}`}>
                          {symbol}
                        </span>
                      )}
                    </div>

                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 sm:mt-1.5 w-14 sm:w-16 md:w-[4.5rem] text-center pointer-events-none">
                      <p className={`text-[7px] sm:text-[8px] md:text-[9px] leading-snug line-clamp-2 ${isUnlocked ? 'text-white/90' : 'text-gray-500'}`}>
                        {node.name}
                      </p>
                      {!node.is_fork && nfInvCount > 0 && (
                        <p className="text-[6px] sm:text-[7px] text-cyan-300/90 tabular-nums mt-0.5">
                          {nfInvCount}/{MAX_NON_FORK_INVEST}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="absolute left-3 top-10 sm:left-5 sm:top-12 max-w-[140px] sm:max-w-[180px] text-[9px] sm:text-[11px] text-gray-400 border border-white/10 bg-black/50 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 pointer-events-none z-10">
              좌측: 인파이터 · 단계가 아래로 갈수록 심화. 선행을 찍은 뒤 포인트로 다음 노드 찍기
            </div>
            <div className="absolute right-3 bottom-3 sm:right-5 sm:bottom-5 max-w-[140px] sm:max-w-[180px] text-[9px] sm:text-[11px] text-gray-400 border border-white/10 bg-black/50 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 pointer-events-none z-10 text-right">
              우측: 아웃복서 · 중앙: 전설 체인
            </div>
          </div>
        </div>
      </SpotlightCard>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1.85fr] gap-4">
        <SpotlightCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Icon type="target" size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">선택 노드 정보</h3>
              <p className="text-xs text-gray-400">노드를 클릭하면 필요한 포인트와 선행 조건을 확인할 수 있습니다.</p>
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
                  {selectedNode.zone === 'tutorial' ? '튜토리얼' : selectedNode.zone === 'infighter' ? '인파이터' : selectedNode.zone === 'outboxer' ? '아웃복서' : '전설'}
                </span>
                <span className="px-2 py-1 rounded-full text-xs font-bold border bg-white/5 text-gray-300 border-white/10">
                  {selectedNode.node_type === 'basic' ? '기본 노드' : selectedNode.node_type === 'socket' ? '스킬 소켓' : '전설 소켓'}
                </span>
              </div>

              <div>
                <h4 className="text-base sm:text-lg md:text-xl font-bold text-white mb-1">{selectedNode.name}</h4>
                <p className="text-[11px] sm:text-xs text-gray-500">노드 번호 #{selectedNode.node_number}</p>
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
                              ? '투자하기 (무료)'
                              : `${selectedPointCost} SP로 투자하기`}
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
                      <span>강화 (찍기)</span>
                      <span className="text-white font-bold tabular-nums">
                        {selectedNonForkInv} / {MAX_NON_FORK_INVEST}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">같은 노드에 최대 {MAX_NON_FORK_INVEST}번까지 스킬 포인트를 투자할 수 있습니다.</p>
                  </div>

                  {nonForkInvestMaxed ? (
                    <div className="rounded-xl bg-white/5 border border-emerald-500/25 p-4 space-y-2">
                      <p className="text-sm font-bold text-emerald-200">이 노드 강화 완료</p>
                      <p className="text-[11px] sm:text-xs text-gray-400">
                        {MAX_NON_FORK_INVEST}번 모두 투자했습니다. 다른 노드를 선택해 빌드를 이어 가세요.
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
                            ? `강화하기 (${selectedNonForkInv + 1}/${MAX_NON_FORK_INVEST})`
                            : `${selectedPointCost} SP로 강화 (${selectedNonForkInv + 1}/${MAX_NON_FORK_INVEST})`}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-xs text-gray-400">
                선행 조건: {selectedNode.parent_nodes?.length ? selectedNode.parent_nodes.map((value) => `#${value}`).join(', ') : '없음'}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">선택된 노드가 없습니다.</div>
          )}
        </SpotlightCard>

        <div className="space-y-4">
          {filteredUnlockedNodes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUnlockedNodes.map((node) => {
                const typeBadge = getTypeBadge(
                  node.zone === 'infighter' ? 'infighter' : node.zone === 'outboxer' ? 'outboxer' : 'neutral'
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

                    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-gray-400">
                      스킬 포인트를 써서 찍은 노드입니다. 필터를 바꾸면 이 목록도 함께 좁혀집니다.
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
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">아직 찍은 스킬이 없습니다</h3>
              <p className="text-sm text-gray-400 mb-6">
                스킬 포인트가 있으면 맵에서 노드를 골라 바로 찍을 수 있습니다. 위 필터는 맵 하이라이트와 이 목록에 모두 적용됩니다.
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
            <h3 className="text-lg font-bold text-white mb-2">스킬 포인트 안내</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              출석이 기록될 때마다 스킬 포인트가 쌓입니다. 포인트만 있으면 트리에서 원하는 노드를 골라 찍을 수 있고, 한 번 찍은 노드는 계속 적용됩니다.
            </p>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
};

export { ActiveSkillsView };

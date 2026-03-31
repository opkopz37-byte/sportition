'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

const FILTERS = ['all', 'infighter', 'outboxer', 'legendary'];

const getRarityBadge = (rarity) => {
  switch (rarity) {
    case 'legendary':
      return { label: '전설', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30' };
    case 'epic':
      return { label: '영웅', className: 'bg-purple-500/20 text-purple-300 border-purple-400/30' };
    case 'rare':
      return { label: '희귀', className: 'bg-blue-500/20 text-blue-300 border-blue-400/30' };
    default:
      return { label: '일반', className: 'bg-gray-500/20 text-gray-300 border-gray-400/30' };
  }
};

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

const getStyleSummary = (cards) => {
  const infighter = cards.filter((card) => card.card_type === 'infighter').length;
  const outboxer = cards.filter((card) => card.card_type === 'outboxer').length;

  if (infighter === 0 && outboxer === 0) {
    return {
      label: '미설정',
      description: '아직 장착한 액티브 스킬이 없습니다.',
      className: 'from-gray-500/20 to-white/5 border-white/10',
    };
  }

  if (infighter === outboxer) {
    return {
      label: '밸런스 빌드',
      description: '인파이터와 아웃복서 스킬이 균형 있게 장착되어 있습니다.',
      className: 'from-violet-500/20 to-indigo-500/10 border-violet-400/20',
    };
  }

  if (infighter > outboxer) {
    return {
      label: '인파이터 중심',
      description: '근거리 압박과 바디 연계 중심의 공격형 세팅입니다.',
      className: 'from-orange-500/20 to-red-500/10 border-orange-400/20',
    };
  }

  return {
    label: '아웃복서 중심',
    description: '거리 운영과 카운터 중심의 컨트롤형 세팅입니다.',
    className: 'from-emerald-500/20 to-cyan-500/10 border-emerald-400/20',
  };
};

const sortSkills = (cards) =>
  [...cards].sort((a, b) => {
    const rarityPriority = { legendary: 4, epic: 3, rare: 2, normal: 1 };
    const rarityGap = (rarityPriority[b.rarity] || 0) - (rarityPriority[a.rarity] || 0);

    if (rarityGap !== 0) return rarityGap;
    if ((b.level || 0) !== (a.level || 0)) return (b.level || 0) - (a.level || 0);
    return (a.node?.node_number || 999) - (b.node?.node_number || 999);
  });

const getNodeSymbol = (node, equippedCard) => {
  if (equippedCard) {
    if (equippedCard.rarity === 'legendary') return '✦';
    if (equippedCard.rarity === 'epic') return '◆';
    if (equippedCard.rarity === 'rare') return '◈';
    return '●';
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

const getNodeToneClass = ({ node, isEquipped, isSelected, isDimmed, isUnlockableOnly }) => {
  const inactiveBase = isUnlockableOnly
    ? 'border-white/15 bg-black/50 text-gray-300'
    : 'border-white/10 bg-black/40 text-gray-500';

  if (!isEquipped) {
    return `${inactiveBase} ${isDimmed ? 'opacity-30' : 'opacity-70'}`;
  }

  const selected = isSelected ? 'ring-2 ring-white/60 scale-110 z-20' : '';

  if (node.zone === 'legendary') {
    return `border-yellow-300/80 bg-gradient-to-br from-yellow-300 via-amber-500 to-orange-600 text-white shadow-[0_0_24px_rgba(251,191,36,0.55)] ${selected}`;
  }

  if (node.zone === 'tutorial') {
    return `border-slate-200/70 bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 text-slate-950 shadow-[0_0_18px_rgba(226,232,240,0.35)] ${selected}`;
  }

  if (node.zone === 'infighter') {
    return `border-orange-200/70 bg-gradient-to-br from-orange-300 via-red-500 to-orange-700 text-white shadow-[0_0_24px_rgba(249,115,22,0.45)] ${selected}`;
  }

  return `border-emerald-200/70 bg-gradient-to-br from-emerald-300 via-teal-500 to-cyan-700 text-white shadow-[0_0_24px_rgba(16,185,129,0.40)] ${selected}`;
};

const getNodeSizeClass = (node) => {
  if (node.zone === 'legendary') return 'w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12';
  if (node.zone === 'tutorial') return 'w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11';
  if (node.node_type === 'socket') return 'w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10';
  return 'w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10';
};

const matchesNodeZone = (node, card) => {
  if (!node || !card) return false;
  if (node.zone === 'legendary') return card.rarity === 'legendary';
  if (node.zone === 'tutorial') return true;
  return card.card_type === node.zone;
};

const ActiveSkillsView = ({ t = (key) => key, setActiveTab }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [allCards, setAllCards] = useState([]);
  const [equippedCards, setEquippedCards] = useState([]);
  const [treeNodes, setTreeNodes] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadSkillData();
    }
  }, [user]);

  const loadSkillData = async () => {
    if (!user?.id) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const { getUserCards, getUserSkillTree, getSkillTreeNodes } = await import('@/lib/supabase');
      const [
        { data: cards, error: cardsError },
        { data: equippedTree, error: treeError },
        { data: nodes, error: nodesError },
      ] = await Promise.all([
        getUserCards(user.id, {}),
        getUserSkillTree(user.id),
        getSkillTreeNodes(),
      ]);

      if (cardsError) throw cardsError;
      if (treeError) throw treeError;
      if (nodesError) throw nodesError;

      const normalizedCards = cards || [];
      const normalizedEquippedCards = sortSkills(equippedTree || []);
      const normalizedTreeNodes = (nodes || []).sort((a, b) => a.node_number - b.node_number);

      setAllCards(normalizedCards);
      setEquippedCards(normalizedEquippedCards);
      setTreeNodes(normalizedTreeNodes);
      setSelectedNodeId(normalizedEquippedCards[0]?.node?.id || normalizedTreeNodes[0]?.id || null);
    } catch (error) {
      console.error('[ActiveSkillsView] 데이터 로드 에러:', error);
      setErrorMessage(error?.message || '액티브 스킬 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const equippedNodeMap = useMemo(
    () => new Map(equippedCards.map((item) => [item.node?.id, item]).filter(([nodeId]) => Boolean(nodeId))),
    [equippedCards]
  );

  const nodeByNumber = useMemo(
    () => new Map(treeNodes.map((node) => [node.node_number, node])),
    [treeNodes]
  );

  const filteredEquippedCards = useMemo(() => {
    if (activeFilter === 'all') return equippedCards;
    if (activeFilter === 'legendary') return equippedCards.filter((card) => card.rarity === 'legendary');
    return equippedCards.filter((card) => card.card?.card_type === activeFilter);
  }, [activeFilter, equippedCards]);

  const highlightedNodeIds = useMemo(
    () => new Set(filteredEquippedCards.map((card) => card.node?.id).filter(Boolean)),
    [filteredEquippedCards]
  );

  const unequippedCards = useMemo(
    () =>
      sortSkills(
        allCards.filter((card) => !card.is_equipped)
      ).slice(0, 6),
    [allCards]
  );

  const buildSummary = useMemo(
    () => getStyleSummary(equippedCards.map((card) => ({ ...card, card_type: card.card?.card_type }))),
    [equippedCards]
  );

  const infighterCount = equippedCards.filter((card) => card.card?.card_type === 'infighter').length;
  const outboxerCount = equippedCards.filter((card) => card.card?.card_type === 'outboxer').length;
  const legendaryCount = equippedCards.filter((card) => card.rarity === 'legendary').length;
  const averageLevel = equippedCards.length
    ? (equippedCards.reduce((total, card) => total + (card.level || 0), 0) / equippedCards.length).toFixed(1)
    : '0.0';

  const selectedNode = treeNodes.find((node) => node.id === selectedNodeId) || null;
  const selectedNodeCard = selectedNode ? equippedNodeMap.get(selectedNode.id) || null : null;
  const selectableCardsForNode = useMemo(() => {
    if (!selectedNode) return [];

    return sortSkills(
      allCards.filter((card) => !card.is_equipped && matchesNodeZone(selectedNode, card))
    ).slice(0, 6);
  }, [allCards, selectedNode]);

  const handleEquipToNode = async (userCardId, nodeId) => {
    try {
      setIsApplying(true);
      const { equipCard } = await import('@/lib/supabase');
      const { error } = await equipCard(userCardId, nodeId, true);

      if (error) {
        alert(error.message || '스킬 장착에 실패했습니다.');
        return;
      }

      await loadSkillData();
    } catch (error) {
      console.error('[ActiveSkillsView] 장착 에러:', error);
      alert('스킬 장착 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleUnequipFromNode = async (userCardId) => {
    try {
      setIsApplying(true);
      const { equipCard } = await import('@/lib/supabase');
      const { error } = await equipCard(userCardId, null, false);

      if (error) {
        alert(error.message || '스킬 해제에 실패했습니다.');
        return;
      }

      await loadSkillData();
    } catch (error) {
      console.error('[ActiveSkillsView] 해제 에러:', error);
      alert('스킬 해제 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  if (loading) {
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
        description="현재 장착된 액티브 스킬 노드 구성과 스타일 세팅을 확인하세요"
        onBack={() => setActiveTab('roadmap-skill-tree')}
      >
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('roadmap-skill-tree')}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-all"
          >
            스킬트리 보기
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-all"
          >
            보관함 이동
          </button>
          <button
            onClick={() => setActiveTab('gacha')}
            className="px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg text-sm text-white font-bold transition-all"
          >
            카드 뽑기
          </button>
        </div>
      </PageHeader>

      {errorMessage && (
        <SpotlightCard className="p-4 border-l-4 border-red-500">
          <p className="text-sm text-red-300">{errorMessage}</p>
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
              <div className="text-[11px] sm:text-xs text-gray-400 mb-1">장착 액티브</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-white">{equippedCards.length}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/10 p-4">
              <div className="text-[11px] sm:text-xs text-gray-400 mb-1">평균 레벨</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-300">{averageLevel}</div>
            </div>
          </div>
        </div>
      </SpotlightCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xs:gap-4">
        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-[11px] sm:text-xs text-gray-400 mb-1">전체 장착</div>
            <div className="text-base sm:text-lg md:text-2xl font-bold text-white">{equippedCards.length}</div>
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
            <div className="text-[11px] sm:text-xs text-gray-400 mb-1">전설 장착</div>
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

      <SpotlightCard className="p-0 overflow-hidden">
        <div className="relative w-full overflow-hidden">
          <div
            className="relative w-full max-w-full"
            style={{ aspectRatio: '1000 / 560', minHeight: '360px', maxHeight: '62vh' }}
          >
            <div className="absolute inset-0 bg-[#08090d]" />
            <div
              className="absolute inset-0 opacity-90"
              style={{ clipPath: 'polygon(0 0, 62% 0, 48% 100%, 0 100%)', background: 'linear-gradient(135deg, rgba(249,115,22,0.22), rgba(124,45,18,0.06) 58%, transparent 100%)' }}
            />
            <div
              className="absolute inset-0 opacity-90"
              style={{ clipPath: 'polygon(38% 0, 100% 0, 100% 100%, 52% 100%)', background: 'linear-gradient(315deg, rgba(16,185,129,0.20), rgba(6,78,59,0.05) 58%, transparent 100%)' }}
            />
            <div
              className="absolute inset-0 opacity-70"
              style={{ clipPath: 'polygon(48.7% 0, 51.3% 0, 100% 100%, 97.4% 100%)', background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.02))' }}
            />
            <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 56" preserveAspectRatio="none">
              {treeNodes.flatMap((node) => {
                if (!node.parent_nodes || node.parent_nodes.length === 0) return [];

                return node.parent_nodes.map((parentNum) => {
                  const parentNode = nodeByNumber.get(parentNum);
                  if (!parentNode) return null;

                  const x1 = parentNode.position_x;
                  const y1 = (parentNode.position_y / 100) * 56;
                  const x2 = node.position_x;
                  const y2 = (node.position_y / 100) * 56;
                  const parentEquipped = equippedNodeMap.has(parentNode.id);
                  const nodeEquipped = equippedNodeMap.has(node.id);
                  const isActiveLine = parentEquipped && nodeEquipped;
                  const filtered = activeFilter !== 'all' && !(highlightedNodeIds.has(node.id) || highlightedNodeIds.has(parentNode.id));

                  let stroke = 'rgba(148,163,184,0.18)';
                  if (isActiveLine && node.zone === 'infighter') stroke = 'rgba(249,115,22,0.85)';
                  if (isActiveLine && node.zone === 'outboxer') stroke = 'rgba(16,185,129,0.8)';
                  if (isActiveLine && node.zone === 'legendary') stroke = 'rgba(250,204,21,0.9)';
                  if (!isActiveLine && node.zone === 'infighter') stroke = 'rgba(249,115,22,0.18)';
                  if (!isActiveLine && node.zone === 'outboxer') stroke = 'rgba(16,185,129,0.18)';
                  if (!isActiveLine && node.zone === 'legendary') stroke = 'rgba(250,204,21,0.18)';

                  return (
                    <line
                      key={`${parentNode.id}-${node.id}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={stroke}
                      strokeWidth={isActiveLine ? 3 : 1.5}
                      strokeDasharray={isActiveLine ? '0' : '5 6'}
                      opacity={filtered ? 0.18 : 1}
                      style={{
                        filter: isActiveLine ? `drop-shadow(0 0 8px ${stroke})` : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    />
                  );
                });
              })}
            </svg>

            {treeNodes.map((node) => {
              const equippedCard = equippedNodeMap.get(node.id) || null;
              const isEquipped = Boolean(equippedCard);
              const isSelected = node.id === selectedNodeId;
              const isHighlighted = activeFilter === 'all' || highlightedNodeIds.has(node.id);
              const hasEquippedParent = !node.parent_nodes?.length || node.parent_nodes.some((parentNum) => {
                const parentNode = nodeByNumber.get(parentNum);
                return parentNode && equippedNodeMap.has(parentNode.id);
              });
              const isUnlockableOnly = !isEquipped && hasEquippedParent;
              const shapeClass = getNodeShapeClass(node);
              const sizeClass = getNodeSizeClass(node);
              const toneClass = getNodeToneClass({
                node,
                isEquipped,
                isSelected,
                isDimmed: !isHighlighted,
                isUnlockableOnly,
              });
              const symbol = getNodeSymbol(node, equippedCard);

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNodeId(node.id)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-105"
                  style={{
                    left: `${node.position_x}%`,
                    top: `${node.position_y}%`,
                  }}
                >
                  <div className="relative">
                    {isEquipped && (
                      <div
                        className={`absolute inset-0 blur-xl opacity-60 ${
                          node.zone === 'infighter'
                            ? 'bg-orange-500'
                            : node.zone === 'outboxer'
                              ? 'bg-emerald-500'
                              : node.zone === 'legendary'
                                ? 'bg-yellow-400'
                                : 'bg-slate-300'
                        }`}
                        style={{ transform: 'scale(1.5)' }}
                      />
                    )}

                    <div className={`${sizeClass} ${shapeClass} ${toneClass} border flex items-center justify-center relative backdrop-blur-sm transition-all`}>
                      <span className={`text-[8px] sm:text-[9px] md:text-[10px] font-bold ${node.zone === 'legendary' ? '-rotate-45' : ''}`}>
                        {symbol}
                      </span>

                      {isEquipped && equippedCard && node.zone !== 'legendary' && (
                        <div className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] sm:min-w-[20px] sm:h-[20px] px-1 rounded-full bg-black border border-white/10 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white">
                          {equippedCard.level}
                        </div>
                      )}
                    </div>

                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 sm:mt-2 w-14 sm:w-16 md:w-20 text-center">
                      <p className={`text-[8px] sm:text-[9px] md:text-[10px] leading-tight ${isEquipped ? 'text-white' : 'text-gray-500'}`}>
                        {node.name}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="absolute left-2 top-2 sm:left-4 sm:top-4 text-[9px] sm:text-[11px] text-gray-400 border border-white/10 bg-black/30 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2">
              좌측: 인파이터 라인
            </div>
            <div className="absolute right-2 bottom-2 sm:right-4 sm:bottom-4 text-[9px] sm:text-[11px] text-gray-400 border border-white/10 bg-black/30 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2">
              우측: 아웃복서 라인
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
              <p className="text-xs text-gray-400">노드를 클릭하면 현재 장착 상태를 확인할 수 있습니다.</p>
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

              {selectedNodeCard ? (
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{selectedNodeCard.card?.name || selectedNodeCard.card_name}</p>
                      <p className="text-[11px] sm:text-xs text-gray-400">{selectedNodeCard.master_name || selectedNodeCard.card?.card_type || '마스터 미지정'}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getRarityBadge(selectedNodeCard.rarity).className}`}>
                      {getRarityBadge(selectedNodeCard.rarity).label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-black/30 border border-white/10 p-3">
                      <div className="text-gray-400 mb-1">레벨</div>
                      <div className="font-bold text-white">Lv.{selectedNodeCard.level}</div>
                    </div>
                    <div className="rounded-lg bg-black/30 border border-white/10 p-3">
                      <div className="text-gray-400 mb-1">스타일</div>
                      <div className="font-bold text-white">
                        {selectedNodeCard.card?.card_type === 'infighter' ? '인파이터' : selectedNodeCard.card?.card_type === 'outboxer' ? '아웃복서' : '중립'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnequipFromNode(selectedNodeCard.id)}
                    disabled={isApplying}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white transition-all disabled:opacity-50"
                  >
                    {isApplying ? '처리 중...' : '이 노드에서 해제'}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <p className="text-sm text-gray-400">아직 이 노드에는 액티브 카드가 장착되지 않았습니다.</p>

                  {selectableCardsForNode.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] sm:text-xs text-gray-400">이 노드에 바로 찍을 수 있는 카드</p>
                      {selectableCardsForNode.map((card) => {
                        const rarityBadge = getRarityBadge(card.rarity);
                        return (
                          <button
                            key={card.id}
                            onClick={() => handleEquipToNode(card.id, selectedNode.id)}
                            disabled={isApplying}
                            className="w-full p-3 rounded-xl bg-black/30 hover:bg-black/40 border border-white/10 transition-all text-left disabled:opacity-50"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{card.card_name}</p>
                                <p className="text-[11px] sm:text-xs text-gray-400 truncate">
                                  {card.card_type === 'infighter' ? '인파이터' : card.card_type === 'outboxer' ? '아웃복서' : '중립'} · Lv.{card.level}
                                </p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${rarityBadge.className}`}>
                                {rarityBadge.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-black/30 border border-white/10 p-3 text-[11px] sm:text-xs text-gray-400">
                      장착 가능한 카드가 없습니다. 보관함이나 가챠에서 스타일에 맞는 카드를 먼저 확보하세요.
                    </div>
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
          {filteredEquippedCards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEquippedCards.map((card) => {
                const rarityBadge = getRarityBadge(card.rarity);
                const typeBadge = getTypeBadge(card.card?.card_type);
                const levelPercent = Math.min(((card.level || 0) / (card.card?.max_level || 5)) * 100, 100);

                return (
                  <SpotlightCard key={card.id} className="p-5 overflow-hidden">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold border ${rarityBadge.className}`}>
                            {rarityBadge.label}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold border ${typeBadge.className}`}>
                            {typeBadge.label}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-white">{card.card?.name || card.card_name}</h3>
                        <p className="text-[11px] sm:text-sm text-gray-400">{card.card?.name_en || card.master_name || '장착 카드'}</p>
                      </div>

                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg sm:text-xl flex-shrink-0">
                        {card.rarity === 'legendary' ? '✦' : card.rarity === 'epic' ? '◆' : card.rarity === 'rare' ? '◈' : '●'}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <div className="text-xs text-gray-400 mb-1">장착 노드</div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-white truncate">{card.node?.name || '노드 정보 없음'}</span>
                          <span className="text-[11px] sm:text-xs text-gray-500 whitespace-nowrap">
                            {card.node?.node_number ? `#${card.node.node_number}` : '미지정'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                          <span>레벨</span>
                          <span>
                            Lv.{card.level} / {card.card?.max_level || 5}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              card.card?.card_type === 'infighter'
                                ? 'bg-gradient-to-r from-orange-400 to-red-500'
                                : 'bg-gradient-to-r from-emerald-400 to-cyan-500'
                            }`}
                            style={{ width: `${levelPercent}%` }}
                          ></div>
                        </div>
                      </div>
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
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">장착된 액티브 스킬이 없습니다</h3>
              <p className="text-sm text-gray-400 mb-6">
                스킬트리에서 노드를 해금하고 카드를 장착하면 이 페이지에 노드 구성과 세팅이 함께 표시됩니다.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setActiveTab('roadmap-skill-tree')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-lg text-white font-bold transition-all"
                >
                  스킬트리 열기
                </button>
                <button
                  onClick={() => setActiveTab('gacha')}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-bold transition-all"
                >
                  카드 뽑기
                </button>
              </div>
            </SpotlightCard>
          )}

          <SpotlightCard className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">다음 후보 카드</h3>
                <p className="text-sm text-gray-400">장착하지 않은 카드 중 바로 다음 세팅 후보입니다.</p>
              </div>
              <button
                onClick={() => setActiveTab('inventory')}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-all"
              >
                보관함 전체 보기
              </button>
            </div>

            {unequippedCards.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unequippedCards.map((card) => {
                  const rarityBadge = getRarityBadge(card.rarity);
                  return (
                    <div key={card.id} className="rounded-xl bg-white/5 border border-white/10 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{card.card_name}</p>
                          <p className="text-[11px] sm:text-xs text-gray-400 truncate">{card.master_name || '마스터 미지정'}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${rarityBadge.className}`}>
                          {rarityBadge.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{card.card_type === 'infighter' ? '인파이터' : card.card_type === 'outboxer' ? '아웃복서' : '중립'}</span>
                        <span>Lv.{card.level}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center text-sm text-gray-400">
                아직 보유 카드가 충분하지 않습니다. 가챠나 보관함에서 카드를 먼저 확보해보세요.
              </div>
            )}
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
};

export { ActiveSkillsView };

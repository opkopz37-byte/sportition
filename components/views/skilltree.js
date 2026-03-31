'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

// 스킬 트리 뷰 - 135개 노드 방사형 구조
const SkillTreeView = ({ t = (key) => key, setActiveTab }) => {
  const { user, profile } = useAuth();
  const [treeNodes, setTreeNodes] = useState([]);
  const [userCards, setUserCards] = useState([]);
  const [equippedCards, setEquippedCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    loadTreeData();
  }, [user]);

  const loadTreeData = async () => {
    if (!user?.id) return;

    try {
      const { getSkillTreeNodes, getUserSkillTree, getUserCards } = await import('@/lib/supabase');
      
      const [nodesResult, equippedResult, cardsResult] = await Promise.all([
        getSkillTreeNodes(),
        getUserSkillTree(user.id),
        getUserCards(user.id, {})
      ]);

      console.log('[SkillTree] 데이터 로드:', {
        nodes: nodesResult.data?.length || 0,
        equipped: equippedResult.data?.length || 0,
        cards: cardsResult.data?.length || 0
      });

      setTreeNodes(nodesResult.data || []);
      setEquippedCards(equippedResult.data || []);
      setUserCards(cardsResult.data || []);

      // 튜토리얼 완료 여부 확인 (노드 1-5가 모두 해금되었는지)
      const tutorialNodes = nodesResult.data?.filter(n => n.node_number >= 1 && n.node_number <= 5) || [];
      const tutorialEquipped = equippedResult.data?.filter(e => {
        const nodeNum = e.node?.node_number;
        return nodeNum >= 1 && nodeNum <= 5;
      }) || [];
      
      setTutorialCompleted(tutorialNodes.length > 0 && tutorialEquipped.length >= tutorialNodes.length);
    } catch (error) {
      console.error('[SkillTree] 데이터 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  // 줌 인/아웃
  const handleZoom = (delta) => {
    setScale(prev => Math.max(0.5, Math.min(2, prev + delta)));
  };

  // 드래그
  const handleMouseDown = (e) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const getNodeColor = (node) => {
    const isEquipped = equippedCards.some(c => c.equipped_node_id === node.id);
    
    if (node.zone === 'tutorial') {
      return isEquipped ? 'from-gray-400 to-gray-500' : 'from-gray-600 to-gray-700';
    } else if (node.zone === 'infighter') {
      return isEquipped ? 'from-blue-500 to-blue-600' : 'from-blue-800 to-blue-900';
    } else if (node.zone === 'outboxer') {
      return isEquipped ? 'from-red-500 to-red-600' : 'from-red-800 to-red-900';
    } else if (node.zone === 'legendary') {
      return isEquipped ? 'from-yellow-500 to-amber-600' : 'from-yellow-800 to-amber-900';
    }
    return 'from-gray-700 to-gray-800';
  };

  const getNodeSize = (node) => {
    if (node.node_type === 'legendary_socket') return 'w-16 h-16';
    if (node.zone === 'tutorial') return 'w-12 h-12';
    return 'w-10 h-10';
  };

  const isNodeUnlocked = (node) => {
    // 튜토리얼 노드는 항상 접근 가능
    if (node.zone === 'tutorial') return true;
    
    // 튜토리얼 완료 필요
    if (!tutorialCompleted) return false;

    // 부모 노드가 모두 활성화되어 있어야 함
    if (node.parent_nodes && node.parent_nodes.length > 0) {
      return node.parent_nodes.every(parentNum => {
        const parentNode = treeNodes.find(n => n.node_number === parentNum);
        return parentNode && equippedCards.some(c => c.equipped_node_id === parentNode.id);
      });
    }

    return true;
  };

  const handleNodeClick = (node) => {
    if (!isNodeUnlocked(node)) {
      alert('이전 노드를 먼저 활성화해야 합니다.');
      return;
    }
    setSelectedNode(node);
  };

  const handleEquipCard = async (userCardId, nodeId) => {
    try {
      const { equipCard } = await import('@/lib/supabase');
      const { data, error } = await equipCard(userCardId, nodeId, true);

      if (error) {
        alert('장착 실패: ' + (error.message || '알 수 없는 오류'));
        return;
      }

      alert('카드가 장착되었습니다!');
      await loadTreeData();
      setSelectedNode(null);
    } catch (error) {
      console.error('[SkillTree] 장착 에러:', error);
      alert('장착 중 오류가 발생했습니다.');
    }
  };

  const availableCards = userCards.filter(c => !c.is_equipped && c.level > 0);
  
  const unlockedSkills = equippedCards.length;
  const totalSkills = treeNodes.length;

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
        title="🌳 스킬 트리" 
        description="전설의 별자리를 완성하세요"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleZoom(0.1)}
            className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center transition-all"
          >
            <Icon type="plus" size={16} className="text-white" />
          </button>
          <button
            onClick={() => handleZoom(-0.1)}
            className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center transition-all"
          >
            <Icon type="minus" size={16} className="text-white" />
          </button>
          <button
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white font-bold transition-all"
          >
            초기화
          </button>
        </div>
      </PageHeader>

      {/* 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xs:gap-4">
        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">활성화 노드</div>
            <div className="text-2xl font-bold text-white">{unlockedSkills}/{totalSkills}</div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">튜토리얼</div>
            <div className="text-2xl font-bold text-white">
              {tutorialCompleted ? '✅' : `${equippedCards.filter(c => c.node?.node_number <= 5).length}/5`}
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">인파이터</div>
            <div className="text-2xl font-bold text-blue-400">
              {equippedCards.filter(c => c.card?.card_type === 'infighter').length}
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">아웃복서</div>
            <div className="text-2xl font-bold text-red-400">
              {equippedCards.filter(c => c.card?.card_type === 'outboxer').length}
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* 튜토리얼 미완료 안내 */}
      {!tutorialCompleted && (
        <SpotlightCard className="p-6 border-l-4 border-yellow-500">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Icon type="info" size={20} className="text-yellow-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">🎓 튜토리얼을 완료하세요!</h3>
              <p className="text-xs text-gray-400 mb-2">
                중앙의 5개 기본 노드를 모두 활성화하면 좌/우 진영 트리가 해금됩니다.
              </p>
              <p className="text-xs text-blue-400">
                진행도: {equippedCards.filter(c => c.node?.node_number <= 5).length}/5 완료
              </p>
            </div>
          </div>
        </SpotlightCard>
      )}

      {/* 스킬 트리 캔버스 */}
      <SpotlightCard className="p-0 overflow-hidden">
        <div 
          ref={canvasRef}
          className="relative w-full bg-gradient-to-br from-[#0A0A0A] via-[#0f0f1a] to-[#0A0A0A] cursor-move select-none"
          style={{ height: '600px' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* 배경 별 효과 */}
          <div className="absolute inset-0 opacity-20">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`
                }}
              ></div>
            ))}
          </div>

          {/* 트리 노드 컨테이너 */}
          <div
            className="absolute inset-0 transition-transform duration-200"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
            }}
          >
            {/* 연결선 그리기 (SVG) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {treeNodes.map(node => {
                if (!node.parent_nodes || node.parent_nodes.length === 0) return null;
                
                return node.parent_nodes.map(parentNum => {
                  const parentNode = treeNodes.find(n => n.node_number === parentNum);
                  if (!parentNode) return null;

                  const x1 = (parentNode.position_x / 100) * 800;
                  const y1 = (parentNode.position_y / 100) * 600;
                  const x2 = (node.position_x / 100) * 800;
                  const y2 = (node.position_y / 100) * 600;

                  const isActive = equippedCards.some(c => c.equipped_node_id === node.id) &&
                                   equippedCards.some(c => c.equipped_node_id === parentNode.id);

                  let strokeColor = '#444';
                  if (node.zone === 'infighter') strokeColor = isActive ? '#3b82f6' : '#1e3a8a';
                  if (node.zone === 'outboxer') strokeColor = isActive ? '#ef4444' : '#7f1d1d';
                  if (node.zone === 'legendary') strokeColor = isActive ? '#eab308' : '#713f12';

                  return (
                    <line
                      key={`${parentNum}-${node.node_number}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={strokeColor}
                      strokeWidth={isActive ? 3 : 1}
                      opacity={isActive ? 0.8 : 0.3}
                    />
                  );
                });
              })}
            </svg>

            {/* 노드들 */}
            {treeNodes.map(node => {
              const isEquipped = equippedCards.some(c => c.equipped_node_id === node.id);
              const isUnlocked = isNodeUnlocked(node);
              const equippedCard = equippedCards.find(c => c.equipped_node_id === node.id);

              return (
                <div
                  key={node.id}
                  className="absolute cursor-pointer transition-transform hover:scale-110"
                  style={{
                    left: `${node.position_x}%`,
                    top: `${node.position_y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onClick={() => handleNodeClick(node)}
                >
                  <div className={`${getNodeSize(node)} rounded-full bg-gradient-to-br ${getNodeColor(node)} border-2 ${
                    isEquipped ? 'border-white shadow-lg shadow-white/50' : 
                    isUnlocked ? 'border-white/30' : 'border-white/10 opacity-50'
                  } flex items-center justify-center relative transition-all`}>
                    {isEquipped && equippedCard?.card && (
                      <span className="text-xl">
                        {equippedCard.card.rarity === 'legendary' ? '✨' :
                         equippedCard.card.rarity === 'epic' ? '💜' :
                         equippedCard.card.rarity === 'rare' ? '💙' : '⚪'}
                      </span>
                    )}
                    {!isEquipped && isUnlocked && (
                      <Icon type="plus" size={16} className="text-white/50" />
                    )}
                    {!isUnlocked && (
                      <Icon type="lock" size={12} className="text-white/30" />
                    )}
                  </div>
                  
                  {/* 노드 이름 툴팁 */}
                  <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 rounded text-[10px] text-white whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                    {node.name}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 컨트롤 안내 */}
          <div className="absolute bottom-4 left-4 px-3 py-2 bg-black/60 backdrop-blur-sm rounded-lg text-xs text-gray-400">
            <p>드래그: 이동 | 버튼: 확대/축소</p>
          </div>

          {/* 튜토리얼 미완료 오버레이 */}
          {!tutorialCompleted && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-4xl mb-4">🔒</div>
                <p className="text-white font-bold text-lg mb-2">트리 잠금</p>
                <p className="text-gray-400 text-sm">튜토리얼 5개 노드를 완료하세요</p>
              </div>
            </div>
          )}
        </div>
      </SpotlightCard>

      {/* 노드 상세 모달 */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{selectedNode.name}</h2>
              <button
                onClick={() => setSelectedNode(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <Icon type="x" size={20} className="text-gray-400" />
              </button>
            </div>

            {/* 노드 정보 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  selectedNode.zone === 'tutorial' ? 'bg-gray-500/20 text-gray-400' :
                  selectedNode.zone === 'infighter' ? 'bg-blue-500/20 text-blue-400' :
                  selectedNode.zone === 'outboxer' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {selectedNode.zone === 'tutorial' ? '튜토리얼' :
                   selectedNode.zone === 'infighter' ? '인파이터' :
                   selectedNode.zone === 'outboxer' ? '아웃복서' : '전설'}
                </span>
                <span className="px-2 py-1 bg-white/5 rounded-full text-xs text-gray-400">
                  {selectedNode.node_type === 'basic' ? '기본 노드' :
                   selectedNode.node_type === 'socket' ? '스킬 소켓' : '전설 소켓'}
                </span>
              </div>

              {equippedCards.some(c => c.equipped_node_id === selectedNode.id) ? (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon type="check" size={16} className="text-green-400" />
                    <span className="text-sm font-bold text-green-400">활성화됨</span>
                  </div>
                  {equippedCards.find(c => c.equipped_node_id === selectedNode.id)?.card && (
                    <div className="text-xs text-gray-400">
                      장착 카드: {equippedCards.find(c => c.equipped_node_id === selectedNode.id).card.name}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-gray-400 mb-3">
                    {selectedNode.node_type === 'basic' 
                      ? '기본 노드는 체육관 훈련으로 해금할 수 있습니다.' 
                      : '스킬 카드를 장착하여 이 노드를 활성화하세요.'}
                  </p>

                  {availableCards.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-white font-bold mb-2">장착 가능한 카드:</p>
                      {availableCards.slice(0, 5).map(card => (
                        <button
                          key={card.id}
                          onClick={() => handleEquipCard(card.id, selectedNode.id)}
                          className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-all flex items-center justify-between"
                        >
                          <span className="text-sm text-white">{card.card_name}</span>
                          <span className="text-xs text-gray-400">Lv.{card.level}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-3">장착 가능한 카드가 없습니다</p>
                      <button
                        onClick={() => {
                          setSelectedNode(null);
                          setActiveTab('gacha');
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white font-bold text-sm transition-all"
                      >
                        카드 뽑으러 가기
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedNode(null)}
              className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export { SkillTreeView };

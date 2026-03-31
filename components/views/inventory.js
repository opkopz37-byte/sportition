'use client';

import { useState, useEffect } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

// 카드 보관함 뷰
const InventoryView = ({ t = (key) => key, setActiveTab }) => {
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRarity, setFilterRarity] = useState(null);
  const [filterType, setFilterType] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    loadCards();
  }, [user, filterRarity, filterType]);

  const loadCards = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { getUserCards } = await import('@/lib/supabase');
      const filters = {};
      if (filterRarity) filters.rarity = filterRarity;
      if (filterType) filters.card_type = filterType;

      const { data, error } = await getUserCards(user.id, filters);
      
      if (error) {
        console.error('[Inventory] 카드 로드 에러:', error);
      } else {
        console.log('[Inventory] 카드 로드 완료:', data?.length || 0);
        setCards(data || []);
      }
    } catch (error) {
      console.error('[Inventory] 카드 로드 예외:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (cardId) => {
    try {
      const { upgradeCard } = await import('@/lib/supabase');
      const { data, error } = await upgradeCard(cardId);

      if (error) {
        alert(error.message || '레벨업 실패');
        return;
      }

      alert('레벨업 성공!');
      await loadCards();
      setSelectedCard(null);
    } catch (error) {
      console.error('[Inventory] 레벨업 에러:', error);
      alert('레벨업 중 오류가 발생했습니다.');
    }
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-500 to-amber-600';
      case 'epic': return 'from-purple-500 to-pink-600';
      case 'rare': return 'from-blue-500 to-cyan-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getRarityBadge = (rarity) => {
    switch (rarity) {
      case 'legendary': return { text: '전설', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case 'epic': return { text: '영웅', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
      case 'rare': return { text: '희귀', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      default: return { text: '일반', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
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
        title="🎒 카드 보관함"
        description="보유 중인 스킬 카드를 관리하세요"
      >
        <button
          onClick={() => setActiveTab('gacha')}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg text-white font-bold text-sm transition-all"
        >
          카드 뽑기
        </button>
      </PageHeader>

      {/* 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xs:gap-4">
        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">보유 카드</div>
            <div className="text-2xl font-bold text-white">{cards.length}</div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">장착 중</div>
            <div className="text-2xl font-bold text-emerald-400">
              {cards.filter(c => c.is_equipped).length}
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">전설 카드</div>
            <div className="text-2xl font-bold text-yellow-400">
              {cards.filter(c => c.rarity === 'legendary').length}
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">최고 레벨</div>
            <div className="text-2xl font-bold text-purple-400">
              {cards.length > 0 ? Math.max(...cards.map(c => c.level)) : 0}
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterRarity(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
            !filterRarity ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setFilterRarity('legendary')}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
            filterRarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-white/5 text-gray-400 hover:bg-yellow-500/10'
          }`}
        >
          전설
        </button>
        <button
          onClick={() => setFilterRarity('epic')}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
            filterRarity === 'epic' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-gray-400 hover:bg-purple-500/10'
          }`}
        >
          영웅
        </button>
        <button
          onClick={() => setFilterRarity('rare')}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
            filterRarity === 'rare' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-400 hover:bg-blue-500/10'
          }`}
        >
          희귀
        </button>
        <button
          onClick={() => setFilterRarity('normal')}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
            filterRarity === 'normal' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' : 'bg-white/5 text-gray-400 hover:bg-gray-500/10'
          }`}
        >
          일반
        </button>

        <div className="flex-1"></div>

        <button
          onClick={() => setFilterType(filterType === 'infighter' ? null : 'infighter')}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
            filterType === 'infighter' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-400 hover:bg-blue-500/10'
          }`}
        >
          🥊 인파이터
        </button>
        <button
          onClick={() => setFilterType(filterType === 'outboxer' ? null : 'outboxer')}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
            filterType === 'outboxer' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-gray-400 hover:bg-red-500/10'
          }`}
        >
          🦋 아웃복서
        </button>
      </div>

      {/* 카드 그리드 */}
      {cards.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 xs:gap-4">
          {cards.map((card) => {
            const badge = getRarityBadge(card.rarity);
            return (
              <SpotlightCard
                key={card.id}
                className="p-3 cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setSelectedCard(card)}
              >
                <div className={`relative aspect-square rounded-lg bg-gradient-to-br ${getRarityColor(card.rarity)} p-0.5 mb-2`}>
                  <div className="w-full h-full bg-black/60 rounded-lg flex items-center justify-center">
                    <span className="text-5xl">
                      {card.rarity === 'legendary' ? '✨' : 
                       card.rarity === 'epic' ? '💜' : 
                       card.rarity === 'rare' ? '💙' : '⚪'}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${badge.color}`}>
                      Lv.{card.level}
                    </span>
                  </div>
                  {card.is_equipped && (
                    <div className="absolute top-2 left-2">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Icon type="check" size={12} className="text-white" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-xs font-bold text-white text-center mb-1 line-clamp-2">
                  {card.card_name}
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded-full font-bold border ${badge.color}`}>
                    {badge.text}
                  </span>
                  {card.fragment_count > 0 && (
                    <span className="text-blue-400 font-bold">
                      조각 {card.fragment_count}
                    </span>
                  )}
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      ) : (
        <SpotlightCard className="p-10 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <Icon type="inbox" size={40} className="text-gray-500" />
          </div>
          <p className="text-gray-400 text-sm mb-2">보유 중인 카드가 없습니다</p>
          <p className="text-gray-500 text-xs mb-4">카드를 뽑아 스킬을 수집하세요!</p>
          <button
            onClick={() => setActiveTab('gacha')}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg text-white font-bold text-sm transition-all"
          >
            카드 뽑으러 가기
          </button>
        </SpotlightCard>
      )}

      {/* 카드 상세 모달 */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">카드 상세</h2>
              <button
                onClick={() => setSelectedCard(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <Icon type="x" size={20} className="text-gray-400" />
              </button>
            </div>

            {/* 카드 미리보기 */}
            <div className={`relative aspect-[2/3] rounded-xl bg-gradient-to-br ${getRarityColor(selectedCard.rarity)} p-1 mb-4`}>
              <div className="w-full h-full bg-black/60 rounded-lg flex items-center justify-center">
                <span className="text-8xl">
                  {selectedCard.rarity === 'legendary' ? '✨' : 
                   selectedCard.rarity === 'epic' ? '💜' : 
                   selectedCard.rarity === 'rare' ? '💙' : '⚪'}
                </span>
              </div>
              {selectedCard.is_equipped && (
                <div className="absolute top-4 right-4">
                  <div className="px-3 py-1 bg-green-500 rounded-full flex items-center gap-2">
                    <Icon type="check" size={14} className="text-white" />
                    <span className="text-xs font-bold text-white">장착 중</span>
                  </div>
                </div>
              )}
            </div>

            {/* 카드 정보 */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{selectedCard.card_name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getRarityBadge(selectedCard.rarity).color}`}>
                    {getRarityBadge(selectedCard.rarity).text}
                  </span>
                </div>
                {selectedCard.master_nickname && (
                  <div className="text-sm text-gray-400 mb-2">
                    {selectedCard.master_nickname} ({selectedCard.animal_motif})
                  </div>
                )}
              </div>

              {/* 레벨 정보 */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">카드 레벨</span>
                  <span className="text-lg font-bold text-white">Lv. {selectedCard.level} / {selectedCard.max_level}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                  <div 
                    className={`bg-gradient-to-r ${getRarityColor(selectedCard.rarity)} h-2 rounded-full transition-all`}
                    style={{ width: `${(selectedCard.level / selectedCard.max_level) * 100}%` }}
                  ></div>
                </div>
                {selectedCard.level < selectedCard.max_level && (
                  <div className="text-xs text-gray-400">
                    레벨업까지: {5 - (selectedCard.fragment_count || 0)} 조각
                  </div>
                )}
              </div>

              {/* 조각 정보 */}
              {selectedCard.fragment_count > 0 && (
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white mb-1">보유 조각</div>
                      <div className="text-xs text-gray-400">조각 5개로 레벨업 가능</div>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">
                      {selectedCard.fragment_count}
                    </div>
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="space-y-2">
                {selectedCard.level < selectedCard.max_level && selectedCard.fragment_count >= 5 && (
                  <button
                    onClick={() => handleUpgrade(selectedCard.id)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-white font-bold transition-all"
                  >
                    레벨업 (조각 5개 소모)
                  </button>
                )}

                {selectedCard.level > 0 && !selectedCard.is_equipped && (
                  <button
                    onClick={() => {
                      setSelectedCard(null);
                      setActiveTab('skilltree');
                    }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 rounded-xl text-white font-bold transition-all"
                  >
                    스킬 트리에 장착하기
                  </button>
                )}

                <button
                  onClick={() => setSelectedCard(null)}
                  className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold transition-all"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { InventoryView };

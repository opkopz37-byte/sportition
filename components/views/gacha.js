'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

// 카드뽑기 (가챠) 뷰
const GachaView = ({ t = (key) => key, setActiveTab }) => {
  const { user, profile } = useAuth();
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPulling, setIsPulling] = useState(false);
  const [pullResults, setPullResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const loadInventory = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { getUserInventory } = await import('@/lib/supabase');
      const { data, error } = await getUserInventory(user.id);

      if (error) {
        console.error('[Gacha] 인벤토리 로드 에러:', error);
      } else {
        setInventory(data);
      }
    } catch (error) {
      console.error('[Gacha] 인벤토리 로드 예외:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handlePull = async (pullCount) => {
    if (isPulling || !user?.id) return;

    setIsPulling(true);
    setPullResults(null);

    try {
      const { performGacha } = await import('@/lib/supabase');
      const { data, error } = await performGacha(user.id, pullCount);

      if (error) {
        alert(error.message || '가챠 실행 중 오류가 발생했습니다.');
        return;
      }

      console.log('[Gacha] 가챠 결과:', data);
      setPullResults(data.results);
      setShowResults(true);

      // 인벤토리 새로고침
      await loadInventory();
    } catch (error) {
      console.error('[Gacha] 가챠 실행 에러:', error);
      alert('가챠 실행 중 오류가 발생했습니다.');
    } finally {
      setIsPulling(false);
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

  const costPerPull = 50;

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
        title="🎴 카드 뽑기"
        description="전설의 복서들의 스킬 카드를 획득하세요!"
      />

      {/* 보유 재화 */}
      <div className="grid grid-cols-2 gap-3 xs:gap-4">
        <SpotlightCard className="p-4 xs:p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 xs:w-14 xs:h-14 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
            <div>
              <div className="text-xs text-gray-400">보유 코인</div>
              <div className="text-2xl xs:text-3xl font-bold text-white">{inventory?.coins || 0}</div>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4 xs:p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 xs:w-14 xs:h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-2xl">🎟️</span>
            </div>
            <div>
              <div className="text-xs text-gray-400">무료 뽑기권</div>
              <div className="text-2xl xs:text-3xl font-bold text-white">{inventory?.free_pulls || 0}</div>
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* 천장 시스템 안내 */}
      <SpotlightCard className="p-4 xs:p-6 border-l-4 border-yellow-500">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
            <Icon type="star" size={20} className="text-yellow-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white mb-1">천장 시스템</h3>
            <p className="text-xs text-gray-400 mb-2">
              200회 뽑기 시 원하는 전설 스킬 선택권 지급
            </p>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-yellow-500 to-amber-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((inventory?.pity_counter || 0) / 200) * 100}%` }}
              ></div>
            </div>
            <div className="text-xs text-yellow-400 mt-1 font-bold">
              {inventory?.pity_counter || 0} / 200 ({(((inventory?.pity_counter || 0) / 200) * 100).toFixed(1)}%)
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* 뽑기 버튼들 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 xs:gap-4">
        {/* 1회 뽑기 */}
        <SpotlightCard className="p-6 hover:scale-105 transition-transform cursor-pointer" onClick={() => !isPulling && handlePull(1)}>
          <div className="text-center">
            <div className="w-16 h-16 xs:w-20 xs:h-20 mx-auto mb-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-3xl">🎴</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">1회 뽑기</h3>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm text-gray-400">소모:</span>
              <div className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-bold">
                {costPerPull} 코인
              </div>
            </div>
            <button
              disabled={isPulling || (inventory?.coins || 0) < costPerPull}
              className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPulling ? '뽑는 중...' : '뽑기'}
            </button>
          </div>
        </SpotlightCard>

        {/* 10회 뽑기 */}
        <SpotlightCard className="p-6 hover:scale-105 transition-transform cursor-pointer border-2 border-purple-500/30" onClick={() => !isPulling && handlePull(10)}>
          <div className="text-center">
            <div className="w-16 h-16 xs:w-20 xs:h-20 mx-auto mb-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center relative">
              <span className="text-3xl">🎴</span>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                +1
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">10회 뽑기</h3>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm text-gray-400">소모:</span>
              <div className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-bold">
                {costPerPull * 10} 코인
              </div>
            </div>
            <button
              disabled={isPulling || (inventory?.coins || 0) < (costPerPull * 10)}
              className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-lg text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPulling ? '뽑는 중...' : '뽑기'}
            </button>
          </div>
        </SpotlightCard>

        {/* 30회 뽑기 */}
        <SpotlightCard className="p-6 hover:scale-105 transition-transform cursor-pointer border-2 border-yellow-500/50" onClick={() => !isPulling && handlePull(30)}>
          <div className="text-center">
            <div className="w-16 h-16 xs:w-20 xs:h-20 mx-auto mb-3 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center relative">
              <span className="text-3xl">🎴</span>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                +5
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">30회 뽑기</h3>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm text-gray-400">소모:</span>
              <div className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-bold">
                {costPerPull * 30} 코인
              </div>
            </div>
            <button
              disabled={isPulling || (inventory?.coins || 0) < (costPerPull * 30)}
              className="w-full px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 rounded-lg text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPulling ? '뽑는 중...' : '뽑기'}
            </button>
          </div>
        </SpotlightCard>
      </div>

      {/* 확률 정보 */}
      <SpotlightCard className="p-4 xs:p-6">
        <h3 className="text-lg font-bold text-white mb-4">📊 뽑기 확률</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-yellow-500/10 to-amber-600/10 border border-yellow-500/20">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <span className="text-sm font-bold text-yellow-400">전설 (Legendary)</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">1.5%</div>
              <div className="text-xs text-gray-400">완제품 0.2% / 조각 1.3%</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-600/10 border border-purple-500/20">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💜</span>
              <span className="text-sm font-bold text-purple-400">영웅 (Epic)</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">8.5%</div>
              <div className="text-xs text-gray-400">완제품 1.5% / 조각 7.0%</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-600/10 border border-blue-500/20">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💙</span>
              <span className="text-sm font-bold text-blue-400">희귀 (Rare)</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">40.0%</div>
              <div className="text-xs text-gray-400">완제품 10.0% / 조각 30.0%</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-500/10 to-gray-600/10 border border-gray-500/20">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚪</span>
              <span className="text-sm font-bold text-gray-400">일반 (Normal)</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">50.0%</div>
              <div className="text-xs text-gray-400">완제품 15.0% / 조각 35.0%</div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-400">
            💡 <span className="font-bold">Tip:</span> 200회 뽑기 시 원하는 전설 스킬을 선택할 수 있습니다!
          </p>
        </div>
      </SpotlightCard>

      {/* 뽑기 결과 모달 */}
      {showResults && pullResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">🎉 뽑기 결과</h2>
              <button
                onClick={() => {
                  setShowResults(false);
                  setPullResults(null);
                }}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <Icon type="x" size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
              {pullResults.map((result, index) => {
                const badge = getRarityBadge(result.rarity);
                return (
                  <div
                    key={index}
                    className={`relative p-4 rounded-xl border-2 bg-gradient-to-br ${getRarityColor(result.rarity)} animate-fade-in-up`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                        {badge.text}
                      </span>
                    </div>
                    <div className="aspect-square bg-black/30 rounded-lg mb-2 flex items-center justify-center">
                      <span className="text-4xl">{result.rarity === 'legendary' ? '✨' : result.rarity === 'epic' ? '💜' : result.rarity === 'rare' ? '💙' : '⚪'}</span>
                    </div>
                    <div className="text-xs font-bold text-white text-center mb-1 line-clamp-2">
                      {result.card.name}
                    </div>
                    <div className="text-center">
                      {result.isFullCard ? (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full">
                          완제품
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-full">
                          조각 +1
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('inventory')}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-white font-bold transition-all"
              >
                보관함 확인
              </button>
              <button
                onClick={() => {
                  setShowResults(false);
                  setPullResults(null);
                }}
                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold transition-all"
              >
                계속 뽑기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 테스트용 코인 지급 버튼 */}
      {process.env.NODE_ENV === 'development' && (
        <SpotlightCard className="p-4 bg-red-500/10 border border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">🧪 테스트 모드</h3>
              <p className="text-xs text-gray-400">개발 환경에서만 표시됩니다</p>
            </div>
            <button
              onClick={async () => {
                if (!user?.id) return;
                const { addTestCoins } = await import('@/lib/supabase');
                await addTestCoins(user.id, 1000);
                await loadInventory();
                alert('테스트 코인 1000개가 지급되었습니다!');
              }}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 font-bold text-sm transition-all"
            >
              코인 1000개 지급
            </button>
          </div>
        </SpotlightCard>
      )}
    </div>
  );
};

export { GachaView };

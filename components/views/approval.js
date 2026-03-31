'use client';

import { useState, useEffect } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

// 스킬 승인 관리 뷰 (관장님 전용)
const ApprovalView = ({ t = (key) => key }) => {
  const { user, profile } = useAuth();
  const [approvalQueue, setApprovalQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadApprovalQueue();
  }, [user, filter]);

  const loadApprovalQueue = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { getApprovalQueue } = await import('@/lib/supabase');
      const { data, error } = await getApprovalQueue(filter === 'all' ? null : filter);
      
      if (error) {
        console.error('[Approval] 승인 대기열 로드 에러:', error);
      } else {
        console.log('[Approval] 승인 대기열 로드:', data?.length || 0);
        setApprovalQueue(data || []);
      }
    } catch (error) {
      console.error('[Approval] 승인 대기열 로드 예외:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approvalId, approved) => {
    if (!user?.id) return;

    try {
      const { approveSkill } = await import('@/lib/supabase');
      const { data, error } = await approveSkill(approvalId, approved, user.id, notes);

      if (error) {
        alert('처리 실패: ' + (error.message || '알 수 없는 오류'));
        return;
      }

      alert(approved ? '✅ 스킬이 승인되었습니다!' : '❌ 스킬이 거절되었습니다.');
      setSelectedRequest(null);
      setNotes('');
      await loadApprovalQueue();
    } catch (error) {
      console.error('[Approval] 승인 처리 에러:', error);
      alert('처리 중 오류가 발생했습니다.');
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return { text: '승인 완료', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
      case 'rejected': return { text: '거절됨', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
      default: return { text: '대기 중', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  };

  if (!profile || !['gym', 'admin'].includes(profile.role)) {
    return (
      <div className="flex items-center justify-center h-96">
        <SpotlightCard className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <Icon type="x" size={32} className="text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">접근 권한 없음</h3>
          <p className="text-sm text-gray-400">이 페이지는 관장님만 접근할 수 있습니다.</p>
        </SpotlightCard>
      </div>
    );
  }

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
        title="📋 스킬 승인 관리"
        description="회원의 스킬 습득 요청을 검토하세요"
      />

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3 xs:gap-4">
        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">대기 중</div>
            <div className="text-2xl font-bold text-yellow-400">
              {approvalQueue.filter(a => a.status === 'pending').length}
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">승인 완료</div>
            <div className="text-2xl font-bold text-green-400">
              {approvalQueue.filter(a => a.status === 'approved').length}
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">거절됨</div>
            <div className="text-2xl font-bold text-red-400">
              {approvalQueue.filter(a => a.status === 'rejected').length}
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            filter === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          대기 중
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            filter === 'approved' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          승인 완료
        </button>
        <button
          onClick={() => setFilter('rejected')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            filter === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          거절됨
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            filter === 'all' ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          전체
        </button>
      </div>

      {/* 승인 대기열 */}
      {approvalQueue.length > 0 ? (
        <div className="space-y-3">
          {approvalQueue.map((request) => {
            const badge = getRarityBadge(request.rarity);
            const statusBadge = getStatusBadge(request.status);

            return (
              <SpotlightCard
                key={request.id}
                className={`p-4 cursor-pointer hover:bg-white/5 transition-all ${
                  request.status === 'pending' ? 'border-l-4 border-yellow-500' : ''
                }`}
                onClick={() => request.status === 'pending' && setSelectedRequest(request)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">
                        {request.rarity === 'legendary' ? '✨' :
                         request.rarity === 'epic' ? '💜' :
                         request.rarity === 'rare' ? '💙' : '⚪'}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-white truncate">{request.user_nickname || request.user_name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.color}`}>
                          {statusBadge.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="truncate">{request.card_name}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${badge.color}`}>
                          {badge.text}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        노드: {request.node_name} • {formatDate(request.requested_at)}
                      </div>
                    </div>
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApproval(request.id, true);
                        }}
                        className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-400 font-bold text-xs transition-all"
                      >
                        ✓ 승인
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(request);
                        }}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 font-bold text-xs transition-all"
                      >
                        ✗ 거절
                      </button>
                    </div>
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
          <p className="text-gray-400 text-sm mb-2">
            {filter === 'pending' ? '대기 중인 승인 요청이 없습니다' : '승인 내역이 없습니다'}
          </p>
          <p className="text-gray-500 text-xs">회원이 스킬을 요청하면 여기에 표시됩니다</p>
        </SpotlightCard>
      )}

      {/* 승인 처리 모달 */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">승인 요청 상세</h2>
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setNotes('');
                }}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <Icon type="x" size={20} className="text-gray-400" />
              </button>
            </div>

            {/* 요청 정보 */}
            <div className="space-y-4 mb-6">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs text-gray-400 mb-1">회원</div>
                <div className="text-lg font-bold text-white">{selectedRequest.user_nickname || selectedRequest.user_name}</div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs text-gray-400 mb-2">스킬 카드</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{selectedRequest.card_name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getRarityBadge(selectedRequest.rarity).color}`}>
                    {getRarityBadge(selectedRequest.rarity).text}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs text-gray-400 mb-1">장착 노드</div>
                <div className="text-sm font-bold text-white">{selectedRequest.node_name}</div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs text-gray-400 mb-1">요청 시간</div>
                <div className="text-sm text-white">{formatDate(selectedRequest.requested_at)}</div>
              </div>

              {/* 메모 입력 (거절 시) */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">관장님 메모 (선택사항)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="거절 사유나 피드백을 입력하세요..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                  rows={3}
                ></textarea>
              </div>
            </div>

            {/* 액션 버튼 */}
            {selectedRequest.status === 'pending' && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleApproval(selectedRequest.id, false)}
                  className="flex-1 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 font-bold transition-all"
                >
                  ✗ 거절
                </button>
                <button
                  onClick={() => handleApproval(selectedRequest.id, true)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-bold transition-all"
                >
                  ✓ 승인
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export { ApprovalView };

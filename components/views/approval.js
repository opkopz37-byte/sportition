'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

/** 체육관: gym_user_id 일치 또는 gym_name 일치 (둘 다 있으면 하나만 맞아도 표시) */
function isSameGymContext(profile, gymUserId, gymName) {
  if (!profile || profile.role === 'admin') return true;
  const gname = String(profile.gym_name || '').trim();
  const reqName = String(gymName || '').trim();
  if (gymUserId && gymUserId === profile.id) return true;
  if (gname && reqName && gname === reqName) return true;
  return false;
}

const ApprovalView = ({ t = (key) => key }) => {
  const { user, profile } = useAuth();
  const [viewMode, setViewMode] = useState('cards');

  const [approvalQueue, setApprovalQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [notes, setNotes] = useState('');

  const [promotionQueue, setPromotionQueue] = useState([]);
  const [promLoading, setPromLoading] = useState(false);
  const [promFilter, setPromFilter] = useState('pending');
  const [promoError, setPromoError] = useState('');
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [branchOptions, setBranchOptions] = useState([]);
  const [chosenBranchId, setChosenBranchId] = useState(null);
  const [promoNotes, setPromoNotes] = useState('');
  const [processingPromo, setProcessingPromo] = useState(false);

  // 카드 승인: 뷰·RLS가 체육관에 맞는 행만 주면 클라이언트 재필터는 빈 목록을 만들 수 있음
  const scopedApprovalQueue = useMemo(() => {
    if (!profile) return approvalQueue;
    if (profile.role === 'admin' || profile.role === 'gym') return approvalQueue;
    return approvalQueue.filter((a) =>
      isSameGymContext(profile, a.applicant_gym_user_id, a.applicant_gym_name)
    );
  }, [approvalQueue, profile]);

  // 승단: RLS가 체육관 행만 넘김 — 여기서 한 번 더 걸면 gym_user_id 불일치 시 빈 목록이 됨
  const scopedPromotionQueue = useMemo(() => {
    if (!profile) return promotionQueue;
    if (profile.role === 'admin' || profile.role === 'gym') return promotionQueue;
    return promotionQueue.filter((r) =>
      isSameGymContext(profile, r.gym_user_id, r.gym_name)
    );
  }, [promotionQueue, profile]);

  const loadApprovalQueue = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { getApprovalQueue } = await import('@/lib/supabase');
      const { data, error } = await getApprovalQueue(filter === 'all' ? null : filter);

      if (error) {
        console.error('[Approval] 승인 대기열 로드 에러:', error);
      } else {
        setApprovalQueue(data || []);
      }
    } catch (error) {
      console.error('[Approval] 승인 대기열 로드 예외:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter]);

  const loadPromotionQueue = useCallback(async () => {
    if (!user?.id) return;

    setPromLoading(true);
    setPromoError('');
    try {
      const { getGymPromotionRequestsDetailed } = await import('@/lib/supabase');
      const { data, error } = await getGymPromotionRequestsDetailed(promFilter === 'all' ? null : promFilter);

      if (error) throw error;
      setPromotionQueue(data || []);
    } catch (error) {
      console.error('[Approval] 승단 목록 로드:', error);
      setPromoError(error?.message || '승단 신청 목록을 불러오지 못했습니다. sql/08_skill_promotion.sql 적용 여부를 확인해 주세요.');
      setPromotionQueue([]);
    } finally {
      setPromLoading(false);
    }
  }, [user?.id, promFilter]);

  useEffect(() => {
    if (viewMode === 'cards') {
      loadApprovalQueue();
    }
  }, [viewMode, loadApprovalQueue]);

  useEffect(() => {
    if (viewMode === 'promotion') {
      loadPromotionQueue();
    }
  }, [viewMode, loadPromotionQueue]);

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

  const openPromoModal = async (req) => {
    setSelectedPromo(req);
    setPromoNotes('');
    setChosenBranchId(null);
    const nums = req.fork?.fork_branch_node_numbers;
    if (nums?.length) {
      const { getSkillTreeNodesByNumbers } = await import('@/lib/supabase');
      const { data } = await getSkillTreeNodesByNumbers(nums);
      const opts = data || [];
      setBranchOptions(opts);
      if (opts.length === 1) setChosenBranchId(opts[0].id);
    } else {
      setBranchOptions([]);
    }
  };

  const handleGymResolvePromo = async (approved) => {
    if (!selectedPromo?.id || !user?.id) return;
    if (approved && !chosenBranchId) {
      alert('승인 시 분기할 자식 노드를 선택해 주세요.');
      return;
    }

    try {
      setProcessingPromo(true);
      const { gymResolvePromotionRequestRpc } = await import('@/lib/supabase');
      const { error } = await gymResolvePromotionRequestRpc(
        selectedPromo.id,
        approved,
        approved ? chosenBranchId : null,
        promoNotes || null
      );

      if (error) {
        alert(error.message || '처리에 실패했습니다.');
        return;
      }

      alert(approved ? '✅ 승단이 승인되었습니다.' : '승단이 거절되었습니다.');
      setSelectedPromo(null);
      setPromoNotes('');
      setChosenBranchId(null);
      setBranchOptions([]);
      await loadPromotionQueue();
    } catch (error) {
      console.error('[Approval] 승단 처리:', error);
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setProcessingPromo(false);
    }
  };

  const handleStartPromoReview = async (requestId) => {
    try {
      const { gymStartPromotionReviewRpc } = await import('@/lib/supabase');
      const { error } = await gymStartPromotionReviewRpc(requestId);
      if (error) {
        alert(error.message || '심사 시작에 실패했습니다.');
        return;
      }
      await loadPromotionQueue();
    } catch (error) {
      console.error('[Approval] 심사 시작:', error);
      alert('오류가 발생했습니다.');
    }
  };

  const getRarityBadge = (rarity) => {
    switch (rarity) {
      case 'legendary':
        return { text: '전설', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case 'epic':
        return { text: '영웅', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
      case 'rare':
        return { text: '희귀', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      default:
        return { text: '일반', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return { text: '승인 완료', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
      case 'rejected':
        return { text: '거절됨', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
      case 'reviewing':
        return { text: '심사 중', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
      default:
        return { text: '대기 중', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
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

  const showSpinner =
    (viewMode === 'cards' && loading) || (viewMode === 'promotion' && promLoading && promotionQueue.length === 0 && !promoError);

  if (showSpinner) {
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
        description="회원의 카드 장착 요청과 스킬 승단 신청을 검토하세요"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setViewMode('cards')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            viewMode === 'cards' ? 'bg-white/10 text-white border border-white/15' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          카드 장착 승인
        </button>
        <button
          type="button"
          onClick={() => setViewMode('promotion')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            viewMode === 'promotion' ? 'bg-violet-500/20 text-violet-200 border border-violet-400/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          스킬 승단 심사
        </button>
      </div>

      {viewMode === 'cards' && (
        <>
          <div className="grid grid-cols-3 gap-3 xs:gap-4">
            <SpotlightCard className="p-4">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">대기 중</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {scopedApprovalQueue.filter((a) => a.status === 'pending').length}
                </div>
              </div>
            </SpotlightCard>

            <SpotlightCard className="p-4">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">승인 완료</div>
                <div className="text-2xl font-bold text-green-400">
                  {scopedApprovalQueue.filter((a) => a.status === 'approved').length}
                </div>
              </div>
            </SpotlightCard>

            <SpotlightCard className="p-4">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">거절됨</div>
                <div className="text-2xl font-bold text-red-400">
                  {scopedApprovalQueue.filter((a) => a.status === 'rejected').length}
                </div>
              </div>
            </SpotlightCard>
          </div>

          <div className="flex gap-2 flex-wrap">
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

          {scopedApprovalQueue.length > 0 ? (
            <div className="space-y-3">
              {scopedApprovalQueue.map((request) => {
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
                            {request.rarity === 'legendary'
                              ? '✨'
                              : request.rarity === 'epic'
                                ? '💜'
                                : request.rarity === 'rare'
                                  ? '💙'
                                  : '⚪'}
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
        </>
      )}

      {viewMode === 'promotion' && (
        <>
          {promoError && (
            <SpotlightCard className="p-4 border-l-4 border-amber-500">
              <p className="text-sm text-amber-200">{promoError}</p>
            </SpotlightCard>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 xs:gap-4">
            {['pending', 'reviewing', 'approved', 'rejected'].map((st) => (
              <SpotlightCard key={st} className="p-4">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">
                    {st === 'pending' ? '대기' : st === 'reviewing' ? '심사 중' : st === 'approved' ? '승인' : '거절'}
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      st === 'pending'
                        ? 'text-yellow-400'
                        : st === 'reviewing'
                          ? 'text-sky-300'
                          : st === 'approved'
                            ? 'text-green-400'
                            : 'text-red-400'
                    }`}
                  >
                    {scopedPromotionQueue.filter((r) => r.status === st).length}
                  </div>
                </div>
              </SpotlightCard>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {['pending', 'reviewing', 'approved', 'rejected', 'all'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPromFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  promFilter === f ? 'bg-violet-500/20 text-violet-200 border border-violet-400/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {f === 'pending' ? '대기' : f === 'reviewing' ? '심사 중' : f === 'approved' ? '승인' : f === 'rejected' ? '거절' : '전체'}
              </button>
            ))}
          </div>

          {scopedPromotionQueue.length > 0 ? (
            <div className="space-y-3">
              {scopedPromotionQueue.map((req) => {
                const statusBadge = getStatusBadge(req.status);
                const memberName = req.member?.nickname || req.member?.name || '회원';
                const forkName = req.fork?.name || '갈림길 노드';

                return (
                  <SpotlightCard
                    key={req.id}
                    className={`p-4 border-l-4 ${
                      req.status === 'pending' ? 'border-amber-400' : req.status === 'reviewing' ? 'border-sky-400' : 'border-white/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-white">{memberName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.color}`}>
                            {statusBadge.text}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          갈림길: {forkName} (#{req.fork?.node_number ?? '—'}) · {formatDate(req.requested_at)}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          소속: {req.gym_name || '—'}
                          {req.gym_user_id && profile?.id === req.gym_user_id ? (
                            <span className="text-emerald-400/90"> · 체육관 계정과 연동</span>
                          ) : null}
                        </p>
                      </div>

                      {(req.status === 'pending' || req.status === 'reviewing') && (
                        <div className="flex flex-wrap gap-2">
                          {req.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleStartPromoReview(req.id)}
                              className="px-3 py-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 rounded-lg text-sky-200 font-bold text-xs"
                            >
                              심사 시작
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openPromoModal(req)}
                            className="px-3 py-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-lg text-violet-200 font-bold text-xs"
                          >
                            처리
                          </button>
                        </div>
                      )}
                    </div>
                  </SpotlightCard>
                );
              })}
            </div>
          ) : (
            !promoError && (
              <SpotlightCard className="p-10 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center">
                  <Icon type="inbox" size={40} className="text-gray-500" />
                </div>
                <p className="text-gray-400 text-sm mb-2">
                  {promFilter === 'pending' ? '대기 중인 승단 신청이 없습니다' : '해당 상태의 신청이 없습니다'}
                </p>
                <p className="text-gray-500 text-xs">회원이 갈림길에서 승단을 신청하면 여기에 표시됩니다</p>
              </SpotlightCard>
            )
          )}
        </>
      )}

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

      {selectedPromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">승단 처리</h2>
              <button
                type="button"
                onClick={() => {
                  setSelectedPromo(null);
                  setPromoNotes('');
                  setChosenBranchId(null);
                  setBranchOptions([]);
                }}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <Icon type="x" size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs text-gray-400 mb-1">회원</div>
                <div className="text-lg font-bold text-white">
                  {selectedPromo.member?.nickname || selectedPromo.member?.name || '—'}
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs text-gray-400 mb-1">갈림길 노드</div>
                <div className="text-sm font-bold text-white">
                  {selectedPromo.fork?.name || '—'} (#{selectedPromo.fork?.node_number ?? '—'})
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-2">승인 시 열릴 분기</div>
                {branchOptions.length === 0 ? (
                  <p className="text-sm text-amber-200/90">분기 노드 정보가 없습니다. DB의 fork_branch_node_numbers를 확인해 주세요.</p>
                ) : (
                  <div className="space-y-2">
                    {branchOptions.map((b) => (
                      <label
                        key={b.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                          chosenBranchId === b.id ? 'border-violet-400/50 bg-violet-500/10' : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <input
                          type="radio"
                          name="branch"
                          className="accent-violet-500"
                          checked={chosenBranchId === b.id}
                          onChange={() => setChosenBranchId(b.id)}
                        />
                        <span className="text-sm text-white">
                          {b.name} <span className="text-gray-500">#{b.node_number}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">메모 (선택, 거절 시 사유로 저장)</label>
                <textarea
                  value={promoNotes}
                  onChange={(e) => setPromoNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={processingPromo}
                onClick={() => handleGymResolvePromo(false)}
                className="flex-1 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 font-bold transition-all disabled:opacity-50"
              >
                거절
              </button>
              <button
                type="button"
                disabled={processingPromo || branchOptions.length === 0}
                onClick={() => handleGymResolvePromo(true)}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl text-white font-bold transition-all disabled:opacity-50"
              >
                {processingPromo ? '처리 중...' : '승인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { ApprovalView };

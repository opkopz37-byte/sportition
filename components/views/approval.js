'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import ProfileAvatarImg from '@/components/ProfileAvatarImg';
import Modal, { ModalFooter, ModalButton } from '@/components/Modal';
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

const ApprovalView = ({ t = (key) => key, setActiveTab, onBack }) => {
  const { user, profile } = useAuth();

  const [promotionQueue, setPromotionQueue] = useState([]);
  const [promLoading, setPromLoading] = useState(false);
  const [promFilter, setPromFilter] = useState('pending');
  const [promoError, setPromoError] = useState('');
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [branchOptions, setBranchOptions] = useState([]);
  const [chosenBranchId, setChosenBranchId] = useState(null);
  const [promoNotes, setPromoNotes] = useState('');
  const [processingPromo, setProcessingPromo] = useState(false);
  // 승인/거절 처리 결과 모달 — { approved, memberName, skillName }
  const [resolveResult, setResolveResult] = useState(null);
  // 다건 회원 펼치기 상태 (memberId Set)
  const [expandedMembers, setExpandedMembers] = useState(() => new Set());

  // 승단: RLS가 체육관 행만 넘김 — 여기서 한 번 더 걸면 gym_user_id 불일치 시 빈 목록이 됨
  const scopedPromotionQueue = useMemo(() => {
    if (!profile) return promotionQueue;
    if (profile.role === 'admin' || profile.role === 'gym') return promotionQueue;
    return promotionQueue.filter((r) =>
      isSameGymContext(profile, r.gym_user_id, r.gym_name)
    );
  }, [promotionQueue, profile]);

  // 회원 단위 그룹핑 — 같은 회원의 신청을 하나로 묶고, 대기/심사중 건수를 배지로 노출
  const groupedQueue = useMemo(() => {
    const statusOrder = { pending: 0, reviewing: 1, approved: 2, rejected: 3 };
    const map = new Map();

    for (const req of scopedPromotionQueue) {
      const name = req.member?.nickname || req.member?.display_name || req.member?.name || '회원';
      const key = req.member?.id || req.user_id || `name:${name}`;
      if (!map.has(key)) {
        map.set(key, {
          memberId: key,
          member: req.member,
          memberName: name,
          gymName: req.gym_name,
          requests: [],
        });
      }
      map.get(key).requests.push(req);
    }

    for (const group of map.values()) {
      group.requests.sort((a, b) => {
        const so = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        if (so !== 0) return so;
        return new Date(b.requested_at || 0) - new Date(a.requested_at || 0);
      });
      group.actionableCount = group.requests.filter(
        (r) => r.status === 'pending' || r.status === 'reviewing'
      ).length;
      group.latestAt = group.requests.reduce((acc, r) => {
        const t = new Date(r.requested_at || 0).getTime();
        return t > acc ? t : acc;
      }, 0);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.actionableCount !== b.actionableCount) return b.actionableCount - a.actionableCount;
      return b.latestAt - a.latestAt;
    });
  }, [scopedPromotionQueue]);

  const toggleMember = (memberId) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

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
    if (!user?.id) return;
    loadPromotionQueue();
  }, [user?.id, loadPromotionQueue]);

  // 거절 모드인지 — 거절 버튼으로 열렸으면 메모만 입력하고 거절 즉시 처리
  const [initialReject, setInitialReject] = useState(false);

  const openPromoModal = async (req, asReject = false) => {
    setSelectedPromo(req);
    setPromoNotes('');
    setChosenBranchId(null);
    setInitialReject(asReject === true);
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
    // fork 노드는 분기 선택 필수, 일반 마스터 노드는 분기 없음
    const isFork = selectedPromo.fork?.is_fork === true;
    if (approved && isFork && !chosenBranchId) {
      alert('승인 시 분기할 자식 노드를 선택해 주세요.');
      return;
    }

    try {
      setProcessingPromo(true);
      if (isFork) {
        // 갈림길(fork) — 기존 RPC (분기 선택 포함)
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
      } else {
        // 일반 마스터 스킬 — 단순 승인/거절 RPC (sql/48)
        const { gymResolveMasterExamRpc } = await import('@/lib/supabase');
        const { error } = await gymResolveMasterExamRpc(
          selectedPromo.id,
          approved,
          promoNotes || null
        );
        if (error) {
          alert(error.message || '처리에 실패했습니다.');
          return;
        }
      }

      const memberName =
        selectedPromo.member?.nickname ||
        selectedPromo.member?.display_name ||
        selectedPromo.member?.name ||
        '회원';
      const skillName = selectedPromo.fork?.name || '해당 스킬';
      setResolveResult({ approved, memberName, skillName });
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

  // 거절 로그용 절대 시각 (YYYY-MM-DD HH:mm, 24시간) — 한국 시간
  const formatLogDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    const fmt = new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'Asia/Seoul',
    });
    return fmt.format(date);
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

  const showSpinner = promLoading && promotionQueue.length === 0 && !promoError;

  if (showSpinner) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up w-full">
      <PageHeader
        title="스킬 승단 심사"
        onBack={onBack}
      />

      {promoError && (
        <SpotlightCard className="p-4 mb-4 border border-amber-500/30 bg-amber-500/10">
          <p className="text-base text-amber-200">{promoError}</p>
        </SpotlightCard>
      )}

      {/* 통계 인라인 */}
      <div className="flex items-start gap-6 sm:gap-10 mb-6 sm:mb-8 px-1 flex-wrap">
        <div>
          <div className="text-sm sm:text-base font-semibold text-gray-300 mb-1.5">대기</div>
          <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums leading-none">
            {scopedPromotionQueue.filter((r) => r.status === 'pending').length}
          </div>
        </div>
        <div>
          <div className="text-sm sm:text-base font-semibold text-gray-300 mb-1.5">심사 중</div>
          <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums leading-none">
            {scopedPromotionQueue.filter((r) => r.status === 'reviewing').length}
          </div>
        </div>
        <div className="h-14 sm:h-16 w-px bg-white/10 mt-1" />
        <div>
          <div className="text-sm sm:text-base font-semibold text-gray-300 mb-1.5">승인</div>
          <div className="text-3xl sm:text-4xl font-bold text-gray-400 tabular-nums leading-none">
            {scopedPromotionQueue.filter((r) => r.status === 'approved').length}
          </div>
        </div>
        <div>
          <div className="text-sm sm:text-base font-semibold text-gray-300 mb-1.5">거절</div>
          <div className="text-3xl sm:text-4xl font-bold text-gray-400 tabular-nums leading-none">
            {scopedPromotionQueue.filter((r) => r.status === 'rejected').length}
          </div>
        </div>
      </div>

      {/* 필터 칩 */}
      <div className="flex gap-2 mb-5 sm:mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {['pending', 'reviewing', 'approved', 'rejected', 'all'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setPromFilter(f)}
            className={`px-4 py-2.5 rounded-full font-semibold transition-all text-sm sm:text-base whitespace-nowrap flex-shrink-0 ${
              promFilter === f
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {f === 'pending' ? '대기' : f === 'reviewing' ? '심사 중' : f === 'approved' ? '승인' : f === 'rejected' ? '거절' : '전체'}
          </button>
        ))}
      </div>

      {/* 신청 목록 — 회원 단위 그룹 */}
      {groupedQueue.length > 0 ? (
        <div className="space-y-3">
          {groupedQueue.map((group) => {
            const isSingle = group.requests.length === 1;
            const expanded = isSingle || expandedMembers.has(group.memberId);

            return (
              <div
                key={group.memberId}
                className="bg-white/[0.02] border border-white/8 rounded-2xl overflow-hidden"
              >
                {/* 회원 헤더 — 아바타 + 이름 + 대기 건수 배지 */}
                <button
                  type="button"
                  onClick={() => !isSingle && toggleMember(group.memberId)}
                  disabled={isSingle}
                  className={`w-full flex items-center gap-3 p-3.5 sm:p-4 text-left transition-colors ${
                    isSingle ? 'cursor-default' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <ProfileAvatarImg
                    avatarUrl={group.member?.avatar_url}
                    name={group.memberName}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full text-base flex-shrink-0"
                    gradientClassName="bg-gradient-to-br from-violet-500/80 to-purple-600/80"
                  />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-white truncate">
                      {group.memberName}
                    </h3>
                    {group.actionableCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-xs font-bold tabular-nums flex-shrink-0">
                        {group.actionableCount}
                      </span>
                    )}
                  </div>
                  {!isSingle && (
                    <Icon
                      type="chevronDown"
                      size={18}
                      className={`text-gray-400 flex-shrink-0 transition-transform ${
                        expanded ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </button>

                {/* 신청 리스트 — 펼쳤을 때만 노출 */}
                {expanded && (
                  <div className="border-t border-white/8 divide-y divide-white/5">
                    {group.requests.map((req) => {
                      const statusBadge = getStatusBadge(req.status);
                      const skillName = req.fork?.name || '스킬';

                      // 거절 — 로그 형태 (날짜/시간 + 사유)
                      if (req.status === 'rejected') {
                        return (
                          <div
                            key={req.id}
                            className="px-4 py-3 sm:px-5 sm:py-3.5 bg-rose-500/[0.03]"
                          >
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBadge.color}`}>
                                {statusBadge.text}
                              </span>
                              <span className="text-[11px] sm:text-xs font-mono tabular-nums text-rose-300/90 tracking-tight">
                                {formatLogDate(req.resolved_at || req.requested_at)}
                              </span>
                            </div>
                            <div className="text-sm sm:text-base">
                              <span className="font-semibold text-rose-100">{skillName}</span>
                              <span className="text-gray-400"> 승단 신청 거절</span>
                            </div>
                            {req.notes ? (
                              <div className="mt-1.5 text-xs sm:text-sm text-gray-300 bg-white/[0.03] border border-white/8 rounded-lg px-2.5 py-1.5">
                                <span className="text-rose-300/80 font-semibold mr-1">사유</span>
                                {req.notes}
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={req.id}
                          className="px-4 py-3.5 sm:px-5 sm:py-4 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBadge.color}`}>
                                  {statusBadge.text}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-br from-amber-400/30 to-amber-600/20 border border-amber-400/40 text-amber-300 text-[10px] font-black flex-shrink-0">★</span>
                                <span className="text-base sm:text-lg font-extrabold text-white truncate tracking-tight">
                                  {skillName}
                                </span>
                              </div>
                              <div className="text-[11px] sm:text-xs text-gray-400 truncate">
                                승단 심사 신청 ·{' '}
                                {req.status === 'approved' && req.resolved_at
                                  ? <>승인 {formatLogDate(req.resolved_at)}</>
                                  : formatDate(req.requested_at)}
                              </div>
                            </div>

                            {(req.status === 'pending' || req.status === 'reviewing') && (
                              <div className="flex gap-2 flex-shrink-0">
                                {req.status === 'pending' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleStartPromoReview(req.id)}
                                      className="px-3 sm:px-4 py-2.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 rounded-xl text-sky-200 font-semibold text-sm whitespace-nowrap transition-colors"
                                    >
                                      심사 시작
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openPromoModal(req, true)}
                                      className="px-3 sm:px-4 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 rounded-xl text-rose-100 font-semibold text-sm whitespace-nowrap transition-colors"
                                    >
                                      거절
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openPromoModal(req)}
                                      className="px-3 sm:px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 rounded-xl text-emerald-100 font-semibold text-sm whitespace-nowrap transition-colors"
                                    >
                                      승인
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openPromoModal(req, true)}
                                      className="px-3 sm:px-4 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 rounded-xl text-rose-100 font-semibold text-sm whitespace-nowrap transition-colors"
                                    >
                                      거절
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        !promoError && (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-base mb-2">
              {promFilter === 'pending' ? '대기 중인 승단 신청이 없습니다' : '해당 상태의 신청이 없습니다'}
            </p>
            <p className="text-gray-500 text-sm">회원이 갈림길에서 승단을 신청하면 여기에 표시됩니다</p>
          </div>
        )
      )}

      {selectedPromo && (() => {
        const closeModal = () => {
          setSelectedPromo(null);
          setPromoNotes('');
          setChosenBranchId(null);
          setBranchOptions([]);
          setInitialReject(false);
        };
        return (
        <Modal
          open={!!selectedPromo}
          onClose={() => { if (!processingPromo) closeModal(); }}
          title={initialReject ? '승단 거절' : '승단 승인'}
          variant={initialReject ? 'danger' : 'success'}
          size="md"
          closable={!processingPromo}
        >
          <div className="space-y-4">
            {/* 회원 — 아바타 + 이름 */}
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/10">
              <ProfileAvatarImg
                avatarUrl={selectedPromo.member?.avatar_url}
                name={selectedPromo.member?.nickname || selectedPromo.member?.display_name || selectedPromo.member?.name}
                className="w-12 h-12 rounded-full text-base flex-shrink-0"
                gradientClassName="bg-gradient-to-br from-violet-500 to-purple-600"
              />
              <div className="min-w-0">
                <div className="text-[10px] font-black tracking-[0.25em] uppercase text-gray-400 mb-0.5">신청자</div>
                <div className="text-base sm:text-lg font-bold text-white truncate">
                  {selectedPromo.member?.nickname || selectedPromo.member?.display_name || selectedPromo.member?.name || '—'}
                </div>
                {selectedPromo.gym_name ? (
                  <div className="text-xs text-gray-500 truncate">소속: {selectedPromo.gym_name}</div>
                ) : null}
              </div>
            </div>

            {/* 승단 신청 스킬 */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-[10px] font-black tracking-[0.25em] uppercase text-gray-400 mb-1">승단 신청 스킬</div>
              <div className="text-base sm:text-lg font-bold text-white">
                {selectedPromo.fork?.name || '—'}
              </div>
              <div className="text-[11px] text-emerald-300/80 mt-1">
                5/5 마스터 완료 · {formatDate(selectedPromo.requested_at)} 신청
              </div>
            </div>

            {/* fork(갈림길) 노드만 분기 선택 노출 */}
            {selectedPromo.fork?.is_fork ? (
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
            ) : null}

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

          <ModalFooter>
            {initialReject ? (
              <ModalButton
                variant="danger"
                onClick={() => handleGymResolvePromo(false)}
                disabled={processingPromo}
              >
                {processingPromo ? '처리 중…' : '거절 확정'}
              </ModalButton>
            ) : (
              <ModalButton
                variant="success"
                onClick={() => handleGymResolvePromo(true)}
                disabled={
                  processingPromo
                  || (selectedPromo.fork?.is_fork === true && branchOptions.length === 0)
                }
              >
                {processingPromo ? '처리 중…' : '승인 확정'}
              </ModalButton>
            )}
          </ModalFooter>
        </Modal>
        );
      })()}

      {/* 승인/거절 결과 모달 */}
      <Modal
        open={!!resolveResult}
        onClose={() => setResolveResult(null)}
        title={resolveResult?.approved ? '승단 승인 완료' : '승단 거절 완료'}
        variant={resolveResult?.approved ? 'success' : 'danger'}
      >
        {resolveResult && (
          <>
            <p className="text-sm text-gray-200 leading-relaxed">
              <strong className="text-white">{resolveResult.memberName}</strong> 님의{' '}
              <strong className={resolveResult.approved ? 'text-emerald-200' : 'text-rose-200'}>
                {resolveResult.skillName}
              </strong>{' '}
              승단 신청을 {resolveResult.approved ? '승인했습니다.' : '거절했습니다.'}
            </p>
            <ModalFooter>
              <ModalButton
                variant={resolveResult.approved ? 'success' : 'danger'}
                onClick={() => setResolveResult(null)}
              >
                확인
              </ModalButton>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
};

export { ApprovalView };

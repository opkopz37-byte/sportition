'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import ProfileAvatarImg from '@/components/ProfileAvatarImg';
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

  const [promotionQueue, setPromotionQueue] = useState([]);
  const [promLoading, setPromLoading] = useState(false);
  const [promFilter, setPromFilter] = useState('pending');
  const [promoError, setPromoError] = useState('');
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [branchOptions, setBranchOptions] = useState([]);
  const [chosenBranchId, setChosenBranchId] = useState(null);
  const [promoNotes, setPromoNotes] = useState('');
  const [processingPromo, setProcessingPromo] = useState(false);

  // 승단: RLS가 체육관 행만 넘김 — 여기서 한 번 더 걸면 gym_user_id 불일치 시 빈 목록이 됨
  const scopedPromotionQueue = useMemo(() => {
    if (!profile) return promotionQueue;
    if (profile.role === 'admin' || profile.role === 'gym') return promotionQueue;
    return promotionQueue.filter((r) =>
      isSameGymContext(profile, r.gym_user_id, r.gym_name)
    );
  }, [promotionQueue, profile]);

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

      alert(approved ? '승단이 승인되었습니다.' : '승단이 거절되었습니다.');
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
      <div className="mb-5 sm:mb-7">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white break-words">
          스킬 승단 심사
        </h2>
      </div>

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

      {/* 신청 목록 */}
      {scopedPromotionQueue.length > 0 ? (
        <div className="space-y-2.5">
          {scopedPromotionQueue.map((req) => {
            const statusBadge = getStatusBadge(req.status);
            const memberName = req.member?.nickname || req.member?.display_name || req.member?.name || '회원';
            // 갈림길 / 일반 마스터 모두 동일하게 "스킬 이름" 으로 표시
            const skillName = req.fork?.name || '스킬';
            const statusDot = req.status === 'pending'
              ? 'bg-yellow-400'
              : req.status === 'reviewing'
              ? 'bg-sky-400'
              : req.status === 'approved'
              ? 'bg-emerald-400'
              : 'bg-red-400';

            // 거절 — 로그 형태로 별도 디자인 (날짜/시간 + 사유)
            if (req.status === 'rejected') {
              return (
                <div
                  key={req.id}
                  className="w-full p-3 sm:p-4 bg-rose-500/[0.04] border border-rose-500/15 rounded-xl"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <ProfileAvatarImg
                        avatarUrl={req.member?.avatar_url}
                        name={memberName}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full text-base"
                        gradientClassName="bg-gradient-to-br from-rose-500/70 to-red-600/70"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBadge.color}`}>
                          {statusBadge.text}
                        </span>
                        <span className="text-[11px] sm:text-xs font-mono tabular-nums text-rose-300/90 tracking-tight">
                          {formatLogDate(req.resolved_at || req.requested_at)}
                        </span>
                      </div>
                      <div className="text-sm sm:text-base text-white">
                        <span className="font-bold">{memberName}</span>
                        <span className="text-gray-400"> 님의 </span>
                        <span className="font-semibold text-rose-100">{skillName}</span>
                        <span className="text-gray-400"> 승단 신청 거절</span>
                      </div>
                      {req.notes ? (
                        <div className="mt-1.5 text-xs sm:text-sm text-gray-300 bg-white/[0.03] border border-white/8 rounded-lg px-2.5 py-1.5">
                          <span className="text-rose-300/80 font-semibold mr-1">사유</span>
                          {req.notes}
                        </div>
                      ) : null}
                      <div className="text-[10px] sm:text-[11px] text-gray-500 mt-1">
                        신청 {formatLogDate(req.requested_at)}
                        {req.gym_name ? <> · 소속 {req.gym_name}</> : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={req.id}
                className="w-full p-4 sm:p-5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-white/15 rounded-2xl transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                      <ProfileAvatarImg
                        avatarUrl={req.member?.avatar_url}
                        name={memberName}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full text-lg"
                        gradientClassName="bg-gradient-to-br from-violet-500/80 to-purple-600/80"
                      />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0A0A0A] ${statusDot}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm sm:text-base font-semibold text-white/85 truncate">{memberName}</h3>
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
                        {req.gym_name ? <> · 소속: {req.gym_name}</> : null}
                        {req.gym_user_id && profile?.id === req.gym_user_id ? (
                          <span className="text-emerald-400/90"> · 체육관 계정 연동</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {(req.status === 'pending' || req.status === 'reviewing') && (
                    <div className="flex gap-2 flex-shrink-0">
                      {req.status === 'pending' ? (
                        // 대기중 — 심사 시작 + 거절 만 노출 (승인은 심사 시작 후에)
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
                        // 심사 중 — 승인 + 거절
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={processingPromo}
                  aria-label="뒤로가기"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors disabled:opacity-50"
                >
                  ←
                </button>
                <h2 className="text-xl font-bold text-white">
                  {initialReject ? '승단 거절' : '승단 승인'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={processingPromo}
                aria-label="닫기"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <Icon type="x" size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
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

              {/* 승단 신청 스킬 (갈림길 용어 제거) */}
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

            <div className="flex gap-3">
              <button
                type="button"
                disabled={processingPromo}
                onClick={closeModal}
                className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 font-bold transition-all disabled:opacity-50"
              >
                뒤로가기
              </button>
              {initialReject ? (
                <button
                  type="button"
                  disabled={processingPromo}
                  onClick={() => handleGymResolvePromo(false)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 rounded-xl text-white font-bold transition-all disabled:opacity-50"
                >
                  {processingPromo ? '처리 중...' : '거절 확정'}
                </button>
              ) : (
                /* fork 노드는 분기 옵션이 없으면 승인 비활성, 일반 마스터 노드는 항상 활성 */
                <button
                  type="button"
                  disabled={
                    processingPromo
                    || (selectedPromo.fork?.is_fork === true && branchOptions.length === 0)
                  }
                  onClick={() => handleGymResolvePromo(true)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 rounded-xl text-white font-bold transition-all disabled:opacity-50"
                >
                  {processingPromo ? '처리 중...' : '승인 확정'}
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export { ApprovalView };

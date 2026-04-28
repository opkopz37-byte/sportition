'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 출석 후 표시되는 모달 — 두 액션 중 하나만 활성:
 *   - 스킬 포인트 적립 (amber/gold) : pending 아닐 때 활성 → +1 SP
 *   - 레벨업 신청 (cyan/blue)        : pending 일 때 활성 → 해당 스킬 페이지로 이동
 *
 * 단계: 'choose' → 'confirm-claim' / 'confirm-levelup' → 'success-claim' / closed
 *
 * Props:
 *   open              : boolean
 *   onClose           : () => void
 *   pendingPromotion  : { id, node_id, status, skill_name? } | null
 *   alreadyClaimed    : boolean
 *   onClaimSkillPoint : () => Promise<{ ok, message, skillPoints }>
 *   onGoToLevelUp     : (nodeId) => void
 */
export default function AttendanceClaimModal({
  open,
  onClose,
  pendingPromotion = null,
  alreadyClaimed = false,
  onClaimSkillPoint,
  onGoToLevelUp,
}) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState('choose'); // 'choose' | 'confirm-claim' | 'confirm-levelup' | 'success-claim'
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultSp, setResultSp] = useState(null);

  useEffect(() => { setMounted(true); }, []);

  // 모달 열릴 때마다 초기 상태로
  useEffect(() => {
    if (open) {
      setView('choose');
      setBusy(false);
      setErrorMsg('');
      setResultSp(null);
    }
  }, [open]);

  if (!mounted || !open || typeof document === 'undefined') return null;

  // pendingPromotion = "처리 안 된 마스터 스킬" (5/5 인데 승단 미승인)
  // status: 'unsubmitted' | 'pending' | 'reviewing' | 'rejected'
  const isPending = Boolean(pendingPromotion);
  const claimEnabled = !isPending && !alreadyClaimed && !busy;
  const levelUpEnabled = isPending && !busy;
  const skillName = pendingPromotion?.skill_name || pendingPromotion?.node_name || '마스터 스킬';
  const statusLabel = (() => {
    switch (pendingPromotion?.status) {
      case 'pending':    return '심사 대기 중';
      case 'reviewing':  return '심사 진행 중';
      case 'rejected':   return '거절됨 — 재신청 필요';
      case 'unsubmitted':
      default:           return '승단 심사 필요';
    }
  })();

  const handleConfirmClaim = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await onClaimSkillPoint?.();
      if (res?.ok) {
        setResultSp(res.skillPoints ?? null);
        setView('success-claim');
      } else {
        setErrorMsg(res?.message || '적립에 실패했습니다.');
        setView('choose');
      }
    } catch (e) {
      setErrorMsg(e?.message || '적립에 실패했습니다.');
      setView('choose');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmLevelUp = () => {
    onGoToLevelUp?.(pendingPromotion.node_id);
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(12,16,36,0.92)' }}
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border-2 border-emerald-300/40 overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.35)]"
        style={{
          background:
            'linear-gradient(135deg, rgba(16,185,129,0.16) 0%, rgba(12,16,36,0.96) 60%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          {/* 단계별 헤더 — 레벨업 이동 확인에선 "출석 완료" 안 보이게 */}
          {view === 'confirm-levelup' ? (
            <>
              <p className="text-[10px] font-black tracking-[0.4em] uppercase text-cyan-300 mb-2">
                LEVEL UP
              </p>
              <h3 className="text-2xl font-black text-white mb-1 leading-tight">
                레벨업 이동
              </h3>
            </>
          ) : view === 'confirm-claim' ? (
            <>
              <p className="text-[10px] font-black tracking-[0.4em] uppercase text-amber-300 mb-2">
                CLAIM REWARD
              </p>
              <h3 className="text-2xl font-black text-white mb-1 leading-tight">
                스킬 포인트 적립
              </h3>
            </>
          ) : view === 'success-claim' ? (
            <>
              <p className="text-[10px] font-black tracking-[0.4em] uppercase text-amber-300 mb-2">
                REWARD CLAIMED
              </p>
              <h3 className="text-2xl font-black text-white mb-1 leading-tight">
                적립 완료!
              </h3>
            </>
          ) : (
            <>
              <p className="text-[10px] font-black tracking-[0.4em] uppercase text-emerald-300 mb-2">
                ATTENDANCE CHECK
              </p>
              <h3 className="text-2xl font-black text-white mb-1 leading-tight">
                출석 완료
              </h3>
            </>
          )}

          {/* 단계 1: 두 버튼 선택 */}
          {view === 'choose' ? (
            <>
              <p className="text-sm text-white/70 leading-relaxed mb-5">
                {isPending
                  ? '마스터한 스킬의 승단이 마무리될 때까지 SP 적립이 잠금됩니다.'
                  : alreadyClaimed
                    ? '오늘 스킬 포인트는 이미 적립되었습니다.'
                    : '아래 버튼 중 하나를 선택해 주세요.'}
              </p>

              {isPending ? (
                <div className="mb-4 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-left">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-cyan-300/80 mb-0.5">
                    {statusLabel}
                  </p>
                  <p className="text-sm font-bold text-white truncate">{skillName}</p>
                </div>
              ) : null}

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setView('confirm-claim')}
                  disabled={!claimEnabled}
                  className={`w-full py-3 rounded-xl font-extrabold text-sm transition-all border ${
                    claimEnabled
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black border-amber-300/60 shadow-[0_0_20px_rgba(251,191,36,0.35)] active:scale-[0.98]'
                      : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {alreadyClaimed
                    ? '스킬 포인트 (오늘 적립 완료)'
                    : '★ 스킬 포인트 적립 (+1 SP)'}
                </button>

                <button
                  type="button"
                  onClick={() => setView('confirm-levelup')}
                  disabled={!levelUpEnabled}
                  className={`w-full py-3 rounded-xl font-extrabold text-sm transition-all border ${
                    levelUpEnabled
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border-cyan-300/60 shadow-[0_0_20px_rgba(34,211,238,0.35)] active:scale-[0.98]'
                      : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isPending ? '⚡ 레벨업 신청' : '레벨업 신청 (대기 중인 심사 없음)'}
                </button>
              </div>

              {errorMsg ? (
                <p className="mt-4 text-sm text-rose-300 font-semibold">{errorMsg}</p>
              ) : null}

              <button
                type="button"
                onClick={onClose}
                className="mt-4 text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                닫기
              </button>
            </>
          ) : null}

          {/* 단계 2-A: 적립 확인 */}
          {view === 'confirm-claim' ? (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-400/20 border border-amber-300/50 flex items-center justify-center mb-3 mt-1">
                <span className="text-2xl text-amber-300">★</span>
              </div>
              <p className="text-base text-white font-bold mb-1">
                스킬 포인트 +1 을 적립하시겠습니까?
              </p>
              <p className="text-xs text-white/60 mb-5">
                오늘 한 번만 적립되며 취소할 수 없습니다.
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setView('choose')}
                  disabled={busy}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all disabled:opacity-40"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClaim}
                  disabled={busy}
                  className="flex-1 py-3 rounded-xl font-extrabold text-sm bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black border border-amber-300/60 shadow-[0_0_18px_rgba(251,191,36,0.35)] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {busy ? '처리 중...' : '적립 확정'}
                </button>
              </div>
            </>
          ) : null}

          {/* 단계 2-B: 레벨업 이동 확인 */}
          {view === 'confirm-levelup' ? (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-cyan-400/20 border border-cyan-300/50 flex items-center justify-center mb-3 mt-1">
                <span className="text-2xl text-cyan-300">⚡</span>
              </div>
              <p className="text-base text-white font-bold mb-1 leading-snug">
                <span className="text-cyan-200 font-extrabold">{skillName}</span> 의<br />
                승단 심사 페이지로 이동할까요?
              </p>
              <p className="text-xs text-white/60 mb-5">
                해당 스킬 노드로 자동 포커스됩니다.
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setView('choose')}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLevelUp}
                  className="flex-1 py-3 rounded-xl font-extrabold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border border-cyan-300/60 shadow-[0_0_18px_rgba(34,211,238,0.35)] active:scale-[0.98] transition-all"
                >
                  이동
                </button>
              </div>
            </>
          ) : null}

          {/* 단계 3: 적립 성공 */}
          {view === 'success-claim' ? (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-400/25 border-2 border-amber-300/60 flex items-center justify-center mb-3 mt-1 shadow-[0_0_24px_rgba(251,191,36,0.45)]">
                <span className="text-3xl text-amber-300">★</span>
              </div>
              <p className="text-base text-white font-bold mb-1">
                스킬 포인트 +1 적립 완료
              </p>
              {resultSp != null ? (
                <p className="text-sm text-amber-300 font-extrabold tabular-nums mb-5">
                  보유 SP: {resultSp}
                </p>
              ) : <div className="mb-5" />}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl font-extrabold text-sm bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black border border-amber-300/60 transition-all active:scale-[0.98]"
              >
                확인
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

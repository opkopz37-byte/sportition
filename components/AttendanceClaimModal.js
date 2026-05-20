'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 출석 후 표시되는 모달
 *
 * 새 모델 (관장 주도 해금 + 자동 적립):
 *   - 회원의 [SP 적립] 버튼은 폐지됨 (출석 시 활성 스킬 EXP 자동 +1)
 *   - 모달은 출석 완료 안내 + (있을 시) 승단 신청 페이지로 이동 버튼만
 *
 * 단계: 'main' → 'confirm-levelup' → closed
 *
 * Props:
 *   open              : boolean
 *   onClose           : () => void
 *   pendingPromotion  : { id, node_id, status, skill_name? } | null
 *   onGoToLevelUp     : (nodeId) => void
 *   alreadyClaimed    : (deprecated) — 호환성 유지 위해 받지만 사용 안 함
 *   onClaimSkillPoint : (deprecated) — 호환성 유지 위해 받지만 사용 안 함
 */
export default function AttendanceClaimModal({
  open,
  onClose,
  pendingPromotion = null,
  onGoToLevelUp,
  // eslint-disable-next-line no-unused-vars
  alreadyClaimed,
  // eslint-disable-next-line no-unused-vars
  onClaimSkillPoint,
}) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState('main'); // 'main' | 'confirm-levelup'

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) setView('main');
  }, [open]);

  if (!mounted || !open || typeof document === 'undefined') return null;

  const isPending = Boolean(pendingPromotion);
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

  const handleConfirmLevelUp = () => {
    if (pendingPromotion?.node_id != null) {
      onGoToLevelUp?.(pendingPromotion.node_id);
    }
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(12,16,36,0.92)' }}
      onClick={onClose}
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
          {view === 'confirm-levelup' ? (
            <>
              <p className="text-[10px] font-black tracking-[0.4em] uppercase text-cyan-300 mb-2">
                LEVEL UP
              </p>
              <h3 className="text-2xl font-black text-white mb-1 leading-tight">
                레벨업 이동
              </h3>
              <div className="mx-auto w-12 h-12 rounded-full bg-cyan-400/20 border border-cyan-300/50 flex items-center justify-center mb-3 mt-3">
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
                  onClick={() => setView('main')}
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
          ) : (
            <>
              <p className="text-[10px] font-black tracking-[0.4em] uppercase text-emerald-300 mb-2">
                ATTENDANCE CHECK
              </p>
              <h3 className="text-2xl font-black text-white mb-1 leading-tight">
                출석 완료
              </h3>

              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-400/25 border-2 border-emerald-300/60 flex items-center justify-center mb-3 mt-3 shadow-[0_0_24px_rgba(16,185,129,0.45)]">
                <span className="text-3xl">✓</span>
              </div>
              <p className="text-base text-white font-bold mb-2">
                오늘 출석 완료!
              </p>
              <p className="text-sm text-emerald-200/90 leading-relaxed mb-5">
                활성 스킬의 EXP 가<br />자동으로 +1 적립되었습니다.
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
                {isPending ? (
                  <button
                    type="button"
                    onClick={() => setView('confirm-levelup')}
                    className="w-full py-3 rounded-xl font-extrabold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border border-cyan-300/60 shadow-[0_0_20px_rgba(34,211,238,0.35)] active:scale-[0.98] transition-all"
                  >
                    ⚡ 승단 심사 신청하러 가기
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all"
                >
                  확인
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

'use client';

import { useEffect, useState } from 'react';
import Modal, { ModalFooter, ModalButton } from '@/components/Modal';

/**
 * 출석 후 표시되는 모달
 *
 * 단계: 'main' → 'confirm-levelup' → closed
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
  const [view, setView] = useState('main');

  useEffect(() => {
    if (open) setView('main');
  }, [open]);

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={view === 'confirm-levelup' ? '레벨업 이동' : '출석 완료'}
      variant={view === 'confirm-levelup' ? 'info' : 'success'}
      zIndexClass="z-[300]"
      usePortal
    >
      {view === 'confirm-levelup' ? (
        <>
          <p className="text-sm text-white/90 leading-relaxed">
            <span className="text-cyan-200 font-extrabold">{skillName}</span> 의 승단 심사 페이지로 이동할까요?
          </p>
          <p className="text-xs text-white/60 mt-2">해당 스킬 노드로 자동 포커스됩니다.</p>
          <ModalFooter>
            <ModalButton variant="ghost" onClick={() => setView('main')}>
              이전
            </ModalButton>
            <ModalButton variant="info" onClick={handleConfirmLevelUp}>
              이동
            </ModalButton>
          </ModalFooter>
        </>
      ) : (
        <>
          <p className="text-base text-white font-bold mb-1">오늘 출석 완료!</p>
          <p className="text-sm text-emerald-200/90 leading-relaxed">
            활성 스킬의 EXP 가 자동으로 +1 적립되었습니다.
          </p>
          {isPending ? (
            <div className="mt-3 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30">
              <p className="text-[10px] tracking-[0.2em] uppercase text-cyan-300/80 mb-0.5">
                {statusLabel}
              </p>
              <p className="text-sm font-bold text-white truncate">{skillName}</p>
            </div>
          ) : null}
          <ModalFooter>
            {isPending && (
              <ModalButton variant="info" onClick={() => setView('confirm-levelup')}>
                승단 심사 신청하러 가기
              </ModalButton>
            )}
            <ModalButton variant={isPending ? 'ghost' : 'success'} onClick={onClose}>
              확인
            </ModalButton>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}

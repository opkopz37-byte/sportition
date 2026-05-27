'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import Modal, { ModalFooter, ModalButton } from '@/components/Modal';

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AttendanceCheckModal({ open, onClose, onGoToSkills }) {
  const { user, refreshProfile } = useAuth();
  const [view, setView] = useState('idle'); // 'idle' | 'loading' | 'done' | 'error'
  const [todayRecord, setTodayRecord] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [error, setError] = useState(null);

  const loadToday = useCallback(async () => {
    if (!user?.id) return null;
    try {
      const { supabase } = await import('@/lib/supabase');
      const today = localYmd();
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('attendance_date', today)
        .maybeSingle();
      if (data) {
        setTodayRecord(data);
        setView('done');
      } else {
        setTodayRecord(null);
        setView('idle');
      }
      return data;
    } catch (e) {
      console.error('[AttendanceCheckModal] loadToday 에러:', e);
      setView('idle');
      return null;
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      setError(null);
      setPendingPromotion(null);
      loadToday();
    }
  }, [open, loadToday]);

  const handleCheckIn = useCallback(async () => {
    if (!user?.id) return;
    setView('loading');
    setError(null);
    try {
      const { checkAttendance, getMyPromotionRequests, supabase } = await import('@/lib/supabase');
      const result = await checkAttendance();

      if (result.error) {
        if (result.error.code === 'no_active_skill') {
          setError({
            title: '오늘 출석할 수 없어요',
            message: '진행할 스킬을 먼저 선택해 주세요.',
            goSkills: true,
          });
        } else {
          setError({
            title: '출석 체크에 실패했어요',
            message: result.error.message || result.message || '알 수 없는 오류가 발생했습니다.',
            hint: '잠시 후 다시 시도해 주세요. 문제가 계속되면 관장님께 문의해 주세요.',
            goSkills: false,
          });
        }
        setView('error');
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80);

      const { data: promoRows } = await getMyPromotionRequests();
      const pending = (promoRows || []).find(
        (r) => r.status === 'pending' || r.status === 'reviewing'
      );
      if (pending?.node_id) {
        const { data: nodes } = await supabase
          .from('skill_tree_nodes')
          .select('id, name')
          .eq('id', pending.node_id);
        setPendingPromotion({
          id: pending.id,
          node_id: pending.node_id,
          status: pending.status,
          skill_name: nodes?.[0]?.name || '승단 신청 스킬',
        });
      }

      await loadToday();
      refreshProfile?.().catch(() => {});
    } catch (e) {
      console.error('[AttendanceCheckModal] handleCheckIn 에러:', e);
      setError({
        title: '출석 체크 중 오류',
        message: e?.message || '네트워크 또는 시스템 오류가 발생했습니다.',
        hint: '인터넷 연결을 확인하고 다시 시도해 주세요.',
        goSkills: false,
      });
      setView('error');
    }
  }, [user, refreshProfile, loadToday]);

  const isLoading = view === 'loading';

  const title = (() => {
    switch (view) {
      case 'loading':  return '처리 중…';
      case 'done':     return '오늘 출석 완료';
      case 'error':    return error?.title || '오류';
      case 'idle':
      default:         return '오늘 출석 체크';
    }
  })();

  const variant = view === 'error' ? 'warning' : 'success';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      variant={variant}
      zIndexClass="z-[300]"
      closable={!isLoading}
      usePortal
    >
      {view === 'idle' && (
        <>
          <p className="text-sm text-emerald-100/85 leading-relaxed">
            출석하면 활성 스킬의 EXP 가 자동으로 +1 적립됩니다.
          </p>
          <ModalFooter>
            <ModalButton variant="success" onClick={handleCheckIn}>
              출석 체크하기
            </ModalButton>
          </ModalFooter>
        </>
      )}

      {view === 'loading' && (
        <div className="py-3 flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-300/30 border-t-emerald-300 animate-spin" />
          <p className="text-sm text-white/70">잠시만 기다려 주세요.</p>
        </div>
      )}

      {view === 'done' && (
        <>
          <p className="text-base text-white font-bold mb-1">오늘 출석 완료!</p>
          {todayRecord?.check_in_time && (
            <p className="text-sm text-emerald-200/90">
              {new Date(todayRecord.check_in_time).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
              })} 출석 · 활성 스킬 EXP +1 적립
            </p>
          )}
          {pendingPromotion ? (
            <div className="mt-3 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30">
              <p className="text-[10px] tracking-[0.2em] uppercase text-cyan-300/80 mb-0.5">
                {pendingPromotion.status === 'reviewing' ? '심사 진행 중' : '심사 대기 중'}
              </p>
              <p className="text-sm font-bold text-white truncate">
                {pendingPromotion.skill_name}
              </p>
            </div>
          ) : null}
          <ModalFooter>
            <ModalButton variant="success" onClick={onClose}>
              확인
            </ModalButton>
          </ModalFooter>
        </>
      )}

      {view === 'error' && error && (
        <>
          <p className="text-sm text-white/90 leading-relaxed whitespace-pre-line">
            {error.message}
          </p>
          {error.hint && (
            <div className="mt-3 rounded-xl bg-amber-500/[0.08] border border-amber-400/20 px-3 py-2.5">
              <p className="text-xs sm:text-[13px] text-amber-100/85 leading-relaxed whitespace-pre-line">
                {error.hint}
              </p>
            </div>
          )}
          <ModalFooter>
            {error.goSkills && (
              <ModalButton
                variant="info"
                onClick={() => {
                  onGoToSkills?.();
                  onClose?.();
                }}
              >
                스킬 화면으로
              </ModalButton>
            )}
            <ModalButton variant="ghost" onClick={onClose}>
              확인
            </ModalButton>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}

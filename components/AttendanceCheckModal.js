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
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [activeSkill, setActiveSkill] = useState(null); // { name, exp_level } | null
  const [error, setError] = useState(null);

  const loadActiveSkill = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: unlocks } = await supabase
        .from('user_skill_unlocks')
        .select('node_id, unlocked_at, skill_tree_nodes(name)')
        .eq('user_id', user.id);
      if (!unlocks?.length) {
        setActiveSkill(null);
        return;
      }
      const { data: progs } = await supabase
        .from('user_skill_node_progress')
        .select('node_id, exp_level')
        .eq('user_id', user.id)
        .in('node_id', unlocks.map((u) => u.node_id));
      const progMap = new Map((progs || []).map((p) => [p.node_id, p.exp_level]));
      const active = unlocks
        .filter((u) => (progMap.get(u.node_id) ?? 0) < 5)
        .sort((a, b) => new Date(b.unlocked_at || 0) - new Date(a.unlocked_at || 0))[0];
      if (active) {
        setActiveSkill({
          name: active.skill_tree_nodes?.name || '활성 스킬',
          exp_level: progMap.get(active.node_id) ?? 0,
        });
      } else {
        setActiveSkill(null);
      }
    } catch (e) {
      console.error('[AttendanceCheckModal] loadActiveSkill 에러:', e);
      setActiveSkill(null);
    }
  }, [user]);

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
        setView('done');
        await loadActiveSkill();
      } else {
        setView('idle');
      }
      return data;
    } catch (e) {
      console.error('[AttendanceCheckModal] loadToday 에러:', e);
      setView('idle');
      return null;
    }
  }, [user, loadActiveSkill]);

  useEffect(() => {
    if (open) {
      setError(null);
      setPendingPromotion(null);
      setActiveSkill(null);
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
          {activeSkill ? (
            <div className="text-center py-3">
              <p className="text-base font-bold text-white">{activeSkill.name}</p>
              <p className="text-3xl font-extrabold text-emerald-300 mt-1 tabular-nums tracking-tight">
                {activeSkill.exp_level} <span className="text-emerald-300/50">/</span> 5
              </p>
            </div>
          ) : (
            <p className="text-center text-sm text-emerald-200/90 py-3">
              오늘 출석이 적립되었습니다.
            </p>
          )}
          {pendingPromotion ? (
            <p className="text-center text-xs text-cyan-200/90 mt-1">
              심사 {pendingPromotion.status === 'reviewing' ? '진행' : '대기'} 중 · {pendingPromotion.skill_name}
            </p>
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

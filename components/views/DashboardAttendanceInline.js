'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import AttendanceClaimModal from '@/components/AttendanceClaimModal';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

// 로컬 타임존 기준 YYYY-MM-DD (KST 등) — toISOString() 의 UTC 변환 버그 회피
function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekDates() {
  const today = new Date();
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    return localYmd(d);
  });
}

export default function DashboardAttendanceInline({ t = (k) => k, setActiveTab }) {
  const { user, refreshProfile } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [todayChecked, setTodayChecked] = useState(false);
  const [weekAttended, setWeekAttended] = useState(new Set());
  const [stats, setStats] = useState({
    currentStreak: 0,
    thisMonth: 0,
    skillPointsEarned: 0,
  });
  // 출석 후 모달 상태
  const [modalState, setModalState] = useState({
    open: false,
    alreadyClaimed: false,
    pendingPromotion: null,
  });

  const weekDates = getWeekDates();
  const todayYmd = localYmd();
  const todayDowIndex = (() => {
    const dow = new Date().getDay();
    return dow === 0 ? 6 : dow - 1;
  })();

  // 페이지 진입 시 — 1 RPC 로 모든 통계 한 번에 (이전: 5 parallel queries)
  const loadAttendanceData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { getMyAttendanceSummary } = await import('@/lib/supabase');
      const { data, error } = await getMyAttendanceSummary();
      if (error) {
        console.warn('[DashboardAttendanceInline] summary 에러:', error.message);
        return;
      }
      if (!data) return;

      setTodayChecked(data.today_checked === true);
      setStats({
        currentStreak: Number(data.current_streak ?? 0),
        thisMonth: Number(data.this_month_count ?? 0),
        skillPointsEarned: Number(data.skill_points ?? 0),
      });
      // week_dates 는 PG DATE[] → ['2026-04-25', ...] 문자열 배열
      const dates = Array.isArray(data.week_dates) ? data.week_dates : [];
      const attended = new Set(dates.map((d) => String(d).split('T')[0]));
      setWeekAttended(attended);
    } catch (e) {
      console.error('[DashboardAttendanceInline] loadAttendanceData 예외:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user) loadAttendanceData();
  }, [user, loadAttendanceData]);

  // 출석체크 버튼 = 1 RPC 호출 (이전: 4 sequential)
  // 출석 기록 + 처리 안 된 마스터 검출 + 모달 상태 한 번에.
  const handleCheckAttendance = async () => {
    if (isChecking || !user?.id) return;
    setIsChecking(true);
    try {
      const { openAttendanceModal } = await import('@/lib/supabase');
      const { data, error } = await openAttendanceModal();
      if (error || !data) {
        alert(`${t('checkInFailed')}: ${error?.message || ''}`);
        return;
      }

      // 카드 visual 동기화
      const wasFirstToday = data.already_checked === false;
      if (wasFirstToday && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80);
      setTodayChecked(true);
      setWeekAttended((prev) => new Set([...prev, todayYmd]));
      setStats((prev) => ({
        ...prev,
        currentStreak: typeof data.current_streak === 'number' ? data.current_streak : prev.currentStreak,
        thisMonth: wasFirstToday
          ? (typeof data.this_month === 'number' ? data.this_month : prev.thisMonth + 1)
          : prev.thisMonth,
      }));

      // 모달 열기 — RPC 가 unfinished mastery 까지 같이 반환
      const u = data.unfinished;
      const pendingPromotion = u
        ? { node_id: u.node_id, status: u.status, skill_name: u.skill_name }
        : null;

      setModalState({
        open: true,
        alreadyClaimed: data.sp_claimed === true,
        pendingPromotion,
      });
    } catch (e) {
      console.error(e);
      alert(t('checkInError'));
    } finally {
      setIsChecking(false);
    }
  };

  // 모달 [스킬 포인트 적립] 클릭 → SP +1 (출석은 이미 기록됨)
  const handleClaimSkillPoint = useCallback(async () => {
    // 프론트 방어선 #1 — 처리 안 된 마스터 있으면 절대 적립 불가
    if (modalState.pendingPromotion) {
      return {
        ok: false,
        message: '마스터한 스킬의 승단 심사가 필요합니다. 먼저 승인 받으세요.',
      };
    }
    try {
      const { claimDailySkillPoint } = await import('@/lib/supabase');
      const r = await claimDailySkillPoint();
      if (r.error) return { ok: false, message: r.error.message };
      if (typeof r.skillPoints === 'number') {
        setStats((prev) => ({ ...prev, skillPointsEarned: r.skillPoints }));
      }
      refreshProfile();
      setModalState((prev) => ({ ...prev, alreadyClaimed: true }));
      return { ok: true, skillPoints: r.skillPoints };
    } catch (e) {
      console.error(e);
      return { ok: false, message: '스킬 포인트 적립 실패' };
    }
  }, [refreshProfile, modalState.pendingPromotion]);

  // 모달 [레벨업 신청] 클릭 → 스킬 페이지 이동 (출석은 이미 기록됨)
  const handleGoToLevelUp = useCallback((nodeId) => {
    if (typeof window !== 'undefined' && nodeId != null) {
      try {
        window.sessionStorage.setItem('skill_focus_node_id', String(nodeId));
      } catch { /* ignore */ }
    }
    if (typeof setActiveTab === 'function') {
      setActiveTab('skills');
    } else {
      console.warn('[DashboardAttendanceInline] setActiveTab 미전달 — location 폴백');
      if (typeof window !== 'undefined') {
        window.location.assign('/');
      }
    }
  }, [setActiveTab]);

  return (
    <SpotlightCard className="p-4 sm:p-5 bg-[#1a2138] h-full overflow-hidden relative">
      <AttendanceClaimModal
        open={modalState.open}
        onClose={() => setModalState((prev) => ({ ...prev, open: false }))}
        pendingPromotion={modalState.pendingPromotion}
        alreadyClaimed={modalState.alreadyClaimed}
        onClaimSkillPoint={handleClaimSkillPoint}
        onGoToLevelUp={handleGoToLevelUp}
      />
      <div className="relative flex flex-col gap-3">
        {/* 상단: 타이틀 + 아이콘 */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-400/70">{t('attendance')}</p>
            <h3 className="text-xl font-black text-white mt-0.5 leading-tight">
              {todayChecked ? '출석 완료' : '오늘 출석'}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <Icon type="checkCircle" size={18} className="text-emerald-300" />
          </div>
        </div>

        {/* 연속 출석 숫자 */}
        <div className="flex items-end gap-1.5">
          <span className="text-5xl font-black tabular-nums leading-none text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400">
            {stats.currentStreak}
          </span>
          <span className="text-sm font-semibold text-gray-500 mb-1">일 연속</span>
        </div>

        {/* 이번 주 출석 도트 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-gray-500">이번 주</span>
            <span className="text-[10px] text-gray-500 tabular-nums">{weekAttended.size}/7</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((ymd, i) => {
              const isToday = ymd === todayYmd;
              const checked = weekAttended.has(ymd);
              return (
                <div key={ymd} className="flex flex-col items-center gap-0.5">
                  <span className={`text-[9px] font-medium ${isToday ? 'text-white' : 'text-gray-600'}`}>
                    {DAY_LABELS[i]}
                  </span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    checked
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                      : isToday
                      ? 'border border-emerald-400/60 bg-emerald-500/10'
                      : 'bg-white/[0.04] border border-white/8'
                  }`}>
                    {checked && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 체크인 버튼 or 완료 상태 (출석 후에도 보상 모달 다시 열기 가능) */}
        {todayChecked ? (
          <button
            type="button"
            onClick={handleCheckAttendance}
            disabled={isChecking}
            className="w-full p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-xs font-bold text-emerald-300 flex-1 text-left">내일도 화이팅</p>
            <span className="text-[10px] text-amber-300/80 font-bold">보상 다시 열기</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCheckAttendance}
            disabled={isChecking}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] text-white font-bold text-sm transition-all disabled:opacity-50"
          >
            {isChecking ? t('processing') : '오늘 출석 체크하기'}
          </button>
        )}

        {/* 하단 통계 */}
        <div className="flex gap-2">
          <div className="flex-1 p-2.5 rounded-2xl bg-white/[0.04] border border-white/8">
            <p className="text-[10px] text-gray-500 mb-0.5">이번 달</p>
            <p className="text-sm font-bold text-white tabular-nums">{stats.thisMonth}일</p>
          </div>
          <div className="flex-1 p-2.5 rounded-2xl bg-white/[0.04] border border-white/8">
            <p className="text-[10px] text-gray-500 mb-0.5">SP</p>
            <p className="text-sm font-bold text-emerald-400 tabular-nums">{stats.skillPointsEarned}</p>
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}

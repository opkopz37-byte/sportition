'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

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

export default function DashboardAttendanceInline({ t = (k) => k }) {
  const { user, refreshProfile } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [todayChecked, setTodayChecked] = useState(false);
  const [weekAttended, setWeekAttended] = useState(new Set());
  const [stats, setStats] = useState({
    currentStreak: 0,
    thisMonth: 0,
    skillPointsEarned: 0,
  });

  const weekDates = getWeekDates();
  const todayYmd = localYmd();
  const todayDowIndex = (() => {
    const dow = new Date().getDay();
    return dow === 0 ? 6 : dow - 1;
  })();

  const loadAttendanceData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { default: supabase } = await import('@/lib/supabase');
      const now = new Date();
      // 로컬(KST) 기준 — UTC 변환 시 한국 새벽 시간이 어제 달로 잘못 들어가는 문제 방지
      const firstOfMonth = localYmd(new Date(now.getFullYear(), now.getMonth(), 1));
      const weekStart = weekDates[0];
      const weekEnd = weekDates[6];

      const [todayResult, statsResult, userRowResult, monthCountResult, weekResult] = await Promise.all([
        supabase.from('attendance').select('attendance_date').eq('user_id', user.id).eq('attendance_date', todayYmd).maybeSingle(),
        supabase.from('statistics').select('current_streak').eq('user_id', user.id).maybeSingle(),
        supabase.from('users').select('skill_points').eq('id', user.id).maybeSingle(),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('attendance_date', firstOfMonth),
        supabase.from('attendance').select('attendance_date').eq('user_id', user.id).gte('attendance_date', weekStart).lte('attendance_date', weekEnd),
      ]);

      setTodayChecked(!!todayResult?.data);
      const s = statsResult?.data;
      const monthCnt = typeof monthCountResult?.count === 'number' ? monthCountResult.count : 0;
      const skillPts = userRowResult?.data?.skill_points != null ? Number(userRowResult.data.skill_points) : 0;
      setStats({
        currentStreak: s?.current_streak != null ? Number(s.current_streak) : 0,
        thisMonth: monthCnt,
        skillPointsEarned: skillPts,
      });
      const attended = new Set((weekResult?.data || []).map((r) => String(r.attendance_date).split('T')[0]));
      setWeekAttended(attended);
    } catch (e) {
      console.error('[DashboardAttendanceInline]', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user) loadAttendanceData();
  }, [user, loadAttendanceData]);

  const handleCheckAttendance = async () => {
    if (todayChecked || isChecking || !user?.id) return;
    setIsChecking(true);
    // 낙관적 UI 업데이트 — 버튼 누른 즉시 상태 반영
    setTodayChecked(true);
    setWeekAttended((prev) => new Set([...prev, todayYmd]));
    setStats((prev) => ({
      ...prev,
      currentStreak: prev.currentStreak + 1,
      thisMonth: prev.thisMonth + 1,
      skillPointsEarned: prev.skillPointsEarned + 1,
    }));

    try {
      const { checkAttendance } = await import('@/lib/supabase');
      const result = await checkAttendance();
      if (result.error) {
        // 롤백
        setTodayChecked(false);
        setWeekAttended((prev) => {
          const next = new Set(prev);
          next.delete(todayYmd);
          return next;
        });
        setStats((prev) => ({
          ...prev,
          currentStreak: Math.max(0, prev.currentStreak - 1),
          thisMonth: Math.max(0, prev.thisMonth - 1),
          skillPointsEarned: Math.max(0, prev.skillPointsEarned - 1),
        }));
        alert(`${t('checkInFailed')}: ${result.error.message || result.message || ''}`);
        return;
      }
      // RPC 응답으로 정확한 수치 즉시 동기화 (재호출 불필요 → 트래픽 ↓)
      if (typeof result.totalSkillPoints === 'number') {
        setStats((prev) => ({ ...prev, skillPointsEarned: result.totalSkillPoints }));
      }
      if (typeof result.currentStreak === 'number') {
        setStats((prev) => ({ ...prev, currentStreak: result.currentStreak }));
      }
      // 프로필의 skill_points 도 갱신
      refreshProfile();
    } catch (e) {
      console.error(e);
      setTodayChecked(false);
      alert(t('checkInError'));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <SpotlightCard className="p-4 sm:p-5 bg-[#1a2138] h-full overflow-hidden relative">
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

        {/* 체크인 버튼 or 완료 상태 */}
        {todayChecked ? (
          <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/8 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-xs font-bold text-emerald-300">내일도 화이팅</p>
          </div>
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

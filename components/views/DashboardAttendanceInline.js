'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function getWeekDates() {
  const today = new Date();
  // Monday = 0 index
  const dow = today.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    return d.toISOString().split('T')[0];
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
  const todayYmd = new Date().toISOString().split('T')[0];
  const todayDowIndex = (() => {
    const dow = new Date().getDay();
    return dow === 0 ? 6 : dow - 1;
  })();

  const loadAttendanceData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { default: supabase } = await import('@/lib/supabase');
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
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
    try {
      const { checkAttendance } = await import('@/lib/supabase');
      const result = await checkAttendance(user.id);
      if (result.error) {
        alert(`${t('checkInFailed')}: ${result.message}`);
      } else {
        await Promise.all([refreshProfile(), loadAttendanceData()]);
        setTodayChecked(true);
      }
    } catch (e) {
      console.error(e);
      alert(t('checkInError'));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <SpotlightCard className="p-4 sm:p-5 pb-3 bg-[#1a1a1a] h-full flex flex-col gap-3">

      {/* 헤더: 스트릭 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white">{t('attendance')}</h3>
        {stats.currentStreak > 0 ? (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
            <span className="text-sm leading-none">🔥</span>
            <span className="text-xs font-bold text-orange-400">{stats.currentStreak}일 연속</span>
          </div>
        ) : (
          <Icon type="calendar" size={18} className="text-emerald-400/60" />
        )}
      </div>

      {/* 이번 주 출석 도트 */}
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((ymd, i) => {
          const isToday = ymd === todayYmd;
          const checked = weekAttended.has(ymd);
          const isFuture = ymd > todayYmd;
          return (
            <div key={ymd} className="flex flex-col items-center gap-1">
              <span className={`text-[10px] font-medium ${isToday ? 'text-white' : 'text-gray-600'}`}>
                {DAY_LABELS[i]}
              </span>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                checked
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : isToday
                  ? 'border-2 border-emerald-500/60 bg-emerald-500/10'
                  : isFuture
                  ? 'bg-white/5'
                  : 'bg-white/5 border border-white/10'
              }`}>
                {checked && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {!checked && isToday && (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 체크인 버튼 or 완료 상태 */}
      <div className="flex-1">
        {todayChecked ? (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-400">오늘 출석 완료!</p>
              <p className="text-xs text-gray-500 mt-0.5">내일도 화이팅 💪</p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCheckAttendance}
            disabled={isChecking}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
          >
            <Icon type="checkCircle" size={18} className="text-white/90" />
            {isChecking ? t('processing') : '오늘 출석 체크하기'}
          </button>
        )}
      </div>

      {/* 하단 통계 */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10">
        <div className="rounded-lg bg-white/5 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">{t('currentStreak')}</div>
          <div className="text-sm font-bold text-orange-400 tabular-nums">
            {stats.currentStreak}
            <span className="text-[10px] font-normal text-gray-500">{t('days')}</span>
          </div>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">{t('thisMonth')}</div>
          <div className="text-sm font-bold text-white tabular-nums">
            {stats.thisMonth}
            <span className="text-[10px] font-normal text-gray-500">일</span>
          </div>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">SP</div>
          <div className="text-sm font-bold text-cyan-400 tabular-nums">{stats.skillPointsEarned}</div>
        </div>
      </div>
    </SpotlightCard>
  );
}

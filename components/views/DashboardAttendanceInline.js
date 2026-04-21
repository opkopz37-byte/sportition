'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

/**
 * 대시보드 우측 컬럼용 — 전체 출석 페이지와 다른 컴팩트 레이아웃
 */
export default function DashboardAttendanceInline({ t = (k) => k }) {
  const { user, refreshProfile } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [todayChecked, setTodayChecked] = useState(false);
  const [stats, setStats] = useState({
    currentStreak: 0,
    thisMonth: 0,
    skillPointsEarned: 0,
  });

  const loadAttendanceData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { default: supabase } = await import('@/lib/supabase');
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const [todayResult, statsResult, userRowResult, monthCountResult] = await Promise.all([
        supabase.from('attendance').select('*').eq('user_id', user.id).eq('attendance_date', today).maybeSingle(),
        supabase
          .from('statistics')
          .select('current_streak')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.from('users').select('skill_points').eq('id', user.id).maybeSingle(),
        supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('attendance_date', firstOfMonth),
      ]);

      setTodayChecked(!!todayResult?.data);
      const s = statsResult?.data;
      const monthCnt = typeof monthCountResult?.count === 'number' ? monthCountResult.count : 0;
      const skillPts =
        userRowResult?.data?.skill_points != null ? Number(userRowResult.data.skill_points) : 0;
      setStats({
        currentStreak: s?.current_streak != null ? Number(s.current_streak) : 0,
        thisMonth: monthCnt,
        skillPointsEarned: skillPts,
      });
    } catch (e) {
      console.error('[DashboardAttendanceInline]', e);
    }
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
    <SpotlightCard className="p-4 sm:p-5 bg-[#1a1a1a] h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-bold text-white">{t('attendance')}</h3>
        <Icon type="calendar" size={18} className="text-emerald-400/80" />
      </div>

      <div className="flex-1 flex flex-col justify-center text-center py-2">
        {todayChecked ? (
          <>
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Icon type="check" size={28} className="text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-white mb-1">{t('calendarAttendanceYes')}</p>
            <p className="text-xs text-gray-500 mb-3">{t('skillPointsEarned')}</p>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">{t('dailyCheckIn')}</p>
            <button
              type="button"
              onClick={handleCheckAttendance}
              disabled={isChecking}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold disabled:opacity-50 transition-all"
            >
              {isChecking ? t('processing') : t('checkInButton')}
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-4 mt-auto border-t border-white/10">
        <div className="rounded-lg bg-white/5 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">{t('currentStreak')}</div>
          <div className="text-sm font-bold text-emerald-400 tabular-nums">
            {stats.currentStreak}
            <span className="text-[10px] font-normal text-gray-500">{t('days')}</span>
          </div>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">{t('thisMonth')}</div>
          <div className="text-sm font-bold text-white tabular-nums">{stats.thisMonth}</div>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">{t('earnedPoints')}</div>
          <div className="text-sm font-bold text-cyan-400 tabular-nums">{stats.skillPointsEarned}</div>
        </div>
      </div>
    </SpotlightCard>
  );
}

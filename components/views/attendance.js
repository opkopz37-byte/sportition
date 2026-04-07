'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon, PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

const AttendanceView = ({ t = (key) => key, setActiveTab, language = 'ko' }) => {
  const { user, profile, refreshProfile } = useAuth();
  const locale = language === 'ko' ? 'ko-KR' : 'en-US';
  const [isChecking, setIsChecking] = useState(false);
  const [todayChecked, setTodayChecked] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [stats, setStats] = useState({
    totalDays: 0,
    currentStreak: 0,
    longestStreak: 0,
    thisMonth: 0,
    skillPointsEarned: 0
  });

  const loadAttendanceData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { getUserAttendance, default: supabase } = await import('@/lib/supabase');

      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];

      console.log('[Attendance] 데이터 로딩 시작 (병렬)');

      const [
        todayResult,
        recentResult,
        statsResult,
        userRowResult,
        monthCountResult,
      ] = await Promise.all([
        supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .eq('attendance_date', today)
          .maybeSingle(),
        getUserAttendance(user.id, thirtyDaysAgo.toISOString()),
        supabase
          .from('statistics')
          .select('total_attendance, current_streak, longest_streak')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.from('users').select('skill_points').eq('id', user.id).maybeSingle(),
        supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('attendance_date', firstOfMonth),
      ]);

      const recentRows = recentResult?.data || [];

      console.log('[Attendance] 데이터 로딩 완료:', {
        todayChecked: !!todayResult?.data,
        recentCount: recentRows.length,
        stats: statsResult?.data,
        skillPoints: userRowResult?.data?.skill_points,
        monthCount: monthCountResult?.count,
      });

      setTodayChecked(!!todayResult?.data);
      setAttendanceData(todayResult?.data);
      setRecentAttendance(recentRows);

      const s = statsResult?.data;
      const monthCnt = typeof monthCountResult?.count === 'number' ? monthCountResult.count : 0;
      const skillPts =
        userRowResult?.data?.skill_points != null
          ? Number(userRowResult.data.skill_points)
          : 0;

      setStats({
        totalDays: s?.total_attendance != null ? Number(s.total_attendance) : 0,
        currentStreak: s?.current_streak != null ? Number(s.current_streak) : 0,
        longestStreak: s?.longest_streak != null ? Number(s.longest_streak) : 0,
        thisMonth: monthCnt,
        skillPointsEarned: skillPts,
      });
    } catch (error) {
      console.error('[Attendance] 출석 데이터 로드 에러:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadAttendanceData();
    }
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
        alert(`${result.message}\n${t('skillPointsEarned')}`);
        setTodayChecked(true);
        setAttendanceData(result.data);
        
        // 프로필 새로고침과 출석 데이터 재로드 병렬 처리
        await Promise.all([
          refreshProfile(),
          loadAttendanceData()
        ]);
      }
    } catch (error) {
      console.error('[Attendance] 출석 체크 에러:', error);
      alert(t('checkInError'));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="animate-fade-in-up space-y-4 xs:space-y-6">
      <PageHeader
        title={t('attendance')}
        description={t('checkInDescription')}
      />

      {/* 출석 체크 버튼 */}
      <SpotlightCard className="p-6 xs:p-8 sm:p-10 text-center">
        <div className="max-w-md mx-auto">
          {todayChecked ? (
            <>
              <div className="w-20 h-20 xs:w-24 xs:h-24 mx-auto mb-4 xs:mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                <Icon type="check" size={48} className="text-emerald-400" />
              </div>
              <h3 className="text-xl xs:text-2xl font-bold text-white mb-2">오늘 출석 완료!</h3>
              <p className="text-sm xs:text-base text-gray-400 mb-4">
                {attendanceData && new Date(attendanceData.check_in_time).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })} 출석
              </p>
              <button
                type="button"
                onClick={async () => {
                  await Promise.all([refreshProfile(), loadAttendanceData()]);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-400 rounded-lg transition-colors"
              >
                <Icon type="star" size={20} />
                <span className="font-bold">스킬 포인트 +1</span>
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 xs:w-24 xs:h-24 mx-auto mb-4 xs:mb-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center animate-pulse">
                <Icon type="calendar" size={48} className="text-blue-400" />
              </div>
              <h3 className="text-xl xs:text-2xl font-bold text-white mb-2">{t('checkInTitle')}</h3>
              <p className="text-sm xs:text-base text-gray-400 mb-6">
                {t('dailyCheckIn')}
              </p>
              <button
                onClick={handleCheckAttendance}
                disabled={isChecking}
                className={`w-full max-w-xs px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl text-white font-bold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                  isChecking ? 'animate-pulse' : ''
                }`}
              >
                {isChecking ? t('processing') : t('checkInButton')}
              </button>
            </>
          )}
        </div>
      </SpotlightCard>

      {/* 출석 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 xs:gap-4">
        <SpotlightCard className="p-4 xs:p-5">
          <div className="text-center">
            <div className="w-10 h-10 xs:w-12 xs:h-12 mx-auto mb-2 xs:mb-3 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Icon type="calendar" size={24} className="text-blue-400" />
            </div>
            <div className="text-xs xs:text-sm text-gray-400 mb-1">{t('totalAttendance')}</div>
            <div className="text-xl xs:text-2xl font-bold text-white">{stats.totalDays}{t('days')}</div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4 xs:p-5">
          <div className="text-center">
            <div className="w-10 h-10 xs:w-12 xs:h-12 mx-auto mb-2 xs:mb-3 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Icon type="zap" size={24} className="text-emerald-400" />
            </div>
            <div className="text-xs xs:text-sm text-gray-400 mb-1">{t('currentStreak')}</div>
            <div className="text-xl xs:text-2xl font-bold text-white">{stats.currentStreak}{t('days')}</div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4 xs:p-5">
          <div className="text-center">
            <div className="w-10 h-10 xs:w-12 xs:h-12 mx-auto mb-2 xs:mb-3 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Icon type="trophy" size={24} className="text-purple-400" />
            </div>
            <div className="text-xs xs:text-sm text-gray-400 mb-1">{t('longestStreak')}</div>
            <div className="text-xl xs:text-2xl font-bold text-white">{stats.longestStreak}{t('days')}</div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4 xs:p-5">
          <div className="text-center">
            <div className="w-10 h-10 xs:w-12 xs:h-12 mx-auto mb-2 xs:mb-3 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Icon type="calendar" size={24} className="text-yellow-400" />
            </div>
            <div className="text-xs xs:text-sm text-gray-400 mb-1">{t('thisMonth')}</div>
            <div className="text-xl xs:text-2xl font-bold text-white">{stats.thisMonth}{t('days')}</div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4 xs:p-5">
          <div className="text-center">
            <div className="w-10 h-10 xs:w-12 xs:h-12 mx-auto mb-2 xs:mb-3 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Icon type="star" size={24} className="text-cyan-400" />
            </div>
            <div className="text-xs xs:text-sm text-gray-400 mb-1">{t('earnedPoints')}</div>
            <div className="text-xl xs:text-2xl font-bold text-white">{stats.skillPointsEarned}</div>
          </div>
        </SpotlightCard>
      </div>

      {/* 최근 출석 기록 */}
      <SpotlightCard className="p-4 xs:p-6">
        <h3 className="text-lg xs:text-xl font-bold text-white mb-4">{t('recentAttendanceRecords')}</h3>
        
        {recentAttendance.length > 0 ? (
          <div className="space-y-2">
            {recentAttendance.slice(0, 10).map((record, index) => {
              const date = new Date(record.check_in_time);
              const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
              
              return (
                <div
                  key={record.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isToday ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isToday ? 'bg-blue-500/20' : 'bg-white/10'
                    }`}>
                      <Icon 
                        type={isToday ? 'check' : 'calendar'} 
                        size={16} 
                        className={isToday ? 'text-blue-400' : 'text-gray-400'} 
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {date.toLocaleDateString(locale, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short'
                        })}
                      </div>
                      <div className="text-xs text-gray-400">
                        {date.toLocaleTimeString(locale, {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                  {isToday && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded">
                      {t('today')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            <Icon type="calendar" size={48} className="mx-auto mb-3 text-gray-600" />
            <p>{t('noAttendanceRecords')}</p>
            <p className="text-sm mt-1">{t('startAttending')}</p>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
};

export { AttendanceView };

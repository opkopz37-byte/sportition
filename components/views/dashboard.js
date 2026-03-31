'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon, PageHeader, SpotlightCard, BackgroundGrid, THEME_ATHLETE, THEME_COACH, getMenuStructure } from '@/components/ui';
import { translations } from '@/lib/translations';
import { useAuth } from '@/lib/AuthContext';
// 대시보드 뷰

const DashboardView = ({ setActiveTab, t = (key) => key, role = 'player_common' }) => {
  const { profile, user } = useAuth();
  const [statistics, setStatistics] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [rankingNews, setRankingNews] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState('');
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [calendarViewMode, setCalendarViewMode] = useState('day');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showDetailPage, setShowDetailPage] = useState(false);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);

  useEffect(() => {
    console.log('[Dashboard] 컴포넌트 마운트/업데이트');
    console.log('[Dashboard] 프로필 데이터:', profile);
    console.log('[Dashboard] 사용자 데이터:', user);

    const loadUserData = async () => {
      if (user?.id) {
        console.log('[Dashboard] 사용자 데이터 로드 시작:', user.id);
        const supabaseModule = await import('@/lib/supabase');
        const { getUserStatistics, getUserAttendance, getUserMatches } = supabaseModule;
        const supabase = supabaseModule.default || supabaseModule.supabase;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [statsResult, attendanceResult, rankingResult, matchesResult] = await Promise.all([
          getUserStatistics(user.id),
          getUserAttendance(user.id, thirtyDaysAgo.toISOString()),
          getUserMatches(user.id),
          // 실시간 랭킹 데이터 가져오기
          supabase
            .from('public_player_profiles')
            .select('id, display_name, tier, tier_points')
            .order('rank', { ascending: true, nullsFirst: false })
            .limit(5)
        ]);

        if (statsResult.data) {
          console.log('[Dashboard] 통계 데이터 로드:', statsResult.data);
          setStatistics(statsResult.data);
        } else {
          console.warn('[Dashboard] 통계 데이터 없음');
        }
        
        if (attendanceResult.data) {
          console.log('[Dashboard] 출석 데이터 로드:', attendanceResult.data.length, '건');
          setAttendance(attendanceResult.data);
        } else {
          console.warn('[Dashboard] 출석 데이터 없음');
        }

        if (rankingResult.data && rankingResult.data.length > 0) {
          console.log('[Dashboard] 랭킹 데이터 로드:', rankingResult.data.length, '건');
          const formattedRanking = rankingResult.data.map((item, index) => ({
            rank: index + 1,
            name: item.display_name || '사용자',
            tier: item.tier || 'Bronze III',
            change: '0',
            type: 'same'
          }));
          setRankingNews(formattedRanking);
        } else {
          console.warn('[Dashboard] 랭킹 데이터 없음');
          setRankingNews([]);
        }

        if (matchesResult.error) {
          console.error('[Dashboard] 경기 기록 로드 에러:', matchesResult.error);
          setMatchError('경기 기록을 불러오지 못했습니다.');
          setMatchHistory([]);
        } else {
          const recentMatches = matchesResult.data?.recentMatches || [];
          const formattedMatches = recentMatches.map((match) => {
            const date = match.match_date ? new Date(match.match_date) : null;
            const isKo = match.result === 'ko_win' || match.result === 'ko_loss';
            return {
              id: match.id,
              result: match.normalized_result || 'draw',
              opponent: match.opponent_label || 'Unknown',
              opponentId: match.opponent_id || null,
              date: date ? date.toLocaleDateString('ko-KR') : '-',
              method: isKo ? `KO ${match.round || '-' }R` : (match.event_name || '기록 경기'),
              score: isKo ? 'KO' : (match.notes || '-'),
              rounds: match.round || '-',
              weight: match.weight_class || '-',
              icon: '🥊',
            };
          });
          setMatchHistory(formattedMatches);
          setMatchError('');
        }
        setMatchLoading(false);
      } else {
        setMatchHistory([]);
        setMatchError('');
        setMatchLoading(false);
      }
    };

    loadUserData();
  }, [user, profile]);

  useEffect(() => {
    const handleMatchChanged = async (event) => {
      if (!user?.id) return;
      if (event?.detail?.userId && event.detail.userId !== user.id) return;
      setMatchLoading(true);
      const supabaseModule = await import('@/lib/supabase');
      const { getUserMatches } = supabaseModule;
      const { data, error } = await getUserMatches(user.id);
      if (error) {
        setMatchError('경기 기록을 갱신하지 못했습니다.');
      } else {
        const recentMatches = data?.recentMatches || [];
        setMatchHistory(recentMatches.map((match) => ({
          id: match.id,
          result: match.normalized_result || 'draw',
          opponent: match.opponent_label || 'Unknown',
          opponentId: match.opponent_id || null,
          date: match.match_date ? new Date(match.match_date).toLocaleDateString('ko-KR') : '-',
          method: (match.result === 'ko_win' || match.result === 'ko_loss') ? `KO ${match.round || '-'}R` : (match.event_name || '기록 경기'),
          score: (match.result === 'ko_win' || match.result === 'ko_loss') ? 'KO' : (match.notes || '-'),
          rounds: match.round || '-',
          weight: match.weight_class || '-',
          icon: '🥊',
        })));
        setMatchError('');
      }
      setMatchLoading(false);
    };

    window.addEventListener('matches:changed', handleMatchChanged);
    return () => window.removeEventListener('matches:changed', handleMatchChanged);
  }, [user?.id]);
  
  const monthNames = {
    ko: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  
  const daysOfWeek = {
    ko: ['월', '화', '수', '목', '금', '토', '일'],
    en: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  };
  
  const lang = t('hi') === '안녕하세요' ? 'ko' : 'en';
  
  // 특정 월의 달력 데이터 생성
  const getCalendarDays = (year, month) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // 월요일 시작
    
    const days = Array(adjustedFirstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };
  
  const calendarDays = getCalendarDays(currentYear, currentMonth);
  
  const attendanceDays = attendance
    .filter(record => {
      const date = new Date(record.check_in_time);
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    })
    .map(record => new Date(record.check_in_time).getDate());
  
  const workoutDays = attendanceDays;
  const today = new Date().getDate();

  // 샘플 훈련 데이터 (상세 정보 포함)
  const workoutData = {};

  const handleDateClick = (day) => {
    if (day && workoutData[day]) { // 운동 데이터가 있는 날짜만 클릭 가능
      console.log('날짜 클릭:', day);
      setSelectedDate(day);
      setShowWorkoutModal(true);
      setShowDetailPage(false);
    }
  };

  // 자동 슬라이드 효과 - 1위부터 5위까지 보여주고 다시 1위로 (Hook을 최상위에 배치)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentNewsIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        return nextIndex >= rankingNews.length ? 0 : nextIndex;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [rankingNews.length]);

  // 상세 페이지 렌더링
  if (showDetailPage && selectedDate && workoutData[selectedDate]) {
    return (
      <div className="animate-fade-in-up space-y-6">
        {/* 헤더 */}
        <div className="mb-8 flex items-center justify-between">
          <button 
            onClick={() => setShowDetailPage(false)}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
          >
            <Icon type="arrowLeft" size={20} className="text-gray-400 group-hover:text-white group-hover:-translate-x-1 transition-all" />
            <span className="text-white font-bold">{t('backButton')}</span>
          </button>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">
              🗓️ {workoutData[selectedDate].date} ({workoutData[selectedDate].dayOfWeek})
            </h1>
            <p className="text-gray-400">상세 트레이닝 리포트</p>
          </div>
          <div className="w-40"></div>
        </div>

        {/* 전체 통계 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <SpotlightCard className="p-2.5 sm:p-4 border-l-4 border-blue-500">
            <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 whitespace-nowrap">총 운동 시간</div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-bold text-white mb-0.5 whitespace-nowrap">{workoutData[selectedDate].totalTime}분</div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap">일일 목표 대비 120%</div>
          </SpotlightCard>
          <SpotlightCard className="p-2.5 sm:p-4 border-l-4 border-red-500">
            <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 whitespace-nowrap">소모 칼로리</div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-bold text-white mb-0.5 whitespace-nowrap">{workoutData[selectedDate].calories}kcal</div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap">목표 800kcal 달성</div>
          </SpotlightCard>
          <SpotlightCard className="p-2.5 sm:p-4 border-l-4 border-purple-500">
            <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 whitespace-nowrap">운동 종목</div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-bold text-white mb-0.5 whitespace-nowrap">{workoutData[selectedDate].exercises.length}개</div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap">균형잡힌 루틴</div>
          </SpotlightCard>
          <SpotlightCard className="p-2.5 sm:p-4 border-l-4 border-yellow-500">
            <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 whitespace-nowrap">만족도</div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-bold text-yellow-400 whitespace-nowrap">
              {workoutData[selectedDate].satisfaction}/5
            </div>
            <div className="text-[9px] sm:text-[10px] text-gray-500">
              {'⭐'.repeat(workoutData[selectedDate].satisfaction || 0)}
            </div>
          </SpotlightCard>
        </div>

        {/* 운동 상세 내역 */}
        <SpotlightCard className="p-4 sm:p-8">
          <h3 className="text-xl sm:text-3xl font-bold text-white mb-4 sm:mb-8 flex items-center gap-2 sm:gap-3">
            <span className="text-2xl sm:text-3xl">📋</span>
            <span>운동 상세 내역</span>
          </h3>
          <div className="space-y-4 sm:space-y-8">
            {workoutData[selectedDate].exercises.map((exercise, idx) => (
              <div key={idx} className="p-4 sm:p-6 bg-gradient-to-r from-white/5 to-white/[0.02] border-2 border-white/10 rounded-2xl hover:border-white/30 transition-all">
                <div className="flex items-center gap-3 sm:gap-6 mb-4 sm:mb-6">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 flex-shrink-0 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-3xl sm:text-6xl">
                    {exercise.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-2 truncate">{exercise.name}</h4>
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                      {exercise.intensity && (
                        <span className={`px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-bold ${
                          exercise.intensity === 'very-high' ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50' :
                          exercise.intensity === 'high' ? 'bg-orange-500/20 text-orange-400 border-2 border-orange-500/50' :
                          exercise.intensity === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500/50' :
                          'bg-green-500/20 text-green-400 border-2 border-green-500/50'
                        }`}>
                          강도: {exercise.intensity === 'very-high' ? '매우 높음' :
                               exercise.intensity === 'high' ? '높음' :
                               exercise.intensity === 'medium' ? '중간' : '낮음'}
                        </span>
                      )}
                      {exercise.duration && (
                        <span className="text-gray-400 text-sm sm:text-lg">⏱️ {exercise.duration}분</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 세부 정보 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                  {exercise.sets && (
                    <div className="p-2 sm:p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 whitespace-nowrap">세트</div>
                      <div className="text-base sm:text-xl lg:text-2xl font-bold text-blue-400">{exercise.sets}</div>
                    </div>
                  )}
                  {exercise.reps && (
                    <div className="p-2 sm:p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                      <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 whitespace-nowrap">총 반복</div>
                      <div className="text-base sm:text-xl lg:text-2xl font-bold text-purple-400">{exercise.reps}</div>
                    </div>
                  )}
                  {exercise.weight && (
                    <div className="p-2 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 whitespace-nowrap">중량</div>
                      <div className="text-base sm:text-xl lg:text-2xl font-bold text-red-400">{exercise.weight}</div>
                    </div>
                  )}
                  {exercise.totalWeight && (
                    <div className="p-2 sm:p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 whitespace-nowrap">총 중량</div>
                      <div className="text-base sm:text-xl lg:text-2xl font-bold text-orange-400 whitespace-nowrap">{exercise.totalWeight}kg</div>
                    </div>
                  )}
                  {exercise.distance && (
                    <div className="p-2 sm:p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 whitespace-nowrap">거리</div>
                      <div className="text-base sm:text-xl lg:text-2xl font-bold text-emerald-400 whitespace-nowrap">{exercise.distance}km</div>
                    </div>
                  )}
                  {exercise.calories && (
                    <div className="p-2 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 whitespace-nowrap">칼로리</div>
                      <div className="text-base sm:text-xl lg:text-2xl font-bold text-red-400 whitespace-nowrap">{exercise.calories}kcal</div>
                    </div>
                  )}
                  {exercise.pace && (
                    <div className="p-2 sm:p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                      <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 whitespace-nowrap">페이스</div>
                      <div className="text-base sm:text-xl lg:text-2xl font-bold text-cyan-400 whitespace-nowrap">{exercise.pace}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>

        {/* 메모 및 코치 */}
        <div className="grid grid-cols-2 gap-6">
          <SpotlightCard className="p-8">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <span>📝</span>
              <span>메모</span>
            </h3>
            <div className="p-6 bg-white/5 rounded-xl text-gray-300 text-lg leading-relaxed">
              {workoutData[selectedDate].note}
            </div>
          </SpotlightCard>

          {workoutData[selectedDate].coach && (
            <SpotlightCard className="p-8">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span>👨‍🏫</span>
                <span>담당 코치</span>
              </h3>
              <div className="flex items-center gap-6 p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                  {workoutData[selectedDate].coach.charAt(0)}
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">담당 코치</div>
                  <div className="text-2xl font-bold text-white">{workoutData[selectedDate].coach}</div>
                </div>
              </div>
            </SpotlightCard>
          )}
        </div>
      </div>
    );
  }

  // ── 체육관 전용 대시보드 ──────────────────────────────────
  if (role === 'gym' || profile?.role === 'gym') {
    return (
      <div className="animate-fade-in-up space-y-3 xs:space-y-4 sm:space-y-6">
        {/* 헤더 */}
        <div className="mb-4 xs:mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-1.5 xs:mb-2 flex-wrap">
            <h2 className="text-xl xs:text-2xl sm:text-3xl font-bold text-white">
              안녕하세요, {profile?.gym_name || profile?.name || '체육관'}!
            </h2>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
              체육관
            </span>
          </div>
          <p className="text-xs xs:text-sm text-gray-500">오늘의 체육관 현황을 확인하세요</p>
        </div>

        {/* 체육관 정보 카드 */}
        <SpotlightCard className="p-4 xs:p-5 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4 pb-4 border-b border-white/5 mb-4">
            <div className="w-14 h-14 xs:w-16 xs:h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl xs:text-3xl shadow-lg flex-shrink-0">
              🏋️
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-white truncate">
                {profile?.gym_name || '체육관'}
              </h3>
              <div className="flex flex-col gap-0.5 mt-1">
                {profile?.gym_location && (
                  <p className="text-xs xs:text-sm text-gray-400 truncate">📍 {profile.gym_location}</p>
                )}
                {profile?.representative_phone && (
                  <p className="text-xs xs:text-sm text-gray-400">📞 {profile.representative_phone}</p>
                )}
                {profile?.email && (
                  <p className="text-xs xs:text-sm text-gray-400 truncate">✉️ {profile.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* 출석 통계 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 xs:gap-3">
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-lg xs:rounded-xl p-3 border border-blue-500/20">
              <div className="text-[10px] xs:text-xs text-blue-300 mb-1 whitespace-nowrap">오늘 출석</div>
              <div className="text-xl xs:text-2xl font-bold text-white">{attendance?.length || 0}</div>
              <div className="text-[9px] xs:text-[10px] text-gray-500">명</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-lg xs:rounded-xl p-3 border border-emerald-500/20">
              <div className="text-[10px] xs:text-xs text-emerald-300 mb-1 whitespace-nowrap">이달 출석</div>
              <div className="text-xl xs:text-2xl font-bold text-white">
                {attendance?.filter(a => {
                  const d = new Date(a.check_in_time || a.attendance_date);
                  return d.getMonth() === new Date().getMonth();
                }).length || 0}
              </div>
              <div className="text-[9px] xs:text-[10px] text-gray-500">건</div>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-lg xs:rounded-xl p-3 border border-purple-500/20">
              <div className="text-[10px] xs:text-xs text-purple-300 mb-1 whitespace-nowrap">스킬 포인트</div>
              <div className="text-xl xs:text-2xl font-bold text-white">{profile?.skill_points || 0}</div>
              <div className="text-[9px] xs:text-[10px] text-gray-500">pt</div>
            </div>
          </div>
        </SpotlightCard>

        {/* 빠른 관리 메뉴 */}
        <div>
          <h3 className="text-sm xs:text-base font-bold text-white mb-2 xs:mb-3">빠른 메뉴</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 xs:gap-3">
            <button
              onClick={() => setActiveTab('attendance')}
              className="p-3 xs:p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 rounded-xl transition-all text-left group"
            >
              <div className="text-xl xs:text-2xl mb-1.5">📋</div>
              <div className="text-xs xs:text-sm font-bold text-white">출석 관리</div>
              <div className="text-[10px] xs:text-xs text-gray-500 mt-0.5">회원 출석 확인</div>
            </button>

            <button
              onClick={() => setActiveTab('approval')}
              className="p-3 xs:p-4 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 rounded-xl transition-all text-left group"
            >
              <div className="text-xl xs:text-2xl mb-1.5">✅</div>
              <div className="text-xs xs:text-sm font-bold text-white">스킬 승인</div>
              <div className="text-[10px] xs:text-xs text-gray-500 mt-0.5">승인 요청 처리</div>
            </button>

            <button
              onClick={() => setActiveTab('players')}
              className="p-3 xs:p-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition-all text-left group"
            >
              <div className="text-xl xs:text-2xl mb-1.5">👥</div>
              <div className="text-xs xs:text-sm font-bold text-white">회원 관리</div>
              <div className="text-[10px] xs:text-xs text-gray-500 mt-0.5">선수 목록 확인</div>
            </button>

            <button
              onClick={() => setActiveTab('insights')}
              className="p-3 xs:p-4 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 hover:border-orange-500/40 rounded-xl transition-all text-left group"
            >
              <div className="text-xl xs:text-2xl mb-1.5">📊</div>
              <div className="text-xs xs:text-sm font-bold text-white">코치 인사이트</div>
              <div className="text-[10px] xs:text-xs text-gray-500 mt-0.5">훈련 분석 보기</div>
            </button>

            <button
              onClick={() => setActiveTab('match')}
              className="p-3 xs:p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all text-left group"
            >
              <div className="text-xl xs:text-2xl mb-1.5">🥊</div>
              <div className="text-xs xs:text-sm font-bold text-white">경기 관리</div>
              <div className="text-[10px] xs:text-xs text-gray-500 mt-0.5">경기 일정 확인</div>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className="p-3 xs:p-4 bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/20 hover:border-gray-500/40 rounded-xl transition-all text-left group"
            >
              <div className="text-xl xs:text-2xl mb-1.5">⚙️</div>
              <div className="text-xs xs:text-sm font-bold text-white">관리자 설정</div>
              <div className="text-[10px] xs:text-xs text-gray-500 mt-0.5">체육관 설정</div>
            </button>
          </div>
        </div>

        {/* 출석 캘린더 - 체육관도 확인 가능 */}
        <SpotlightCard className="p-4 xs:p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3 xs:mb-4">
            <h3 className="text-sm xs:text-base font-bold text-white">출석 캘린더</h3>
            <div className="flex items-center gap-1.5 xs:gap-2">
              <button
                onClick={() => {
                  if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
                  else setCurrentMonth(m => m - 1);
                }}
                className="w-6 h-6 xs:w-7 xs:h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs"
              >‹</button>
              <span className="text-xs xs:text-sm font-bold text-white whitespace-nowrap">
                {currentYear}년 {currentMonth + 1}월
              </span>
              <button
                onClick={() => {
                  if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
                  else setCurrentMonth(m => m + 1);
                }}
                className="w-6 h-6 xs:w-7 xs:h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs"
              >›</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 xs:gap-1">
            {['월','화','수','목','금','토','일'].map(d => (
              <div key={d} className="text-center text-[9px] xs:text-[10px] text-gray-500 py-1 font-medium">{d}</div>
            ))}
            {calendarDays.map((day, i) => (
              <div
                key={i}
                className={`aspect-square flex items-center justify-center rounded-md xs:rounded-lg text-[10px] xs:text-xs font-medium transition-all
                  ${!day ? '' :
                    attendanceDays.includes(day) ? 'bg-purple-500/30 text-purple-300 border border-purple-500/30' :
                    day === today && currentMonth === new Date().getMonth() ? 'bg-white/10 text-white border border-white/20' :
                    'text-gray-400'
                  }`}
              >
                {day}
              </div>
            ))}
          </div>
        </SpotlightCard>
      </div>
    );
  }
  // ── 체육관 전용 대시보드 끝 ──────────────────────────────

  return (
    <div className="animate-fade-in-up space-y-3 xs:space-y-4 sm:space-y-6">
      {/* 헤더 */}
      <div className="mb-4 xs:mb-6 sm:mb-8">
        <div className="flex items-center gap-1.5 xs:gap-2 mb-1.5 xs:mb-2 flex-wrap">
          <h2 className="text-xl xs:text-2xl sm:text-3xl font-bold text-white">
            {t('hi')}, {profile?.nickname || profile?.name || '사용자'} {profile?.role ? t(profile.role) : ''}!
          </h2>
        </div>
        <p className="text-xs xs:text-sm text-gray-500">{t('todayActivity')}</p>
      </div>

      {/* 실시간 랭킹 헤드라인 */}
      {rankingNews.length > 0 && (
        <div className="overflow-hidden bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/30 rounded-lg xs:rounded-xl relative">
          <div className="absolute left-1.5 xs:left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10">
            <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 bg-black/50 backdrop-blur-sm px-1.5 xs:px-2 sm:px-3 py-0.5 xs:py-1 rounded-md xs:rounded-lg">
              <span className="w-1.5 h-1.5 xs:w-2 xs:h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold text-gray-300">LIVE</span>
            </div>
          </div>
          <div className="relative h-12 xs:h-14 sm:h-16 flex items-center justify-center">
            <div 
              className="absolute left-0 right-0 transition-transform duration-700 ease-in-out"
              style={{ 
                transform: `translateY(-${currentNewsIndex * (typeof window !== 'undefined' && window.innerWidth < 375 ? 48 : window.innerWidth < 640 ? 56 : 64)}px)` 
              }}
            >
              {rankingNews.map((news, index) => (
                <div
                  key={index}
                  className="h-12 xs:h-14 sm:h-16 flex items-center justify-center px-3 xs:px-4 sm:px-6"
                >
                  <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                    <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2">
                      <span className="text-base xs:text-lg sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">
                        #{news.rank}
                      </span>
                      <span className="text-sm xs:text-base sm:text-lg font-bold text-white truncate max-w-[80px] xs:max-w-none">{news.name}</span>
                    </div>
                    <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2">
                      <span className="px-1.5 xs:px-2 py-0.5 xs:py-1 rounded-md xs:rounded-lg bg-blue-500/20 text-blue-400 text-[9px] xs:text-[10px] sm:text-xs font-bold whitespace-nowrap">
                        {news.tier}
                      </span>
                      <div className={`flex items-center gap-0.5 xs:gap-1 px-1.5 xs:px-2 py-0.5 xs:py-1 rounded-md xs:rounded-lg text-[9px] xs:text-[10px] sm:text-xs font-bold ${
                        news.type === 'up' ? 'bg-emerald-500/20 text-emerald-400' :
                        news.type === 'down' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {news.type === 'up' ? '↑' : news.type === 'down' ? '↓' : '━'}
                        <span>{news.change}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute right-1.5 xs:right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10">
            <div className="text-[9px] xs:text-[10px] sm:text-xs text-gray-400 bg-black/50 backdrop-blur-sm px-1.5 xs:px-2 sm:px-3 py-0.5 xs:py-1 rounded-md xs:rounded-lg font-bold whitespace-nowrap">
              {t('liveRanking')}
            </div>
          </div>
        </div>
      )}

      {/* 메인 컨텐츠 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 xs:gap-4 sm:gap-6">
        {/* 왼쪽: Workout Results */}
        <div className="lg:col-span-2 space-y-3 xs:space-y-4">
          <SpotlightCard className="p-3 xs:p-4 sm:p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
            {/* 선수 프로필 헤더 */}
            <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 mb-4 xs:mb-5 sm:mb-6 pb-3 xs:pb-4 border-b border-white/5">
              <div className="w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-xl xs:rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl xs:text-3xl shadow-lg border-2 border-blue-400/50 flex-shrink-0">
                <span>{(profile?.nickname || profile?.name || 'U').charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 mb-1 xs:mb-1.5 sm:mb-2 flex-wrap">
                  <h3 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold text-white truncate">{profile?.nickname || profile?.name || '사용자'}</h3>
                  <span className={`px-2 py-0.5 xs:px-2.5 xs:py-1 sm:px-3 rounded-full text-[10px] xs:text-xs sm:text-sm font-bold shadow-lg whitespace-nowrap ${
                    profile?.role === 'player_common' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    profile?.role === 'player_athlete' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    profile?.role === 'gym' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                    'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {profile?.role ? t(profile.role) : t('player_common')}
                  </span>
                </div>
                <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-[10px] xs:text-xs sm:text-sm text-gray-400 flex-wrap">
                  {(profile?.role === 'player_common' || profile?.role === 'player_athlete') && profile?.tier && (
                    <>
                      <span className="font-bold text-yellow-400 whitespace-nowrap">{profile.tier}</span>
                      <span className="hidden xs:inline">•</span>
                      <span className="whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs">{profile?.tier_points || 0} {t('points') || '포인트'}</span>
                      <span className="hidden xs:inline">•</span>
                    </>
                  )}
                  {profile?.boxing_style && (
                    <>
                      <span className="whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs">{profile.boxing_style}</span>
                      <span className="hidden xs:inline">•</span>
                    </>
                  )}
                  {(profile?.height || profile?.weight) && (
                    <>
                      <span className="whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs">
                        {profile?.height && `${profile.height}cm`}
                        {profile?.height && profile?.weight && ' / '}
                        {profile?.weight && `${profile.weight}kg`}
                      </span>
                      {profile?.gym_name && <span className="hidden xs:inline">•</span>}
                    </>
                  )}
                  {profile?.gym_name && (
                    <span className="whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs">{profile.gym_name}</span>
                  )}
                </div>
              </div>
            </div>

            {/* 핵심 전적 - 4개의 주요 지표 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3 mb-4 xs:mb-5 sm:mb-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-lg xs:rounded-xl p-2 xs:p-2.5 sm:p-3 border border-blue-500/20">
                <div className="text-[9px] xs:text-[10px] sm:text-xs text-blue-300 mb-0.5 xs:mb-1 whitespace-nowrap truncate">{t('totalMatches')}</div>
                <div className="text-lg xs:text-xl sm:text-2xl font-bold text-white">{statistics?.total_matches || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-lg xs:rounded-xl p-2 xs:p-2.5 sm:p-3 border border-emerald-500/20">
                <div className="text-xs text-emerald-300 mb-1 whitespace-nowrap">{t('record')}</div>
                <div className="text-lg font-bold text-white">
                  {statistics?.wins || 0}{t('win')} {statistics?.draws || 0}{t('draw')} {statistics?.losses || 0}{t('loss')}
                </div>
                <div className="text-xs text-emerald-400 mt-1">
                  {t('winRate')} {statistics ? ((statistics.wins / (statistics.total_matches || 1)) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-3 border border-red-500/20">
                <div className="text-xs text-red-300 mb-1 whitespace-nowrap">{t('koWins')}</div>
                <div className="text-2xl font-bold text-red-400">{statistics?.ko_wins || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-3 border border-purple-500/20">
                <div className="text-xs text-purple-300 mb-1 whitespace-nowrap">{t('winStreak')}</div>
                <div className="text-2xl font-bold text-purple-400">{statistics?.current_win_streak || 0}</div>
              </div>
            </div>

            {/* 복싱 스타일 (선수만) */}
            {profile?.boxing_style && (
              <div className="mb-6">
                <h4 className="text-sm font-bold text-white mb-3">{t('boxingStyle')}</h4>
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                      <span className="text-xl">🥊</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('mainStyle')}</div>
                      <div className="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{profile.boxing_style}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 신체 정보 (일반회원, 선수 공통) */}
            {(profile?.height || profile?.weight || profile?.gender) && (
              <div className="mb-6">
                <h4 className="text-sm font-bold text-white mb-3">{t('bodyInfo')}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* 키 */}
                  {profile?.height && (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <span className="text-xl">📏</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('height') || '키'}</div>
                          <div className="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{profile.height}cm</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 몸무게 */}
                  {profile?.weight && (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                          <span className="text-xl">⚖️</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('weight') || '체중'}</div>
                          <div className="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{profile.weight}kg</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 성별 */}
                  {profile?.gender && (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                          <span className="text-xl">👤</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('gender') || '성별'}</div>
                          <div className="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">
                            {profile.gender === 'male' ? (t('male') || '남성') : (t('female') || '여성')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 최근 경기 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white">최근 경기</h4>
                {matchHistory.length > 3 && (
                  <button 
                    onClick={() => {
                      const matchHistorySection = document.getElementById('match-history-section');
                      if (matchHistorySection) {
                        matchHistorySection.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    전체 보기 →
                  </button>
                )}
              </div>
              {matchLoading ? (
                <div className="bg-white/5 rounded-lg p-8 text-center border border-white/5 text-gray-400 text-sm">
                  경기 기록을 불러오는 중입니다...
                </div>
              ) : matchError ? (
                <div className="bg-red-500/10 rounded-lg p-8 text-center border border-red-500/30">
                  <p className="text-red-300 text-sm mb-3">{matchError}</p>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('matches:changed', { detail: { userId: user?.id } }))}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              ) : matchHistory.length > 0 ? (
                <div className="space-y-2">
                  {matchHistory.slice(0, 3).map((match, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                          match.result === 'win' ? 'bg-blue-500/20 text-blue-400' :
                          match.result === 'loss' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : 'D'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!match.opponentId) return;
                                setActiveTab(`opponent-profile-${match.opponentId}`);
                              }}
                              className="text-sm font-bold text-white hover:text-blue-400 transition-colors truncate disabled:opacity-60 disabled:cursor-not-allowed"
                              disabled={!match.opponentId}
                            >
                              vs. {match.opponent}
                            </button>
                            <span className="text-xs text-gray-500 whitespace-nowrap">{match.date}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{match.method}</span>
                            <span className="text-xs text-gray-500">•</span>
                            <span className={`text-xs font-bold ${
                              match.result === 'win' ? 'text-blue-400' :
                              match.result === 'loss' ? 'text-red-400' :
                              'text-gray-400'
                            }`}>
                              {match.score}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {match.rounds}R
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              ) : (
                <div className="bg-white/5 rounded-lg p-8 text-center border border-white/5">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <Icon type="trophy" size={32} className="text-gray-500" />
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{t('noMatchRecords')}</p>
                  <p className="text-gray-500 text-xs">{t('startFirstMatch')}</p>
                </div>
              )}
            </div>
          </SpotlightCard>
        </div>

        {/* 오른쪽: Training Days Calendar */}
        <div>
          <SpotlightCard className="p-6 bg-[#1a1a1a] h-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{t('trainingDays')}</h3>
              <button 
                onClick={() => setCalendarViewMode(calendarViewMode === 'day' ? 'month' : 'day')}
                className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span className="text-sm text-gray-400">
                  {calendarViewMode === 'day' ? `${currentYear}${t('year')} ${monthNames[lang][currentMonth]}` : `${currentYear}${t('year')}`}
                </span>
                <Icon type="calendar" size={16} className="text-gray-400" />
              </button>
            </div>

            {/* 월 선택 모드 */}
            {calendarViewMode === 'month' && (
              <div className="animate-fade-in">
                {/* 년도 네비게이션 */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                  <button 
                    onClick={() => setCurrentYear(currentYear - 1)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <Icon type="chevronLeft" size={20} className="text-gray-400" />
                  </button>
                  <span className="text-xl font-bold text-white">{currentYear}{t('year')}</span>
                  <button 
                    onClick={() => setCurrentYear(currentYear + 1)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <Icon type="chevronRight" size={20} className="text-gray-400" />
                  </button>
                </div>

                {/* 12개월 선택 */}
                <div className="grid grid-cols-3 gap-3">
                  {monthNames[lang].map((month, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentMonth(idx);
                        setCalendarViewMode('day');
                      }}
                      className={`p-4 rounded-lg transition-all ${
                        currentMonth === idx
                          ? 'bg-blue-500 text-white font-bold shadow-lg scale-105'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white hover:scale-105'
                      }`}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 일별 달력 모드 */}
            {calendarViewMode === 'day' && (
              <div className="animate-fade-in">
                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                  {daysOfWeek[lang].map((day, i) => (
                    <div key={i} className="text-center text-[10px] sm:text-xs text-gray-500 font-medium">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* 날짜 그리드 */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-4 sm:mb-6">
                  {calendarDays.map((day, i) => {
                    const isToday = day === today;
                    const hasWorkout = workoutDays.includes(day);
                    const hasAttendance = attendanceDays.includes(day);
                    
                    return (
                      <button
                        key={i}
                        onClick={() => day && handleDateClick(day)}
                        disabled={!day}
                        className={`aspect-square flex items-center justify-center text-xs sm:text-sm rounded-lg transition-all relative ${
                          day === null
                            ? 'invisible'
                            : isToday
                            ? 'bg-blue-500 text-white font-bold cursor-pointer hover:bg-blue-600 shadow-lg ring-2 ring-blue-400/50'
                            : hasWorkout
                            ? 'bg-yellow-400/80 text-black font-bold cursor-pointer hover:bg-yellow-500 shadow-md'
                            : hasAttendance
                            ? 'bg-emerald-500/70 text-white font-medium cursor-pointer hover:bg-emerald-600 shadow-md'
                            : 'text-gray-300 hover:bg-white/10 cursor-pointer hover:text-white'
                        }`}
                      >
                        {day}
                        {/* 오늘 표시 */}
                        {isToday && (
                          <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white animate-pulse"></div>
                        )}
                        {/* 운동/출석 표시 작은 점 */}
                        {!isToday && hasWorkout && (
                          <div className="absolute bottom-0.5 sm:bottom-1 left-1/2 transform -translate-x-1/2 w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-black"></div>
                        )}
                        {!isToday && hasAttendance && !hasWorkout && (
                          <div className="absolute bottom-0.5 sm:bottom-1 left-1/2 transform -translate-x-1/2 w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-white"></div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 하단 범례 */}
                <div className="space-y-2 text-xs pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-lg bg-blue-500 ring-2 ring-blue-400/50"></div>
                    <span className="text-gray-400">오늘</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-lg bg-yellow-400/80"></div>
                    <span className="text-gray-400">운동 완료</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-lg bg-emerald-500/70"></div>
                    <span className="text-gray-400">출석</span>
                  </div>
                </div>
              </div>
            )}
          </SpotlightCard>
        </div>
      </div>

      {/* 하단 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 xs:gap-4 sm:gap-6">
        {/* Tier Points */}
        <div>
          <SpotlightCard 
            className="p-3 xs:p-4 sm:p-6 bg-[#1a1a1a] cursor-pointer hover:bg-[#1e1e1e] transition-all"
            onClick={() => setActiveTab && setActiveTab('dashboard-steps')}
          >
            <div className="mb-3 xs:mb-4">
              <h3 className="text-sm xs:text-base sm:text-lg font-bold text-white mb-0.5 xs:mb-1">{t('tierPoints')}</h3>
              <p className="text-[10px] xs:text-xs text-gray-500">{t('tierProgress')}</p>
            </div>

            <div className="flex items-center justify-center py-4 xs:py-6 sm:py-8 relative">
              {/* 원형 프로그레스 */}
              <svg className="w-24 h-24 xs:w-28 xs:h-28 sm:w-32 sm:h-32 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-white/10 xs:hidden"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  stroke="currentColor"
                  strokeWidth="7"
                  fill="none"
                  className="text-white/10 hidden xs:block sm:hidden"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-white/10 hidden sm:block"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - ((profile?.tier_points || 0) / 1000))}`}
                  stroke="url(#tierGradient)"
                  strokeLinecap="round"
                  className="xs:hidden"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  strokeWidth="7"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 48}`}
                  strokeDashoffset={`${2 * Math.PI * 48 * (1 - ((profile?.tier_points || 0) / 1000))}`}
                  stroke="url(#tierGradient)"
                  strokeLinecap="round"
                  className="hidden xs:block sm:hidden"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - ((profile?.tier_points || 0) / 1000))}`}
                  stroke="url(#tierGradient)"
                  strokeLinecap="round"
                  className="hidden sm:block"
                />
                <defs>
                  <linearGradient id="tierGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute flex flex-col items-center">
                <div className="text-[10px] xs:text-xs text-gray-400 whitespace-nowrap">{profile?.tier || 'Bronze III'}</div>
                <div className="text-xl xs:text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                  {profile?.tier_points || 0}
                </div>
                <div className="text-[10px] xs:text-xs text-gray-500 mt-0.5 xs:mt-1">/ 1,000</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 xs:gap-3 mt-3 xs:mt-4">
              <div className="p-2 xs:p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/30 text-center">
                <div className="text-[10px] xs:text-xs text-gray-400 mb-0.5 xs:mb-1 whitespace-nowrap">{t('nextTier')}</div>
                <div className="text-xs xs:text-sm font-bold text-blue-400 whitespace-nowrap truncate">
                  {profile?.tier === 'Bronze III' ? 'Bronze II' : 
                   profile?.tier === 'Bronze II' ? 'Bronze I' :
                   profile?.tier === 'Bronze I' ? 'Silver III' : 'Next Tier'}
                </div>
              </div>
              <div className="p-2 xs:p-3 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-lg border border-emerald-500/30 text-center">
                <div className="text-[10px] xs:text-xs text-gray-400 mb-0.5 xs:mb-1 whitespace-nowrap">{t('pointsNeeded')}</div>
                <div className="text-base xs:text-lg font-bold text-emerald-400">
                  +{Math.max(0, 1000 - (profile?.tier_points || 0))}
                </div>
              </div>
            </div>
          </SpotlightCard>
        </div>

        {/* Match History */}
        <div className="lg:col-span-2" id="match-history-section">
          <SpotlightCard 
            className="p-3 xs:p-4 sm:p-6 bg-[#1a1a1a] transition-all"
          >
            <div className="flex items-center justify-between mb-3 xs:mb-4 sm:mb-6 gap-2">
              <h3 className="text-sm xs:text-base sm:text-lg font-bold text-white">{t('matchHistory')}</h3>
              {matchHistory.length > 0 && (
                <button className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg text-[10px] xs:text-xs sm:text-sm text-white font-bold transition-all hover:scale-105 flex items-center gap-1 xs:gap-2 whitespace-nowrap">
                  {t('viewHistory')} <Icon type="arrowRight" size={12} className="xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>

            {matchLoading ? (
              <div className="text-center py-8 xs:py-10 sm:py-12 text-gray-400 text-sm">
                경기 기록을 불러오는 중입니다...
              </div>
            ) : matchError ? (
              <div className="text-center py-8 xs:py-10 sm:py-12">
                <h4 className="text-sm xs:text-base sm:text-lg font-bold text-red-300 mb-2">{matchError}</h4>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('matches:changed', { detail: { userId: user?.id } }))}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors"
                >
                  다시 시도
                </button>
              </div>
            ) : matchHistory.length > 0 ? (
              <div className="space-y-2 xs:space-y-3">
                {matchHistory.map((match, i) => (
                  <div key={i} className="bg-gradient-to-r from-white/5 to-white/[0.02] rounded-lg overflow-hidden hover:from-white/10 hover:to-white/5 transition-all border border-white/5 hover:border-white/20">
                    <div className="flex items-center justify-between p-2 xs:p-3 sm:p-4 gap-2 xs:gap-3">
                      <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className="w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 rounded-lg xs:rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center text-base xs:text-xl sm:text-2xl flex-shrink-0">
                          {match.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 xs:gap-2 mb-0.5 xs:mb-1 flex-wrap">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!match.opponentId) return;
                                setActiveTab(`opponent-profile-${match.opponentId}`);
                              }}
                              className="font-bold text-white text-xs xs:text-sm sm:text-base hover:text-blue-400 transition-colors underline decoration-transparent hover:decoration-blue-400 truncate disabled:opacity-60 disabled:cursor-not-allowed"
                              disabled={!match.opponentId}
                            >
                              vs. {match.opponent}
                            </button>
                            <span className={`px-1.5 xs:px-2 py-0.5 rounded-full text-[9px] xs:text-[10px] font-bold flex-shrink-0 ${
                              match.result === 'win' ? 'bg-blue-500/20 text-blue-400' : 
                              match.result === 'loss' ? 'bg-red-500/20 text-red-400' : 
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {match.result === 'win' ? t('win') : match.result === 'loss' ? t('loss') : t('draw')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-[10px] xs:text-xs text-gray-400 flex-wrap">
                            <span className="whitespace-nowrap">{match.date}</span>
                            <span className="hidden xs:inline">•</span>
                            <span className="whitespace-nowrap">{match.method}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="whitespace-nowrap hidden sm:inline">{match.weight}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 flex-shrink-0">
                        <div className="text-center">
                          <div className={`text-base xs:text-xl sm:text-2xl font-bold ${
                            match.result === 'win' ? 'text-blue-400' : 
                            match.result === 'loss' ? 'text-red-400' : 
                            'text-gray-400'
                          }`}>
                            {match.score}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">{match.rounds}R</div>
                        </div>
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center border ${
                          match.result === 'win' ? 'from-blue-500/20 to-cyan-500/10 border-blue-500/30' : 
                          match.result === 'loss' ? 'from-red-500/20 to-orange-500/10 border-red-500/30' : 
                          'from-white/5 to-white/10 border-white/10'
                        }`}>
                          <div className={`text-xl font-bold ${
                            match.result === 'win' ? 'text-blue-400' : 
                            match.result === 'loss' ? 'text-red-400' : 
                            'text-gray-400'
                          }`}>
                            {match.result === 'win' ? '승' : match.result === 'loss' ? '패' : '무'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 xs:py-10 sm:py-12">
                <div className="w-12 h-12 xs:w-16 xs:h-16 sm:w-20 sm:h-20 mx-auto mb-3 xs:mb-4 sm:mb-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                  <Icon type="trophy" size={24} className="xs:w-8 xs:h-8 sm:w-10 sm:h-10 text-gray-500" />
                </div>
                <h4 className="text-sm xs:text-base sm:text-lg font-bold text-white mb-1 xs:mb-2">아직 경기 기록이 없습니다</h4>
                <p className="text-[10px] xs:text-xs sm:text-sm text-gray-500">첫 경기를 시작하고 기록을 쌓아보세요!</p>
              </div>
            )}
          </SpotlightCard>
        </div>
      </div>

      {/* 운동 모달 */}
      {showWorkoutModal && selectedDate && workoutData[selectedDate] && !showDetailPage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowWorkoutModal(false)}
        >
          <div 
            className="bg-[#0A0A0A] border border-white/20 rounded-2xl max-w-[95vw] sm:max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">
                    {workoutData[selectedDate].date} ({workoutData[selectedDate].dayOfWeek})
                  </h2>
                  <p className="text-gray-400">복싱 훈련 요약</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowDetailPage(true)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all hover:scale-105"
                  >
                    📊 자세히 보기
                  </button>
                  <button 
                    onClick={() => setShowWorkoutModal(false)}
                    className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                  >
                    <span className="text-2xl">✕</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* 통계 카드 */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="text-sm text-gray-400 mb-1">총 훈련 시간</div>
                  <div className="text-2xl font-bold text-blue-400">{workoutData[selectedDate].totalTime}분</div>
                </div>
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="text-sm text-gray-400 mb-1">소모 칼로리</div>
                  <div className="text-2xl font-bold text-red-400">{workoutData[selectedDate].calories}kcal</div>
                </div>
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                  <div className="text-sm text-gray-400 mb-1">훈련 종목</div>
                  <div className="text-2xl font-bold text-purple-400">{workoutData[selectedDate].exercises.length}개</div>
                </div>
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="text-sm text-gray-400 mb-1">만족도</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {'⭐'.repeat(workoutData[selectedDate].satisfaction || 0)}
                  </div>
                </div>
              </div>

              {/* 운동 리스트 */}
              <div className="space-y-4 mb-6">
                {workoutData[selectedDate].exercises.map((exercise, idx) => (
                  <div key={idx} className="p-5 bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 rounded-xl hover:border-white/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{exercise.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-xl font-bold text-white">{exercise.name}</h4>
                          {exercise.intensity && (
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              exercise.intensity === 'very-high' ? 'bg-red-500/20 text-red-400' :
                              exercise.intensity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              exercise.intensity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {exercise.intensity === 'very-high' ? '매우 높음' :
                               exercise.intensity === 'high' ? '높음' :
                               exercise.intensity === 'medium' ? '중간' : '낮음'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          {exercise.duration && <span>⏱️ {exercise.duration}분</span>}
                          {exercise.sets && <span>🔢 {exercise.sets} 세트</span>}
                          {exercise.distance && <span>📏 {exercise.distance}km</span>}
                          {exercise.calories && <span>🔥 {exercise.calories}kcal</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 메모 */}
              <div className="p-5 bg-white/5 border border-white/10 rounded-xl mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">📝</span>
                  <h4 className="text-lg font-bold text-white">메모</h4>
                </div>
                <p className="text-gray-300">{workoutData[selectedDate].note}</p>
              </div>

              {/* 담당 코치 */}
              {workoutData[selectedDate].coach && (
                <div className="p-5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                      {workoutData[selectedDate].coach.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">담당 코치</div>
                      <div className="text-xl font-bold text-white">{workoutData[selectedDate].coach}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 상세 페이지 */}
      {showDetailPage && selectedDate && workoutData[selectedDate] && (
        <div className="fixed inset-0 bg-black z-50 overflow-y-auto">
          <div className="min-h-screen p-6">
            <div className="max-w-7xl mx-auto">
              {/* 헤더 */}
              <div className="mb-6 flex items-center justify-between">
                <button 
                  onClick={() => setShowDetailPage(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                >
                  <Icon type="arrowLeft" size={20} className="text-white" />
                  <span className="text-white">{t('backButton')}</span>
                </button>
                <h1 className="text-3xl font-bold text-white">
                  🗓️ {workoutData[selectedDate].date} ({workoutData[selectedDate].dayOfWeek}) 상세 리포트
                </h1>
                <div className="w-32"></div> {/* 레이아웃 균형 */}
              </div>

              {/* 전체 통계 */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <SpotlightCard className="p-5 border-l-4 border-blue-500">
                  <div className="text-sm text-gray-400 mb-1">총 운동 시간</div>
                  <div className="text-3xl font-bold text-white">{workoutData[selectedDate].totalTime}분</div>
                </SpotlightCard>
                <SpotlightCard className="p-3 sm:p-4 border-l-4 border-red-500">
                  <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5">소모 칼로리</div>
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white whitespace-nowrap">{workoutData[selectedDate].calories}kcal</div>
                </SpotlightCard>
                <SpotlightCard className="p-3 sm:p-4 border-l-4 border-purple-500">
                  <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5">운동 종목</div>
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white whitespace-nowrap">{workoutData[selectedDate].exercises.length}개</div>
                </SpotlightCard>
                <SpotlightCard className="p-3 sm:p-4 border-l-4 border-yellow-500">
                  <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5">만족도</div>
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                    {'⭐'.repeat(workoutData[selectedDate].satisfaction || 0)}
                  </div>
                </SpotlightCard>
              </div>

              {/* 운동 상세 */}
              <SpotlightCard className="p-3 sm:p-5 mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white mb-3 sm:mb-5">📋 운동 상세 내역</h3>
                <div className="space-y-3 sm:space-y-5">
                  {workoutData[selectedDate].exercises.map((exercise, idx) => (
                    <div key={idx} className="p-3 sm:p-5 bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 rounded-lg sm:rounded-xl">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="text-2xl sm:text-3xl lg:text-4xl">{exercise.icon}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base lg:text-lg font-bold text-white mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{exercise.name}</h4>
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            {exercise.intensity && (
                              <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold whitespace-nowrap ${
                                exercise.intensity === 'very-high' ? 'bg-red-500/20 text-red-400' :
                                exercise.intensity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                exercise.intensity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {exercise.intensity === 'very-high' ? '매우 높음' :
                                 exercise.intensity === 'high' ? '높음' :
                                 exercise.intensity === 'medium' ? '중간' : '낮음'}
                              </span>
                            )}
                            {exercise.duration && <span className="text-gray-400 text-[10px] sm:text-xs whitespace-nowrap">{exercise.duration}분</span>}
                          </div>
                        </div>
                      </div>

                      {/* 세부 정보 */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-2 sm:mt-3">
                        {exercise.sets && (
                          <div className="p-2 sm:p-3 bg-blue-500/10 rounded-lg">
                            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">세트</div>
                            <div className="text-base sm:text-lg font-bold text-blue-400">{exercise.sets}</div>
                          </div>
                        )}
                        {exercise.reps && (
                          <div className="p-2 sm:p-3 bg-purple-500/10 rounded-lg">
                            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">총 반복</div>
                            <div className="text-base sm:text-lg font-bold text-purple-400">{exercise.reps}</div>
                          </div>
                        )}
                        {exercise.weight && (
                          <div className="p-2 sm:p-3 bg-red-500/10 rounded-lg">
                            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">중량</div>
                            <div className="text-base sm:text-lg font-bold text-red-400">{exercise.weight}</div>
                          </div>
                        )}
                        {exercise.totalWeight && (
                          <div className="p-2 sm:p-3 bg-orange-500/10 rounded-lg">
                            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">총 중량</div>
                            <div className="text-base sm:text-lg font-bold text-orange-400 whitespace-nowrap">{exercise.totalWeight}kg</div>
                          </div>
                        )}
                        {exercise.distance && (
                          <div className="p-2 sm:p-3 bg-emerald-500/10 rounded-lg">
                            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">거리</div>
                            <div className="text-base sm:text-lg font-bold text-emerald-400 whitespace-nowrap">{exercise.distance}km</div>
                          </div>
                        )}
                        {exercise.calories && (
                          <div className="p-2 sm:p-3 bg-red-500/10 rounded-lg">
                            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">칼로리</div>
                            <div className="text-base sm:text-lg font-bold text-red-400 whitespace-nowrap">{exercise.calories}kcal</div>
                          </div>
                        )}
                        {exercise.pace && (
                          <div className="p-2 sm:p-3 bg-cyan-500/10 rounded-lg">
                            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">페이스</div>
                            <div className="text-base sm:text-lg font-bold text-cyan-400 whitespace-nowrap">{exercise.pace}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SpotlightCard>

              {/* 메모 및 코치 */}
              <div className="grid grid-cols-2 gap-6">
                <SpotlightCard className="p-6">
                  <h3 className="text-xl font-bold text-white mb-4">📝 메모</h3>
                  <div className="p-4 bg-white/5 rounded-lg text-gray-300">
                    {workoutData[selectedDate].note}
                  </div>
                </SpotlightCard>

                {workoutData[selectedDate].coach && (
                  <SpotlightCard className="p-6">
                    <h3 className="text-xl font-bold text-white mb-4">👨‍🏫 담당 코치</h3>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
                        {workoutData[selectedDate].coach.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xl font-bold text-white">{workoutData[selectedDate].coach}</div>
                        <div className="text-sm text-gray-400">담당 코치</div>
                      </div>
                    </div>
                  </SpotlightCard>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { DashboardView };

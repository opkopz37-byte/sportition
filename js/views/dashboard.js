// 대시보드 뷰
const { useState, useEffect, useRef } = React;

const DashboardView = ({ setActiveTab, t = (key) => key, role = 'athlete' }) => {
  const [currentYear, setCurrentYear] = useState(2024);
  const [currentMonth, setCurrentMonth] = useState(5); // 0-11 (June = 5)
  const [calendarViewMode, setCalendarViewMode] = useState('day'); // 'month' or 'day'
  const [selectedDate, setSelectedDate] = useState(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showDetailPage, setShowDetailPage] = useState(false);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  
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
  const attendanceDays = [5, 12, 17, 19, 23]; // 출석한 날
  const workoutDays = [5, 12, 17, 19, 23]; // 운동한 날 (출석 중 일부)
  const today = new Date().getDate(); // 실제 오늘 날짜

  // 샘플 훈련 데이터 (상세 정보 포함)
  const workoutData = {
    5: {
      date: '2024-06-05',
      dayOfWeek: '수요일',
      totalTime: 120,
      calories: 850,
      exercises: [
        { name: '헤비백', sets: 5, reps: 50, rounds: '5라운드', duration: 40, intensity: 'high', icon: '🥊' },
        { name: '스피드백', sets: 4, reps: 100, rounds: '4라운드', duration: 30, intensity: 'high', icon: '⚡' },
        { name: '미트 트레이닝', rounds: '3라운드', duration: 35, intensity: 'very-high', icon: '🎯' },
        { name: '쿨다운 & 스트레칭', duration: 15, type: '회복', intensity: 'low', icon: '🧘' }
      ],
      note: '오늘 펀치 스피드 신기록! 스피드백 완벽 수행',
      coach: '김코치',
      satisfaction: 5,
    },
    12: {
      date: '2024-06-12',
      dayOfWeek: '수요일',
      totalTime: 60,
      calories: 420,
      exercises: [
        { name: '섀도우 복싱', rounds: '5라운드', duration: 25, intensity: 'medium', icon: '👤' },
        { name: '풋워크 드릴', rounds: '4라운드', duration: 20, intensity: 'medium', icon: '👟' },
        { name: '쿨다운', duration: 15, type: '회복', intensity: 'low', icon: '🌊' }
      ],
      note: '발놀림과 스텝 집중 훈련',
      coach: '이코치',
      satisfaction: 4,
    },
    17: {
      date: '2024-06-17',
      dayOfWeek: '월요일',
      totalTime: 75,
      calories: 580,
      exercises: [
        { name: '로드워크', duration: 30, distance: 5.2, pace: '5:46/km', calories: 350, intensity: 'medium', icon: '🏃' },
        { name: '코어 강화', sets: 4, reps: 20, duration: 30, intensity: 'high', icon: '💪' },
        { name: '스트레칭', duration: 15, type: '유연성', intensity: 'low', icon: '🕉️' }
      ],
      note: '컨디셔닝과 체력 훈련',
      coach: '박코치',
      satisfaction: 5,
    },
    19: {
      date: '2024-06-19',
      dayOfWeek: '수요일',
      totalTime: 90,
      calories: 620,
      exercises: [
        { name: '스파링', rounds: '6라운드', opponent: '이준호', duration: 35, intensity: 'high', icon: '🥊' },
        { name: '디펜스 드릴', sets: 3, reps: 15, duration: 25, intensity: 'medium', icon: '🛡️' },
        { name: '카운터 연습', sets: 3, reps: 12, duration: 20, intensity: 'medium', icon: '🎯' },
        { name: '쿨다운', duration: 10, type: '회복', intensity: 'low', icon: '🧘' }
      ],
      note: '방어 기술 및 카운터 집중 훈련',
      coach: '최코치',
      satisfaction: 4,
    },
    23: {
      date: '2024-06-23',
      dayOfWeek: '일요일',
      totalTime: 105,
      calories: 780,
      exercises: [
        { name: '미트 트레이닝', rounds: '5라운드', totalPunches: 500, duration: 40, intensity: 'very-high', icon: '🎯' },
        { name: '헤비백 파워', rounds: '4라운드', duration: 30, intensity: 'high', icon: '💥' },
        { name: '스피드 콤비네이션', rounds: '3라운드', duration: 25, intensity: 'medium', icon: '⚡' },
        { name: '로드워크', duration: 10, type: '워밍업', intensity: 'low', icon: '🏃' }
      ],
      note: '펀치력 집중 데이. 개인 최고 기록!',
      coach: '김코치',
      satisfaction: 5,
    }
  };

  const handleDateClick = (day) => {
    if (day && workoutData[day]) { // 운동 데이터가 있는 날짜만 클릭 가능
      console.log('날짜 클릭:', day);
      setSelectedDate(day);
      setShowWorkoutModal(true);
      setShowDetailPage(false);
    }
  };

  const matchHistory = [
    { date: '2024.02.20', opponent: '이준호', result: 'win', method: 'KO 3R', weight: '67kg', rounds: 3, score: 'KO', myScore: 10, opponentScore: 8, icon: '🥊' },
    { date: '2024.02.18', opponent: '박성민', result: 'win', method: '판정승', weight: '67kg', rounds: 10, score: '97-93', myScore: 97, opponentScore: 93, icon: '🥊' },
    { date: '2024.02.15', opponent: '최동훈', result: 'loss', method: '판정패', weight: '67kg', rounds: 10, score: '92-96', myScore: 92, opponentScore: 96, icon: '🥊' },
    { date: '2024.02.13', opponent: '김재욱', result: 'win', method: 'KO 2R', weight: '67kg', rounds: 2, score: 'KO', myScore: 10, opponentScore: 7, icon: '🥊' },
    { date: '2024.02.10', opponent: '정우성', result: 'win', method: '판정승', weight: '67kg', rounds: 10, score: '95-91', myScore: 95, opponentScore: 91, icon: '🥊' },
    { date: '2024.02.08', opponent: '한석규', result: 'draw', method: '무승부', weight: '67kg', rounds: 10, score: '94-94', myScore: 94, opponentScore: 94, icon: '🥊' },
  ];

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
            <span className="text-white font-bold">돌아가기</span>
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

  // 실시간 랭킹 데이터
  const rankingNews = [
    { rank: 1, name: '최강민', tier: 'Master', change: '+2', type: 'up' },
    { rank: 2, name: '박철수', tier: 'Master', change: '-1', type: 'down' },
    { rank: 3, name: '이준호', tier: 'Diamond I', change: '0', type: 'same' },
    { rank: 4, name: '김영희', tier: 'Diamond I', change: '+1', type: 'up' },
    { rank: 5, name: '정수진', tier: 'Diamond I', change: '-2', type: 'down' },
  ];

  // 자동 슬라이드 효과 - 1위부터 5위까지 보여주고 다시 1위로
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentNewsIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        // 5위(인덱스 4) 다음에는 다시 1위(인덱스 0)로
        return nextIndex >= rankingNews.length ? 0 : nextIndex;
      });
    }, 3000); // 3초마다 변경

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h2 className="text-3xl font-bold text-white">{t('hi')}, 김태양 {t('athlete')}!</h2>
        </div>
        <p className="text-gray-500">{t('todayActivity')}</p>
      </div>

      {/* 실시간 랭킹 헤드라인 */}
      <div className="overflow-hidden bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/30 rounded-xl relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-xs font-bold text-gray-300">LIVE</span>
          </div>
        </div>
        <div className="relative h-16 flex items-center justify-center">
          <div 
            className="absolute left-0 right-0 transition-transform duration-700 ease-in-out"
            style={{ 
              transform: `translateY(-${currentNewsIndex * 64}px)` 
            }}
          >
            {rankingNews.map((news, index) => (
              <div
                key={index}
                className="h-16 flex items-center justify-center px-6"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">
                      #{news.rank}
                    </span>
                    <span className="text-lg font-bold text-white">{news.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold">
                      {news.tier}
                    </span>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
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
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
          <div className="text-xs text-gray-400 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-lg font-bold">
            실시간 랭킹
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: Workout Results */}
        <div className="lg:col-span-2 space-y-4">
          <SpotlightCard className="p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
            {/* 선수 프로필 헤더 */}
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg border-2 border-red-400/50">
                <span>🥊</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="text-3xl font-bold text-white">김태양</h3>
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/30 shadow-lg">
                    {t('athlete')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
                  <span className="font-bold text-yellow-400 whitespace-nowrap">Diamond II</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="whitespace-nowrap">{t('nationalRanking')} #42</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold whitespace-nowrap">
                    상위 0.5%
                  </span>
                </div>
              </div>
            </div>

            {/* 핵심 전적 - 4개의 주요 지표 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-3 border border-blue-500/20">
                <div className="text-xs text-blue-300 mb-1 whitespace-nowrap">{t('totalMatches')}</div>
                <div className="text-2xl font-bold text-white">42</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-3 border border-emerald-500/20">
                <div className="text-xs text-emerald-300 mb-1 whitespace-nowrap">전적</div>
                <div className="text-lg font-bold text-white">28승 2무 12패</div>
                <div className="text-xs text-emerald-400 mt-1">승률 68.2%</div>
              </div>
              <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-3 border border-red-500/20">
                <div className="text-xs text-red-300 mb-1 whitespace-nowrap">{t('koWins')}</div>
                <div className="text-2xl font-bold text-red-400">15</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-3 border border-purple-500/20">
                <div className="text-xs text-purple-300 mb-1 whitespace-nowrap">{t('winStreak')}</div>
                <div className="text-2xl font-bold text-purple-400">5</div>
              </div>
            </div>

            {/* 복싱 스타일 & 특성 */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-white mb-3">{t('boxingStyle')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 스타일 */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                      <span className="text-xl">🥊</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('mainStyle')}</div>
                      <div className="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">아웃복서</div>
                    </div>
                  </div>
                </div>

                {/* 체급 */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <span className="text-xl">⚖️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('weightClass')}</div>
                      <div className="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">웰터급</div>
                    </div>
                  </div>
                </div>

                {/* 주특기 */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
                      <span className="text-xl">⭐</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('specialty')}</div>
                      <div className="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">잽 & 스텝</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 선수 기본 정보 */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-white mb-4">{t('athleteInfo')}</h4>
              <div className="grid grid-cols-3 gap-4">
                {/* 키 */}
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 border border-blue-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <span className="text-xl">📏</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 whitespace-nowrap">{t('height')}</div>
                      <div className="text-lg font-bold text-white">178cm</div>
                    </div>
                  </div>
                </div>

                {/* 몸무게 */}
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-4 border border-purple-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <span className="text-xl">⚖️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 whitespace-nowrap">{t('weight')}</div>
                      <div className="text-lg font-bold text-white">66.2kg</div>
                    </div>
                  </div>
                </div>

                {/* 성별 */}
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-4 border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <span className="text-xl">👤</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 whitespace-nowrap">{t('gender')}</div>
                      <div className="text-lg font-bold text-white">{t('male')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 최근 경기 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white">최근 경기</h4>
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
              </div>
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
                                setActiveTab(`opponent-profile-${match.opponent}`);
                              }}
                              className="text-sm font-bold text-white hover:text-blue-400 transition-colors truncate"
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
                  {calendarViewMode === 'day' ? `${currentYear}년 ${monthNames[lang][currentMonth]}` : `${currentYear}년`}
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
                  <span className="text-xl font-bold text-white">{currentYear}년</span>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Points */}
        <div>
          <SpotlightCard 
            className="p-6 bg-[#1a1a1a] cursor-pointer hover:bg-[#1e1e1e] transition-all"
            onClick={() => setActiveTab && setActiveTab('dashboard-steps')}
          >
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white mb-1">{t('tierPoints')}</h3>
              <p className="text-xs text-gray-500">{t('tierProgress')}</p>
            </div>

            <div className="flex items-center justify-center py-8 relative">
              {/* 원형 프로그레스 */}
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-white/10"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - 0.73)}`}
                  stroke="url(#tierGradient)"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="tierGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute flex flex-col items-center">
                <div className="text-xs text-gray-400">Diamond II</div>
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">2,750</div>
                <div className="text-xs text-gray-500 mt-1">/ 3,000</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/30 text-center">
                <div className="text-xs text-gray-400 mb-1">{t('nextTier')}</div>
                <div className="text-sm font-bold text-blue-400">Diamond I</div>
              </div>
              <div className="p-3 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-lg border border-emerald-500/30 text-center">
                <div className="text-xs text-gray-400 mb-1">{t('pointsNeeded')}</div>
                <div className="text-lg font-bold text-emerald-400">+250</div>
              </div>
            </div>
          </SpotlightCard>
        </div>

        {/* Match History */}
        <div className="lg:col-span-2" id="match-history-section">
          <SpotlightCard 
            className="p-6 bg-[#1a1a1a] transition-all"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{t('matchHistory')}</h3>
              <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg text-sm text-white font-bold transition-all hover:scale-105 flex items-center gap-2">
                {t('viewHistory')} <Icon type="arrowRight" size={14} />
              </button>
            </div>

            {matchHistory.length > 0 ? (
              <div className="space-y-3">
                {matchHistory.map((match, i) => (
                  <div key={i} className="bg-gradient-to-r from-white/5 to-white/[0.02] rounded-lg overflow-hidden hover:from-white/10 hover:to-white/5 transition-all border border-white/5 hover:border-white/20">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center text-2xl">
                          {match.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab(`opponent-profile-${match.opponent}`);
                              }}
                              className="font-bold text-white text-base hover:text-blue-400 transition-colors underline decoration-transparent hover:decoration-blue-400"
                            >
                              vs. {match.opponent}
                            </button>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              match.result === 'win' ? 'bg-blue-500/20 text-blue-400' : 
                              match.result === 'loss' ? 'bg-red-500/20 text-red-400' : 
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {match.result === 'win' ? t('win') : match.result === 'loss' ? t('loss') : t('draw')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{match.date}</span>
                            <span>•</span>
                            <span>{match.method}</span>
                            <span>•</span>
                            <span>{match.weight}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${
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
              <div className="text-center py-10 text-gray-500">
                {t('noMatchHistory')}
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
                  <span className="text-white">돌아가기</span>
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

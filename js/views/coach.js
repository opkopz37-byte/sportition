// 코치 뷰들
const { useState, useEffect, useRef } = React;

const CoachInsightsView = ({ t = (key) => key, setActiveTab, skillRequests, updateSkillRequestStatus }) => (
  <div className="animate-fade-in-up">
    <PageHeader 
      title={`📊 ${t('insightsDashboard')}`}
      description={t('gymOperationOverview')}
    >
      <div className="flex gap-2">
        <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-all">
          {t('today')}
        </button>
        <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-all">
          {t('thisWeek')}
        </button>
        <button className="px-4 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-lg text-sm font-bold">
          {t('thisMonth')}
        </button>
      </div>
    </PageHeader>

    {/* 주요 통계 카드 - 확장 버전 */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
      <SpotlightCard className="p-3 sm:p-5 border-l-4 border-blue-500">
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Icon type="users" size={16} className="sm:w-5 sm:h-5 text-blue-400" />
          </div>
          <span className="text-[10px] sm:text-xs text-emerald-400 font-bold bg-emerald-500/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap">+8%</span>
        </div>
        <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-0.5">248</div>
        <div className="text-xs sm:text-sm text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('totalMembersCount')}</div>
        <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">{t('activeMembers')} 232 • {t('dormantMembers')} 16</div>
      </SpotlightCard>

      <SpotlightCard className="p-3 sm:p-5 border-l-4 border-emerald-500">
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Icon type="activity" size={16} className="sm:w-5 sm:h-5 text-emerald-400" />
          </div>
          <span className="text-[10px] sm:text-xs text-emerald-400 font-bold bg-emerald-500/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap">+12%</span>
        </div>
        <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-0.5">156</div>
        <div className="text-xs sm:text-sm text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('todayAttendance')}</div>
        <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">{t('targetAchievement')} 104%</div>
      </SpotlightCard>

      <SpotlightCard className="p-3 sm:p-5 border-l-4 border-purple-500">
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Icon type="trendingUp" size={16} className="sm:w-5 sm:h-5 text-purple-400" />
          </div>
          <span className="text-[10px] sm:text-xs text-emerald-400 font-bold bg-emerald-500/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap">+5.2%</span>
        </div>
        <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-0.5">87.5%</div>
        <div className="text-xs sm:text-sm text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('avgAttendanceRate')}</div>
        <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">{t('thisMonth')}</div>
      </SpotlightCard>

      <SpotlightCard className="p-3 sm:p-5 border-l-4 border-yellow-500">
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <span className="text-lg sm:text-xl">💰</span>
          </div>
          <span className="text-[10px] sm:text-xs text-emerald-400 font-bold bg-emerald-500/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap">+15%</span>
        </div>
        <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-0.5">₩8.2M</div>
        <div className="text-xs sm:text-sm text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('monthlyRevenue')}</div>
        <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">{t('target')}: ₩10M (82%)</div>
      </SpotlightCard>
    </div>

    {/* 빠른 액션 버튼 */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
      <button 
        onClick={() => setActiveTab('players')}
        className="p-2 sm:p-3 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/30 hover:border-blue-500/50 rounded-xl transition-all hover:scale-105 group"
      >
        <div className="text-xl sm:text-2xl mb-1 group-hover:scale-110 transition-transform">👥</div>
        <div className="text-[11px] sm:text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{t('memberManagement')}</div>
      </button>
      <button 
        onClick={() => setActiveTab('match')}
        className="p-2 sm:p-3 bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/30 hover:border-red-500/50 rounded-xl transition-all hover:scale-105 group"
      >
        <div className="text-xl sm:text-2xl mb-1 group-hover:scale-110 transition-transform">🥊</div>
        <div className="text-[11px] sm:text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{t('matchRoom')}</div>
      </button>
      <button 
        onClick={() => setActiveTab('admin')}
        className="p-2 sm:p-3 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/30 hover:border-purple-500/50 rounded-xl transition-all hover:scale-105 group"
      >
        <div className="text-xl sm:text-2xl mb-1 group-hover:scale-110 transition-transform">⚙️</div>
        <div className="text-[11px] sm:text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{t('facilityManagement')}</div>
      </button>
      <button className="p-2 sm:p-3 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl transition-all hover:scale-105 group">
        <div className="text-xl sm:text-2xl mb-1 group-hover:scale-110 transition-transform">📊</div>
        <div className="text-[11px] sm:text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{t('detailedReport')}</div>
      </button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* 오늘의 출석 현황 */}
      <SpotlightCard className="p-3 sm:p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-3 sm:mb-5 gap-2">
          <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2 whitespace-nowrap overflow-hidden text-ellipsis">
            <span>📅</span>
            <span>{t('todayAttendanceStatus')}</span>
          </h3>
          <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">2024년 2월 7일 (수)</div>
        </div>
        
        {/* 시간대별 출석 */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs text-gray-400 whitespace-nowrap">{t('timeSlotAttendance')}</span>
            <span className="text-[11px] sm:text-xs text-emerald-400 font-bold whitespace-nowrap">156명 {t('attended')}</span>
          </div>
          <div className="flex gap-1 sm:gap-2 h-24 sm:h-32">
            {[
              { time: '06-09', count: 28, height: 70 },
              { time: '09-12', count: 18, height: 45 },
              { time: '12-15', count: 15, height: 38 },
              { time: '15-18', count: 32, height: 80 },
              { time: '18-21', count: 48, height: 100 },
              { time: '21-24', count: 15, height: 38 },
            ].map((slot, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[9px] sm:text-[10px] text-white font-bold mb-0.5 sm:mb-1">{slot.count}</div>
                <div 
                  className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-lg transition-all hover:from-blue-400 hover:to-purple-400"
                  style={{ height: `${slot.height}%` }}
                />
                <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 whitespace-nowrap">{slot.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 멤버십 타입별 출석 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="p-2 sm:p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 whitespace-nowrap">{t('premium')}</div>
            <div className="text-base sm:text-lg font-bold text-yellow-400 whitespace-nowrap">89명</div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 whitespace-nowrap">{t('ofTotal')} 57%</div>
          </div>
          <div className="p-2 sm:p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 whitespace-nowrap">{t('standard')}</div>
            <div className="text-base sm:text-lg font-bold text-blue-400 whitespace-nowrap">52명</div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 whitespace-nowrap">{t('ofTotal')} 33%</div>
          </div>
          <div className="p-2 sm:p-3 bg-gray-500/10 border border-gray-500/30 rounded-lg">
            <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 whitespace-nowrap">{t('basic')}</div>
            <div className="text-base sm:text-lg font-bold text-gray-400 whitespace-nowrap">15명</div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 whitespace-nowrap">{t('ofTotal')} 10%</div>
          </div>
        </div>
      </SpotlightCard>

      {/* 최근 알림 */}
      <SpotlightCard className="p-3 sm:p-5">
        <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white mb-3 sm:mb-5 flex items-center gap-1.5 sm:gap-2">
          <span>🔔</span>
          <span>{t('recentNotifications')}</span>
        </h3>
        <div className="space-y-2 sm:space-y-3">
          {[
            { type: 'success', icon: '✅', msg: '김철수 회원 30일 연속 출석 달성', time: '10', unit: 'minutesAgo' },
            { type: 'warning', icon: '⚠️', msg: '이영희 회원 3일 미출석', time: '1', unit: 'hoursAgo' },
            { type: 'info', icon: 'ℹ️', msg: '새로운 회원 가입: 박지성', time: '2', unit: 'hoursAgo' },
            { type: 'success', icon: '🎉', msg: '이번 달 목표 출석률 달성', time: '3', unit: 'hoursAgo' },
            { type: 'warning', icon: '💳', msg: '정수진 회원 결제일 도래', time: '5', unit: 'hoursAgo' },
          ].map((notif, i) => (
            <div key={i} className={`p-2 sm:p-3 rounded-lg border ${
              notif.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' :
              notif.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
              'bg-blue-500/10 border-blue-500/30'
            }`}>
              <div className="flex items-start gap-1.5 sm:gap-2">
                <span className="text-sm sm:text-base flex-shrink-0">{notif.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] sm:text-xs text-white">{notif.msg}</div>
                  <div className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 whitespace-nowrap">{notif.time} {t(notif.unit)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SpotlightCard>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5 mb-4 sm:mb-6">
      {/* 주간 성장 트렌드 */}
      <SpotlightCard className="p-3 sm:p-5">
        <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white mb-3 sm:mb-5 flex items-center gap-1.5 sm:gap-2">
          <span>📈</span>
          <span>{t('weeklyGrowthTrend')}</span>
        </h3>
        <div className="space-y-2.5 sm:space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[11px] sm:text-xs text-gray-400 whitespace-nowrap">{t('newMembers')}</span>
              <span className="text-sm sm:text-base font-bold text-emerald-400 whitespace-nowrap">+12명</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 sm:h-3">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500" style={{ width: '75%' }} />
            </div>
            <div className="flex justify-between text-[9px] sm:text-[10px] text-gray-500 mt-0.5 sm:mt-1">
              <span className="whitespace-nowrap">{t('lastWeek')}: +9명</span>
              <span className="whitespace-nowrap">{t('target')}: 16명</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[11px] sm:text-xs text-gray-400 whitespace-nowrap">{t('avgAttendanceRate')}</span>
              <span className="text-sm sm:text-base font-bold text-blue-400 whitespace-nowrap">87.5%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 sm:h-3">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: '87.5%' }} />
            </div>
            <div className="flex justify-between text-[9px] sm:text-[10px] text-gray-500 mt-0.5 sm:mt-1">
              <span className="whitespace-nowrap">{t('lastWeek')}: 82.3%</span>
              <span className="whitespace-nowrap">{t('target')}: 90%</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[11px] sm:text-xs text-gray-400 whitespace-nowrap">{t('memberSatisfaction')}</span>
              <span className="text-sm sm:text-base font-bold text-yellow-400 whitespace-nowrap">4.8/5.0</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 sm:h-3">
              <div className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-500" style={{ width: '96%' }} />
            </div>
            <div className="flex justify-between text-[9px] sm:text-[10px] text-gray-500 mt-0.5 sm:mt-1">
              <span className="whitespace-nowrap">{t('lastWeek')}: 4.6</span>
              <span className="whitespace-nowrap">{t('target')}: 4.9</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[11px] sm:text-xs text-gray-400 whitespace-nowrap">{t('programParticipation')}</span>
              <span className="text-sm sm:text-base font-bold text-purple-400 whitespace-nowrap">72%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 sm:h-3">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: '72%' }} />
            </div>
            <div className="flex justify-between text-[9px] sm:text-[10px] text-gray-500 mt-0.5 sm:mt-1">
              <span className="whitespace-nowrap">{t('lastWeek')}: 68%</span>
              <span className="whitespace-nowrap">{t('target')}: 80%</span>
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* 수익 분석 */}
      <SpotlightCard className="p-3 sm:p-5">
        <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white mb-3 sm:mb-5 flex items-center gap-1.5 sm:gap-2">
          <span>💰</span>
          <span>{t('revenueAnalysis')}</span>
        </h3>
        <div className="space-y-2.5 sm:space-y-4">
          {/* 이번 달 수익 */}
          <div className="p-2.5 sm:p-3 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-lg">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[11px] sm:text-xs text-gray-300 whitespace-nowrap">{t('revenueThisMonth')}</span>
              <span className="text-[9px] sm:text-[10px] text-emerald-400 font-bold bg-emerald-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">+15%</span>
            </div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-0.5 whitespace-nowrap">₩8,200,000</div>
            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{t('targetAchievement')} 82% (₩10M)</div>
          </div>

          {/* 멤버십별 수익 */}
          <div>
            <div className="text-[11px] sm:text-xs text-gray-400 mb-2 sm:mb-3 whitespace-nowrap">{t('revenueByMembership')}</div>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-16 sm:w-20 text-[10px] sm:text-xs text-yellow-400 font-bold whitespace-nowrap">{t('premium')}</div>
                <div className="flex-1 bg-gray-800 rounded-full h-1.5 sm:h-2">
                  <div className="h-full rounded-full bg-yellow-500" style={{ width: '62%' }} />
                </div>
                <div className="w-14 sm:w-16 text-right text-[10px] sm:text-xs text-white font-bold whitespace-nowrap">₩5.1M</div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-16 sm:w-20 text-[10px] sm:text-xs text-blue-400 font-bold whitespace-nowrap">{t('standard')}</div>
                <div className="flex-1 bg-gray-800 rounded-full h-1.5 sm:h-2">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: '28%' }} />
                </div>
                <div className="w-14 sm:w-16 text-right text-[10px] sm:text-xs text-white font-bold whitespace-nowrap">₩2.3M</div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-16 sm:w-20 text-[10px] sm:text-xs text-gray-400 font-bold whitespace-nowrap">{t('basic')}</div>
                <div className="flex-1 bg-gray-800 rounded-full h-1.5 sm:h-2">
                  <div className="h-full rounded-full bg-gray-500" style={{ width: '10%' }} />
                </div>
                <div className="w-14 sm:w-16 text-right text-[10px] sm:text-xs text-white font-bold whitespace-nowrap">₩0.8M</div>
              </div>
            </div>
          </div>

          {/* 예상 수익 */}
          <div className="p-2.5 sm:p-3 bg-white/5 rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs text-gray-400 mb-0.5 whitespace-nowrap">{t('expectedRevenue')}</div>
                <div className="text-base sm:text-lg font-bold text-white whitespace-nowrap">₩9.85M</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[11px] sm:text-xs text-gray-400 mb-0.5 whitespace-nowrap">{t('achievementRate')}</div>
                <div className="text-base sm:text-lg font-bold text-emerald-400 whitespace-nowrap">98.5%</div>
              </div>
            </div>
          </div>
        </div>
      </SpotlightCard>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
      {/* 최고 성과자 */}
      <SpotlightCard className="p-3 sm:p-5">
        <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white mb-3 sm:mb-5 flex items-center gap-1.5 sm:gap-2">
          <span>🏆</span>
          <span>{t('topPerformersThisWeek')}</span>
        </h3>
        <div className="space-y-2 sm:space-y-3">
          {[
            { name: '김철수', tier: 'Master I', score: 285, streak: 30, trend: '+15', avatar: '🥊' },
            { name: '이영희', tier: 'Master II', score: 268, streak: 28, trend: '+12', avatar: '🥋' },
            { name: '박민준', tier: 'Master III', score: 255, streak: 25, trend: '+10', avatar: '⚡' },
            { name: '정지훈', tier: 'Diamond II', score: 242, streak: 22, trend: '+8', avatar: '🔥' },
            { name: '최동욱', tier: 'Diamond I', score: 238, streak: 20, trend: '+7', avatar: '💪' },
          ].map((player, i) => (
            <div key={i} className={`p-2 sm:p-3 rounded-lg transition-all ${
              i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500/50' :
              i === 1 ? 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-2 border-gray-400/50' :
              i === 2 ? 'bg-gradient-to-r from-orange-600/20 to-orange-700/20 border-2 border-orange-600/50' :
              'bg-white/5 border border-white/10'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-yellow-500/30 border-2 border-yellow-400' :
                    i === 1 ? 'bg-gray-400/30 border-2 border-gray-300' :
                    i === 2 ? 'bg-orange-600/30 border-2 border-orange-500' :
                    'bg-white/10'
                  }`}>
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : player.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-white font-bold text-xs sm:text-sm whitespace-nowrap">{player.name}</span>
                      <span className="text-[9px] sm:text-[10px] text-gray-400 whitespace-nowrap">{player.tier}</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-gray-400 flex-wrap">
                      <span className="whitespace-nowrap">🔥 {player.streak}{t('consecutiveDays')}</span>
                      <span className="text-emerald-400 font-bold whitespace-nowrap">{player.trend}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-base sm:text-lg font-bold text-white whitespace-nowrap">{player.score}</div>
                  <div className="text-[9px] sm:text-[10px] text-gray-400 whitespace-nowrap">{t('points')}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SpotlightCard>

      {/* 주의 필요 회원 */}
      <SpotlightCard className="p-3 sm:p-5">
        <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white mb-3 sm:mb-5 flex items-center gap-1.5 sm:gap-2">
          <span>⚠️</span>
          <span>{t('needsAttention')}</span>
        </h3>
        <div className="space-y-2 sm:space-y-3">
          {[
            { name: '최서연', issueKey: 'daysAbsent', issueValue: '7', severity: 'high', lastVisit: '2024-02-01', phone: '010-4567-****' },
            { name: '강예린', issueKey: 'paymentExpiring', issueValue: '', severity: 'medium', lastVisit: '2024-02-07', phone: '010-6543-****' },
            { name: '윤지민', issueKey: 'daysAbsent', issueValue: '3', severity: 'low', lastVisit: '2024-02-04', phone: '010-7890-****' },
            { name: '이준호', issueKey: 'injuryAlert', issueValue: '', severity: 'medium', lastVisit: '2024-02-07', phone: '010-8901-****' },
          ].map((member, i) => (
            <div key={i} className="p-2 sm:p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
              <div className="flex items-center justify-between mb-2 gap-1">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                  <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-sm sm:text-base flex-shrink-0 ${
                    member.severity === 'high' ? 'bg-red-500/20' :
                    member.severity === 'medium' ? 'bg-yellow-500/20' :
                    'bg-blue-500/20'
                  }`}>
                    {member.severity === 'high' ? '🚨' : member.severity === 'medium' ? '⚠️' : 'ℹ️'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-bold text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis">{member.name}</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-400 whitespace-nowrap">{member.phone}</div>
                  </div>
                </div>
                <div className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold whitespace-nowrap flex-shrink-0 ${
                  member.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                  member.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {member.issueValue ? `${member.issueValue} ${t(member.issueKey)}` : t(member.issueKey)}
                </div>
              </div>
              <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
                <span className="text-gray-500 whitespace-nowrap">{t('lastVisit')}: {member.lastVisit}</span>
                <button className="text-blue-400 hover:text-blue-300 font-bold whitespace-nowrap">{t('contact')} →</button>
              </div>
            </div>
          ))}
        </div>
      </SpotlightCard>
    </div>

    {/* 스킬 요청 관리 */}
    <div className="mt-4 sm:mt-6">
      <SpotlightCard className="p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-5 gap-2">
          <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span>⚡</span>
            <span className="whitespace-nowrap">{t('skillRequestManagement')}</span>
            {skillRequests.filter(req => req.status === 'pending').length > 0 && (
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-500/20 text-red-400 rounded-full text-[10px] sm:text-xs font-bold animate-pulse whitespace-nowrap">
                {skillRequests.filter(req => req.status === 'pending').length} {t('requestsWaiting')}
              </span>
            )}
          </h3>
          <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto">
            <button className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] sm:text-xs transition-all whitespace-nowrap flex-shrink-0">
              {t('all')}
            </button>
            <button className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap flex-shrink-0">
              {t('pending')}
            </button>
            <button className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] sm:text-xs transition-all whitespace-nowrap flex-shrink-0">
              {t('approved')}
            </button>
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {skillRequests.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-gray-500">
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-4">📭</div>
              <div className="text-sm sm:text-base">{t('noSkillRequests')}</div>
            </div>
          ) : (
            skillRequests.map((request) => (
              <div 
                key={request.id} 
                className={`p-2.5 sm:p-4 rounded-lg border transition-all ${
                  request.status === 'pending' 
                    ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30 hover:border-yellow-500/50' 
                    : request.status === 'approved'
                    ? 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/30'
                    : 'bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    {/* 회원 정보 */}
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0">
                      {request.playerName.charAt(0)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-1.5 mb-1 flex-wrap">
                        <span className="text-white font-bold text-xs sm:text-sm whitespace-nowrap">{request.playerName}</span>
                        <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[9px] sm:text-[10px] font-bold whitespace-nowrap">
                          {request.tier}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold whitespace-nowrap ${
                          request.skillType === 'active' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {request.skillType === 'active' ? t('activeSkill') : t('passiveSkill')}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-3 text-[10px] sm:text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 whitespace-nowrap">{t('requestedSkill')}:</span>
                          <span className="text-white font-bold whitespace-nowrap overflow-hidden text-ellipsis">{request.skillName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 whitespace-nowrap">{t('requestTime')}:</span>
                          <span className="text-gray-300 whitespace-nowrap">{request.requestDate}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 상태 및 액션 */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 mt-2 sm:mt-0">
                    {request.status === 'pending' ? (
                      <>
                        <button 
                          onClick={() => updateSkillRequestStatus(request.id, 'approved')}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-lg font-bold transition-all text-[11px] sm:text-xs whitespace-nowrap"
                        >
                          ✓ {t('approve')}
                        </button>
                        <button 
                          onClick={() => updateSkillRequestStatus(request.id, 'rejected')}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-lg font-bold transition-all text-[11px] sm:text-xs whitespace-nowrap"
                        >
                          ✗ {t('reject')}
                        </button>
                      </>
                    ) : (
                      <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-[11px] sm:text-xs whitespace-nowrap ${
                        request.status === 'approved' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-red-500/20 text-red-400 border border-red-500/50'
                      }`}>
                        {request.status === 'approved' ? `✓ ${t('approved')}` : `✗ ${t('rejected')}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 통계 */}
        {skillRequests.length > 0 && (
          <div className="mt-3 sm:mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-yellow-400">
                {skillRequests.filter(req => req.status === 'pending').length}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 whitespace-nowrap">대기중</div>
            </div>
            <div className="p-2 sm:p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-400">
                {skillRequests.filter(req => req.status === 'approved').length}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 whitespace-nowrap">승인됨</div>
            </div>
            <div className="p-2 sm:p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-400">
                {skillRequests.filter(req => req.status === 'rejected').length}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 whitespace-nowrap">거절됨</div>
            </div>
          </div>
        )}
      </SpotlightCard>
    </div>
  </div>
);

// 회원 관리 페이지 (코치)
const PlayersManagementView = ({ t = (key) => key, setActiveTab }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive
  const [selectedMember, setSelectedMember] = useState(null); // 상세보기 모달용
  const [showNewMemberModal, setShowNewMemberModal] = useState(false); // 신규회원 등록 모달
  const [newMemberForm, setNewMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: '남성',
    weight: '',
    height: '',
    address: '',
    emergencyContact: '',
    membershipType: '베이직',
    notes: '',
  });
  
  const members = [
    { 
      id: 1, name: '김철수', status: 'active', tier: 'Master I', level: 247, attendance: 156, 
      lastVisit: '2024-02-07', phone: '010-1234-5678', membershipType: '프리미엄',
      email: 'chulsoo@example.com', birthDate: '1995-03-15', gender: '남성', 
      weight: 72, height: 178, joinDate: '2023-01-15', address: '서울시 강남구',
      emergencyContact: '010-9876-5432', notes: '무릎 부상 주의',
      recentRecords: [
        { date: '2024-02-07', type: '경기', detail: '스파링 매치 승리 (판정)' },
        { date: '2024-02-06', type: '훈련', detail: '미트 트레이닝 90분' },
        { date: '2024-02-05', type: '상담', detail: '전략 코칭 세션' },
      ],
      achievements: ['30일 연속 훈련', '레벨 200 달성', 'Master 티어 달성', 'KO 승리 10회'],
      skills: [
        { name: '펀치력', level: 85 },
        { name: '스피드', level: 92 },
        { name: '스태미나', level: 78 },
        { name: '방어력', level: 82 },
      ]
    },
    { 
      id: 2, name: '이영희', status: 'active', tier: 'Master II', level: 218, attendance: 148, 
      lastVisit: '2024-02-07', phone: '010-2345-6789', membershipType: '스탠다드',
      email: 'younghee@example.com', birthDate: '1992-07-22', gender: '여성',
      weight: 58, height: 165, joinDate: '2023-02-20', address: '서울시 서초구',
      emergencyContact: '010-8765-4321', notes: '요가 선호',
      recentRecords: [
        { date: '2024-02-07', type: '훈련', detail: '섀도우 복싱 60분' },
        { date: '2024-02-06', type: '경기', detail: '스파링 매치 (무승부)' },
      ],
      achievements: ['레벨 200 달성', 'Master 티어 달성', '완벽한 디펜스 5회'],
      skills: [
        { name: '펀치력', level: 70 },
        { name: '스피드', level: 88 },
        { name: '스태미나', level: 82 },
        { name: '방어력', level: 85 },
      ]
    },
    { 
      id: 3, name: '박민준', status: 'active', tier: 'Master III', level: 205, attendance: 142, 
      lastVisit: '2024-02-06', phone: '010-3456-7890', membershipType: '프리미엄',
      email: 'minjun@example.com', birthDate: '1998-11-10', gender: '남성',
      weight: 80, height: 182, joinDate: '2023-03-10', address: '서울시 송파구',
      emergencyContact: '010-7654-3210', notes: '파워리프팅 집중',
      recentRecords: [
        { date: '2024-02-06', type: '경기', detail: 'KO 승리 (2라운드)' },
      ],
      achievements: ['레벨 200 달성', 'KO 파워하우스'],
      skills: [
        { name: '펀치력', level: 92 },
        { name: '스피드', level: 68 },
        { name: '스태미나', level: 75 },
        { name: '방어력', level: 60 },
      ]
    },
    { 
      id: 4, name: '최서연', status: 'inactive', tier: 'Diamond I', level: 193, attendance: 135, 
      lastVisit: '2024-02-01', phone: '010-4567-8901', membershipType: '베이직',
      email: 'seoyeon@example.com', birthDate: '1996-05-30', gender: '여성',
      weight: 55, height: 160, joinDate: '2023-04-05', address: '서울시 마포구',
      emergencyContact: '010-6543-2109', notes: '휴면 회원',
      recentRecords: [],
      achievements: [],
      skills: [
        { name: '펀치력', level: 65 },
        { name: '스피드', level: 70 },
        { name: '스태미나', level: 68 },
        { name: '방어력', level: 72 },
      ]
    },
    { 
      id: 5, name: '정지훈', status: 'active', tier: 'Diamond II', level: 187, attendance: 130, 
      lastVisit: '2024-02-07', phone: '010-5678-9012', membershipType: '프리미엄',
      email: 'jihun@example.com', birthDate: '1994-09-18', gender: '남성',
      weight: 75, height: 175, joinDate: '2023-05-15', address: '서울시 강동구',
      emergencyContact: '010-5432-1098', notes: '헤비백 훈련 선호',
      recentRecords: [
        { date: '2024-02-07', type: '훈련', detail: '헤비백 트레이닝 120분' },
      ],
      achievements: ['30일 연속 훈련', '강력한 펀치 마스터'],
      skills: [
        { name: '펀치력', level: 90 },
        { name: '스피드', level: 75 },
        { name: '스태미나', level: 85 },
        { name: '방어력', level: 70 },
      ]
    },
  ];

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || m.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader 
        title={t('members')} 
        description={t('viewAndManageMembers')}
        onBack={() => setActiveTab('insights')}
      >
        <button 
          onClick={() => setShowNewMemberModal(true)}
          className="px-3 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all hover:scale-105 flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
        >
          <span>+</span>
          <span className="hidden xs:inline">{t('newMemberRegistration')}</span>
          <span className="xs:hidden">신규등록</span>
        </button>
      </PageHeader>

      {/* 검색 및 필터 */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchMemberName')}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all text-sm sm:text-base"
          />
        </div>
        <div className="flex gap-1.5 sm:gap-2">
          {[
            { key: 'all', label: t('allMembers') },
            { key: 'active', label: t('activeMembers') },
            { key: 'inactive', label: t('dormant') },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setFilterStatus(filter.key)}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold transition-all text-[11px] sm:text-sm whitespace-nowrap ${
                filterStatus === filter.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* 선수 통계 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-5">
        <SpotlightCard className="p-2.5 sm:p-3">
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-white mb-0.5">{members.length}</div>
            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{t('totalMembersCount')}</div>
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-2.5 sm:p-3">
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-emerald-400 mb-0.5">{members.filter(m => m.status === 'active').length}</div>
            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{t('activeMembers')}</div>
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-2.5 sm:p-3">
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-red-400 mb-0.5">{members.filter(m => m.status === 'inactive').length}</div>
            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{t('dormant')}</div>
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-2.5 sm:p-3">
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-purple-400 mb-0.5">{members.filter(m => m.membershipType === '프리미엄').length}</div>
            <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{t('premium')}</div>
          </div>
        </SpotlightCard>
      </div>

      {/* 회원 목록 */}
      <SpotlightCard className="overflow-hidden">
        <div className="divide-y divide-white/5">
          {filteredMembers.map((member) => (
            <div key={member.id} className="p-2 sm:p-4 hover:bg-white/5 transition-all cursor-pointer">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 w-full min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-base sm:text-lg">
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-white whitespace-nowrap">{member.name}</h3>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold whitespace-nowrap ${
                        member.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {member.status === 'active' ? t('activeMembers') : t('dormant')}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-purple-500/20 text-purple-400 whitespace-nowrap">
                        {member.membershipType}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-gray-400">
                      <span className="whitespace-nowrap">📞 {member.phone}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="whitespace-nowrap">🏆 {member.tier}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="whitespace-nowrap">Lv.{member.level}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="whitespace-nowrap">📅 {member.attendance}일</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedMember(member)}
                  className="w-full sm:w-auto px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] sm:text-xs text-white transition-all whitespace-nowrap"
                >
                  {t('viewDetails')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </SpotlightCard>

      {/* 회원 상세보기 모달 */}
      {selectedMember && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="bg-[#0A0A0A] border border-white/20 rounded-2xl max-w-[95vw] sm:max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="p-3 sm:p-5 border-b border-white/10 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg sm:text-2xl shadow-lg flex-shrink-0">
                    {selectedMember.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                      <h2 className="text-base sm:text-xl lg:text-2xl font-bold text-white whitespace-nowrap">{selectedMember.name}</h2>
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold whitespace-nowrap ${
                        selectedMember.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {selectedMember.status === 'active' ? '활동중' : '휴면'}
                      </span>
                      <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-purple-500/20 text-purple-400 whitespace-nowrap">
                        {selectedMember.membershipType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-400 flex-wrap">
                      <span className="whitespace-nowrap">🏆 {selectedMember.tier}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="whitespace-nowrap">Lv.{selectedMember.level}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="whitespace-nowrap">출석 {selectedMember.attendance}일</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedMember(null)}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all flex-shrink-0"
                >
                  <span className="text-lg sm:text-xl">✕</span>
                </button>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="p-3 sm:p-5 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                {/* 기본 정보 */}
                <SpotlightCard className="p-3 sm:p-5">
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2 sm:mb-3 flex items-center gap-1.5">
                    <span className="text-sm sm:text-base">📋</span>
                    <span>기본 정보</span>
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1.5 border-b border-white/5 gap-2">
                      <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">이메일</span>
                      <span className="text-[10px] sm:text-xs text-white font-medium overflow-hidden text-ellipsis text-right">{selectedMember.email}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5 gap-2">
                      <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">연락처</span>
                      <span className="text-[10px] sm:text-xs text-white font-medium whitespace-nowrap">{selectedMember.phone}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5 gap-2">
                      <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">생년월일</span>
                      <span className="text-[10px] sm:text-xs text-white font-medium whitespace-nowrap">{selectedMember.birthDate}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5 gap-2">
                      <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">성별</span>
                      <span className="text-[10px] sm:text-xs text-white font-medium whitespace-nowrap">{selectedMember.gender}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5 gap-2">
                      <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">가입일</span>
                      <span className="text-[10px] sm:text-xs text-white font-medium whitespace-nowrap">{selectedMember.joinDate}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5 gap-2">
                      <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">주소</span>
                      <span className="text-[10px] sm:text-xs text-white font-medium overflow-hidden text-ellipsis text-right">{selectedMember.address}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5 gap-2">
                      <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">비상연락처</span>
                      <span className="text-[10px] sm:text-xs text-white font-medium whitespace-nowrap">{selectedMember.emergencyContact}</span>
                    </div>
                    <div className="flex justify-between py-1.5 gap-2">
                      <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">최근 방문</span>
                      <span className="text-[10px] sm:text-xs text-white font-medium whitespace-nowrap">{selectedMember.lastVisit}</span>
                    </div>
                  </div>
                </SpotlightCard>

                {/* 신체 정보 */}
                <SpotlightCard className="p-3 sm:p-5">
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2 sm:mb-3 flex items-center gap-1.5">
                    <span className="text-sm sm:text-base">💪</span>
                    <span>신체 정보</span>
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="p-2 sm:p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] sm:text-xs text-gray-400">체중</span>
                        <span className="text-base sm:text-xl font-bold text-blue-400">{selectedMember.weight}kg</span>
                      </div>
                    </div>
                    <div className="p-2 sm:p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] sm:text-xs text-gray-400">신장</span>
                        <span className="text-base sm:text-xl font-bold text-purple-400">{selectedMember.height}cm</span>
                      </div>
                    </div>
                    <div className="p-2 sm:p-3 bg-white/5 rounded-lg">
                      <div className="text-[10px] sm:text-xs text-gray-400 mb-1">특이사항</div>
                      <div className="text-[10px] sm:text-xs text-white">{selectedMember.notes}</div>
                    </div>
                  </div>
                </SpotlightCard>

                {/* 능력치 */}
                <SpotlightCard className="p-3 sm:p-5 col-span-1 sm:col-span-2">
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2 sm:mb-3 flex items-center gap-1.5">
                    <span className="text-sm sm:text-base">⚡</span>
                    <span>능력치</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {selectedMember.skills.map((skill) => (
                      <div key={skill.name} className="p-2 sm:p-3 bg-white/5 rounded-lg">
                        <div className="flex justify-between items-center mb-1 gap-2">
                          <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{skill.name}</span>
                          <span className="text-[10px] sm:text-xs text-white font-bold whitespace-nowrap">{skill.level}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                            style={{ width: `${skill.level}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </SpotlightCard>

                {/* 업적 */}
                <SpotlightCard className="p-3 sm:p-5">
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2 sm:mb-3 flex items-center gap-1.5">
                    <span className="text-sm sm:text-base">🏆</span>
                    <span>업적</span>
                  </h3>
                  <div className="space-y-1.5 sm:space-y-2">
                    {selectedMember.achievements.length > 0 ? (
                      selectedMember.achievements.map((achievement, idx) => (
                        <div key={idx} className="p-2 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-1.5">
                          <span className="text-yellow-400 text-xs sm:text-sm flex-shrink-0">🌟</span>
                          <span className="text-[10px] sm:text-xs text-white overflow-hidden text-ellipsis">{achievement}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] sm:text-xs text-gray-500 text-center py-3">업적이 없습니다</div>
                    )}
                  </div>
                </SpotlightCard>

                {/* 최근 활동 */}
                <SpotlightCard className="p-3 sm:p-5">
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2 sm:mb-3 flex items-center gap-1.5">
                    <span className="text-sm sm:text-base">📊</span>
                    <span>최근 활동</span>
                  </h3>
                  <div className="space-y-1.5 sm:space-y-2">
                    {selectedMember.recentRecords.length > 0 ? (
                      selectedMember.recentRecords.map((record, idx) => (
                        <div key={idx} className="p-2 bg-white/5 rounded-lg">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold whitespace-nowrap ${
                              record.type === '운동' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                            }`}>
                              {record.type}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-gray-400 whitespace-nowrap">{record.date}</span>
                          </div>
                          <div className="text-[10px] sm:text-xs text-white overflow-hidden text-ellipsis">{record.detail}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] sm:text-xs text-gray-500 text-center py-3">최근 활동이 없습니다</div>
                    )}
                  </div>
                </SpotlightCard>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="p-4 border-t border-white/10 bg-white/5 flex gap-3">
              <button className="flex-1 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg font-bold transition-all">
                정보 수정
              </button>
              <button className="flex-1 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg font-bold transition-all">
                출석 기록
              </button>
              <button 
                onClick={() => setSelectedMember(null)}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 신규 회원 등록 모달 */}
      {showNewMemberModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowNewMemberModal(false)}
        >
          <div 
            className="bg-[#0A0A0A] border border-white/20 rounded-2xl max-w-[95vw] sm:max-w-6xl w-full max-h-[95vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="p-8 border-b border-white/10 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white shadow-lg">
                    <span className="text-3xl">👤</span>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-1">신규 회원 등록</h2>
                    <p className="text-gray-400">새로운 회원의 정보를 입력하세요</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowNewMemberModal(false)}
                  className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                >
                  <span className="text-2xl">✕</span>
                </button>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="p-8 overflow-y-auto max-h-[calc(95vh-200px)]">
              <div className="space-y-8">
                {/* 기본 정보 섹션 */}
                <div>
                  <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <span>📋</span>
                    <span>기본 정보</span>
                    <span className="text-red-400">*</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        이름 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={newMemberForm.name}
                        onChange={(e) => setNewMemberForm({...newMemberForm, name: e.target.value})}
                        placeholder="홍길동"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        이메일 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email"
                        value={newMemberForm.email}
                        onChange={(e) => setNewMemberForm({...newMemberForm, email: e.target.value})}
                        placeholder="example@email.com"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        연락처 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={newMemberForm.phone}
                        onChange={(e) => setNewMemberForm({...newMemberForm, phone: e.target.value})}
                        placeholder="010-1234-5678"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        생년월일 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={newMemberForm.birthDate}
                        onChange={(e) => setNewMemberForm({...newMemberForm, birthDate: e.target.value})}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        성별 <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={newMemberForm.gender}
                        onChange={(e) => setNewMemberForm({...newMemberForm, gender: e.target.value})}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                      >
                        <option value="남성">남성</option>
                        <option value="여성">여성</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        멤버십 타입 <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={newMemberForm.membershipType}
                        onChange={(e) => setNewMemberForm({...newMemberForm, membershipType: e.target.value})}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                      >
                        <option value="베이직">베이직</option>
                        <option value="스탠다드">스탠다드</option>
                        <option value="프리미엄">프리미엄</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 신체 정보 섹션 */}
                <div>
                  <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <span>💪</span>
                    <span>신체 정보</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">체중 (kg)</label>
                      <input
                        type="number"
                        value={newMemberForm.weight}
                        onChange={(e) => setNewMemberForm({...newMemberForm, weight: e.target.value})}
                        placeholder="70"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">신장 (cm)</label>
                      <input
                        type="number"
                        value={newMemberForm.height}
                        onChange={(e) => setNewMemberForm({...newMemberForm, height: e.target.value})}
                        placeholder="175"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* 연락 정보 섹션 */}
                <div>
                  <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <span>📞</span>
                    <span>연락 정보</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">주소</label>
                      <input
                        type="text"
                        value={newMemberForm.address}
                        onChange={(e) => setNewMemberForm({...newMemberForm, address: e.target.value})}
                        placeholder="서울시 강남구"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">비상연락처</label>
                      <input
                        type="tel"
                        value={newMemberForm.emergencyContact}
                        onChange={(e) => setNewMemberForm({...newMemberForm, emergencyContact: e.target.value})}
                        placeholder="010-9876-5432"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* 특이사항 섹션 */}
                <div>
                  <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <span>📝</span>
                    <span>특이사항</span>
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">메모</label>
                    <textarea
                      value={newMemberForm.notes}
                      onChange={(e) => setNewMemberForm({...newMemberForm, notes: e.target.value})}
                      placeholder="부상 이력, 특별 주의사항 등을 입력하세요..."
                      rows="4"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all resize-none"
                    />
                  </div>
                </div>

                {/* 안내 메시지 */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-blue-400 text-xl">ℹ️</span>
                    <div className="flex-1">
                      <div className="text-blue-400 font-bold mb-1">회원 등록 안내</div>
                      <div className="text-sm text-gray-400">
                        • <span className="text-red-400">*</span> 표시된 항목은 필수 입력 항목입니다.<br/>
                        • 회원 등록 후 초기 비밀번호는 생년월일(YYYYMMDD)로 설정됩니다.<br/>
                        • 회원에게 초기 비밀번호 변경을 안내해 주세요.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="p-6 border-t border-white/10 bg-white/5 flex gap-4">
              <button 
                onClick={() => {
                  setShowNewMemberModal(false);
                  setNewMemberForm({
                    name: '',
                    email: '',
                    phone: '',
                    birthDate: '',
                    gender: '남성',
                    weight: '',
                    height: '',
                    address: '',
                    emergencyContact: '',
                    membershipType: '베이직',
                    notes: '',
                  });
                }}
                className="flex-1 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-lg transition-all"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  // TODO: 회원 등록 로직
                  alert('회원이 등록되었습니다!');
                  setShowNewMemberModal(false);
                  setNewMemberForm({
                    name: '',
                    email: '',
                    phone: '',
                    birthDate: '',
                    gender: '남성',
                    weight: '',
                    height: '',
                    address: '',
                    emergencyContact: '',
                    membershipType: '베이직',
                    notes: '',
                  });
                }}
                className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold text-lg transition-all hover:scale-[1.02] shadow-lg shadow-blue-500/30"
              >
                ✓ 등록 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 매칭 룸 페이지 (코치)
const MatchRoomView = ({ t = (key) => key, setActiveTab }) => {
  // Phase: 'lobby' | 'matching' | 'fighting' | 'rest' | 'finish'
  const [phase, setPhase] = useState('lobby');
  const [blueCorner, setBlueCorner] = useState(null);
  const [redCorner, setRedCorner] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTime, setRoundTime] = useState(180); // 3:00
  const [restTime, setRestTime] = useState(60); // 1:00
  const [scores, setScores] = useState({ round1: null, round2: null, round3: null });
  const [selectingCorner, setSelectingCorner] = useState(null); // 'blue' | 'red' | null
  const [rscWinner, setRscWinner] = useState(null); // RSC 승자 ('blue' | 'red' | null)
  const [finishMethod, setFinishMethod] = useState(null); // 'decision' | 'rsc'
  const [currentScoreInput, setCurrentScoreInput] = useState({ blue: null, red: null, dominant: null }); // 현재 라운드 점수 입력
  
  // 출석한 선수 리스트 (체급순)
  const attendedMembers = [
    { id: 1, name: '김철수', weight: 54, record: '12승 3패', winRate: 80, avatar: '🥊' },
    { id: 2, name: '이영희', weight: 54, record: '10승 5패', winRate: 67, avatar: '🥋' },
    { id: 3, name: '박민수', weight: 58, record: '15승 2패', winRate: 88, avatar: '⚡' },
    { id: 4, name: '정수진', weight: 58, record: '8승 4패', winRate: 67, avatar: '💪' },
    { id: 5, name: '최동욱', weight: 63, record: '20승 5패', winRate: 80, avatar: '🔥' },
    { id: 6, name: '강예린', weight: 63, record: '14승 8패', winRate: 64, avatar: '⭐' },
  ];

  // 타이머 로직
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      if (phase === 'fighting') {
        setRoundTime(prev => {
          if (prev <= 1) {
            setIsPlaying(false);
            setPhase('rest');
            setRestTime(60);
            return 180;
          }
          return prev - 1;
        });
      } else if (phase === 'rest') {
        setRestTime(prev => {
          if (prev <= 1) {
            if (currentRound < 3) {
              setCurrentRound(currentRound + 1);
              setPhase('fighting');
              setRoundTime(180);
              setIsPlaying(true);
            } else {
              setPhase('finish');
              setFinishMethod('decision');
            }
            return 60;
          }
          return prev - 1;
        });
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isPlaying, phase, currentRound]);

  // rest 페이즈 자동 시작 및 입력 초기화
  useEffect(() => {
    if (phase === 'rest') {
      if (!isPlaying) {
        setIsPlaying(true);
      }
      setCurrentScoreInput({ blue: null, red: null, dominant: null });
    }
  }, [phase]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startMatch = () => {
    if (!blueCorner || !redCorner) return;
    setPhase('fighting');
    setCurrentRound(1);
    setRoundTime(180);
    setIsPlaying(true);
  };

  const handleScoreSelect = (roundNum, blueScore, redScore, dominant) => {
    setScores(prev => ({ ...prev, [`round${roundNum}`]: { blue: blueScore, red: redScore, dominant } }));
    setCurrentScoreInput({ blue: null, red: null, dominant: null });
  };

  const canSubmitScore = () => {
    return currentScoreInput.blue !== null && currentScoreInput.red !== null && currentScoreInput.dominant !== null;
  };

  const handleRSC = (corner) => {
    setIsPlaying(false);
    setRscWinner(corner);
    setFinishMethod('rsc');
    setPhase('finish');
  };

  const calculateWinner = () => {
    if (finishMethod === 'rsc') {
      return rscWinner === 'blue' ? blueCorner : redCorner;
    }
    const blueTotal = (scores.round1?.blue || 0) + (scores.round2?.blue || 0) + (scores.round3?.blue || 0);
    const redTotal = (scores.round1?.red || 0) + (scores.round2?.red || 0) + (scores.round3?.red || 0);
    return blueTotal > redTotal ? blueCorner : redCorner;
  };

  const resetMatch = () => {
    setPhase('lobby');
    setBlueCorner(null);
    setRedCorner(null);
    setCurrentRound(1);
    setRoundTime(180);
    setRestTime(60);
    setScores({ round1: null, round2: null, round3: null });
    setIsPlaying(false);
    setRscWinner(null);
    setFinishMethod(null);
    setCurrentScoreInput({ blue: null, red: null, dominant: null });
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader 
        title={`🥊 ${t('matchRoomTitle')}`}
        description={t('oneThumbReferee')}
        onBack={() => setActiveTab('insights')}
      />

      {/* Phase 0: Lobby - 회원 선택 */}
      {phase === 'lobby' && (
        <>
          {/* 매칭 프로세스 안내 */}
          <div className="mb-3 sm:mb-5 p-2 sm:p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg sm:rounded-xl">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto">
              <div className={`flex items-center gap-1 sm:gap-1.5 ${blueCorner ? 'text-emerald-400' : 'text-gray-500'}`}>
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm ${
                  blueCorner ? 'bg-emerald-500/20 border-2 border-emerald-400' : 'bg-white/10 border-2 border-white/20'
                }`}>
                  {blueCorner ? '✓' : '1'}
                </div>
                <span className="font-bold text-[11px] sm:text-sm whitespace-nowrap">{t('blueCorner')}</span>
              </div>
              <div className="text-gray-500 text-xs">→</div>
              <div className={`flex items-center gap-1 sm:gap-1.5 ${redCorner ? 'text-emerald-400' : blueCorner ? 'text-white' : 'text-gray-500'}`}>
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm ${
                  redCorner ? 'bg-emerald-500/20 border-2 border-emerald-400' : 
                  blueCorner ? 'bg-white/20 border-2 border-white/40' : 'bg-white/10 border-2 border-white/20'
                }`}>
                  {redCorner ? '✓' : '2'}
                </div>
                <span className="font-bold text-[11px] sm:text-sm whitespace-nowrap">{t('redCorner')}</span>
              </div>
              <div className="text-gray-500 text-xs">→</div>
              <div className={`flex items-center gap-1 sm:gap-1.5 ${blueCorner && redCorner ? 'text-white animate-pulse' : 'text-gray-500'}`}>
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm ${
                  blueCorner && redCorner ? 'bg-emerald-500/20 border-2 border-emerald-400' : 'bg-white/10 border-2 border-white/20'
                }`}>
                  3
                </div>
                <span className="font-bold text-[11px] sm:text-sm whitespace-nowrap">{t('matchStart')}</span>
              </div>
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-5">
            <SpotlightCard className="p-2 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg bg-blue-500/20 flex items-center justify-center text-base sm:text-xl">
                  👥
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-bold text-white">{attendedMembers.length}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('attendedMembers')}</div>
                </div>
              </div>
            </SpotlightCard>
            <SpotlightCard className="p-2 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg bg-red-500/20 flex items-center justify-center text-base sm:text-xl">
                  🥊
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-bold text-white">12</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('todayMatches')}</div>
                </div>
              </div>
            </SpotlightCard>
            <SpotlightCard className="p-2 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg bg-purple-500/20 flex items-center justify-center text-base sm:text-xl">
                  ⚡
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-bold text-white">36</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('totalRounds')}</div>
                </div>
              </div>
            </SpotlightCard>
            <SpotlightCard className="p-2 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg bg-yellow-500/20 flex items-center justify-center text-base sm:text-xl">
                  🏆
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-bold text-white">92%</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{t('completionRate')}</div>
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* 코너 선택 영역 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-5">
            {/* 청코너 */}
            <SpotlightCard className={`p-3 sm:p-5 border-2 transition-all ${
              !blueCorner && !redCorner 
                ? 'border-blue-500 shadow-lg shadow-blue-500/30 animate-pulse' 
                : 'border-blue-500/50'
            }`}>
              <div className="text-center mb-2 sm:mb-3">
                <div className="text-2xl sm:text-3xl mb-1">🟦</div>
                <h3 className="text-sm sm:text-base font-bold text-blue-400 whitespace-nowrap">{t('blueCorner')}</h3>
              </div>
              {blueCorner ? (
                <div className="p-2 sm:p-3 bg-blue-500/20 rounded-lg text-center">
                  <div className="text-xl sm:text-2xl mb-1">{blueCorner.avatar}</div>
                  <div className="text-sm sm:text-base font-bold text-white whitespace-nowrap">{blueCorner.name}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{blueCorner.weight}kg • {blueCorner.record}</div>
                  <div className="flex gap-1.5 sm:gap-2 mt-2">
                    <button 
                      onClick={() => setSelectingCorner('blue')}
                      className="flex-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-[10px] sm:text-xs transition-all whitespace-nowrap"
                    >
                      {t('change')}
                    </button>
                    <button 
                      onClick={() => setBlueCorner(null)}
                      className="flex-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] sm:text-xs transition-all whitespace-nowrap"
                    >
                      {t('deselect')}
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setSelectingCorner('blue')}
                  className="w-full p-4 sm:p-6 border-2 border-dashed border-blue-400/30 hover:border-blue-400/60 rounded-lg sm:rounded-xl text-center transition-all hover:bg-blue-500/5 group"
                >
                  <div className="text-2xl sm:text-3xl mb-1 sm:mb-2 group-hover:scale-110 transition-transform">➕</div>
                  <div className="text-blue-400 font-bold text-xs sm:text-sm whitespace-nowrap">{t('selectFighter')}</div>
                  {!blueCorner && !redCorner && (
                    <div className="mt-1 text-[10px] sm:text-xs text-gray-400">{t('selectBlueFirst')}</div>
                  )}
                </button>
              )}
            </SpotlightCard>

            {/* 홍코너 */}
            <SpotlightCard className={`p-3 sm:p-5 border-2 transition-all ${
              blueCorner && !redCorner 
                ? 'border-red-500 shadow-lg shadow-red-500/30 animate-pulse' 
                : 'border-red-500/50'
            }`}>
              <div className="text-center mb-2 sm:mb-3">
                <div className="text-2xl sm:text-3xl mb-1">🟥</div>
                <h3 className="text-sm sm:text-base font-bold text-red-400 whitespace-nowrap">{t('redCorner')}</h3>
              </div>
              {redCorner ? (
                <div className="p-2 sm:p-3 bg-red-500/20 rounded-lg text-center">
                  <div className="text-xl sm:text-2xl mb-1">{redCorner.avatar}</div>
                  <div className="text-sm sm:text-base font-bold text-white whitespace-nowrap">{redCorner.name}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{redCorner.weight}kg • {redCorner.record}</div>
                  <div className="flex gap-1.5 sm:gap-2 mt-2">
                    <button 
                      onClick={() => setSelectingCorner('red')}
                      className="flex-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-[10px] sm:text-xs transition-all whitespace-nowrap"
                    >
                      {t('change')}
                    </button>
                    <button 
                      onClick={() => setRedCorner(null)}
                      className="flex-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] sm:text-xs transition-all whitespace-nowrap"
                    >
                      {t('deselect')}
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setSelectingCorner('red')}
                  disabled={!blueCorner}
                  className={`w-full p-4 sm:p-6 border-2 border-dashed rounded-lg sm:rounded-xl text-center transition-all group ${
                    blueCorner 
                      ? 'border-red-400/30 hover:border-red-400/60 hover:bg-red-500/5' 
                      : 'border-gray-500/20 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl sm:text-3xl mb-1 sm:mb-2 group-hover:scale-110 transition-transform">➕</div>
                  <div className={`font-bold text-xs sm:text-sm whitespace-nowrap ${blueCorner ? 'text-red-400' : 'text-gray-500'}`}>{t('selectFighter')}</div>
                  {!blueCorner && (
                    <div className="mt-1 text-[10px] sm:text-xs text-gray-500">{t('selectBlueFirst')}</div>
                  )}
                </button>
              )}
            </SpotlightCard>
          </div>

          {/* 예상 승률 */}
          {blueCorner && redCorner && (
            <SpotlightCard className="p-2 sm:p-3 mb-3 sm:mb-4 bg-gradient-to-r from-blue-500/10 to-red-500/10 border border-white/20">
              <div className="flex items-center justify-between gap-1 sm:gap-2">
                <div className="text-blue-400 font-bold text-xs sm:text-sm whitespace-nowrap">{blueCorner.name}</div>
                <div className="text-center flex-1 min-w-0 mx-1 sm:mx-2">
                  <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 whitespace-nowrap">{t('expectedWinRate')}</div>
                  <div className="flex items-center justify-center gap-1 sm:gap-2">
                    <span className="text-blue-400 font-bold text-sm sm:text-base">55%</span>
                    <span className="text-gray-500 text-xs">:</span>
                    <span className="text-red-400 font-bold text-sm sm:text-base">45%</span>
                  </div>
                </div>
                <div className="text-red-400 font-bold text-xs sm:text-sm whitespace-nowrap">{redCorner.name}</div>
              </div>
            </SpotlightCard>
          )}

          {/* MATCH START 버튼 */}
          {blueCorner && redCorner && (
            <button 
              onClick={startMatch}
              className="w-full py-4 sm:py-6 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white text-lg sm:text-2xl font-bold rounded-xl transition-all hover:scale-105 shadow-2xl shadow-emerald-500/50 animate-pulse"
            >
              🔔 {t('matchStart')}
            </button>
          )}

          {/* 회원 선택 모달 */}
          {selectingCorner && (
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setSelectingCorner(null)}
            >
              <div 
                className="bg-[#0A0A0A] border border-white/20 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 모달 헤더 */}
                <div className={`p-6 border-b border-white/10 ${
                  selectingCorner === 'blue' 
                    ? 'bg-gradient-to-r from-blue-500/20 to-blue-500/10' 
                    : 'bg-gradient-to-r from-red-500/20 to-red-500/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{selectingCorner === 'blue' ? '🟦' : '🟥'}</div>
                      <div>
                        <h3 className={`text-2xl font-bold ${selectingCorner === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
                          {selectingCorner === 'blue' ? '청코너' : '홍코너'} 선수 선택
                        </h3>
                        <p className="text-sm text-gray-400">출석 회원을 선택하세요 (체급순)</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectingCorner(null)}
                      className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                    >
                      <span className="text-2xl">✕</span>
                    </button>
                  </div>
                </div>

                {/* 회원 리스트 */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  <div className="space-y-3">
                    {attendedMembers.map((member) => {
                      const isDisabled = (selectingCorner === 'blue' && redCorner?.id === member.id) || 
                                       (selectingCorner === 'red' && blueCorner?.id === member.id);
                      
                      return (
                        <button
                          key={member.id}
                          onClick={() => {
                            if (selectingCorner === 'blue') {
                              setBlueCorner(member);
                              setSelectingCorner(null);
                              // 청코너 선택 후 자동으로 홍코너 선택 모달 열기
                              setTimeout(() => {
                                if (!redCorner) setSelectingCorner('red');
                              }, 300);
                            } else {
                              setRedCorner(member);
                              setSelectingCorner(null);
                            }
                          }}
                          disabled={isDisabled}
                          className={`w-full p-5 rounded-xl border transition-all text-left ${
                            isDisabled
                              ? 'bg-white/5 border-white/20 opacity-40 cursor-not-allowed'
                              : 'bg-gradient-to-r from-white/5 to-white/[0.02] border-white/10 hover:bg-white/10 hover:scale-[1.02] hover:border-white/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="text-4xl">{member.avatar}</div>
                              <div>
                                <div className="font-bold text-white text-xl mb-1">{member.name}</div>
                                <div className="text-sm text-gray-400">{member.weight}kg • {member.record}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500 mb-1">승률</div>
                              <div className="text-2xl font-bold text-emerald-400">{member.winRate}%</div>
                            </div>
                          </div>
                          {isDisabled && (
                            <div className="mt-2 text-xs text-red-400">
                              {selectingCorner === 'blue' ? '홍코너에 이미 선택됨' : '청코너에 이미 선택됨'}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 모달 푸터 */}
                <div className="p-4 border-t border-white/10 bg-white/5">
                  <button 
                    onClick={() => setSelectingCorner(null)}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-all"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Phase 2: Fighting - 경기 진행 */}
      {phase === 'fighting' && (
        <div className="space-y-6">
          {/* 대진표 */}
          <SpotlightCard className="p-8 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-red-500/10">
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-white mb-2">ROUND {currentRound}</div>
              <div className="text-6xl font-bold text-white mb-4">{formatTime(roundTime)}</div>
              {roundTime <= 10 && (
                <div className="text-yellow-400 text-xl font-bold animate-pulse">⚠️ 10초 전!</div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-center p-6 bg-blue-500/20 rounded-xl">
                <div className="text-4xl mb-2">{blueCorner.avatar}</div>
                <div className="text-xl font-bold text-blue-400">{blueCorner.name}</div>
                <div className="text-sm text-gray-400">{blueCorner.weight}kg</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white">VS</div>
              </div>
              <div className="text-center p-6 bg-red-500/20 rounded-xl">
                <div className="text-4xl mb-2">{redCorner.avatar}</div>
                <div className="text-xl font-bold text-red-400">{redCorner.name}</div>
                <div className="text-sm text-gray-400">{redCorner.weight}kg</div>
              </div>
            </div>
          </SpotlightCard>

          {/* 컨트롤 버튼 */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-full py-16 rounded-xl text-white text-6xl font-bold transition-all hover:scale-105 shadow-2xl ${
              isPlaying 
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600'
                : 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 animate-pulse'
            }`}
          >
            {isPlaying ? '⏸️ 일시정지' : '▶️ 시작 / 재개'}
          </button>

          {/* RSC 버튼 */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                if (confirm(`청코너 ${blueCorner.name} 선수를 RSC 승리로 처리하시겠습니까?`)) {
                  handleRSC('blue');
                }
              }}
              className="py-8 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-lg"
            >
              <div className="text-4xl mb-2">🔵</div>
              <div className="text-xl">청코너 RSC</div>
              <div className="text-sm opacity-80 mt-1">{blueCorner.name}</div>
            </button>
            <button
              onClick={() => {
                if (confirm(`홍코너 ${redCorner.name} 선수를 RSC 승리로 처리하시겠습니까?`)) {
                  handleRSC('red');
                }
              }}
              className="py-8 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-lg"
            >
              <div className="text-4xl mb-2">🔴</div>
              <div className="text-xl">홍코너 RSC</div>
              <div className="text-sm opacity-80 mt-1">{redCorner.name}</div>
            </button>
          </div>

          {/* 이전 라운드 기록 */}
          {currentRound > 1 && (
            <SpotlightCard className="p-4">
              <h4 className="text-sm font-bold text-white mb-3 text-center">이전 라운드 기록</h4>
              <div className="grid grid-cols-1 gap-2">
                {[...Array(currentRound - 1)].map((_, idx) => {
                  const round = idx + 1;
                  const score = scores[`round${round}`];
                  if (!score) return null;
                  return (
                    <div key={round} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-sm text-gray-400">Round {round}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-blue-400">{score.blue}</span>
                        <span className="text-sm text-gray-500">-</span>
                        <span className="text-sm font-bold text-red-400">{score.red}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          score.dominant === 'blue' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {score.dominant === 'blue' ? '청우세' : '홍우세'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* 현재 총점 */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-400">현재 총점</span>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-blue-400">
                      {[...Array(currentRound - 1)].reduce((sum, _, idx) => {
                        return sum + (scores[`round${idx + 1}`]?.blue || 0);
                      }, 0)}
                    </span>
                    <span className="text-lg text-gray-500">-</span>
                    <span className="text-lg font-bold text-red-400">
                      {[...Array(currentRound - 1)].reduce((sum, _, idx) => {
                        return sum + (scores[`round${idx + 1}`]?.red || 0);
                      }, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          )}
        </div>
      )}

      {/* Phase 3: Rest - 휴식 및 채점 */}
      {phase === 'rest' && (
        <div className="space-y-6">
          {/* 휴식 시간 */}
          <SpotlightCard className="p-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400 mb-2">ROUND {currentRound} 종료</div>
              <div className="text-4xl font-bold text-white mb-4">휴식 {formatTime(restTime)}</div>
            </div>
          </SpotlightCard>

          {/* 채점 */}
          {!scores[`round${currentRound}`] && (
            <SpotlightCard className="p-6">
              <h3 className="text-xl font-bold text-white mb-6 text-center">📝 ROUND {currentRound} 채점</h3>
              
              {/* 점수 입력 그리드 */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* 청코너 */}
                <div>
                  <div className="text-center mb-3">
                    <div className="text-2xl mb-1">🔵</div>
                    <h4 className="text-lg font-bold text-blue-400">{blueCorner.name}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[10, 9, 8, 7].map(score => (
                      <button
                        key={score}
                        onClick={() => setCurrentScoreInput(prev => ({ ...prev, blue: score }))}
                        className={`py-4 rounded-lg font-bold text-xl transition-all ${
                          currentScoreInput.blue === score
                            ? 'bg-blue-500 text-white scale-105 shadow-lg'
                            : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                        }`}
                      >
                        {score}점
                      </button>
                    ))}
                  </div>
                </div>

                {/* 홍코너 */}
                <div>
                  <div className="text-center mb-3">
                    <div className="text-2xl mb-1">🔴</div>
                    <h4 className="text-lg font-bold text-red-400">{redCorner.name}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[10, 9, 8, 7].map(score => (
                      <button
                        key={score}
                        onClick={() => setCurrentScoreInput(prev => ({ ...prev, red: score }))}
                        className={`py-4 rounded-lg font-bold text-xl transition-all ${
                          currentScoreInput.red === score
                            ? 'bg-red-500 text-white scale-105 shadow-lg'
                            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        }`}
                      >
                        {score}점
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 우세 선택 */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-white mb-3 text-center">라운드 우세</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCurrentScoreInput(prev => ({ ...prev, dominant: 'blue' }))}
                    className={`py-4 rounded-xl font-bold transition-all ${
                      currentScoreInput.dominant === 'blue'
                        ? 'bg-blue-500 text-white scale-105 shadow-lg'
                        : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">🔵</div>
                    <div>청코너 우세</div>
                  </button>
                  <button
                    onClick={() => setCurrentScoreInput(prev => ({ ...prev, dominant: 'red' }))}
                    className={`py-4 rounded-xl font-bold transition-all ${
                      currentScoreInput.dominant === 'red'
                        ? 'bg-red-500 text-white scale-105 shadow-lg'
                        : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">🔴</div>
                    <div>홍코너 우세</div>
                  </button>
                </div>
              </div>

              {/* 현재 입력 상태 미리보기 */}
              {(currentScoreInput.blue !== null || currentScoreInput.red !== null) && (
                <div className="mb-4 p-4 bg-white/5 rounded-lg">
                  <div className="text-center text-sm text-gray-400 mb-2">현재 입력</div>
                  <div className="flex items-center justify-center gap-4 text-2xl font-bold">
                    <span className={currentScoreInput.blue !== null ? 'text-blue-400' : 'text-gray-600'}>
                      {currentScoreInput.blue ?? '-'}
                    </span>
                    <span className="text-gray-500">:</span>
                    <span className={currentScoreInput.red !== null ? 'text-red-400' : 'text-gray-600'}>
                      {currentScoreInput.red ?? '-'}
                    </span>
                  </div>
                  {currentScoreInput.dominant && (
                    <div className="text-center mt-2">
                      <span className={`text-sm font-bold ${
                        currentScoreInput.dominant === 'blue' ? 'text-blue-400' : 'text-red-400'
                      }`}>
                        {currentScoreInput.dominant === 'blue' ? '청코너 우세' : '홍코너 우세'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 점수 제출 버튼 */}
              <button
                onClick={() => {
                  if (canSubmitScore()) {
                    handleScoreSelect(currentRound, currentScoreInput.blue, currentScoreInput.red, currentScoreInput.dominant);
                  }
                }}
                disabled={!canSubmitScore()}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  canSubmitScore()
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white hover:scale-105'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {canSubmitScore() ? '✅ 점수 제출' : '점수와 우세를 선택하세요'}
              </button>
            </SpotlightCard>
          )}

          {/* 채점 완료 표시 */}
          {scores[`round${currentRound}`] && (
            <SpotlightCard className="p-6 bg-emerald-500/10 border border-emerald-500/50">
              <div className="text-center">
                <div className="text-2xl mb-2">✅</div>
                <div className="text-lg font-bold text-white mb-2">
                  ROUND {currentRound} 점수: {scores[`round${currentRound}`].blue} - {scores[`round${currentRound}`].red}
                </div>
                <div className={`text-sm font-bold ${
                  scores[`round${currentRound}`].dominant === 'blue' ? 'text-blue-400' : 'text-red-400'
                }`}>
                  {scores[`round${currentRound}`].dominant === 'blue' ? '청코너 우세' : '홍코너 우세'}
                </div>
              </div>
            </SpotlightCard>
          )}

          {/* 이전 라운드 기록 */}
          {currentRound > 1 && (
            <SpotlightCard className="p-4">
              <h4 className="text-sm font-bold text-white mb-3 text-center">이전 라운드 기록</h4>
              <div className="space-y-2">
                {[...Array(currentRound - 1)].map((_, idx) => {
                  const round = idx + 1;
                  const score = scores[`round${round}`];
                  if (!score) return null;
                  return (
                    <div key={round} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-sm text-gray-400">Round {round}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-blue-400">{score.blue}</span>
                        <span className="text-sm text-gray-500">-</span>
                        <span className="text-sm font-bold text-red-400">{score.red}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          score.dominant === 'blue' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {score.dominant === 'blue' ? '청우세' : '홍우세'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SpotlightCard>
          )}
        </div>
      )}

      {/* Phase 4: Finish - 판정 */}
      {phase === 'finish' && (
        <div className="space-y-6">
          <SpotlightCard className="p-8 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🏆</div>
              <div className="text-3xl font-bold text-yellow-400 mb-2">
                {finishMethod === 'rsc' ? 'RSC 승리!' : '판정 승리!'}
              </div>
              <div className="text-5xl font-bold text-white mb-4">{calculateWinner()?.name}</div>
              {finishMethod === 'rsc' ? (
                <div className="text-xl text-gray-400">
                  ROUND {currentRound} - Referee Stops Contest
                </div>
              ) : (
                <div className="text-xl text-gray-400">
                  {blueCorner.name} {(scores.round1?.blue || 0) + (scores.round2?.blue || 0) + (scores.round3?.blue || 0)} - {(scores.round1?.red || 0) + (scores.round2?.red || 0) + (scores.round3?.red || 0)} {redCorner.name}
                </div>
              )}
            </div>

            {/* 최종 로그 (판정인 경우만) */}
            {finishMethod === 'decision' && (
              <div className="mb-6">
                <h4 className="text-lg font-bold text-white mb-4 text-center">📊 경기 기록</h4>
                
                {/* 라운드별 상세 기록 */}
                <div className="space-y-3 mb-4">
                  {[1, 2, 3].map(round => {
                    const score = scores[`round${round}`];
                    if (!score) return null;
                    return (
                      <div key={round} className="p-4 bg-white/5 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-gray-400">ROUND {round}</span>
                          <span className={`text-xs px-2 py-1 rounded font-bold ${
                            score.dominant === 'blue' 
                              ? 'bg-blue-500/20 text-blue-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {score.dominant === 'blue' ? '청코너 우세' : '홍코너 우세'}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-4">
                          <div className="text-center">
                            <div className="text-xs text-blue-400 mb-1">청코너</div>
                            <div className="text-3xl font-bold text-blue-400">{score.blue}</div>
                          </div>
                          <span className="text-2xl text-gray-500">-</span>
                          <div className="text-center">
                            <div className="text-xs text-red-400 mb-1">홍코너</div>
                            <div className="text-3xl font-bold text-red-400">{score.red}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 총점 */}
                <div className="p-6 bg-gradient-to-r from-blue-500/10 to-red-500/10 rounded-xl border-2 border-white/20">
                  <div className="text-center mb-3">
                    <div className="text-sm text-gray-400 mb-2">총점</div>
                    <div className="flex items-center justify-center gap-6">
                      <div className="text-center">
                        <div className="text-sm text-blue-400 mb-1">{blueCorner.name}</div>
                        <div className="text-5xl font-bold text-blue-400">
                          {(scores.round1?.blue || 0) + (scores.round2?.blue || 0) + (scores.round3?.blue || 0)}
                        </div>
                      </div>
                      <span className="text-3xl text-gray-500">-</span>
                      <div className="text-center">
                        <div className="text-sm text-red-400 mb-1">{redCorner.name}</div>
                        <div className="text-5xl font-bold text-red-400">
                          {(scores.round1?.red || 0) + (scores.round2?.red || 0) + (scores.round3?.red || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 우세 라운드 통계 */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                      <div className="text-xs text-blue-400 mb-1">청코너 우세 라운드</div>
                      <div className="text-2xl font-bold text-blue-400">
                        {[1, 2, 3].filter(r => scores[`round${r}`]?.dominant === 'blue').length}R
                      </div>
                    </div>
                    <div className="text-center p-3 bg-red-500/10 rounded-lg">
                      <div className="text-xs text-red-400 mb-1">홍코너 우세 라운드</div>
                      <div className="text-2xl font-bold text-red-400">
                        {[1, 2, 3].filter(r => scores[`round${r}`]?.dominant === 'red').length}R
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RSC 정보 */}
            {finishMethod === 'rsc' && (
              <div className="mb-6 p-4 bg-white/5 rounded-xl">
                <div className="text-center">
                  <div className="text-sm text-gray-400 mb-2">경기 종료 방식</div>
                  <div className="text-2xl font-bold text-white mb-2">RSC (Referee Stops Contest)</div>
                  <div className="text-sm text-gray-500">심판 경기 중지</div>
                </div>
              </div>
            )}

            <button
              onClick={resetMatch}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all hover:scale-105"
            >
              다음 매치 잡기
            </button>
          </SpotlightCard>
        </div>
      )}
    </div>
  );
};

// 관리자 페이지 (코치)
const AdminManagementView = ({ t = (key) => key, setActiveTab }) => {
  return (
    <div className="animate-fade-in-up">
      <PageHeader 
        title={t('management')} 
        description="시설 및 운영 관리"
        onBack={() => setActiveTab('insights')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 시설 관리 */}
        <SpotlightCard className="p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span>🏢</span>
            <span>시설 현황</span>
          </h3>
          <div className="space-y-4">
            {[
              { name: '웨이트 트레이닝 존', capacity: 20, current: 15, status: 'active' },
              { name: '유산소 운동 구역', capacity: 15, current: 8, status: 'active' },
              { name: '그룹 레슨룸 A', capacity: 12, current: 12, status: 'full' },
              { name: '그룹 레슨룸 B', capacity: 12, current: 0, status: 'maintenance' },
            ].map((facility, i) => (
              <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-white">{facility.name}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    facility.status === 'full' ? 'bg-red-500/20 text-red-400' :
                    facility.status === 'maintenance' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {facility.status === 'full' ? '만석' : facility.status === 'maintenance' ? '점검중' : '운영중'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        facility.status === 'full' ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${(facility.current / facility.capacity) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-400">{facility.current}/{facility.capacity}</span>
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>

        {/* 매출 현황 */}
        <SpotlightCard className="p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span>💰</span>
            <span>이번 달 매출</span>
          </h3>
          <div className="mb-6">
            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-400 mb-2">
              ₩8,450,000
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-emerald-400 font-bold">▲ 12.5%</span>
              <span className="text-gray-400">전월 대비</span>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: '회원권 매출', amount: 6200000, percentage: 73 },
              { label: 'PT 매출', amount: 1800000, percentage: 21 },
              { label: '부가 서비스', amount: 450000, percentage: 6 },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-lg bg-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">{item.label}</span>
                  <span className="text-lg font-bold text-white">₩{item.amount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>

        {/* 코치 관리 */}
        <SpotlightCard className="p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span>👨‍🏫</span>
            <span>코치진</span>
          </h3>
          <div className="space-y-3">
            {[
              { name: '강민수', specialty: 'PT / 웨이트', students: 15, rating: 4.9 },
              { name: '김서연', specialty: '크로스핏', students: 22, rating: 4.8 },
              { name: '이준호', specialty: '필라테스 / 요가', students: 18, rating: 4.7 },
            ].map((coach, i) => (
              <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg">
                    {coach.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white mb-1">{coach.name}</div>
                    <div className="text-xs text-gray-400">{coach.specialty}</div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 mb-1">
                      <Icon type="star" size={14} className="text-yellow-400" fill="currentColor" />
                      <span className="text-sm font-bold text-yellow-400">{coach.rating}</span>
                    </div>
                    <div className="text-xs text-gray-500">{coach.students}명 담당</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>

        {/* 공지사항 관리 */}
        <SpotlightCard className="p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span>📢</span>
            <span>공지사항</span>
          </h3>
          <div className="space-y-3">
            {[
              { title: '설 연휴 휴관 안내', date: '2024-02-08', important: true },
              { title: '신규 기구 입고 완료', date: '2024-02-05', important: false },
              { title: '2월 이벤트 안내', date: '2024-02-01', important: false },
            ].map((notice, i) => (
              <div key={i} className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {notice.important && (
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold">중요</span>
                      )}
                      <span className="font-bold text-white">{notice.title}</span>
                    </div>
                    <div className="text-xs text-gray-500">{notice.date}</div>
                  </div>
                  <Icon type="chevronRight" size={16} className="text-gray-500" />
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold transition-all">
            공지사항 작성하기
          </button>
        </SpotlightCard>
      </div>
    </div>
  );
};

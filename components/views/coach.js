'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon, PageHeader, SpotlightCard, BackgroundGrid, THEME_ATHLETE, THEME_COACH, getMenuStructure } from '@/components/ui';
import ProfileAvatarImg from '@/components/ProfileAvatarImg';
import { translations } from '@/lib/translations';
import { useAuth } from '@/lib/AuthContext';
import {
  BIRTH_YEAR_OPTIONS,
  MONTH_OPTIONS,
  BIRTH_DAY_OPTIONS,
  isValidCalendarDate,
  birthPartsToIso,
} from '@/lib/birthDate';
import { checkEmailAvailable } from '@/lib/emailAvailability';
// 코치 뷰들

const CoachInsightsView = ({ t = (key) => key, setActiveTab }) => (
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
            { name: '김철수', streak: 30, trend: '+15', avatar: '🥊' },
            { name: '이영희', streak: 28, trend: '+12', avatar: '🥋' },
            { name: '박민준', streak: 25, trend: '+10', avatar: '⚡' },
            { name: '정지훈', streak: 22, trend: '+8', avatar: '🔥' },
            { name: '최동욱', streak: 20, trend: '+7', avatar: '💪' },
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
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-gray-400 flex-wrap">
                      <span className="whitespace-nowrap">🔥 {player.streak}{t('consecutiveDays')}</span>
                      <span className="text-emerald-400 font-bold whitespace-nowrap">{player.trend}</span>
                    </div>
                  </div>
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
  </div>
);

/** 전화번호에 자동으로 하이픈 포맷을 적용한다 (숫자만 추출 후 한국 형식으로 분할) */
function formatPhoneNumber(value) {
  if (value == null) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  // 휴대전화(010/011/016/017/018/019) - 11자리
  if (/^(010|011|016|017|018|019)/.test(digits)) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  // 서울(02)
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  // 기타 지역 (0XX)
  if (/^0\d\d/.test(digits)) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  return digits;
}

/** users + statistics 조인 행 → 회원관리 UI 객체 */
function mapGymMemberRow(row) {
  const stats = row.statistics || {};
  const priv = row.user_private_profiles;
  const wins = Number(stats.wins) || 0;
  const losses = Number(stats.losses) || 0;
  const draws = Number(stats.draws) || 0;
  const totalMatches = Number(stats.total_matches) || 0;
  const totalAttendance = Number(stats.total_attendance) || 0;
  const displayName = row.nickname || row.name || '이름 미등록';
  const membershipKo =
    {
      basic: '베이직',
      standard: '스탠다드',
      premium: '프리미엄',
    }[row.membership_type] || (row.membership_type ? String(row.membership_type) : '—');
  const genderKo =
    row.gender === 'male' ? '남성' : row.gender === 'female' ? '여성' : '—';
  const joinDate = row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : '—';
  const birthStr = priv?.birth_date ? String(priv.birth_date).slice(0, 10) : '—';
  const hasActivity = totalAttendance > 0 || totalMatches > 0;
  const winRatePct =
    totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0;
  const memoRaw = row.boxing_style ? String(row.boxing_style) : '';
  const addrMatch = memoRaw.match(/^주소:\s*([^\n]+)/);
  const addressDisplay = addrMatch ? addrMatch[1].trim() : '—';
  const notesDisplay =
    memoRaw.replace(/^주소:\s*[^\n]+\n?/, '').trim() ||
    (memoRaw && !addrMatch ? memoRaw : '—');

  const membershipTypeKey = ['basic', 'standard', 'premium'].includes(row.membership_type)
    ? row.membership_type
    : 'basic';
  const genderKey = row.gender === 'female' ? 'female' : 'male';
  const birthDateIso = priv?.birth_date ? String(priv.birth_date).slice(0, 10) : '';

  return {
    id: row.id,
    gymUserId: row.gym_user_id || null,
    userRole: row.role || 'player_common',
    name: displayName,
    nameRaw: row.name || null,
    nicknameRaw: row.nickname || null,
    membershipTypeKey,
    genderKey,
    birthDateIso,
    status: hasActivity ? 'active' : 'inactive',
    tier: row.tier || '—',
    level: 0,
    rankLabel: '',
    avatarUrl: row.avatar_url || null,
    attendance: totalAttendance,
    lastVisit: '—',
    phone: priv?.phone ? formatPhoneNumber(priv.phone) : '—',
    membershipType: membershipKo,
    email: row.email || '—',
    birthDate: birthStr,
    gender: genderKo,
    weight: row.weight != null ? Number(row.weight) : null,
    height: row.height != null ? row.height : null,
    joinDate,
    address: addressDisplay,
    emergencyContact: priv?.representative_phone ? formatPhoneNumber(priv.representative_phone) : '—',
    notes: notesDisplay,
    wins,
    losses,
    draws,
    totalMatches,
    winRate: winRatePct,
    recentRecords: [],
    skills: [],
  };
}

const NEW_MEMBER_FORM_INITIAL = {
  name: '',
  email: '',
  phone: '',
  birthYear: '',
  birthMonth: '',
  birthDay: '',
  gender: '남성',
  weight: '',
  height: '',
  address: '',
  emergencyContact: '',
  notes: '',
};

/** 체육관 신규 회원 등록 — 전체 페이지 */
const GymNewMemberRegisterView = ({ t = (key) => key, setActiveTab, onBack }) => {
  const { profile } = useAuth();
  const [registeringMember, setRegisteringMember] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState(NEW_MEMBER_FORM_INITIAL);
  const [emailCheckStatus, setEmailCheckStatus] = useState('idle');

  const gymName = (profile?.gym_name && String(profile.gym_name).trim()) || '';

  const handleRegisterNewMember = async () => {
    if (!profile?.id || !gymName) {
      alert('체육관 프로필(체육관명)이 없습니다. 마이페이지에서 설정해 주세요.');
      return;
    }
    const email = newMemberForm.email.trim();
    const name = newMemberForm.name.trim();
    if (!email || !name) {
      alert('이름과 이메일은 필수입니다.');
      return;
    }
    if (emailCheckStatus !== 'available') {
      alert('이메일(아이디) 중복 확인을 완료해 주세요.');
      return;
    }
    if (!newMemberForm.birthYear || !newMemberForm.birthMonth || !newMemberForm.birthDay) {
      alert('생년월일을 모두 선택해 주세요.');
      return;
    }
    if (!isValidCalendarDate(newMemberForm.birthYear, newMemberForm.birthMonth, newMemberForm.birthDay)) {
      alert('올바른 생년월일을 선택해 주세요.');
      return;
    }
    const birthDateIso = birthPartsToIso(
      newMemberForm.birthYear,
      newMemberForm.birthMonth,
      newMemberForm.birthDay
    );
    const pwd = birthDateIso.replace(/-/g, '');
    if (!/^\d{8}$/.test(pwd)) {
      alert('생년월일을 확인해 주세요.');
      return;
    }
    const genderMap = { 남성: 'male', 여성: 'female' };

    const memoParts = [];
    if (newMemberForm.address.trim()) memoParts.push(`주소: ${newMemberForm.address.trim()}`);
    if (newMemberForm.notes.trim()) memoParts.push(newMemberForm.notes.trim());
    const notesCombined = memoParts.join('\n');

    setRegisteringMember(true);
    try {
      const { signUp } = await import('@/lib/supabase');
      const { error } = await signUp(email, pwd, {
        name,
        role: 'player_common',
        gym_name: gymName,
        gym_user_id: profile.id,
        phone: newMemberForm.phone.trim() || undefined,
        birth_date: birthDateIso,
        representative_phone: newMemberForm.emergencyContact.trim() || undefined,
        membership_type: 'basic',
        gender: genderMap[newMemberForm.gender] || 'male',
        height: newMemberForm.height ? parseInt(newMemberForm.height, 10) : undefined,
        weight: newMemberForm.weight ? parseFloat(newMemberForm.weight) : undefined,
        notes: notesCombined || undefined,
      });
      if (error) {
        alert(error.message || '등록에 실패했습니다.');
        return;
      }
      alert('회원 계정이 생성되었습니다. 생년월일(YYYYMMDD)을 초기 비밀번호로 안내해 주세요.');
      setNewMemberForm({ ...NEW_MEMBER_FORM_INITIAL });
      setEmailCheckStatus('idle');
      setActiveTab('players');
    } catch (e) {
      alert(e.message || '등록에 실패했습니다.');
    } finally {
      setRegisteringMember(false);
    }
  };

  const cancelRegistration = () => {
    setNewMemberForm({ ...NEW_MEMBER_FORM_INITIAL });
    setEmailCheckStatus('idle');
    if (onBack) onBack();
  };

  return (
    <div className="animate-fade-in-up w-full">
      <PageHeader
        title={t('newMemberRegistration')}
        onBack={cancelRegistration}
      />

      {!gymName && (
        <SpotlightCard className="p-4 mb-4 border border-amber-500/30 bg-amber-500/10">
          <p className="text-base text-amber-200">체육관명이 프로필에 없습니다. 마이페이지에서 체육관명을 설정한 뒤 다시 시도해 주세요.</p>
        </SpotlightCard>
      )}

      <div className="space-y-6 sm:space-y-8 pb-8">
        <div>
          <h3 className="text-2xl sm:text-3xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-2">
            <span>기본 정보</span>
            <span className="text-red-400">*</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-base sm:text-lg font-bold text-white mb-2.5">
                이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newMemberForm.name}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                placeholder="홍길동"
                className="w-full px-4 py-4 bg-white/[0.07] border border-white/15 rounded-xl text-base sm:text-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-base sm:text-lg font-bold text-white mb-2.5">
                이메일 (아이디) <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={newMemberForm.email}
                  onChange={(e) => {
                    setNewMemberForm({ ...newMemberForm, email: e.target.value });
                    setEmailCheckStatus('idle');
                  }}
                  placeholder="example@email.com"
                  className="flex-1 min-w-0 px-4 py-4 bg-white/[0.07] border border-white/15 rounded-xl text-base sm:text-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all"
                  autoComplete="email"
                />
                <button
                  type="button"
                  disabled={
                    registeringMember ||
                    !newMemberForm.email.trim() ||
                    emailCheckStatus === 'checking'
                  }
                  onClick={async () => {
                    setEmailCheckStatus('checking');
                    const r = await checkEmailAvailable(newMemberForm.email);
                    if (!r.ok) {
                      setEmailCheckStatus(r.error === 'service_unavailable' ? 'unavailable' : 'error');
                      alert(
                        r.error === 'service_unavailable'
                          ? '이메일 확인 서비스를 사용할 수 없습니다. 환경 설정(SUPABASE_SERVICE_ROLE_KEY)을 확인해 주세요.'
                          : '이메일 확인 중 오류가 발생했습니다.'
                      );
                      return;
                    }
                    setEmailCheckStatus(r.available ? 'available' : 'taken');
                    if (!r.available) {
                      alert('이미 사용 중인 이메일입니다. 다른 이메일을 입력해 주세요.');
                    }
                  }}
                  className="shrink-0 px-5 py-4 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 text-white text-base sm:text-lg font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {emailCheckStatus === 'checking' ? '확인 중…' : '중복 확인'}
                </button>
              </div>
              {emailCheckStatus === 'available' && (
                <p className="text-base text-emerald-400 mt-2 font-medium">사용 가능한 이메일입니다.</p>
              )}
              {emailCheckStatus === 'taken' && (
                <p className="text-base text-red-400 mt-2 font-medium">이미 등록된 이메일입니다.</p>
              )}
            </div>
            <div>
              <label className="block text-base sm:text-lg font-bold text-white mb-2.5">
                연락처 <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={newMemberForm.phone}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: formatPhoneNumber(e.target.value) })}
                placeholder="010-1234-5678"
                className="w-full px-4 py-4 bg-white/[0.07] border border-white/15 rounded-xl text-base sm:text-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-base sm:text-lg font-bold text-white mb-2.5">
                생년월일 <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">연도</label>
                  <select
                    value={newMemberForm.birthYear}
                    onChange={(e) =>
                      setNewMemberForm({ ...newMemberForm, birthYear: e.target.value })
                    }
                    className="w-full px-2 sm:px-3 py-4 bg-white/[0.07] border border-white/15 rounded-xl text-white focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all text-base sm:text-lg"
                  >
                    <option value="">선택</option>
                    {BIRTH_YEAR_OPTIONS.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}년
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">월</label>
                  <select
                    value={newMemberForm.birthMonth}
                    onChange={(e) =>
                      setNewMemberForm({ ...newMemberForm, birthMonth: e.target.value })
                    }
                    className="w-full px-2 sm:px-3 py-4 bg-white/[0.07] border border-white/15 rounded-xl text-white focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all text-base sm:text-lg"
                  >
                    <option value="">선택</option>
                    {MONTH_OPTIONS.map((mo) => (
                      <option key={mo} value={String(mo)}>
                        {mo}월
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">일</label>
                  <select
                    value={newMemberForm.birthDay}
                    onChange={(e) =>
                      setNewMemberForm({ ...newMemberForm, birthDay: e.target.value })
                    }
                    className="w-full px-2 sm:px-3 py-4 bg-white/[0.07] border border-white/15 rounded-xl text-white focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all text-base sm:text-lg"
                  >
                    <option value="">선택</option>
                    {BIRTH_DAY_OPTIONS.map((day) => (
                      <option key={day} value={String(day)}>
                        {day}일
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-base sm:text-lg font-bold text-white mb-2.5">
                성별 <span className="text-red-400">*</span>
              </label>
              <select
                value={newMemberForm.gender}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, gender: e.target.value })}
                className="w-full px-4 py-4 bg-white/[0.07] border border-white/15 rounded-xl text-base sm:text-lg text-white focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all"
              >
                <option value="남성">남성</option>
                <option value="여성">여성</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-2xl sm:text-3xl font-bold text-white mb-5 sm:mb-6">신체 정보</h3>
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-base sm:text-lg font-bold text-white mb-2.5">체중 (kg)</label>
              <input
                type="number"
                value={newMemberForm.weight}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, weight: e.target.value })}
                placeholder="70"
                className="w-full px-4 py-4 bg-white/[0.07] border border-white/15 rounded-xl text-base sm:text-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-base sm:text-lg font-bold text-white mb-2.5">신장 (cm)</label>
              <input
                type="number"
                value={newMemberForm.height}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, height: e.target.value })}
                placeholder="175"
                className="w-full px-4 py-4 bg-white/[0.07] border border-white/15 rounded-xl text-base sm:text-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-2xl sm:text-3xl font-bold text-white mb-5 sm:mb-6">연락 정보</h3>
          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            <div>
              <label className="block text-base sm:text-lg font-bold text-white mb-2.5">주소</label>
              <input
                type="text"
                value={newMemberForm.address}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, address: e.target.value })}
                placeholder="서울시 강남구"
                className="w-full px-4 py-4 bg-white/[0.07] border border-white/15 rounded-xl text-base sm:text-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-base sm:text-lg font-bold text-white mb-2.5">비상연락처</label>
              <input
                type="tel"
                value={newMemberForm.emergencyContact}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, emergencyContact: formatPhoneNumber(e.target.value) })}
                placeholder="010-9876-5432"
                className="w-full px-4 py-4 bg-white/[0.07] border border-white/15 rounded-xl text-base sm:text-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleRegisterNewMember}
            disabled={registeringMember || !gymName}
            className="w-full py-5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold text-lg sm:text-xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50"
          >
            {registeringMember ? '등록 중…' : '등록 완료'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 회원 관리 페이지 (코치)
const PlayersManagementView = ({ t = (key) => key, setActiveTab, onBack }) => {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all | active | inactive | athlete
  const [selectedMember, setSelectedMember] = useState(null); // 상세보기 모달용
  const memberModalScrollRef = useRef(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState(null);
  /** 'info' | 'edit' | 'attendance' */
  const [memberDetailMode, setMemberDetailMode] = useState('info');
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);
  const [memberEditSaving, setMemberEditSaving] = useState(false);
  const [memberEditForm, setMemberEditForm] = useState(null);
  const [deleteStep, setDeleteStep] = useState(0);
  const [showResetPw, setShowResetPw] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');
  const [deletingMember, setDeletingMember] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const gymName = (profile?.gym_name && String(profile.gym_name).trim()) || '';

  // 모달 열릴 때마다 모달 내부 스크롤만 맨 위로 (페이지는 그대로)
  // selectedMember?.id 만 의존 — 객체 reference 변화에 휘둘리지 않음
  useEffect(() => {
    if (selectedMember?.id && memberModalScrollRef.current) {
      memberModalScrollRef.current.scrollTop = 0;
    }
  }, [selectedMember?.id, memberDetailMode]);

  const openMemberEditForm = (m) => {
    if (!m) return;
    setMemberEditForm({
      displayName: (m.nicknameRaw || m.nameRaw || m.name || '').trim() || '',
      phone: m.phone && m.phone !== '—' ? m.phone : '',
      birthDate: m.birthDateIso || '',
      gender: m.genderKey || 'male',
      height: m.height != null ? String(m.height) : '',
      weight: m.weight != null ? String(m.weight) : '',
      membership_type: m.membershipTypeKey || 'basic',
      address: m.address && m.address !== '—' ? m.address : '',
      notes: m.notes && m.notes !== '—' ? m.notes : '',
      representative_phone: m.emergencyContact && m.emergencyContact !== '—' ? m.emergencyContact : '',
    });
    setMemberDetailMode('edit');
    setActionMessage(null);
  };

  const openAttendancePanel = async (m) => {
    if (!m?.id) return;
    setMemberDetailMode('attendance');
    setAttendanceRows([]);
    setAttendanceError(null);
    setAttendanceLoading(true);
    try {
      const { getSupabase, isSupabaseConfigured } = await import('@/lib/supabase');
      if (typeof isSupabaseConfigured === 'function' && !isSupabaseConfigured()) {
        setAttendanceError('Supabase가 설정되지 않았습니다.');
        setAttendanceLoading(false);
        return;
      }
      const supa = getSupabase();
      const { data: sessionData } = await supa.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setAttendanceError('로그인이 필요합니다.');
        setAttendanceLoading(false);
        return;
      }
      const res = await fetch(`/api/gym-members/${encodeURIComponent(m.id)}/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAttendanceError(json.error || '출석 기록을 불러오지 못했습니다.');
        setAttendanceRows([]);
      } else {
        setAttendanceRows(Array.isArray(json.rows) ? json.rows : []);
      }
    } catch (e) {
      setAttendanceError(e.message || '출석 기록을 불러오지 못했습니다.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const saveMemberEdit = async () => {
    if (!selectedMember?.id || !memberEditForm) return;
    setMemberEditSaving(true);
    setActionMessage(null);
    try {
      const { getSupabase, isSupabaseConfigured } = await import('@/lib/supabase');
      if (typeof isSupabaseConfigured === 'function' && !isSupabaseConfigured()) {
        setActionMessage({ type: 'err', text: 'Supabase가 설정되지 않았습니다.' });
        return;
      }
      const supa = getSupabase();
      const { data: sessionData } = await supa.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setActionMessage({ type: 'err', text: '로그인이 필요합니다.' });
        return;
      }
      const d = memberEditForm.displayName.trim();
      if (!d) {
        setActionMessage({ type: 'err', text: '이름(표시)을 입력해 주세요.' });
        return;
      }
      const res = await fetch(`/api/gym-members/${encodeURIComponent(selectedMember.id)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: d,
          nickname: d,
          phone: memberEditForm.phone || null,
          birth_date: memberEditForm.birthDate || null,
          gender: memberEditForm.gender,
          height: memberEditForm.height ? parseInt(memberEditForm.height, 10) : null,
          weight: memberEditForm.weight ? parseFloat(memberEditForm.weight) : null,
          membership_type: memberEditForm.membership_type,
          address: memberEditForm.address,
          notes: memberEditForm.notes,
          representative_phone: memberEditForm.representative_phone,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMessage({ type: 'err', text: json.error || '저장에 실패했습니다.' });
        return;
      }
      setActionMessage({ type: 'ok', text: '저장되었습니다.' });
      setMemberDetailMode('info');
      setMemberEditForm(null);
      await loadMembers();
    } catch (e) {
      setActionMessage({ type: 'err', text: e.message || '저장에 실패했습니다.' });
    } finally {
      setMemberEditSaving(false);
    }
  };

  const runDeleteMember = async () => {
    if (!selectedMember?.id) return;
    if (deleteEmailInput.trim().toLowerCase() !== (selectedMember.email || '').toLowerCase()) {
      setActionMessage({ type: 'err', text: '이메일이 일치하지 않습니다.' });
      return;
    }
    setDeletingMember(true);
    setActionMessage(null);
    try {
      const { getSupabase, isSupabaseConfigured } = await import('@/lib/supabase');
      if (typeof isSupabaseConfigured === 'function' && !isSupabaseConfigured()) {
        setActionMessage({ type: 'err', text: 'Supabase가 설정되지 않았습니다.' });
        return;
      }
      const supa = getSupabase();
      const { data: sessionData } = await supa.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setActionMessage({ type: 'err', text: '로그인이 필요합니다.' });
        return;
      }
      const res = await fetch(`/api/gym-members/${encodeURIComponent(selectedMember.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMessage({ type: 'err', text: json.error || '삭제에 실패했습니다.' });
        return;
      }
      setSelectedMember(null);
      setDeleteStep(0);
      setDeleteEmailInput('');
      setMemberDetailMode('info');
      await loadMembers();
    } catch (e) {
      setActionMessage({ type: 'err', text: e.message || '삭제에 실패했습니다.' });
    } finally {
      setDeletingMember(false);
    }
  };

  const runResetPassword = async () => {
    if (!selectedMember?.id) return;
    setResettingPw(true);
    setActionMessage(null);
    try {
      const { getSupabase, isSupabaseConfigured } = await import('@/lib/supabase');
      if (typeof isSupabaseConfigured === 'function' && !isSupabaseConfigured()) {
        setActionMessage({ type: 'err', text: 'Supabase가 설정되지 않았습니다.' });
        return;
      }
      const supa = getSupabase();
      const { data: sessionData } = await supa.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setActionMessage({ type: 'err', text: '로그인이 필요합니다.' });
        return;
      }
      const res = await fetch(`/api/gym-members/${encodeURIComponent(selectedMember.id)}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMessage({ type: 'err', text: json.error || '비밀번호 초기화에 실패했습니다.' });
        return;
      }
      setShowResetPw(false);
      setActionMessage({ type: 'ok', text: '비밀번호가 123456으로 초기화되었습니다.' });
    } catch (e) {
      setActionMessage({ type: 'err', text: e.message || '비밀번호 초기화에 실패했습니다.' });
    } finally {
      setResettingPw(false);
    }
  };

  const closeMemberModal = () => {
    setSelectedMember(null);
    setMemberDetailMode('info');
    setDeleteStep(0);
    setDeleteEmailInput('');
    setMemberEditForm(null);
    setActionMessage(null);
    setAttendanceRows([]);
    setShowResetPw(false);
  };

  const loadMembers = useCallback(async () => {
    if (!gymName) {
      setMembers([]);
      setMembersError(null);
      setMembersLoading(false);
      return;
    }
    setMembersLoading(true);
    setMembersError(null);
    try {
      const { getGymMembersForGym, getRecentAttendanceForUsers } = await import('@/lib/supabase');
      const { data, error } = await getGymMembersForGym({
        gymUserId: profile?.id,
        gymName,
      });
      if (error) {
        setMembersError(error.message || '회원 목록을 불러오지 못했습니다.');
        setMembers([]);
        return;
      }
      const mapped = (data || []).map(mapGymMemberRow);
      // 회원들의 최근 출석 활동 일괄 fetch (한 쿼리)
      const ids = mapped.map((m) => m.id).filter(Boolean);
      const { data: attendanceMap } = await getRecentAttendanceForUsers(ids, 3);
      const merged = mapped.map((m) => ({
        ...m,
        recentAttendance: attendanceMap?.[m.id] || [],
      }));
      setMembers(merged);
    } catch (e) {
      setMembersError(e.message || '회원 목록을 불러오지 못했습니다.');
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [gymName, profile?.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  /** 출석/통계 DB 변경 시 목록 즉시 반영 (키오스크 등 다른 창 포함) */
  useEffect(() => {
    if (!gymName) return;
    let channel;
    let cancelled = false;

    const start = async () => {
      try {
        const { getSupabase, isSupabaseConfigured } = await import('@/lib/supabase');
        if (typeof isSupabaseConfigured !== 'function' || !isSupabaseConfigured() || cancelled) return;
        const supabase = getSupabase();
        channel = supabase
          .channel(`gym-members-live-${gymName}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'attendance' },
            () => loadMembers()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'statistics' },
            () => loadMembers()
          )
          .subscribe();
      } catch (e) {
        console.warn('[PlayersManagement] realtime subscribe:', e);
      }
    };
    start();

    const poll = setInterval(() => {
      if (!cancelled && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadMembers();
      }
    }, 20000);

    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') loadMembers();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
      import('@/lib/supabase').then(({ getSupabase }) => {
        if (channel) getSupabase().removeChannel(channel);
      });
    };
  }, [gymName, loadMembers]);

  /** 목록 새로고침 후 열린 상세 모달도 최신 출석·통계 반영 */
  useEffect(() => {
    setSelectedMember((prev) => {
      if (!prev) return prev;
      const updated = members.find((m) => m.id === prev.id);
      if (!updated) return prev;
      if (
        prev.attendance === updated.attendance &&
        prev.status === updated.status &&
        prev.winRate === updated.winRate &&
        prev.totalMatches === updated.totalMatches
      ) {
        return prev;
      }
      return updated;
    });
  }, [members]);

  const filteredMembers = members.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesFilter = true;
    if (filterStatus === 'active') matchesFilter = m.status === 'active';
    else if (filterStatus === 'inactive') matchesFilter = m.status === 'inactive';
    else if (filterStatus === 'athlete') matchesFilter = m.userRole === 'player_athlete';
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={t('members')}
        onBack={onBack}
      >
        <button
          type="button"
          onClick={() => setActiveTab('gym-register-member')}
          className="flex-shrink-0 px-3 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all hover:scale-105 flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
        >
          <span>+</span>
          <span>신규등록</span>
        </button>
      </PageHeader>

      {!gymName && (
        <SpotlightCard className="p-4 mb-4 border border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-amber-100/90">
            소속 회원만 보려면 <strong className="text-white">마이페이지 프로필</strong>에 이 체육관과 동일한{' '}
            <strong className="text-white">체육관 이름</strong>이 입력되어 있어야 합니다. 회원도 가입·프로필에서 같은 이름으로 소속을 맞춰 주세요.
          </p>
        </SpotlightCard>
      )}

      {/* 통계 숫자 인라인 */}
      <div className="flex items-start gap-6 sm:gap-10 mb-6 sm:mb-8 px-1">
        <div>
          <div className="text-sm sm:text-base font-semibold text-gray-300 mb-1.5">{t('totalMembersCount')}</div>
          <div className="text-4xl sm:text-5xl font-black text-white tabular-nums leading-none">{members.length}</div>
        </div>
        <div className="h-14 sm:h-16 w-px bg-white/10 mt-1" />
        <div>
          <div className="text-sm sm:text-base font-semibold text-gray-300 mb-1.5">{t('activeMembers')}</div>
          <div className="text-3xl sm:text-4xl font-bold text-emerald-400 tabular-nums leading-none">{members.filter((m) => m.status === 'active').length}</div>
        </div>
        <div>
          <div className="text-sm sm:text-base font-semibold text-gray-300 mb-1.5">{t('dormant')}</div>
          <div className="text-3xl sm:text-4xl font-bold text-gray-400 tabular-nums leading-none">{members.filter((m) => m.status === 'inactive').length}</div>
        </div>
      </div>

      {/* 검색 바 */}
      <div className="mb-3 sm:mb-4 relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          id="coach-member-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchMemberName')}
          className="w-full pl-12 pr-4 py-3.5 bg-white/[0.04] border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-white/25 focus:bg-white/[0.06] transition-all text-base"
        />
      </div>

      {/* 필터 칩 */}
      <div className="flex gap-2 mb-5 sm:mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {[
          { key: 'all', label: t('allMembers') },
          { key: 'active', label: t('activeMembers') },
          { key: 'inactive', label: t('dormant') },
          { key: 'athlete', label: t('memberScopeAthletes') },
        ].map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setFilterStatus(filter.key)}
            className={`px-4 py-2.5 rounded-full font-semibold transition-all text-sm sm:text-base whitespace-nowrap flex-shrink-0 ${
              filterStatus === filter.key
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* 회원 목록 - 카드 형태로 완전히 재구성 */}
      <div className="space-y-2.5">
        {membersLoading && (
          <div className="py-16 text-center text-gray-400 text-base">회원 정보를 불러오는 중...</div>
        )}
        {!membersLoading && membersError && (
          <div className="py-16 text-center text-red-400 text-base">{membersError}</div>
        )}
        {!membersLoading && !membersError && !gymName && (
          <div className="py-16 text-center text-gray-400 text-base">체육관 이름이 없어 목록을 불러올 수 없습니다.</div>
        )}
        {!membersLoading && !membersError && gymName && filteredMembers.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-base">
            이 체육관(<span className="text-white font-medium">{gymName}</span>)에 소속으로 등록된 회원이 없습니다.
          </div>
        )}
        {!membersLoading && !membersError && gymName && filteredMembers.map((member) => {
          // 최근 출석 활동 — 가장 최근 1건은 메인 정보 줄에, 추가 2건은 작은 점들로 시각화
          const recent = member.recentAttendance || [];
          const lastAttendance = recent[0];
          const lastAttendanceLabel = (() => {
            if (!lastAttendance) return null;
            const t = lastAttendance.check_in_time
              ? new Date(lastAttendance.check_in_time)
              : (lastAttendance.attendance_date ? new Date(lastAttendance.attendance_date + 'T00:00:00') : null);
            if (!t || Number.isNaN(t.getTime())) return null;
            // 며칠 전인지 상대 표기 (오늘 / 어제 / N일 전 / 30일+)
            const now = new Date();
            const diffMs = now.getTime() - t.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) return '오늘 출석';
            if (diffDays === 1) return '어제 출석';
            if (diffDays < 30) return `${diffDays}일 전 출석`;
            return '30일+ 전';
          })();
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                setMemberDetailMode('info');
                setDeleteStep(0);
                setActionMessage(null);
                setSelectedMember(member);
              }}
              className="w-full p-4 sm:p-5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-white/15 rounded-2xl transition-all text-left flex items-center gap-4 group"
            >
              <div className="relative flex-shrink-0">
                <ProfileAvatarImg
                  avatarUrl={member.avatarUrl}
                  name={member.name}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full text-lg"
                  gradientClassName="bg-gradient-to-br from-blue-500/80 to-purple-600/80"
                />
                <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0A0A0A] ${
                  member.status === 'active' ? 'bg-emerald-400' : 'bg-red-500'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                    {member.nicknameRaw || member.name}
                  </h3>
                  {member.nameRaw && member.nameRaw !== (member.nicknameRaw || member.name) && (
                    <span className="text-xs sm:text-sm text-gray-400 truncate">({member.nameRaw})</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
                  <span className="truncate">{member.phone || '연락처 없음'}</span>
                  {lastAttendanceLabel ? (
                    <>
                      <span className="text-gray-600">·</span>
                      <span className={`whitespace-nowrap font-medium ${
                        lastAttendanceLabel === '오늘 출석' ? 'text-emerald-400'
                        : lastAttendanceLabel === '어제 출석' ? 'text-emerald-300/80'
                        : 'text-gray-400'
                      }`}>
                        {lastAttendanceLabel}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-600">·</span>
                      <span className="whitespace-nowrap text-gray-500">최근 출석 없음</span>
                    </>
                  )}
                </div>
                {/* 최근 3건 점 표시 — 활동 빈도 시각화 */}
                {recent.length > 0 ? (
                  <div className="flex items-center gap-1 mt-1.5">
                    {recent.slice(0, 3).map((r, idx) => (
                      <span
                        key={`${r.attendance_date}-${idx}`}
                        className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400/70"
                        title={r.attendance_date}
                        aria-hidden
                      />
                    ))}
                    <span className="ml-1 text-[10px] text-gray-500 tabular-nums">
                      최근 30일 {recent.length}회
                    </span>
                  </div>
                ) : null}
              </div>
              <Icon type="chevronRight" size={20} className="text-gray-600 group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {/* 회원 상세보기 모달 — Portal로 렌더링하여 transform 컨테이너 영향 제거 */}
      {selectedMember && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-stretch sm:items-center sm:justify-center sm:p-4 animate-fade-in"
          onClick={() => {
            if (deleteStep > 0) {
              setDeleteStep(0);
              setDeleteEmailInput('');
            } else {
              closeMemberModal();
            }
          }}
        >
          <div
            className="relative bg-[#0A0A0A] sm:border sm:border-white/20 sm:rounded-2xl w-full h-full sm:max-w-4xl sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-500/80 to-purple-600/80 flex items-center justify-center text-white font-bold text-xl sm:text-2xl flex-shrink-0">
                    {selectedMember.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-lg sm:text-2xl font-bold text-white truncate">
                        {selectedMember.nicknameRaw || selectedMember.nameRaw || selectedMember.name}
                      </h2>
                      {selectedMember.nameRaw &&
                        selectedMember.nameRaw !== (selectedMember.nicknameRaw || selectedMember.nameRaw || selectedMember.name) && (
                          <span className="text-xs sm:text-sm text-gray-400 truncate">
                            ({selectedMember.nameRaw})
                          </span>
                        )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold whitespace-nowrap ${
                          selectedMember.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {selectedMember.status === 'active' ? '활동중' : '휴면'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">
                      출석 {selectedMember.attendance}일
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeMemberModal}
                  className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all flex-shrink-0"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>
            </div>

            {/* 액션 버튼 — 상단 배치 (info 모드) */}
            {memberDetailMode === 'info' && (
              <div className="px-4 sm:px-5 pt-3 sm:pt-4 flex-shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionMessage(null);
                      openMemberEditForm(selectedMember);
                    }}
                    className="py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/20 hover:border-white/30 text-white rounded-lg font-semibold text-sm transition-all"
                  >
                    정보 수정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionMessage(null);
                      openAttendancePanel(selectedMember);
                    }}
                    className="py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/20 hover:border-white/30 text-white rounded-lg font-semibold text-sm transition-all"
                  >
                    출석 기록
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionMessage(null);
                      setShowResetPw(true);
                    }}
                    className="py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/20 hover:border-white/30 text-white rounded-lg font-semibold text-sm transition-all"
                  >
                    비밀번호 초기화
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionMessage(null);
                      setDeleteEmailInput('');
                      setDeleteStep(1);
                    }}
                    className="py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/20 hover:border-white/30 text-white rounded-lg font-semibold text-sm transition-all"
                  >
                    회원 삭제
                  </button>
                </div>
              </div>
            )}

            {actionMessage?.text && (
              <div
                className={`mx-4 sm:mx-5 mt-2.5 rounded-lg px-3 py-2 text-xs sm:text-sm ${
                  actionMessage.type === 'ok' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-200'
                }`}
              >
                {actionMessage.text}
              </div>
            )}

            {/* 모달 내용 */}
            <div ref={memberModalScrollRef} className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0">
              {memberDetailMode === 'info' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                  <SpotlightCard className="p-4 sm:p-5">
                    <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">기본 정보</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b border-white/5 gap-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">이메일</span>
                        <span className="text-sm text-white font-medium truncate text-right">
                          {selectedMember.email}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5 gap-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">연락처</span>
                        <span className="text-sm text-white font-medium whitespace-nowrap">{selectedMember.phone}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5 gap-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">생년월일</span>
                        <span className="text-sm text-white font-medium whitespace-nowrap">{selectedMember.birthDate}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5 gap-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">성별</span>
                        <span className="text-sm text-white font-medium whitespace-nowrap">{selectedMember.gender}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5 gap-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">가입일</span>
                        <span className="text-sm text-white font-medium whitespace-nowrap">{selectedMember.joinDate}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5 gap-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">주소</span>
                        <span className="text-sm text-white font-medium truncate text-right">{selectedMember.address}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5 gap-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">비상연락처</span>
                        <span className="text-sm text-white font-medium whitespace-nowrap">{selectedMember.emergencyContact}</span>
                      </div>
                      <div className="flex justify-between py-2 gap-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">최근 방문</span>
                        <span className="text-sm text-white font-medium whitespace-nowrap">{selectedMember.lastVisit}</span>
                      </div>
                    </div>
                  </SpotlightCard>

                  <SpotlightCard className="p-4 sm:p-5">
                    <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">신체 정보</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b border-white/5 gap-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">체중</span>
                        <span className="text-sm text-white font-medium whitespace-nowrap tabular-nums">
                          {selectedMember.weight != null ? `${selectedMember.weight}kg` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5 gap-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">신장</span>
                        <span className="text-sm text-white font-medium whitespace-nowrap tabular-nums">
                          {selectedMember.height != null ? `${selectedMember.height}cm` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 gap-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">특이사항</span>
                        <span className="text-sm text-white font-medium truncate text-right">
                          {selectedMember.notes || '—'}
                        </span>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
              )}

              {memberDetailMode === 'edit' && memberEditForm && (
                <div className="space-y-3 sm:space-y-4 max-w-2xl">
                  <p className="text-xs sm:text-sm text-gray-400">회원 프로필을 수정합니다. (로그인 이메일은 변경할 수 없습니다.)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <label className="sm:col-span-2 block">
                      <span className="text-xs text-gray-500 mb-1 block">이름(표시)</span>
                      <input
                        value={memberEditForm.displayName}
                        onChange={(e) => setMemberEditForm((f) => (f ? { ...f, displayName: e.target.value } : f))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label>
                      <span className="text-xs text-gray-500 mb-1 block">연락처</span>
                      <input
                        type="tel"
                        value={memberEditForm.phone}
                        onChange={(e) => setMemberEditForm((f) => (f ? { ...f, phone: formatPhoneNumber(e.target.value) } : f))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label>
                      <span className="text-xs text-gray-500 mb-1 block">생년월일</span>
                      <input
                        type="date"
                        value={memberEditForm.birthDate}
                        onChange={(e) => setMemberEditForm((f) => (f ? { ...f, birthDate: e.target.value } : f))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white [color-scheme:dark]"
                      />
                    </label>
                    <label>
                      <span className="text-xs text-gray-500 mb-1 block">성별</span>
                      <select
                        value={memberEditForm.gender}
                        onChange={(e) => setMemberEditForm((f) => (f ? { ...f, gender: e.target.value } : f))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      >
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-xs text-gray-500 mb-1 block">신장(cm)</span>
                      <input
                        value={memberEditForm.height}
                        onChange={(e) => setMemberEditForm((f) => (f ? { ...f, height: e.target.value } : f))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                        inputMode="numeric"
                      />
                    </label>
                    <label>
                      <span className="text-xs text-gray-500 mb-1 block">체중(kg)</span>
                      <input
                        value={memberEditForm.weight}
                        onChange={(e) => setMemberEditForm((f) => (f ? { ...f, weight: e.target.value } : f))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                        inputMode="decimal"
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="text-xs text-gray-500 mb-1 block">주소</span>
                      <input
                        value={memberEditForm.address}
                        onChange={(e) => setMemberEditForm((f) => (f ? { ...f, address: e.target.value } : f))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="text-xs text-gray-500 mb-1 block">특이사항(메모)</span>
                      <textarea
                        value={memberEditForm.notes}
                        onChange={(e) => setMemberEditForm((f) => (f ? { ...f, notes: e.target.value } : f))}
                        rows={3}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="text-xs text-gray-500 mb-1 block">비상 연락처</span>
                      <input
                        type="tel"
                        value={memberEditForm.representative_phone}
                        onChange={(e) => setMemberEditForm((f) => (f ? { ...f, representative_phone: formatPhoneNumber(e.target.value) } : f))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      />
                    </label>
                  </div>
                </div>
              )}

              {memberDetailMode === 'attendance' && (
                <div>
                  {attendanceLoading && <div className="py-8 text-center text-gray-400">불러오는 중…</div>}
                  {attendanceError && <div className="py-4 text-center text-red-400 text-sm">{attendanceError}</div>}
                  {!attendanceLoading && !attendanceError && (
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                      <table className="min-w-full text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/5">
                            <th className="px-3 py-2 font-bold text-gray-300">체크인 시각</th>
                            <th className="px-3 py-2 font-bold text-gray-300">위치/메모</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceRows.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="px-3 py-6 text-center text-gray-500">
                                출석 기록이 없습니다.
                              </td>
                            </tr>
                          ) : (
                            attendanceRows.map((row) => (
                              <tr key={row.id} className="border-b border-white/5">
                                <td className="px-3 py-2 text-gray-300">
                                  {row.check_in_time
                                    ? new Date(row.check_in_time).toLocaleString('ko-KR', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : (row.attendance_date || '—')}
                                </td>
                                <td className="px-3 py-2 text-gray-400">{row.location || '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>


            {memberDetailMode === 'edit' && (
              <div className="p-2 xs:p-3 sm:p-4 border-t border-white/10 bg-white/5 flex gap-1.5 xs:gap-2 sm:gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setMemberDetailMode('info');
                    setMemberEditForm(null);
                    setActionMessage(null);
                  }}
                  className="flex-1 py-2 xs:py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-[10px] xs:text-xs sm:text-sm"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveMemberEdit}
                  disabled={memberEditSaving}
                  className="flex-1 py-2 xs:py-2.5 sm:py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold text-[10px] xs:text-xs sm:text-sm disabled:opacity-50"
                >
                  {memberEditSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            )}

            {memberDetailMode === 'attendance' && (
              <div className="p-2 xs:p-3 sm:p-4 border-t border-white/10 bg-white/5 flex gap-1.5 xs:gap-2 sm:gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setMemberDetailMode('info');
                    setAttendanceError(null);
                  }}
                  className="flex-1 py-2 xs:py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-[10px] xs:text-xs sm:text-sm"
                >
                  상세로 돌아가기
                </button>
                <button
                  type="button"
                  onClick={closeMemberModal}
                  className="flex-1 py-2 xs:py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-[10px] xs:text-xs sm:text-sm"
                >
                  닫기
                </button>
              </div>
            )}

            {/* 비밀번호 초기화 확인 모달 */}
            {showResetPw && (
              <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6 rounded-2xl bg-black/80 backdrop-blur-sm">
                <div
                  className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#111] p-5 sm:p-6 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-bold text-amber-300 mb-2">비밀번호를 초기화하시겠습니까?</h3>
                  <p className="text-sm text-gray-300 leading-relaxed mb-2">
                    <strong className="text-white">{selectedMember.name}</strong> 회원의 비밀번호가{' '}
                    <strong className="text-amber-200">123456</strong>으로 초기화됩니다.
                  </p>
                  <p className="text-xs text-gray-500 mb-4">초기화 즉시 적용되어 회원이 123456으로 로그인할 수 있습니다. 회원에게 직접 안내해 주세요.</p>
                  {actionMessage?.type === 'err' && actionMessage.text && (
                    <p className="text-red-300 text-xs mb-3 break-words">{actionMessage.text}</p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetPw(false);
                        setActionMessage(null);
                      }}
                      disabled={resettingPw}
                      className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-bold disabled:opacity-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={runResetPassword}
                      disabled={resettingPw}
                      className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold disabled:opacity-50"
                    >
                      {resettingPw ? '초기화 중…' : '123456으로 초기화'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 삭제 확인: 1단계 경고 → 2단계 이메일 입력 */}
            {deleteStep > 0 && (
              <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6 rounded-2xl bg-black/80 backdrop-blur-sm">
                <div
                  className="w-full max-w-md rounded-2xl border border-red-500/40 bg-[#111] p-4 sm:p-6 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {deleteStep === 1 && (
                    <>
                      <h3 className="text-lg font-bold text-red-300 mb-2">회원을 삭제하시겠습니까?</h3>
                      <p className="text-sm text-gray-300 leading-relaxed mb-1">
                        이 작업은 <strong className="text-white">되돌릴 수 없습니다</strong>. 해당 회원의 로그인 계정이 삭제되고, 연동된
                        서비스 데이터가 함께 제거될 수 있습니다.
                      </p>
                      <p className="text-xs text-amber-200/90 mb-4">신중히 결정한 뒤에만 진행해 주세요.</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteStep(0);
                            setDeleteEmailInput('');
                          }}
                          className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-bold"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteStep(2);
                            setDeleteEmailInput('');
                            setActionMessage(null);
                          }}
                          className="flex-1 py-2.5 rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-sm font-bold"
                        >
                          정말 삭제하기
                        </button>
                      </div>
                    </>
                  )}
                  {deleteStep === 2 && (
                    <>
                      <h3 className="text-lg font-bold text-red-300 mb-2">최종 확인</h3>
                      <p className="text-sm text-gray-300 mb-2">
                        삭제를 확정하려면 아래에 이 회원의 <strong className="text-white">이메일 주소</strong>를{' '}
                        <span className="text-amber-200">한 글자도 틀리지 않게</span> 입력하세요.
                      </p>
                      <p className="text-xs text-gray-500 font-mono break-all mb-3 rounded bg-white/5 px-2 py-1.5 border border-white/10">
                        {selectedMember.email}
                      </p>
                      <input
                        type="text"
                        value={deleteEmailInput}
                        onChange={(e) => setDeleteEmailInput(e.target.value)}
                        placeholder="이메일 전체를 입력"
                        className="w-full rounded-lg border border-red-500/40 bg-black/40 px-3 py-2.5 text-sm text-white placeholder-gray-500 mb-3"
                        autoComplete="off"
                      />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteStep(1);
                            setDeleteEmailInput('');
                            setActionMessage(null);
                          }}
                          className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-bold"
                        >
                          이전
                        </button>
                        <button
                          type="button"
                          onClick={runDeleteMember}
                          disabled={
                            deletingMember ||
                            deleteEmailInput.trim().toLowerCase() !== (selectedMember.email || '').toLowerCase()
                          }
                          className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold"
                        >
                          {deletingMember ? '삭제 중…' : '영구 삭제 실행'}
                        </button>
                      </div>
                      {actionMessage?.type === 'err' && actionMessage.text && (
                        <p className="text-red-300 text-xs mt-3 text-center break-words">{actionMessage.text}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/**
 * statistics(또는 public_player_profiles) 기반 전적으로 청 코너 예상 승률(%).
 * 각 선수의 역사적 승률 w/t를 강도로 두고 P(청) = s_b / (s_b + s_r) (단순 로짓/브들리-테리형).
 * 경기 수 0이면 0.5로 두어 50:50에 가깝게.
 */
function computeExpectedBlueWinPercent(blue, red) {
  const strength = (m) => {
    const t = Number(m?.totalMatches) || 0;
    const w = Number(m?.wins) || 0;
    if (t <= 0) return 0.5;
    return w / t;
  };
  const sb = strength(blue);
  const sr = strength(red);
  const den = sb + sr;
  if (den <= 0) return 50;
  return Math.round((sb / den) * 1000) / 10;
}

function matchEmptyScoresMap(roundCount) {
  const n = Math.min(12, Math.max(3, Math.floor(Number(roundCount)) || 3));
  return Object.fromEntries([...Array(n)].map((_, i) => [`round${i + 1}`, null]));
}

function sumCornerPoints(scores, totalRounds, corner) {
  let t = 0;
  for (let r = 1; r <= totalRounds; r++) {
    t += scores[`round${r}`]?.[corner] || 0;
  }
  return t;
}

/** 라운드별 점수로 이긴 라운드 수 (동점 라운드는 미카운트) */
function countRoundsWonOnScore(scores, totalRounds) {
  let blue = 0;
  let red = 0;
  for (let r = 1; r <= totalRounds; r++) {
    const s = scores[`round${r}`];
    if (!s) continue;
    const b = Number(s.blue) || 0;
    const rr = Number(s.red) || 0;
    if (b > rr) blue++;
    else if (rr > b) red++;
  }
  return { blue, red };
}

/**
 * 판정승 승자 (총점 → 홀수 라운드만 이긴 라운드 수).
 * 총점 동점 + 짝수 라운드 → 무승부(라운드 우세로 결정하지 않음).
 */
function resolveDecisionWinnerCorner(scores, totalRounds) {
  const blueTotal = sumCornerPoints(scores, totalRounds, 'blue');
  const redTotal = sumCornerPoints(scores, totalRounds, 'red');
  if (blueTotal > redTotal) return 'blue';
  if (redTotal > blueTotal) return 'red';
  const n = Math.floor(Number(totalRounds)) || 0;
  if (n % 2 === 0) return 'draw';
  const { blue: bRw, red: rRw } = countRoundsWonOnScore(scores, totalRounds);
  if (bRw > rRw) return 'blue';
  if (rRw > bRw) return 'red';
  return 'draw';
}

// ============================================================
// 매치 영속화 — 페이지 떠나도/화면 꺼도 시간이 흘러간 만큼 복원
// ============================================================
const MATCH_STORAGE_KEY = 'sportition_active_match_v1';
const ROUND_DURATION_SEC = 180;
const REST_DURATION_SEC = 60;

function loadActiveMatchSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MATCH_STORAGE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    // 24시간 이상된 스냅샷은 폐기 (무한 잔류 방지)
    if (snap?.savedAt && Date.now() - snap.savedAt > 24 * 60 * 60 * 1000) return null;
    return snap;
  } catch {
    return null;
  }
}
function saveActiveMatchSnapshot(snap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify({ ...snap, savedAt: Date.now() }));
  } catch {
    /* ignore */
  }
}
function clearActiveMatchSnapshot() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MATCH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// 매칭 룸 페이지 (코치)
const MatchRoomView = ({ t = (key) => key, setActiveTab, onBack }) => {
  const { profile } = useAuth();
  // Phase: 'lobby' | 'matching' | 'fighting' | 'rest' | 'finish'
  const [phase, setPhase] = useState('lobby');
  const [blueCorner, setBlueCorner] = useState(null);
  const [redCorner, setRedCorner] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [roundTime, setRoundTime] = useState(ROUND_DURATION_SEC);
  const [restTime, setRestTime] = useState(REST_DURATION_SEC);
  const [scores, setScores] = useState(() => matchEmptyScoresMap(3));
  // ⭐ phase 가 fighting/rest 로 바뀌는 순간의 timestamp — 페이지 떠나도 시간 계산 가능
  const phaseStartedAtRef = useRef(null);
  const restoreCompletedRef = useRef(false); // 복원 1회만
  const currentRoundRef = useRef(1);
  const totalRoundsRef = useRef(3);
  currentRoundRef.current = currentRound;
  totalRoundsRef.current = totalRounds;
  const [selectingCorner, setSelectingCorner] = useState(null); // 'blue' | 'red' | null
  const [rscWinner, setRscWinner] = useState(null); // RSC 승자 ('blue' | 'red' | null)
  const [finishMethod, setFinishMethod] = useState(null); // 'decision' | 'rsc' | 'forced'
  const [currentScoreInput, setCurrentScoreInput] = useState({ blue: null, red: null, dominant: null }); // 현재 라운드 점수 입력
  const [attendedMembers, setAttendedMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [memberLoadError, setMemberLoadError] = useState(null);
  const [showForceStopModal, setShowForceStopModal] = useState(false);
  const [forcedResult, setForcedResult] = useState({ winner: null, blueScore: '', redScore: '', finishType: 'decision' });
  const [resultMethod, setResultMethod] = useState(null); // decision | tko | ko
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [resultSaved, setResultSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const formatMemberRecord = (wins, losses, draws, totalMatches) => {
    const w = Number(wins) || 0;
    const l = Number(losses) || 0;
    const d = Number(draws) || 0;
    const t = Number(totalMatches) || w + l + d;
    if (t === 0) return '전적 없음';
    return `${w}승 ${d}무 ${l}패`;
  };

  const normalizeWinRate = (winRate) => {
    const n = Number(winRate);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 10) / 10;
  };

  const loadMatchRoomData = useCallback(async (opts = { showLoading: true }) => {
    if (opts.showLoading) {
      setIsLoadingMembers(true);
      setMemberLoadError(null);
    }

    try {
      const { supabase } = await import('@/lib/supabase');

      const gymUserId = profile?.id ? String(profile.id).trim() : '';
      const gymName = (profile?.gym_name && String(profile.gym_name).trim()) || '';

      if (!gymUserId && !gymName) {
        setAttendedMembers([]);
        if (opts.showLoading) setIsLoadingMembers(false);
        return;
      }

      let query = supabase
        .from('users')
        .select('id, name, nickname, weight, height, gender, boxing_style, tier, avatar_url, statistics ( total_matches, wins, losses, draws )')
        .in('role', ['player_common', 'player_athlete']);

      if (gymUserId && gymName) {
        query = query.or(`gym_user_id.eq.${gymUserId},and(gym_name.eq.${gymName},gym_user_id.is.null)`);
      } else if (gymUserId) {
        query = query.eq('gym_user_id', gymUserId);
      } else {
        query = query.eq('gym_name', gymName);
      }

      const { data: users, error: usersError } = await query;

      if (usersError) throw usersError;

      const mappedMembers = (users || []).map((user) => {
        const stats = Array.isArray(user.statistics) ? user.statistics[0] : user.statistics;
        const wins = Number(stats?.wins) || 0;
        const losses = Number(stats?.losses) || 0;
        const draws = Number(stats?.draws) || 0;
        const totalMatches = Number(stats?.total_matches) || wins + losses + draws;
        const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0;
        const nick = user.nickname || user.name || '이름 미등록';
        const realName = user.name && user.name !== nick ? user.name : null;
        return {
          id: user.id,
          // name = 표시용 (닉네임 우선) — 정렬·검색에 그대로 사용
          name: nick,
          // 추가 — 닉네임 / 실명 분리 (UI 에서 "닉네임 (이름)" 표시용)
          nickname: nick,
          realName,
          avatarUrl: user.avatar_url || null,
          weight: Number.isFinite(Number(user.weight)) ? Number(user.weight) : null,
          height: Number.isFinite(Number(user.height)) ? Number(user.height) : null,
          gender: user.gender || null,
          boxingStyle: user.boxing_style || null,
          tier: user.tier || null,
          record: formatMemberRecord(wins, losses, draws, totalMatches),
          winRate,
          wins,
          losses,
          draws,
          totalMatches,
        };
      });

      const sorted = mappedMembers.sort((a, b) => {
        if (a.weight === null && b.weight === null) return a.name.localeCompare(b.name, 'ko');
        if (a.weight === null) return 1;
        if (b.weight === null) return -1;
        if (a.weight !== b.weight) return a.weight - b.weight;
        return a.name.localeCompare(b.name, 'ko');
      });

      setAttendedMembers(sorted);
    } catch (error) {
      console.error('[MatchRoomView] 회원 로드 실패:', error);
      if (opts.showLoading) {
        setMemberLoadError(error.message || '회원 정보를 불러오지 못했습니다.');
        setAttendedMembers([]);
      }
    } finally {
      if (opts.showLoading) {
        setIsLoadingMembers(false);
      }
    }
  }, [profile?.id, profile?.gym_name]);

  useEffect(() => {
    loadMatchRoomData({ showLoading: true });
  }, [loadMatchRoomData]);

  // ─────────────────────────────────────────────────────────────
  // ⭐ 매치 영속화 — localStorage 자동 저장 + 마운트 시 복원
  // ─────────────────────────────────────────────────────────────

  // (1) 마운트 시 1회 — 진행 중이던 매치 스냅샷이 있으면 복원
  useEffect(() => {
    if (restoreCompletedRef.current) return;
    restoreCompletedRef.current = true;
    const snap = loadActiveMatchSnapshot();
    if (!snap) return;
    if (snap.phase === 'lobby' || snap.phase === 'finish' || !snap.blueCorner || !snap.redCorner) {
      clearActiveMatchSnapshot();
      return;
    }

    // 기본 메타 복원 (즉시)
    setBlueCorner(snap.blueCorner);
    setRedCorner(snap.redCorner);
    setCurrentRound(snap.currentRound || 1);
    setTotalRounds(snap.totalRounds || 3);
    setScores(snap.scores || matchEmptyScoresMap(snap.totalRounds || 3));
    if (snap.finishMethod) setFinishMethod(snap.finishMethod);
    if (snap.rscWinner) setRscWinner(snap.rscWinner);
    if (snap.resultMethod) setResultMethod(snap.resultMethod);

    // ⭐ 일시정지였다면 시간 그대로 — 페이지 떠나있는 동안 절대 시간 흐르지 않음
    //   재생 중이었다면 phaseStartedAt 부터 지난 시간 계산
    if (snap.isPlaying === false) {
      // 일시정지 상태 복원: 저장된 roundTime/restTime 그대로 사용
      phaseStartedAtRef.current = snap.phaseStartedAt || null;
      if (snap.phase === 'fighting') {
        setPhase('fighting');
        setRoundTime(typeof snap.roundTime === 'number' ? snap.roundTime : ROUND_DURATION_SEC);
        setIsPlaying(false);
      } else if (snap.phase === 'rest') {
        setPhase('rest');
        setRestTime(typeof snap.restTime === 'number' ? snap.restTime : REST_DURATION_SEC);
        setIsPlaying(false);
      } else if (snap.phase === 'matching') {
        setPhase('matching');
      }
      return;
    }

    // 재생 중이었음 → 떠나있던 시간만큼 자동 진행
    const phaseStart = snap.phaseStartedAt || snap.savedAt || Date.now();
    phaseStartedAtRef.current = phaseStart;
    const elapsedSec = Math.floor((Date.now() - phaseStart) / 1000);

    if (snap.phase === 'fighting') {
      const remaining = ROUND_DURATION_SEC - elapsedSec;
      if (remaining > 0) {
        // 아직 라운드 진행 중 → 그대로 재생
        setPhase('fighting');
        setRoundTime(remaining);
        setIsPlaying(true);
      } else {
        // 라운드 종료 — 휴식 phase 로 전이. 휴식 시간도 일부 흘렀을 수 있음.
        const overflowSec = -remaining;
        const restRemaining = REST_DURATION_SEC - overflowSec;
        const cr = snap.currentRound || 1;
        const tr = snap.totalRounds || 3;
        if (cr >= tr) {
          setPhase('rest');
          setRoundTime(0);
          setRestTime(0);
          setIsPlaying(false);
        } else if (restRemaining > 0) {
          setPhase('rest');
          setRoundTime(0);
          setRestTime(restRemaining);
          setIsPlaying(true);
          phaseStartedAtRef.current = Date.now() - (REST_DURATION_SEC - restRemaining) * 1000;
        } else {
          setPhase('rest');
          setRoundTime(0);
          setRestTime(0);
          setIsPlaying(false);
        }
      }
    } else if (snap.phase === 'rest') {
      const remaining = REST_DURATION_SEC - elapsedSec;
      if (remaining > 0) {
        setPhase('rest');
        setRestTime(remaining);
        setIsPlaying(true);
      } else {
        setPhase('rest');
        setRestTime(0);
        setIsPlaying(false);
      }
    } else if (snap.phase === 'matching') {
      setPhase('matching');
    }
  }, []);

  // (2) 상태 변화 시 자동 저장 — fighting/rest/matching 일 때만
  useEffect(() => {
    if (!restoreCompletedRef.current) return; // 복원 끝나기 전 저장 안 함
    if (phase === 'lobby' || phase === 'finish') {
      clearActiveMatchSnapshot();
      return;
    }
    if (!blueCorner || !redCorner) return;
    saveActiveMatchSnapshot({
      phase,
      blueCorner,
      redCorner,
      currentRound,
      totalRounds,
      roundTime,
      restTime,
      isPlaying,
      scores,
      finishMethod,
      rscWinner,
      resultMethod,
      phaseStartedAt: phaseStartedAtRef.current,
    });
  }, [
    phase, blueCorner, redCorner, currentRound, totalRounds,
    roundTime, restTime, isPlaying, scores,
    finishMethod, rscWinner, resultMethod,
  ]);

  // 타이머 로직 (마지막 라운드 종료 후에는 라운드 간 쉬는 시간 없음 → 바로 채점)
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (phase === 'fighting') {
        setRoundTime((prev) => {
          if (prev <= 1) {
            setIsPlaying(false);
            setPhase('rest');
            phaseStartedAtRef.current = Date.now(); // ⭐ rest phase 시작 시각 기록
            const cr = currentRoundRef.current;
            const tr = totalRoundsRef.current;
            setRestTime(cr < tr ? REST_DURATION_SEC : 0);
            return ROUND_DURATION_SEC;
          }
          return prev - 1;
        });
      } else if (phase === 'rest') {
        setRestTime((prev) => {
          const cr = currentRoundRef.current;
          const tr = totalRoundsRef.current;
          if (cr === tr) {
            return 0;
          }
          if (prev <= 1) {
            setCurrentRound((c) => c + 1);
            setPhase('fighting');
            phaseStartedAtRef.current = Date.now(); // ⭐ 새 라운드 fighting 시작 시각
            setRoundTime(ROUND_DURATION_SEC);
            setIsPlaying(true);
            return REST_DURATION_SEC;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, phase]);

  // rest 페이즈 자동 시작 및 입력 초기화
  useEffect(() => {
    if (phase === 'rest') {
      if (!isPlaying) {
        setIsPlaying(true);
      }
      setCurrentScoreInput({ blue: null, red: null, dominant: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startMatch = () => {
    if (!blueCorner || !redCorner) return;
    setScores(matchEmptyScoresMap(totalRounds));
    setPhase('fighting');
    phaseStartedAtRef.current = Date.now(); // ⭐ 1라운드 fighting 시작 시각
    setCurrentRound(1);
    setRoundTime(ROUND_DURATION_SEC);
    setRestTime(REST_DURATION_SEC);
    setIsPlaying(true);
  };

  const handleScoreSelect = (roundNum, blueScore, redScore, dominant) => {
    setScores((prev) => ({ ...prev, [`round${roundNum}`]: { blue: blueScore, red: redScore, dominant } }));
    setCurrentScoreInput({ blue: null, red: null, dominant: null });
    if (roundNum === totalRounds) {
      setIsPlaying(false);
      setFinishMethod('decision');
      setResultMethod('decision');
      setPhase('finish');
    }
  };

  const canSubmitScore = () => {
    return currentScoreInput.blue !== null && currentScoreInput.red !== null && currentScoreInput.dominant !== null;
  };

  const handleRSC = (corner) => {
    setIsPlaying(false);
    setRscWinner(corner);
    setForcedResult({ winner: corner, blueScore: '', redScore: '', finishType: 'tko' });
    setFinishMethod('rsc');
    setResultMethod('tko');
    setPhase('finish');
  };

  const calculateWinner = () => {
    if (finishMethod === 'rsc') {
      return rscWinner === 'blue' ? blueCorner : redCorner;
    }
    if (finishMethod === 'forced') {
      if (forcedResult.winner === 'blue') return blueCorner;
      if (forcedResult.winner === 'red') return redCorner;
      return null;
    }
    const corner = resolveDecisionWinnerCorner(scores, totalRounds);
    if (corner === 'blue') return blueCorner;
    if (corner === 'red') return redCorner;
    return null;
  };

  const getFinalScore = () => {
    if (finishMethod === 'forced') {
      return {
        blue: Number(forcedResult.blueScore) || 0,
        red: Number(forcedResult.redScore) || 0,
      };
    }
    return {
      blue: sumCornerPoints(scores, totalRounds, 'blue'),
      red: sumCornerPoints(scores, totalRounds, 'red'),
    };
  };

  useEffect(() => {
    const persistMatchResult = async () => {
      if (phase !== 'finish' || !blueCorner?.id || !redCorner?.id || resultSaved) return;

      const finalScore = finishMethod === 'forced'
        ? {
            blue: Number(forcedResult.blueScore) || 0,
            red: Number(forcedResult.redScore) || 0,
          }
        : {
            blue: sumCornerPoints(scores, totalRounds, 'blue'),
            red: sumCornerPoints(scores, totalRounds, 'red'),
          };
      const winnerCorner =
        finishMethod === 'forced'
          ? (forcedResult.winner || 'draw')
          : finishMethod === 'rsc'
            ? (rscWinner || 'draw')
            : resolveDecisionWinnerCorner(scores, totalRounds);

      setIsSavingResult(true);
      setSaveError(null);
      try {
        const { submitMatchResult } = await import('@/lib/supabase');
        const { error } = await submitMatchResult({
          blueUserId: blueCorner.id,
          redUserId: redCorner.id,
          winnerCorner,
          finishMethod: resultMethod || finishMethod,
          blueScore: finalScore.blue,
          redScore: finalScore.red,
          roundsPlayed: totalRounds,
        });
        if (error) throw error;
        setResultSaved(true);
        clearActiveMatchSnapshot(); // ⭐ 결과 DB 저장 완료 → localStorage 정리
        loadMatchRoomData({ showLoading: false });
      } catch (error) {
        console.error('[MatchRoomView] 경기 결과 저장 실패:', error);
        setSaveError(error.message || '경기 결과 저장에 실패했습니다.');
      } finally {
        setIsSavingResult(false);
      }
    };

    persistMatchResult();
  }, [phase, finishMethod, forcedResult, rscWinner, blueCorner, redCorner, currentRound, resultSaved, scores, resultMethod, loadMatchRoomData, totalRounds]);

  const resetMatch = () => {
    clearActiveMatchSnapshot(); // ⭐ 매치 종료 → localStorage 정리
    phaseStartedAtRef.current = null;
    setPhase('lobby');
    setBlueCorner(null);
    setRedCorner(null);
    setCurrentRound(1);
    setRoundTime(ROUND_DURATION_SEC);
    setRestTime(REST_DURATION_SEC);
    setScores(matchEmptyScoresMap(totalRounds));
    setIsPlaying(false);
    setRscWinner(null);
    setFinishMethod(null);
    setCurrentScoreInput({ blue: null, red: null, dominant: null });
    setShowForceStopModal(false);
    setForcedResult({ winner: null, blueScore: '', redScore: '', finishType: 'decision' });
    setResultMethod(null);
    setIsSavingResult(false);
    setResultSaved(false);
    setSaveError(null);
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={t('matchRoomTitle')}
        onBack={onBack}
      />

      {/* Phase 0: Lobby - 회원 선택 */}
      {phase === 'lobby' && (
        <>
          {/* 진행 단계 스테퍼 */}
          <div className="mb-3 sm:mb-5 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
              {[
                { label: t('blueCorner'), done: !!blueCorner, active: !blueCorner },
                { label: t('redCorner'), done: !!redCorner, active: !!blueCorner && !redCorner },
                { label: t('matchStart'), done: false, active: !!blueCorner && !!redCorner },
              ].map((step, i, arr) => (
                <div key={i} className="flex items-center gap-2 sm:gap-3">
                  <div className={`flex items-center gap-1.5 sm:gap-2 ${
                    step.done ? 'text-emerald-400' : step.active ? 'text-white' : 'text-gray-600'
                  }`}>
                    <div className={`relative w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all ${
                      step.done
                        ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-400/60'
                        : step.active
                        ? 'bg-white text-black ring-2 ring-white/30 animate-pulse'
                        : 'bg-white/5 text-gray-500 ring-1 ring-white/10'
                    }`}>
                      {step.done ? '✓' : i + 1}
                    </div>
                    <span className="font-semibold text-[11px] sm:text-[13px] whitespace-nowrap tracking-tight">
                      {step.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <span className={`text-xs ${step.done ? 'text-emerald-500/60' : 'text-gray-700'}`}>›</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 코너 선택 영역 — 그라디언트 / 보더 / 메타 정보 강화 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 sm:mb-5">
            {/* 청코너 */}
            <div
              className={`relative rounded-2xl p-4 sm:p-5 border transition-all overflow-hidden ${
                !blueCorner
                  ? 'border-blue-400/60 shadow-[0_0_24px_rgba(59,130,246,0.25)] animate-pulse'
                  : 'border-blue-400/40'
              }`}
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(37,99,235,0.05) 60%, rgba(15,23,42,0.85) 100%)',
              }}
            >
              {/* 코너 라벨 */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)]" aria-hidden />
                <h3 className="text-xs sm:text-sm font-black tracking-[0.2em] uppercase text-blue-300">{t('blueCorner')}</h3>
              </div>
              {blueCorner ? (
                <div className="flex items-center gap-3 sm:gap-4">
                  <ProfileAvatarImg
                    avatarUrl={blueCorner.avatarUrl}
                    name={blueCorner.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-blue-400/70 shadow-[0_0_20px_rgba(96,165,250,0.35)] text-2xl shrink-0"
                    gradientClassName="bg-gradient-to-br from-blue-500 to-blue-700"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-base sm:text-lg font-extrabold text-white truncate">
                      {blueCorner.name}
                      {blueCorner.realName ? (
                        <span className="text-xs sm:text-sm text-blue-200/70 font-medium ml-1.5">({blueCorner.realName})</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-blue-200/80 mt-0.5 tabular-nums">
                      {blueCorner.weight ? `${blueCorner.weight}kg` : '체중 미등록'}
                      {blueCorner.tier ? <span className="text-blue-300/70"> · {blueCorner.tier}</span> : null}
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5 truncate">
                      {blueCorner.record}{blueCorner.totalMatches > 0 ? ` · 승률 ${blueCorner.winRate}%` : ''}
                    </p>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => setSelectingCorner('blue')}
                        className="flex-1 px-2 py-1 bg-blue-500/25 hover:bg-blue-500/35 border border-blue-400/30 rounded-md text-[10px] sm:text-xs font-semibold text-blue-100 transition-colors"
                      >
                        {t('change')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlueCorner(null)}
                        className="flex-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] sm:text-xs font-semibold text-gray-300 transition-colors"
                      >
                        {t('deselect')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectingCorner('blue')}
                  className="w-full py-7 sm:py-9 border-2 border-dashed border-blue-400/30 hover:border-blue-400/60 rounded-xl text-center transition-all hover:bg-blue-500/5 group"
                >
                  <div className="text-blue-300 font-bold text-sm sm:text-base mb-0.5">{t('selectFighter')}</div>
                  {!blueCorner && !redCorner && (
                    <div className="text-[10px] sm:text-xs text-blue-200/60">{t('selectBlueFirst')}</div>
                  )}
                </button>
              )}
            </div>

            {/* 홍코너 */}
            <div
              className={`relative rounded-2xl p-4 sm:p-5 border transition-all overflow-hidden ${
                blueCorner && !redCorner
                  ? 'border-red-400/60 shadow-[0_0_24px_rgba(239,68,68,0.25)] animate-pulse'
                  : 'border-red-400/40'
              }`}
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(220,38,38,0.05) 60%, rgba(15,23,42,0.85) 100%)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]" aria-hidden />
                <h3 className="text-xs sm:text-sm font-black tracking-[0.2em] uppercase text-red-300">{t('redCorner')}</h3>
              </div>
              {redCorner ? (
                <div className="flex items-center gap-3 sm:gap-4">
                  <ProfileAvatarImg
                    avatarUrl={redCorner.avatarUrl}
                    name={redCorner.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-red-400/70 shadow-[0_0_20px_rgba(248,113,113,0.35)] text-2xl shrink-0"
                    gradientClassName="bg-gradient-to-br from-red-500 to-red-700"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-base sm:text-lg font-extrabold text-white truncate">
                      {redCorner.name}
                      {redCorner.realName ? (
                        <span className="text-xs sm:text-sm text-red-200/70 font-medium ml-1.5">({redCorner.realName})</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-red-200/80 mt-0.5 tabular-nums">
                      {redCorner.weight ? `${redCorner.weight}kg` : '체중 미등록'}
                      {redCorner.tier ? <span className="text-red-300/70"> · {redCorner.tier}</span> : null}
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5 truncate">
                      {redCorner.record}{redCorner.totalMatches > 0 ? ` · 승률 ${redCorner.winRate}%` : ''}
                    </p>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => setSelectingCorner('red')}
                        className="flex-1 px-2 py-1 bg-red-500/25 hover:bg-red-500/35 border border-red-400/30 rounded-md text-[10px] sm:text-xs font-semibold text-red-100 transition-colors"
                      >
                        {t('change')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRedCorner(null)}
                        className="flex-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] sm:text-xs font-semibold text-gray-300 transition-colors"
                      >
                        {t('deselect')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectingCorner('red')}
                  disabled={!blueCorner}
                  className={`w-full py-7 sm:py-9 border-2 border-dashed rounded-xl text-center transition-all group ${
                    blueCorner
                      ? 'border-red-400/30 hover:border-red-400/60 hover:bg-red-500/5'
                      : 'border-gray-500/20 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className={`font-bold text-sm sm:text-base mb-0.5 ${blueCorner ? 'text-red-300' : 'text-gray-500'}`}>{t('selectFighter')}</div>
                  {!blueCorner && (
                    <div className="text-[10px] sm:text-xs text-gray-500">{t('selectBlueFirst')}</div>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 진행 라운드 수 (시작 전) */}
          {blueCorner && redCorner && (
            <SpotlightCard className="p-3 sm:p-4 mb-3 sm:mb-4">
              <div className="text-xs sm:text-sm font-bold text-gray-400 mb-1 text-center">{t('matchRoomTotalRounds')}</div>
              <div className="text-[10px] sm:text-xs text-gray-500 text-center mb-2">{t('matchRoomTotalRoundsRange')}</div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
                {Array.from({ length: 10 }, (_, i) => i + 3).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTotalRounds(n)}
                    className={`min-w-[2.75rem] sm:min-w-[3.25rem] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      totalRounds === n
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    {n}R
                  </button>
                ))}
              </div>
            </SpotlightCard>
          )}

          {/* MATCH START 버튼 */}
          {blueCorner && redCorner && (
            <button 
              onClick={startMatch}
              className="w-full py-4 sm:py-6 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white text-lg sm:text-2xl font-bold rounded-xl transition-all hover:scale-105 shadow-2xl shadow-emerald-500/50 animate-pulse"
            >
              {t('matchStart')}
            </button>
          )}

          {/* 회원 선택 모달 */}
          {selectingCorner && (
            <div
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-stretch sm:items-center sm:justify-center sm:p-4 animate-fade-in"
              onClick={() => setSelectingCorner(null)}
            >
              <div
                className="bg-[#0A0A0A] sm:border sm:border-white/20 sm:rounded-2xl w-full h-full sm:max-w-3xl sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 모달 헤더 */}
                <div className={`p-4 sm:p-6 border-b border-white/10 flex-shrink-0 ${
                  selectingCorner === 'blue'
                    ? 'bg-gradient-to-r from-blue-500/20 to-blue-500/10'
                    : 'bg-gradient-to-r from-red-500/20 to-red-500/10'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`inline-block w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-[0_0_10px_rgba(96,165,250,0.6)] ${
                          selectingCorner === 'blue' ? 'bg-blue-400' : 'bg-red-400'
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <h3 className={`text-lg sm:text-2xl font-bold truncate ${selectingCorner === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
                          {selectingCorner === 'blue' ? '청코너' : '홍코너'} 선수 선택
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-400 truncate">회원가입한 회원을 선택하세요 (체급순)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectingCorner(null)}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all flex-shrink-0"
                    >
                      <span className="text-xl sm:text-2xl">✕</span>
                    </button>
                  </div>
                </div>

                {/* 회원 리스트 */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
                  {isLoadingMembers ? (
                    <div className="py-12 text-center text-gray-400">회원 정보를 불러오는 중...</div>
                  ) : memberLoadError ? (
                    <div className="py-12 text-center text-red-400">{memberLoadError}</div>
                  ) : attendedMembers.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">회원가입한 일반 회원/선수 데이터가 없습니다.</div>
                  ) : (
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
                            className={`w-full p-3 sm:p-4 rounded-xl border transition-all text-left ${
                              isDisabled
                                ? 'bg-white/5 border-white/20 opacity-40 cursor-not-allowed'
                                : 'bg-gradient-to-r from-white/5 to-white/[0.02] border-white/10 hover:bg-white/10 hover:border-white/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                <ProfileAvatarImg
                                  avatarUrl={member.avatarUrl}
                                  name={member.name}
                                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-white/20 flex-shrink-0 text-lg sm:text-xl"
                                  gradientClassName="bg-gradient-to-br from-blue-500/80 to-purple-600/80"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
                                    <span className="font-bold text-white text-base sm:text-xl truncate">{member.name}</span>
                                    {member.realName ? (
                                      <span className="text-xs sm:text-sm text-gray-400 font-medium truncate">({member.realName})</span>
                                    ) : null}
                                    {member.tier ? (
                                      <span className="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-[9px] sm:text-[10px] font-bold text-white/85 whitespace-nowrap">{member.tier}</span>
                                    ) : null}
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-400 truncate">
                                    {member.weight ? `${member.weight}kg` : '체중 미등록'}
                                    {member.height ? ` · ${member.height}cm` : ''}
                                    {member.gender ? ` · ${member.gender === 'female' ? '여성' : '남성'}` : ''}
                                  </div>
                                  <div className="text-[11px] sm:text-xs text-gray-500 truncate mt-0.5">
                                    {member.record}{member.boxingStyle ? ` · ${member.boxingStyle}` : ''}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">승률</div>
                                <div className="text-lg sm:text-2xl font-bold text-emerald-400 tabular-nums">
                                  {member.totalMatches > 0 ? `${member.winRate}%` : '—'}
                                </div>
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
                  )}
                </div>

                {/* 모달 푸터 */}
                <div className="p-4 border-t border-white/10 bg-white/5 flex-shrink-0">
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
        <div className="space-y-4">
          {/* ⭐ 메인 카운트다운 카드 — 풀폭 그라디언트 + 큰 모노 타이머 + 라운드 도트 */}
          <div
            className="relative overflow-hidden rounded-2xl border border-white/10 p-5 sm:p-7"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(15,23,42,0.85) 50%, rgba(239,68,68,0.18) 100%)',
            }}
          >
            {/* 배경 격자 텍스처 */}
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
              aria-hidden
            />

            {/* 상단: 라운드 인디케이터 */}
            <div className="relative flex items-center justify-between mb-4 sm:mb-5">
              <div>
                <p className="text-[10px] sm:text-xs font-black tracking-[0.3em] uppercase text-white/50">Live Round</p>
                <p className="text-2xl sm:text-3xl font-black text-white tabular-nums mt-0.5">
                  {currentRound}<span className="text-white/40 text-lg sm:text-xl"> / {totalRounds}</span>
                </p>
              </div>
              {/* 라운드 진행 도트 */}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalRounds }, (_, i) => {
                  const r = i + 1;
                  const done = scores[`round${r}`] != null;
                  const isCurrent = r === currentRound;
                  return (
                    <span
                      key={r}
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all ${
                        done
                          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                          : isCurrent
                          ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] scale-125 animate-pulse'
                          : 'bg-white/15'
                      }`}
                      aria-label={`Round ${r}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* 중앙: 거대 타이머 */}
            <div className="relative text-center mb-4 sm:mb-5">
              <div
                className={`font-black tabular-nums leading-none transition-colors ${
                  roundTime <= 10
                    ? 'text-rose-300 animate-pulse'
                    : roundTime <= 30
                    ? 'text-amber-300'
                    : 'text-white'
                }`}
                style={{
                  fontSize: 'clamp(4.5rem, 15vw, 8rem)',
                  textShadow: roundTime <= 10
                    ? '0 0 40px rgba(244,63,94,0.6), 0 0 80px rgba(244,63,94,0.3)'
                    : '0 0 30px rgba(255,255,255,0.15)',
                  letterSpacing: '-0.02em',
                }}
              >
                {formatTime(roundTime)}
              </div>
              <p className="text-[10px] sm:text-xs font-bold tracking-[0.35em] uppercase text-white/40 mt-2">
                {roundTime <= 10 ? 'Final Seconds' : 'Round In Progress'}
              </p>
              {/* 진행 바 (라운드 시간 대비) */}
              <div className="mt-3 sm:mt-4 mx-auto max-w-md h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${
                    roundTime <= 10 ? 'bg-rose-400' : roundTime <= 30 ? 'bg-amber-400' : 'bg-white/70'
                  }`}
                  style={{ width: `${Math.max(0, (roundTime / ROUND_DURATION_SEC) * 100)}%` }}
                />
              </div>
            </div>

            {/* 하단: 두 코너 — 좌(청) ◐ 가운데 VS ◑ 우(홍) */}
            <div className="relative grid grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-center">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 justify-end sm:justify-end">
                <div className="text-right min-w-0">
                  <p className="text-[9px] sm:text-[10px] font-black tracking-[0.2em] uppercase text-blue-300/80">청코너</p>
                  <p className="text-sm sm:text-base font-extrabold text-white truncate">{blueCorner.name}</p>
                  {blueCorner.weight ? (
                    <p className="text-[10px] sm:text-xs text-blue-200/70 tabular-nums">{blueCorner.weight}kg</p>
                  ) : null}
                </div>
                <ProfileAvatarImg
                  avatarUrl={blueCorner.avatarUrl}
                  name={blueCorner.name}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-blue-400/70 shadow-[0_0_18px_rgba(59,130,246,0.45)] text-xl flex-shrink-0"
                  gradientClassName="bg-gradient-to-br from-blue-500 to-blue-700"
                />
              </div>

              <div className="text-center px-1 sm:px-3">
                <span className="block text-2xl sm:text-3xl font-black text-white/40 tracking-tight">VS</span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <ProfileAvatarImg
                  avatarUrl={redCorner.avatarUrl}
                  name={redCorner.name}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-red-400/70 shadow-[0_0_18px_rgba(239,68,68,0.45)] text-xl flex-shrink-0"
                  gradientClassName="bg-gradient-to-br from-red-500 to-red-700"
                />
                <div className="text-left min-w-0">
                  <p className="text-[9px] sm:text-[10px] font-black tracking-[0.2em] uppercase text-red-300/80">홍코너</p>
                  <p className="text-sm sm:text-base font-extrabold text-white truncate">{redCorner.name}</p>
                  {redCorner.weight ? (
                    <p className="text-[10px] sm:text-xs text-red-200/70 tabular-nums">{redCorner.weight}kg</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* 컨트롤 — 일시정지 / 재개 */}
          <button
            type="button"
            onClick={() => {
              // ⭐ 일시정지 ↔ 재개 토글 — 재개 시 phaseStartedAtRef 를 "현재 남은 시간"
              //    기준으로 재설정해야 다음 페이지 이탈 시 시간 계산이 정확함.
              setIsPlaying((prev) => {
                const next = !prev;
                if (next) {
                  // 재개 — 재기동 시점 - (이미 흐른 시간) 으로 phase 시작 시각 재설정
                  if (phase === 'fighting') {
                    const elapsedNow = ROUND_DURATION_SEC - roundTime;
                    phaseStartedAtRef.current = Date.now() - elapsedNow * 1000;
                  } else if (phase === 'rest') {
                    const elapsedNow = REST_DURATION_SEC - restTime;
                    phaseStartedAtRef.current = Date.now() - elapsedNow * 1000;
                  }
                }
                return next;
              });
            }}
            className={`w-full py-7 sm:py-9 rounded-2xl border text-white font-black tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99] ${
              isPlaying
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-400/40 hover:from-amber-500/30 hover:to-orange-500/30'
                : 'bg-gradient-to-r from-emerald-500/25 to-green-500/25 border-emerald-400/50 hover:from-emerald-500/40 hover:to-green-500/40 animate-pulse shadow-[0_0_24px_rgba(52,211,153,0.35)]'
            }`}
          >
            <div className="text-[10px] sm:text-xs font-black tracking-[0.3em] uppercase opacity-70 mb-1.5">
              {isPlaying ? 'Pause Match' : 'Start / Resume'}
            </div>
            <div className="text-2xl sm:text-3xl">
              {isPlaying ? '일시정지' : '시작 / 재개'}
            </div>
          </button>

          <button
            onClick={() => {
              setForcedResult({ winner: null, blueScore: '', redScore: '', finishType: 'decision' });
              setShowForceStopModal(true);
            }}
            className="w-full py-4 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-bold rounded-xl transition-all hover:scale-105"
          >
            경기 강제 종료
          </button>

          {/* RSC 버튼 */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => {
                if (confirm(`청코너 ${blueCorner.name} 선수를 RSC 승리로 처리하시겠습니까?`)) {
                  handleRSC('blue');
                }
              }}
              className="py-6 sm:py-8 rounded-xl border border-blue-400/40 bg-gradient-to-br from-blue-500/30 via-blue-600/20 to-blue-900/30 hover:from-blue-500/40 hover:to-blue-900/40 text-white font-bold transition-all hover:scale-[1.02] shadow-[0_0_18px_rgba(59,130,246,0.25)]"
            >
              <div className="text-[10px] font-black tracking-[0.2em] text-blue-300 uppercase">청코너</div>
              <div className="text-lg sm:text-xl mt-1">RSC 승리</div>
              <div className="text-xs sm:text-sm text-blue-100/80 mt-1 truncate px-2">{blueCorner.name}</div>
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`홍코너 ${redCorner.name} 선수를 RSC 승리로 처리하시겠습니까?`)) {
                  handleRSC('red');
                }
              }}
              className="py-6 sm:py-8 rounded-xl border border-red-400/40 bg-gradient-to-br from-red-500/30 via-red-600/20 to-red-900/30 hover:from-red-500/40 hover:to-red-900/40 text-white font-bold transition-all hover:scale-[1.02] shadow-[0_0_18px_rgba(239,68,68,0.25)]"
            >
              <div className="text-[10px] font-black tracking-[0.2em] text-red-300 uppercase">홍코너</div>
              <div className="text-lg sm:text-xl mt-1">RSC 승리</div>
              <div className="text-xs sm:text-sm text-red-100/80 mt-1 truncate px-2">{redCorner.name}</div>
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
        <div className="space-y-4">
          {/* ⭐ 휴식 카드 — fighting 카드와 같은 시각 톤 */}
          <div
            className="relative overflow-hidden rounded-2xl border border-white/10 p-5 sm:p-7"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(15,23,42,0.85) 50%, rgba(236,72,153,0.18) 100%)',
            }}
          >
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
              aria-hidden
            />

            {/* 라운드 인디케이터 */}
            <div className="relative flex items-center justify-between mb-4 sm:mb-5">
              <div>
                <p className="text-[10px] sm:text-xs font-black tracking-[0.3em] uppercase text-purple-300/80">Round Ended</p>
                <p className="text-2xl sm:text-3xl font-black text-white tabular-nums mt-0.5">
                  {currentRound}<span className="text-white/40 text-lg sm:text-xl"> / {totalRounds}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalRounds }, (_, i) => {
                  const r = i + 1;
                  const done = scores[`round${r}`] != null;
                  const isCurrent = r === currentRound;
                  return (
                    <span
                      key={r}
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                        done
                          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                          : isCurrent
                          ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                          : 'bg-white/15'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* 휴식 타이머 또는 마지막 라운드 안내 */}
            <div className="relative text-center">
              {currentRound < totalRounds ? (
                <>
                  <div
                    className="font-black tabular-nums leading-none text-purple-200"
                    style={{
                      fontSize: 'clamp(3.5rem, 12vw, 6rem)',
                      textShadow: '0 0 30px rgba(216,180,254,0.4)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {formatTime(restTime)}
                  </div>
                  <p className="text-[10px] sm:text-xs font-bold tracking-[0.35em] uppercase text-purple-200/60 mt-2">
                    Rest Period
                  </p>
                  {/* 휴식 진행 바 */}
                  <div className="mt-3 sm:mt-4 mx-auto max-w-md h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-purple-300/80 transition-all duration-1000 ease-linear"
                      style={{ width: `${Math.max(0, (restTime / REST_DURATION_SEC) * 100)}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="py-2">
                  <p className="text-base sm:text-xl font-black tracking-tight text-amber-300">최종 라운드 종료</p>
                  <p className="text-xs sm:text-sm text-amber-200/70 mt-2 font-medium">아래에서 라운드 점수를 입력해주세요</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setForcedResult({ winner: null, blueScore: '', redScore: '', finishType: 'decision' });
              setShowForceStopModal(true);
            }}
            className="w-full py-4 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-bold rounded-xl transition-all hover:scale-105"
          >
            경기 강제 종료
          </button>

          {/* 채점 */}
          {!scores[`round${currentRound}`] && (
            <SpotlightCard className="p-6">
              <h3 className="text-xl font-bold text-white mb-6 text-center">ROUND {currentRound} 채점</h3>

              {/* 점수 입력 그리드 */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* 청코너 */}
                <div>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400" aria-hidden />
                    <h4 className="text-lg font-bold text-blue-400 truncate">{blueCorner.name}</h4>
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
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" aria-hidden />
                    <h4 className="text-lg font-bold text-red-400 truncate">{redCorner.name}</h4>
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
                    <div className="flex items-center justify-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-400" aria-hidden />
                      <span>청코너 우세</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setCurrentScoreInput(prev => ({ ...prev, dominant: 'red' }))}
                    className={`py-4 rounded-xl font-bold transition-all ${
                      currentScoreInput.dominant === 'red'
                        ? 'bg-red-500 text-white scale-105 shadow-lg'
                        : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-400" aria-hidden />
                      <span>홍코너 우세</span>
                    </div>
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
                {canSubmitScore() ? '점수 제출' : '점수와 우세를 선택하세요'}
              </button>
            </SpotlightCard>
          )}

          {/* 채점 완료 표시 */}
          {scores[`round${currentRound}`] && (
            <SpotlightCard className="p-6 bg-emerald-500/10 border border-emerald-500/50">
              <div className="text-center">
                <div className="text-[10px] font-black tracking-[0.3em] uppercase text-emerald-300/80 mb-2">Round Scored</div>
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

      {showForceStopModal && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-stretch sm:items-center sm:justify-center sm:p-4"
          onClick={() => setShowForceStopModal(false)}
        >
          <div
            className="w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] bg-[#0A0A0A] sm:border sm:border-white/20 sm:rounded-2xl p-5 sm:p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-2">경기 강제 종료</h3>
            <p className="text-sm text-gray-400 mb-5">승자와 최종 점수를 입력하면 즉시 경기를 종료하고 전적에 반영합니다.</p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                onClick={() => setForcedResult(prev => ({ ...prev, winner: 'blue' }))}
                className={`py-3 rounded-lg font-bold transition-all ${forcedResult.winner === 'blue' ? 'bg-blue-500 text-white' : 'bg-blue-500/20 text-blue-400'}`}
              >
                청코너 승
              </button>
              <button
                onClick={() => setForcedResult(prev => ({ ...prev, winner: 'red' }))}
                className={`py-3 rounded-lg font-bold transition-all ${forcedResult.winner === 'red' ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-400'}`}
              >
                홍코너 승
              </button>
              <button
                onClick={() => setForcedResult(prev => ({ ...prev, winner: 'draw' }))}
                className={`py-3 rounded-lg font-bold transition-all ${forcedResult.winner === 'draw' ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                무승부
              </button>
            </div>

            <div className="mb-4">
              <div className="text-xs text-gray-400 mb-2">종료 방식</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setForcedResult(prev => ({ ...prev, finishType: 'decision' }))}
                  className={`py-2 rounded-lg text-sm font-bold ${forcedResult.finishType === 'decision' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-300'}`}
                >
                  판정
                </button>
                <button
                  onClick={() => setForcedResult(prev => ({ ...prev, finishType: 'tko' }))}
                  className={`py-2 rounded-lg text-sm font-bold ${forcedResult.finishType === 'tko' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-gray-300'}`}
                >
                  TKO
                </button>
                <button
                  onClick={() => setForcedResult(prev => ({ ...prev, finishType: 'ko' }))}
                  className={`py-2 rounded-lg text-sm font-bold ${forcedResult.finishType === 'ko' ? 'bg-red-500 text-white' : 'bg-white/10 text-gray-300'}`}
                >
                  KO
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <label className="block">
                <div className="text-xs text-blue-400 mb-1">{blueCorner?.name || '청코너'} 점수</div>
                <input
                  type="number"
                  min="0"
                  value={forcedResult.blueScore}
                  onChange={(e) => setForcedResult(prev => ({ ...prev, blueScore: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                />
              </label>
              <label className="block">
                <div className="text-xs text-red-400 mb-1">{redCorner?.name || '홍코너'} 점수</div>
                <input
                  type="number"
                  min="0"
                  value={forcedResult.redScore}
                  onChange={(e) => setForcedResult(prev => ({ ...prev, redScore: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowForceStopModal(false)}
                className="py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (!forcedResult.winner || forcedResult.blueScore === '' || forcedResult.redScore === '') {
                    alert('승자와 점수를 모두 입력해주세요.');
                    return;
                  }
                  setIsPlaying(false);
                  setResultMethod(forcedResult.finishType || 'decision');
                  setFinishMethod('forced');
                  setPhase('finish');
                  setShowForceStopModal(false);
                }}
                className="py-3 rounded-lg bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-bold"
              >
                강제 종료 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: Finish - 판정 */}
      {phase === 'finish' && (() => {
        // 우승자 / 코너 / 무승부 결정
        const decisionCorner = finishMethod === 'decision'
          ? resolveDecisionWinnerCorner(scores, totalRounds)
          : null;
        const winnerCorner = finishMethod === 'rsc'
          ? rscWinner
          : finishMethod === 'forced'
            ? forcedResult.winner
            : decisionCorner;
        const isDraw = winnerCorner === 'draw' || winnerCorner == null;
        const winnerPlayer = winnerCorner === 'blue' ? blueCorner : winnerCorner === 'red' ? redCorner : null;
        const loserPlayer = winnerCorner === 'blue' ? redCorner : winnerCorner === 'red' ? blueCorner : null;
        const winnerColorKey = winnerCorner === 'blue' ? '청' : winnerCorner === 'red' ? '홍' : null;

        // 종료 방식 라벨
        const methodLabel =
          resultMethod === 'ko' ? 'KO 승'
          : resultMethod === 'tko' ? 'TKO 승'
          : finishMethod === 'rsc' ? 'RSC (TKO) 승'
          : finishMethod === 'forced' ? '강제 종료'
          : isDraw ? '판정 무승부'
          : '판정 승';

        // 점수차 (점수가 의미 있을 때만)
        const finalScore = getFinalScore();
        const margin = Math.abs((finalScore.blue || 0) - (finalScore.red || 0));

        return (
        <div className="space-y-6">
          {/* ⭐ 우승 hero — 누가 이겼는지 시각적으로 명확하게 */}
          <div
            className="relative overflow-hidden rounded-2xl border p-6 sm:p-8"
            style={{
              borderColor: isDraw
                ? 'rgba(255,255,255,0.15)'
                : winnerCorner === 'blue'
                  ? 'rgba(96,165,250,0.5)'
                  : 'rgba(248,113,113,0.5)',
              background: isDraw
                ? 'linear-gradient(135deg, rgba(148,163,184,0.18) 0%, rgba(15,23,42,0.85) 60%)'
                : winnerCorner === 'blue'
                  ? 'linear-gradient(135deg, rgba(59,130,246,0.32) 0%, rgba(30,58,138,0.20) 50%, rgba(15,23,42,0.90) 100%)'
                  : 'linear-gradient(135deg, rgba(239,68,68,0.32) 0%, rgba(127,29,29,0.20) 50%, rgba(15,23,42,0.90) 100%)',
              boxShadow: isDraw
                ? 'none'
                : winnerCorner === 'blue'
                  ? '0 0 40px rgba(59,130,246,0.25)'
                  : '0 0 40px rgba(239,68,68,0.25)',
            }}
          >
            {/* 격자 텍스처 */}
            <div
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
              aria-hidden
            />

            <div className="relative text-center">
              {/* WINNER / DRAW 배지 */}
              {isDraw ? (
                <div className="inline-block px-4 py-1 rounded-full bg-white/10 border border-white/20 mb-4">
                  <span className="text-[10px] sm:text-xs font-black tracking-[0.4em] uppercase text-white/80">Draw</span>
                </div>
              ) : (
                <div
                  className="inline-block px-4 py-1.5 rounded-full mb-4"
                  style={{
                    background: winnerCorner === 'blue' ? 'rgba(59,130,246,0.25)' : 'rgba(239,68,68,0.25)',
                    border: winnerCorner === 'blue' ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(248,113,113,0.5)',
                  }}
                >
                  <span
                    className="text-[10px] sm:text-xs font-black tracking-[0.4em] uppercase"
                    style={{ color: winnerCorner === 'blue' ? '#bfdbfe' : '#fecaca' }}
                  >
                    Winner · {winnerColorKey}코너
                  </span>
                </div>
              )}

              {/* 우승자 아바타 + 이름 */}
              {isDraw ? (
                <div className="flex items-center justify-center gap-6 sm:gap-8 my-5">
                  <div className="text-center">
                    <ProfileAvatarImg
                      avatarUrl={blueCorner.avatarUrl}
                      name={blueCorner.name}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-blue-400/50 mx-auto mb-2 text-2xl"
                      gradientClassName="bg-gradient-to-br from-blue-500 to-blue-700"
                    />
                    <p className="text-sm sm:text-base font-bold text-blue-200">{blueCorner.name}</p>
                  </div>
                  <span className="text-3xl sm:text-4xl font-black text-white/40">VS</span>
                  <div className="text-center">
                    <ProfileAvatarImg
                      avatarUrl={redCorner.avatarUrl}
                      name={redCorner.name}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-red-400/50 mx-auto mb-2 text-2xl"
                      gradientClassName="bg-gradient-to-br from-red-500 to-red-700"
                    />
                    <p className="text-sm sm:text-base font-bold text-red-200">{redCorner.name}</p>
                  </div>
                </div>
              ) : (
                <div className="my-5">
                  <ProfileAvatarImg
                    avatarUrl={winnerPlayer?.avatarUrl}
                    name={winnerPlayer?.name}
                    className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 mx-auto mb-4 text-4xl ${
                      winnerCorner === 'blue' ? 'border-blue-400/80' : 'border-red-400/80'
                    }`}
                    gradientClassName={winnerCorner === 'blue'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                      : 'bg-gradient-to-br from-red-500 to-red-700'}
                  />
                  <h2
                    className="text-4xl sm:text-5xl font-black text-white mb-2 leading-none"
                    style={{ textShadow: '0 0 30px rgba(255,255,255,0.25)' }}
                  >
                    {winnerPlayer?.name || '—'}
                  </h2>
                  <p
                    className="text-lg sm:text-xl font-bold tracking-tight"
                    style={{ color: winnerCorner === 'blue' ? '#93c5fd' : '#fca5a5' }}
                  >
                    {methodLabel}
                  </p>
                </div>
              )}

              {/* 무승부 라벨 별도 */}
              {isDraw ? (
                <h2
                  className="text-3xl sm:text-4xl font-black text-white/90 mb-2 leading-none"
                  style={{ textShadow: '0 0 30px rgba(255,255,255,0.2)' }}
                >
                  {methodLabel}
                </h2>
              ) : null}

              {/* 점수 / 점수차 / 진행 라운드 */}
              {finishMethod === 'rsc' ? (
                <p className="text-sm sm:text-base text-white/70 mt-2">
                  ROUND <span className="font-bold text-white">{currentRound}</span> · 레퍼리 스톱
                </p>
              ) : (
                <div className="mt-3 inline-flex items-center gap-2 sm:gap-3 px-4 py-2 rounded-xl bg-black/30 border border-white/10">
                  <span className={`text-xl sm:text-2xl font-black tabular-nums ${winnerCorner === 'blue' ? 'text-blue-300' : 'text-white/80'}`}>
                    {finalScore.blue}
                  </span>
                  <span className="text-white/40">:</span>
                  <span className={`text-xl sm:text-2xl font-black tabular-nums ${winnerCorner === 'red' ? 'text-red-300' : 'text-white/80'}`}>
                    {finalScore.red}
                  </span>
                  {!isDraw && margin > 0 ? (
                    <span className="ml-2 text-[10px] sm:text-xs text-white/50 font-semibold">
                      {margin}점 차
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>

            {/* 최종 로그 (판정인 경우만) */}
            {finishMethod === 'decision' && (
              <div className="mb-6">
                <h4 className="text-lg font-bold text-white mb-4 text-center">경기 기록</h4>
                
                {/* 라운드별 상세 기록 */}
                <div className="space-y-3 mb-4">
                  {[...Array(totalRounds)].map((_, i) => {
                    const round = i + 1;
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
                          {sumCornerPoints(scores, totalRounds, 'blue')}
                        </div>
                      </div>
                      <span className="text-3xl text-gray-500">-</span>
                      <div className="text-center">
                        <div className="text-sm text-red-400 mb-1">{redCorner.name}</div>
                        <div className="text-5xl font-bold text-red-400">
                          {sumCornerPoints(scores, totalRounds, 'red')}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 우세 라운드 통계 */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                      <div className="text-xs text-blue-400 mb-1">청코너 우세 라운드</div>
                      <div className="text-2xl font-bold text-blue-400">
                        {[...Array(totalRounds)].map((_, i) => i + 1).filter((r) => scores[`round${r}`]?.dominant === 'blue').length}R
                      </div>
                    </div>
                    <div className="text-center p-3 bg-red-500/10 rounded-lg">
                      <div className="text-xs text-red-400 mb-1">홍코너 우세 라운드</div>
                      <div className="text-2xl font-bold text-red-400">
                        {[...Array(totalRounds)].map((_, i) => i + 1).filter((r) => scores[`round${r}`]?.dominant === 'red').length}R
                      </div>
                    </div>
                  </div>
                  {sumCornerPoints(scores, totalRounds, 'blue') === sumCornerPoints(scores, totalRounds, 'red') && (
                    <p className="text-center text-xs text-amber-300/90 mt-3">
                      {totalRounds % 2 === 1
                        ? '총점 동점 시 이긴 라운드가 더 많은 쪽이 승리합니다.'
                        : '총점 동점 시 무승부입니다.'}
                    </p>
                  )}
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

            {finishMethod === 'forced' && (
              <div className="mb-6 p-4 bg-rose-500/10 rounded-xl border border-rose-500/30">
                <div className="text-center">
                  <div className="text-sm text-gray-400 mb-2">경기 종료 방식</div>
                  <div className="text-2xl font-bold text-white mb-2">{(resultMethod || 'decision').toUpperCase()} (FORCED STOP)</div>
                  <div className="text-sm text-gray-500">코치가 강제 종료 후 승자/점수/종료방식 입력</div>
                </div>
              </div>
            )}

            <div className="mb-4">
              {isSavingResult && <div className="text-center text-yellow-400 text-sm">전적 저장 중...</div>}
              {!isSavingResult && resultSaved && <div className="text-center text-emerald-400 text-sm">전적 저장 완료 (대시보드/전적에서 확인 가능)</div>}
              {saveError && <div className="text-center text-red-400 text-sm">전적 저장 실패: {saveError}</div>}
            </div>

            <button
              onClick={resetMatch}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all hover:scale-105"
            >
              다음 매치 잡기
            </button>
        </div>
        );
      })()}
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

export { CoachInsightsView, PlayersManagementView, MatchRoomView, AdminManagementView, GymNewMemberRegisterView };

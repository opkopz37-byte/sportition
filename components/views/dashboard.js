'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon, PageHeader, SpotlightCard, BackgroundGrid, THEME_ATHLETE, THEME_COACH, getMenuStructure } from '@/components/ui';
import { translations } from '@/lib/translations';
import { useAuth } from '@/lib/AuthContext';
import { computeMatchPoints, getNextTierInfo, getTierRingProgress } from '@/lib/tierLadder';
// 대시보드 뷰

const LIVE_MATCH_POINTS_SNAPSHOT_KEY = 'sportition_live_match_points_v1';
const TRAINING_PLANS_STORAGE_KEY = 'sportition_calendar_plans_v1';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ymdFromParts(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function localYmdFromIso(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return ymdFromParts(d.getFullYear(), d.getMonth(), d.getDate());
}

function attendanceRecordYmd(rec) {
  if (rec.attendance_date) {
    const s = String(rec.attendance_date);
    if (s.length >= 10) return s.slice(0, 10);
  }
  return localYmdFromIso(rec.check_in_time);
}

function weekYmdKeys(anchorYmd) {
  const [y, m, d] = anchorYmd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    keys.push(ymdFromParts(x.getFullYear(), x.getMonth(), x.getDate()));
  }
  return keys;
}

/** 티어보드와 동일한 getMatchLeaderboard 상위 N명 기준, 이전 방문 대비 승점(매치 포인트) 변화 */
function buildLiveRankingNews(leaderboardTop) {
  if (!leaderboardTop?.length) return [];
  let prev = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LIVE_MATCH_POINTS_SNAPSHOT_KEY);
      if (raw) prev = JSON.parse(raw);
    } catch {
      prev = {};
    }
  }

  const rows = leaderboardTop.map((p) => {
    const pts = Number(p.match_points ?? 0);
    const prevPts = prev[p.id];
    let deltaType = 'same';
    let deltaAbs = 0;
    if (typeof prevPts !== 'number') {
      deltaType = 'unknown';
    } else {
      const d = pts - prevPts;
      if (d > 0) {
        deltaType = 'up';
        deltaAbs = d;
      } else if (d < 0) {
        deltaType = 'down';
        deltaAbs = Math.abs(d);
      } else {
        deltaType = 'same';
        deltaAbs = 0;
      }
    }
    return {
      id: p.id,
      rank: p.rank_label || '-',
      name: p.display_name || '사용자',
      tier: p.tier || 'Bronze III',
      matchPoints: pts,
      deltaType,
      deltaAbs,
    };
  });

  if (typeof window !== 'undefined') {
    try {
      const next = {};
      leaderboardTop.forEach((p) => {
        next[p.id] = Number(p.match_points ?? 0);
      });
      localStorage.setItem(LIVE_MATCH_POINTS_SNAPSHOT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  return rows;
}

const DashboardView = ({ setActiveTab, t = (key) => key, role = 'player_common' }) => {
  const { profile, user } = useAuth();
  const [statistics, setStatistics] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [showAllMatchHistory, setShowAllMatchHistory] = useState(false);
  const [rankingNews, setRankingNews] = useState([]);
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [calendarViewMode, setCalendarViewMode] = useState('day');
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarModalKey, setCalendarModalKey] = useState(null);
  const [calendarPlanDraft, setCalendarPlanDraft] = useState('');
  const [rawMatches, setRawMatches] = useState([]);
  const [skillProgressWithNodes, setSkillProgressWithNodes] = useState([]);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);

  const tierBoardUi = useMemo(() => {
    const fromRecord = profile?.match_points ?? profile?.tier_points;
    const mp =
      fromRecord != null && fromRecord !== ''
        ? Number(fromRecord)
        : computeMatchPoints(profile?.wins, profile?.draws, profile?.losses);
    return {
      mp,
      ring: getTierRingProgress(mp),
      next: getNextTierInfo(mp),
    };
  }, [profile?.match_points, profile?.tier_points, profile?.wins, profile?.draws, profile?.losses]);

  useEffect(() => {
    console.log('[Dashboard] 컴포넌트 마운트/업데이트');
    console.log('[Dashboard] 프로필 데이터:', profile);
    console.log('[Dashboard] 사용자 데이터:', user);

    const loadUserData = async () => {
      if (user?.id) {
        console.log('[Dashboard] 사용자 데이터 로드 시작:', user.id);
        const supabaseModule = await import('@/lib/supabase');
        const {
          getUserStatistics,
          getUserAttendance,
          getUserMatches,
          getMatchLeaderboard,
          getUserSkillNodeProgressWithNodes,
        } = supabaseModule;

        const lookback = new Date();
        lookback.setDate(lookback.getDate() - 400);

        const [statsResult, attendanceResult, lbResult, matchesResult, skillProgressResult] = await Promise.all([
          getUserStatistics(user.id),
          getUserAttendance(user.id, lookback.toISOString()),
          getMatchLeaderboard(5),
          getUserMatches(user.id, 200),
          getUserSkillNodeProgressWithNodes(user.id),
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

        if (lbResult.data && lbResult.data.length > 0) {
          console.log('[Dashboard] 실시간 랭킹(티어보드 연동):', lbResult.data.length, '건');
          setRankingNews(buildLiveRankingNews(lbResult.data));
        } else {
          console.warn('[Dashboard] 랭킹 데이터 없음');
          setRankingNews([]);
        }

        if (matchesResult.data) {
          setRawMatches(matchesResult.data);
          const formattedMatches = matchesResult.data.map((match) => {
            const playedAt = match.played_at ? new Date(match.played_at) : null;
            const dateLabel = playedAt && !Number.isNaN(playedAt.getTime())
              ? playedAt.toISOString().split('T')[0]
              : '-';
            const result = match.result === 'win' || match.result === 'loss' || match.result === 'draw' ? match.result : 'draw';
            return {
              icon: result === 'win' ? '🔥' : result === 'loss' ? '💥' : '🤝',
              opponentId: match.opponent?.id || match.opponent_id || null,
              opponent: match.opponent_name || match.opponent?.nickname || match.opponent?.name || '상대 미상',
              date: dateLabel,
              played_at: match.played_at,
              result,
              method: match.method || 'decision',
              score: match.score || '-',
              rounds: match.rounds || '-',
              weight: profile?.weight ? `${profile.weight}kg` : '체급 미등록',
            };
          });
          setMatchHistory(formattedMatches);
        } else {
          setRawMatches([]);
          setMatchHistory([]);
        }

        if (skillProgressResult.data) {
          setSkillProgressWithNodes(skillProgressResult.data);
        } else {
          setSkillProgressWithNodes([]);
        }
      }
    };

    loadUserData();
  }, [user, profile]);
  
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

  const attendanceDays = useMemo(() => {
    return attendance
      .filter((record) => {
        const ds = attendanceRecordYmd(record);
        if (!ds) return false;
        const [y, m] = ds.split('-').map(Number);
        return y === currentYear && m - 1 === currentMonth;
      })
      .map((record) => {
        const ds = attendanceRecordYmd(record);
        return parseInt(ds.split('-')[2], 10);
      });
  }, [attendance, currentYear, currentMonth]);

  const workoutDays = attendanceDays;

  const matchDaysInMonth = useMemo(() => {
    const s = new Set();
    (rawMatches || []).forEach((m) => {
      const k = localYmdFromIso(m.played_at);
      if (!k) return;
      const [y, mo, da] = k.split('-').map(Number);
      if (y === currentYear && mo - 1 === currentMonth) s.add(da);
    });
    return s;
  }, [rawMatches, currentYear, currentMonth]);

  const skillDaysInMonth = useMemo(() => {
    const s = new Set();
    (skillProgressWithNodes || []).forEach((row) => {
      if (!row.updated_at) return;
      const k = localYmdFromIso(row.updated_at);
      if (!k) return;
      const [y, mo, da] = k.split('-').map(Number);
      if (y === currentYear && mo - 1 === currentMonth) s.add(da);
    });
    return s;
  }, [skillProgressWithNodes, currentYear, currentMonth]);

  const realNow = new Date();
  const isTodayCell = (day) =>
    !!day &&
    currentYear === realNow.getFullYear() &&
    currentMonth === realNow.getMonth() &&
    day === realNow.getDate();

  const modalAttendance = useMemo(() => {
    if (!calendarModalKey) return [];
    return attendance.filter((r) => attendanceRecordYmd(r) === calendarModalKey);
  }, [attendance, calendarModalKey]);

  const modalMatches = useMemo(() => {
    if (!calendarModalKey) return [];
    return (rawMatches || []).filter((m) => localYmdFromIso(m.played_at) === calendarModalKey);
  }, [rawMatches, calendarModalKey]);

  const modalSkills = useMemo(() => {
    if (!calendarModalKey) return [];
    return (skillProgressWithNodes || []).filter((row) => {
      if (!row.investment_count || row.investment_count < 1) return false;
      return localYmdFromIso(row.updated_at) === calendarModalKey;
    });
  }, [skillProgressWithNodes, calendarModalKey]);

  const weekKeysAroundModal = useMemo(
    () => (calendarModalKey ? weekYmdKeys(calendarModalKey) : []),
    [calendarModalKey]
  );

  const weekSummary = useMemo(() => {
    if (!calendarModalKey || weekKeysAroundModal.length === 0) return { att: 0, matches: 0 };
    const set = new Set(weekKeysAroundModal);
    let att = 0;
    attendance.forEach((r) => {
      const y = attendanceRecordYmd(r);
      if (y && set.has(y)) att += 1;
    });
    let matches = 0;
    (rawMatches || []).forEach((m) => {
      const y = localYmdFromIso(m.played_at);
      if (y && set.has(y)) matches += 1;
    });
    return { att, matches };
  }, [calendarModalKey, weekKeysAroundModal, attendance, rawMatches]);

  const handleCalendarDayClick = (day) => {
    if (!day) return;
    const key = ymdFromParts(currentYear, currentMonth, day);
    setCalendarModalKey(key);
    let plans = {};
    try {
      const raw = localStorage.getItem(TRAINING_PLANS_STORAGE_KEY);
      if (raw) plans = JSON.parse(raw);
    } catch {
      plans = {};
    }
    setCalendarPlanDraft(typeof plans[key] === 'string' ? plans[key] : '');
    setShowCalendarModal(true);
  };

  const persistCalendarPlan = () => {
    if (!calendarModalKey) return;
    let plans = {};
    try {
      const raw = localStorage.getItem(TRAINING_PLANS_STORAGE_KEY);
      if (raw) plans = JSON.parse(raw);
    } catch {
      plans = {};
    }
    plans[calendarModalKey] = calendarPlanDraft;
    localStorage.setItem(TRAINING_PLANS_STORAGE_KEY, JSON.stringify(plans));
  };

  const modalWeekdayLabel = useMemo(() => {
    if (!calendarModalKey) return '';
    const [y, m, d] = calendarModalKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const idx = dt.getDay();
    const labels = lang === 'ko'
      ? ['일', '월', '화', '수', '목', '금', '토']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return labels[idx];
  }, [calendarModalKey, lang]);

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

  useEffect(() => {
    setCurrentNewsIndex((i) =>
      rankingNews.length === 0 ? 0 : Math.min(i, rankingNews.length - 1)
    );
  }, [rankingNews.length]);

  const calendarDayModal =
    showCalendarModal && calendarModalKey ? (
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
        onClick={() => setShowCalendarModal(false)}
      >
        <div
          className="bg-[#0A0A0A] border border-white/20 rounded-2xl max-w-[95vw] sm:max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {calendarModalKey} ({modalWeekdayLabel})
                </h2>
                <p className="text-sm text-gray-400 mt-1">{t('calendarDaySummary')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all flex-shrink-0"
                aria-label={t('calendarClose')}
              >
                <span className="text-xl">✕</span>
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6 overflow-y-auto max-h-[calc(90vh-100px)] space-y-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <span>✅</span> {t('calendarAttendanceSection')}
              </h3>
              {modalAttendance.length > 0 ? (
                <ul className="space-y-2 text-sm text-gray-300">
                  {modalAttendance.map((r) => (
                    <li key={r.id} className="flex flex-wrap gap-x-2 gap-y-1">
                      <span className="text-emerald-400 font-medium">{t('calendarAttendanceYes')}</span>
                      {r.check_in_time && (
                        <span className="text-gray-500">
                          {new Date(r.check_in_time).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">{t('calendarAttendanceNo')}</p>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <span>🎯</span> {t('calendarSkillsSection')}
              </h3>
              {modalSkills.length > 0 ? (
                <ul className="space-y-2">
                  {modalSkills.map((row) => {
                    const label =
                      lang === 'ko'
                        ? row.node?.name || `#${row.node_id}`
                        : row.node?.name_en || row.node?.name || `#${row.node_id}`;
                    return (
                      <li key={String(row.node_id)} className="text-sm text-gray-200 flex justify-between gap-2">
                        <span className="text-left">{label}</span>
                        <span className="text-gray-500 tabular-nums flex-shrink-0">
                          {t('calendarSkillInvestCount')} {row.investment_count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">{t('calendarNoSkillsThatDay')}</p>
              )}
              <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">{t('calendarSkillInvestNote')}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <span>🥊</span> {t('calendarMatchSection')}
              </h3>
              {modalMatches.length > 0 ? (
                <ul className="space-y-3">
                  {modalMatches.map((m) => {
                    const res =
                      m.result === 'win' || m.result === 'loss' || m.result === 'draw' ? m.result : 'draw';
                    const opp = m.opponent_name || m.opponent?.nickname || m.opponent?.name || '—';
                    return (
                      <li key={m.id} className="text-sm border border-white/5 rounded-lg p-3 bg-black/20">
                        <div className="font-bold text-white">vs. {opp}</div>
                        <div className="text-gray-400 mt-1 flex flex-wrap gap-2 text-xs sm:text-sm">
                          <span
                            className={
                              res === 'win' ? 'text-blue-400' : res === 'loss' ? 'text-red-400' : 'text-gray-400'
                            }
                          >
                            {res === 'win' ? t('win') : res === 'loss' ? t('loss') : t('draw')}
                          </span>
                          <span className="text-gray-600">·</span>
                          <span>{m.method || '—'}</span>
                          <span className="text-gray-600">·</span>
                          <span>{m.score || '—'}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">{t('calendarNoMatchThatDay')}</p>
              )}
            </div>

            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <h3 className="text-sm font-bold text-white mb-2">{t('calendarWeekSummary')}</h3>
              <p className="text-sm text-gray-300">
                {lang === 'ko' ? (
                  <>
                    이번 주: 출석 {weekSummary.att}건 · 매치 {weekSummary.matches}건
                  </>
                ) : (
                  <>
                    This week: {weekSummary.att} attendance day(s) · {weekSummary.matches} match(es)
                  </>
                )}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-bold text-white mb-2">{t('calendarPlanSection')}</h3>
              <textarea
                value={calendarPlanDraft}
                onChange={(e) => setCalendarPlanDraft(e.target.value)}
                placeholder={t('calendarPlanPlaceholder')}
                rows={4}
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y min-h-[96px]"
              />
              <button
                type="button"
                onClick={persistCalendarPlan}
                className="mt-3 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-bold hover:opacity-90"
              >
                {t('calendarPlanSave')}
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  // ── 체육관 전용 대시보드 ──────────────────────────────────
  if (role === 'gym' || profile?.role === 'gym') {
    return (
      <>
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
              <button
                type="button"
                key={i}
                disabled={!day}
                onClick={() => day && handleCalendarDayClick(day)}
                className={`aspect-square flex items-center justify-center rounded-md xs:rounded-lg text-[10px] xs:text-xs font-medium transition-all
                  ${!day ? 'invisible' :
                    attendanceDays.includes(day) ? 'bg-purple-500/30 text-purple-300 border border-purple-500/30 hover:bg-purple-500/40' :
                    isTodayCell(day) ? 'bg-white/10 text-white border border-white/20 hover:bg-white/15' :
                    'text-gray-400 hover:bg-white/10'
                  }`}
              >
                {day}
              </button>
            ))}
          </div>
        </SpotlightCard>
      </div>
      {calendarDayModal}
      </>
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
          <div className="absolute left-1.5 xs:left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 bg-black/50 backdrop-blur-sm px-1.5 xs:px-2 sm:px-3 py-0.5 xs:py-1 rounded-md xs:rounded-lg">
              <span className="w-1.5 h-1.5 xs:w-2 xs:h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold text-gray-300">LIVE</span>
            </div>
          </div>
          <div className="absolute right-1.5 xs:right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="text-[9px] xs:text-[10px] sm:text-xs text-gray-400 bg-black/50 backdrop-blur-sm px-1.5 xs:px-2 sm:px-3 py-0.5 xs:py-1 rounded-md xs:rounded-lg font-bold whitespace-nowrap">
              {t('liveRanking')}
            </div>
          </div>

          <div className="relative h-14 sm:h-16 overflow-hidden">
            <div
              className="transition-transform duration-700 ease-in-out will-change-transform"
              style={{
                transform: `translateY(-${(100 * currentNewsIndex) / rankingNews.length}%)`,
              }}
            >
              {rankingNews.map((news, index) => (
                <div
                  key={news.id ?? index}
                  className="h-14 sm:h-16 flex items-center justify-center box-border pl-[4.25rem] pr-[5.5rem] xs:pl-20 xs:pr-24 sm:pl-24 sm:pr-28"
                >
                  <div className="flex items-center justify-center gap-1.5 xs:gap-2 sm:gap-3 w-full min-w-0 max-w-full">
                    <span className="text-sm xs:text-base sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 flex-shrink-0 tabular-nums">
                      #{news.rank}
                    </span>
                    <span className="text-xs xs:text-sm sm:text-base font-bold text-white truncate min-w-0 flex-1 text-left">
                      {news.name}
                    </span>
                    <div
                      className="flex items-center gap-1 xs:gap-1.5 flex-shrink-0 min-w-0"
                      title={t('ladderPointsDeltaTooltip')}
                    >
                      <span className="px-1.5 xs:px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 text-[9px] xs:text-[10px] sm:text-xs font-bold whitespace-nowrap truncate max-w-[5rem] xs:max-w-none">
                        {news.tier}
                      </span>
                      {news.deltaType === 'up' && (
                        <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold tabular-nums whitespace-nowrap text-red-400">
                          +{news.deltaAbs}pt
                        </span>
                      )}
                      {news.deltaType === 'down' && (
                        <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold tabular-nums whitespace-nowrap text-blue-400">
                          -{news.deltaAbs}pt
                        </span>
                      )}
                      {news.deltaType === 'same' && (
                        <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold tabular-nums whitespace-nowrap text-gray-500">
                          ±0pt
                        </span>
                      )}
                      {news.deltaType === 'unknown' && (
                        <span className="text-[9px] xs:text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
                      <span className="whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs">{tierBoardUi.mp} {t('victoryPoints')}</span>
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
                      setShowAllMatchHistory(true);
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
              {matchHistory.length > 0 ? (
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
                                if (match.opponentId) setActiveTab(`opponent-profile-${match.opponentId}`);
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
                    const todayCell = day && isTodayCell(day);
                    const hasWorkout = workoutDays.includes(day);
                    const hasAttendance = attendanceDays.includes(day);
                    const hasMatch = day && matchDaysInMonth.has(day);
                    const hasSkill = day && skillDaysInMonth.has(day);

                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() => day && handleCalendarDayClick(day)}
                        disabled={!day}
                        className={`aspect-square flex items-center justify-center text-xs sm:text-sm rounded-lg transition-all relative ${
                          day === null
                            ? 'invisible'
                            : todayCell
                            ? 'bg-blue-500 text-white font-bold cursor-pointer hover:bg-blue-600 shadow-lg ring-2 ring-blue-400/50'
                            : hasWorkout
                            ? 'bg-yellow-400/80 text-black font-bold cursor-pointer hover:bg-yellow-500 shadow-md'
                            : hasAttendance
                            ? 'bg-emerald-500/70 text-white font-medium cursor-pointer hover:bg-emerald-600 shadow-md'
                            : 'text-gray-300 hover:bg-white/10 cursor-pointer hover:text-white'
                        }`}
                      >
                        {day}
                        {todayCell && (
                          <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white animate-pulse" />
                        )}
                        {day && hasMatch && (
                          <div
                            className="absolute bottom-0.5 left-0.5 sm:bottom-1 sm:left-1 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-red-500"
                            title={t('calendarLegendMatch')}
                          />
                        )}
                        {day && hasSkill && (
                          <div
                            className="absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-violet-400"
                            title={t('calendarLegendSkill')}
                          />
                        )}
                        {!todayCell && hasWorkout && !hasMatch && !hasSkill && (
                          <div className="absolute bottom-0.5 sm:bottom-1 left-1/2 transform -translate-x-1/2 w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-black" />
                        )}
                        {!todayCell && hasAttendance && !hasWorkout && (
                          <div className="absolute bottom-0.5 sm:bottom-1 left-1/2 transform -translate-x-1/2 w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-white" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2 text-xs pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-lg bg-blue-500 ring-2 ring-blue-400/50" />
                    <span className="text-gray-400">{t('currentDay')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-lg bg-yellow-400/80" />
                    <span className="text-gray-400">{lang === 'ko' ? '출석(트레이닝)' : 'Attendance'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 inline-block rounded-full bg-red-500" />
                    <span className="text-gray-400">{t('calendarLegendMatch')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 inline-block rounded-full bg-violet-400" />
                    <span className="text-gray-400">{t('calendarLegendSkill')}</span>
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
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - tierBoardUi.ring)}`}
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
                  strokeDashoffset={`${2 * Math.PI * 48 * (1 - tierBoardUi.ring)}`}
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
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - tierBoardUi.ring)}`}
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
                  {tierBoardUi.mp}
                </div>
                <div className="text-[10px] xs:text-xs text-gray-500 mt-0.5 xs:mt-1 text-center max-w-[10rem]">
                  {tierBoardUi.next.nextLabel
                    ? `${tierBoardUi.next.nextLabel} · +${tierBoardUi.next.pointsToNext}`
                    : (t('maxTier') || '최고 티어')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 xs:gap-3 mt-3 xs:mt-4">
              <div className="p-2 xs:p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/30 text-center">
                <div className="text-[10px] xs:text-xs text-gray-400 mb-0.5 xs:mb-1 whitespace-nowrap">{t('nextTier')}</div>
                <div className="text-xs xs:text-sm font-bold text-blue-400 whitespace-nowrap truncate">
                  {tierBoardUi.next.nextLabel || t('maxTier')}
                </div>
              </div>
              <div className="p-2 xs:p-3 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-lg border border-emerald-500/30 text-center">
                <div className="text-[10px] xs:text-xs text-gray-400 mb-0.5 xs:mb-1 whitespace-nowrap">{t('pointsNeeded')}</div>
                <div className="text-base xs:text-lg font-bold text-emerald-400">
                  {tierBoardUi.next.nextLabel ? `+${tierBoardUi.next.pointsToNext}` : '—'}
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
                <button
                  onClick={() => setShowAllMatchHistory(prev => !prev)}
                  className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg text-[10px] xs:text-xs sm:text-sm text-white font-bold transition-all hover:scale-105 flex items-center gap-1 xs:gap-2 whitespace-nowrap"
                >
                  {showAllMatchHistory ? '접기' : t('viewHistory')} <Icon type="arrowRight" size={12} className={`xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 transition-transform ${showAllMatchHistory ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>

            {matchHistory.length > 0 ? (
              <div className="space-y-2 xs:space-y-3">
                {(showAllMatchHistory ? matchHistory : matchHistory.slice(0, 5)).map((match, i) => (
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
                                if (match.opponentId) setActiveTab(`opponent-profile-${match.opponentId}`);
                              }}
                              className="font-bold text-white text-xs xs:text-sm sm:text-base hover:text-blue-400 transition-colors underline decoration-transparent hover:decoration-blue-400 truncate"
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

      {calendarDayModal}
    </div>
  );
};

export { DashboardView };

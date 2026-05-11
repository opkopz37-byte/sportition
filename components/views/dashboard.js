'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Icon, PageHeader, SpotlightCard, BackgroundGrid, THEME_ATHLETE, THEME_COACH, getMenuStructure } from '@/components/ui';
import ProfileAvatarImg from '@/components/ProfileAvatarImg';
import AvatarCropModal from '@/components/AvatarCropModal';
import MatchHistorySection from '@/components/MatchHistorySection';
import DashboardAttendanceInline from '@/components/views/DashboardAttendanceInline';
import { translations } from '@/lib/translations';
import { useAuth } from '@/lib/AuthContext';
import { computeMatchPoints, getNextTierInfo, getTierRingProgress, getTierColor } from '@/lib/tierLadder';
import TierIcon from '@/components/TierIcon';
import { computeMatchRecords } from '@/lib/matchRecords';
import { uploadUserAvatarBlob } from '@/lib/supabase';

const dashDevLog = (...args) => {
  if (process.env.NODE_ENV === 'development') console.log(...args);
};

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

const DashboardView = ({ setActiveTab, t = (key) => key, role = 'player_common', embeddedInMyPage = false }) => {
  const { profile, user, refreshProfile } = useAuth();
  const [statistics, setStatistics] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [rankingNews, setRankingNews] = useState([]);
  const [matchResetTickets, setMatchResetTickets] = useState(0);
  const [matchResetBusy, setMatchResetBusy] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null); // 크롭 모달 열림 트리거
  const [dataLoading, setDataLoading] = useState(true);
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
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarFileRef = useRef(null);

  // 1단계: 파일 선택 → 크롭 모달 오픈 (즉시 업로드 안 함)
  const handleAvatarChange = useCallback((e) => {
    const f = e.target?.files?.[0];
    e.target.value = '';
    if (!f || !user?.id) return;
    // iOS 사진 라이브러리는 file.type 이 비어 있는 케이스가 있어서 확장자도 허용
    // (accept 속성이 이미 1차 필터링 → 여기선 너무 엄격하게 막지 않음)
    const isImageMime = typeof f.type === 'string' && f.type.startsWith('image/');
    const isImageExt = /\.(png|jpe?g|webp|heic|heif|gif|bmp)$/i.test(f.name || '');
    if (!isImageMime && !isImageExt) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      alert('파일이 너무 큽니다. 12MB 이하로 선택해 주세요.');
      return;
    }
    setPendingAvatarFile(f);
  }, [user?.id]);

  // 2단계: 크롭 완료 → 512x512 JPEG Blob 으로 업로드
  const handleAvatarCropped = useCallback(async (blob) => {
    setPendingAvatarFile(null);
    if (!user?.id || !blob) return;
    setAvatarBusy(true);
    try {
      const { error: upE } = await uploadUserAvatarBlob(user.id, blob);
      if (upE) throw upE;
      await refreshProfile();
    } catch (err) {
      alert(String(err?.message || err) || '업로드에 실패했습니다.');
    } finally {
      setAvatarBusy(false);
    }
  }, [user?.id, refreshProfile]);

  const handleResetMatchRecords = useCallback(async () => {
    if (matchResetBusy) return;
    if (matchResetTickets <= 0) {
      alert('전적 초기화권이 없습니다.');
      return;
    }
    const ok = window.confirm(
      `전적 초기화권 1장을 사용해 모든 경기 기록과 통계·랭킹을 초기화합니다.\n현재 보유: ${matchResetTickets}장\n\n되돌릴 수 없습니다. 계속하시겠습니까?`
    );
    if (!ok) return;
    setMatchResetBusy(true);
    try {
      const { resetMatchRecordsWithTicketRpc, getMatchResetTickets, getUserStatistics, getUserMatches } =
        await import('@/lib/supabase');
      const { error } = await resetMatchRecordsWithTicketRpc();
      if (error) {
        alert(error.message || '초기화에 실패했습니다.');
        return;
      }
      // 화면 갱신: 잔여 티켓 + 통계 + 매치 리스트 다시 불러오기
      const [tk, st, mt] = await Promise.all([
        getMatchResetTickets(user.id),
        getUserStatistics(user.id),
        getUserMatches(user.id),
      ]);
      if (typeof tk?.data === 'number') setMatchResetTickets(tk.data);
      if (st?.data) setStatistics(st.data);
      if (mt?.data) {
        setRawMatches(mt.data);
        setMatchHistory([]);
      }
      alert('전적이 초기화되었습니다.');
    } catch (err) {
      alert(String(err?.message || err) || '초기화에 실패했습니다.');
    } finally {
      setMatchResetBusy(false);
    }
  }, [matchResetBusy, matchResetTickets, user?.id]);

  // 프로필 헤더 4-stat 타일 — matchHistory 기반으로 계산해서 MatchHistorySection 과 일치 보장.
  // (옛 'statistics' 테이블 캐시는 reset / 동기화 누락으로 어긋날 수 있음 → 매치 배열을 단일 source 로)
  const matchAgg = useMemo(() => {
    const r = computeMatchRecords(matchHistory || []);
    return r.aggregate || {
      totalMatches: 0, wins: 0, losses: 0, draws: 0,
      kos: 0, currentStreak: 0, longestStreak: 0, winRate: 0,
    };
  }, [matchHistory]);

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
    dashDevLog('[Dashboard] 컴포넌트 마운트/업데이트');
    dashDevLog('[Dashboard] 프로필 데이터:', profile);
    dashDevLog('[Dashboard] 사용자 데이터:', user);

    const loadUserData = async () => {
      if (user?.id) {
        dashDevLog('[Dashboard] 사용자 데이터 로드 시작:', user.id);
        const supabaseModule = await import('@/lib/supabase');
        const {
          getUserStatistics,
          getUserAttendance,
          getUserMatches,
          getMatchLeaderboard,
          getUserSkillNodeProgressWithNodes,
          getMatchResetTickets,
        } = supabaseModule;

        const lookback = new Date();
        lookback.setDate(lookback.getDate() - 400);

        const [statsResult, attendanceResult, lbResult, matchesResult, skillProgressResult, ticketsResult] = await Promise.all([
          getUserStatistics(user.id),
          getUserAttendance(user.id, lookback.toISOString()),
          getMatchLeaderboard(5),
          getUserMatches(user.id), // limit 없음 — 타일은 전체 전적 기반으로 계산
          getUserSkillNodeProgressWithNodes(user.id),
          getMatchResetTickets(user.id),
        ]);

        if (typeof ticketsResult?.data === 'number') {
          setMatchResetTickets(ticketsResult.data);
        }

        if (statsResult.data) {
          dashDevLog('[Dashboard] 통계 데이터 로드:', statsResult.data);
          setStatistics(statsResult.data);
        } else {
          console.warn('[Dashboard] 통계 데이터 없음');
        }
        
        if (attendanceResult.data) {
          dashDevLog('[Dashboard] 출석 데이터 로드:', attendanceResult.data.length, '건');
          setAttendance(attendanceResult.data);
        } else {
          console.warn('[Dashboard] 출석 데이터 없음');
        }

        if (lbResult.data && lbResult.data.length > 0) {
          dashDevLog('[Dashboard] 실시간 랭킹(티어보드 연동):', lbResult.data.length, '건');
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
            const oppNickname = match.opponent?.nickname || null;
            const oppRealName = match.opponent?.name || null;
            const displayOpponent = match.opponent_name || oppNickname || oppRealName || '상대 미상';
            const opponentRealName = oppRealName && oppRealName !== displayOpponent ? oppRealName : null;
            return {
              opponentId: match.opponent?.id || match.opponent_id || null,
              opponent: displayOpponent,
              opponentRealName,
              opponentAvatarUrl: match.opponent?.avatar_url || null,
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
      setDataLoading(false);
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
              <h3 className="text-sm font-bold text-white mb-2">{t('calendarAttendanceSection')}</h3>
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
              <h3 className="text-sm font-bold text-white mb-2">{t('calendarMatchSection')}</h3>
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
                              res === 'win' ? 'text-blue-400' : res === 'loss' ? 'text-red-400' : 'text-white'
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

  // ── 데이터 로딩 중 스켈레톤 ──
  if (dataLoading && user?.id) {
    return (
      <div className="animate-pulse space-y-3 xs:space-y-4 sm:space-y-6">
        {/* 프로필 카드 스켈레톤 */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-3 xs:p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-white/5">
            <div className="w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-white/10 rounded w-32 sm:w-48" />
              <div className="h-3 bg-white/8 rounded w-24 sm:w-36" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 overflow-hidden mb-3">
            <div className="flex divide-x divide-white/8">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex-1 py-2.5 px-2 text-center">
                  <div className="h-4 bg-white/10 rounded mx-auto w-8 mb-1.5" />
                  <div className="h-2.5 bg-white/8 rounded mx-auto w-10" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* 출석/랭킹 카드 스켈레톤 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 xs:gap-4 sm:gap-6">
          <div className="lg:col-span-2 h-28 sm:h-36 rounded-2xl bg-white/[0.03] border border-white/8" />
          <div className="h-28 sm:h-36 rounded-2xl bg-white/[0.03] border border-white/8" />
        </div>
        {/* 하단 카드 스켈레톤 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 xs:gap-4 sm:gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 sm:h-48 rounded-2xl bg-white/[0.03] border border-white/8" />
          ))}
        </div>
      </div>
    );
  }

  // ── 체육관 전용 대시보드 (마이페이지에 임베드 — 출석·인사이트·캘린더·관리 메뉴 제외) ──
  const isGymRole = (r) => r === 'gym' || r === 'admin';
  if (isGymRole(role) || isGymRole(profile?.role)) {
    return (
      <div className="animate-fade-in-up space-y-3 xs:space-y-4 sm:space-y-6">
        {/* 프로필 사진 편집 모달 (체육관 뷰) */}
        <AvatarCropModal
          file={pendingAvatarFile}
          onCancel={() => setPendingAvatarFile(null)}
          onCropped={handleAvatarCropped}
        />
        {!embeddedInMyPage && (
          <div className="mb-4 xs:mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-1.5 xs:mb-2 flex-wrap">
              <h2 className="text-xl xs:text-2xl sm:text-3xl font-bold text-white">
                {t('hi')}, {profile?.gym_name || profile?.name || '—'}!
              </h2>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                {t('gym')}
              </span>
            </div>
            <p className="text-xs xs:text-sm text-gray-500">{t('manageProfile')}</p>
          </div>
        )}

        <SpotlightCard className="p-3 xs:p-4 sm:p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
          <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
            <div className="relative flex-shrink-0">
              {/* 모바일에서 갤러리(사진 보관함)로 직행 — capture 속성 미지정 + 정적 MIME 리스트로 일부 Android Chrome 이 카메라 단계 스킵 */}
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleAvatarChange}
                disabled={avatarBusy}
              />
              <ProfileAvatarImg
                avatarUrl={profile?.avatar_url}
                name={profile?.gym_name || profile?.name}
                gymFallback="🏋️"
                gradientClassName="bg-gradient-to-br from-purple-500 to-pink-500"
                className="w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-full shadow-lg border-2 border-purple-400/50 text-2xl xs:text-3xl sm:text-4xl"
              />
              <button
                type="button"
                onClick={() => avatarFileRef.current?.click()}
                disabled={avatarBusy}
                className="absolute bottom-0 right-0 w-6 h-6 xs:w-7 xs:h-7 rounded-full bg-purple-500 hover:bg-purple-400 border-2 border-[#0f0f0f] flex items-center justify-center transition-colors disabled:opacity-50"
                title="프로필 사진 변경"
              >
                {avatarBusy
                  ? <span className="text-white text-[9px] leading-none">…</span>
                  : <Icon type="edit" size={11} className="text-white" />
                }
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 mb-1 xs:mb-1.5 sm:mb-2 flex-wrap">
                <h3 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold text-white truncate">
                  {profile?.gym_name || profile?.name || '—'}
                </h3>
                <span className="px-2 py-0.5 xs:px-2.5 xs:py-1 sm:px-3 rounded-full text-[10px] xs:text-xs sm:text-sm font-bold shadow-lg whitespace-nowrap bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  {t('gym')}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1 text-[10px] xs:text-xs sm:text-sm text-gray-400">
                {profile?.gym_location && (
                  <p className="truncate">{profile.gym_location}</p>
                )}
                {profile?.representative_phone && (
                  <p className="truncate">{profile.representative_phone}</p>
                )}
                {profile?.email && (
                  <p className="truncate">{profile.email}</p>
                )}
              </div>
            </div>
          </div>
        </SpotlightCard>

        <div>
          <h3 className="text-sm xs:text-base font-bold text-white mb-2 xs:mb-3">{t('quickActions')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 xs:gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('approval')}
              className="p-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-white/15 rounded-2xl transition-all text-left flex items-center justify-between group"
            >
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-semibold text-white truncate">{t('approval')}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{t('homeSkillApproval')}</div>
              </div>
              <Icon type="chevronRight" size={18} className="text-gray-600 group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('players')}
              className="p-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-white/15 rounded-2xl transition-all text-left flex items-center justify-between group"
            >
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-semibold text-white truncate">{t('members')}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{t('homeMemberList')}</div>
              </div>
              <Icon type="chevronRight" size={18} className="text-gray-600 group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('match')}
              className="p-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-white/15 rounded-2xl transition-all text-left flex items-center justify-between group"
            >
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-semibold text-white truncate">{t('matchRoom')}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{t('homeSparring')}</div>
              </div>
              <Icon type="chevronRight" size={18} className="text-gray-600 group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>
    );
  }
  // ── 체육관 전용 대시보드 끝 ──────────────────────────────

  return (
    <div className="animate-fade-in-up space-y-3 xs:space-y-4 sm:space-y-6">
      {/* 프로필 사진 편집 모달 (선수/코치 뷰) */}
      <AvatarCropModal
        file={pendingAvatarFile}
        onCancel={() => setPendingAvatarFile(null)}
        onCropped={handleAvatarCropped}
      />
      {/* 헤더 — 마이페이지에 넣을 때는 상단 제목과 중복되므로 생략 */}
      {!embeddedInMyPage && (
        <div className="mb-4 xs:mb-6 sm:mb-8">
          <div className="flex items-center gap-1.5 xs:gap-2 mb-1.5 xs:mb-2 flex-wrap">
            <h2 className="text-xl xs:text-2xl sm:text-3xl font-bold text-white">
              {t('hi')}, {profile?.nickname || profile?.name || '사용자'} {profile?.role ? t(profile.role) : ''}!
            </h2>
          </div>
          <p className="text-xs xs:text-sm text-gray-500">{t('todayActivity')}</p>
        </div>
      )}

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
                <button
                  type="button"
                  key={news.id ?? index}
                  onClick={() => {
                    if (news.id && setActiveTab) setActiveTab(`opponent-profile-${news.id}`);
                  }}
                  disabled={!news.id}
                  className="h-14 sm:h-16 w-full flex items-center justify-center box-border pl-[4.25rem] pr-[5.5rem] xs:pl-20 xs:pr-24 sm:pl-24 sm:pr-28 hover:bg-white/[0.04] transition-colors text-left disabled:cursor-default"
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
                </button>
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
              <div className="relative flex-shrink-0">
                {/* 모바일에서 갤러리(사진 보관함)로 직행 — capture 속성 미지정 + 정적 MIME 리스트 */}
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleAvatarChange}
                  disabled={avatarBusy}
                />
                <ProfileAvatarImg
                  avatarUrl={profile?.avatar_url}
                  name={profile?.nickname || profile?.name}
                  className="w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-full shadow-lg border-2 border-blue-400/50 text-2xl xs:text-3xl sm:text-4xl"
                />
                <button
                  type="button"
                  onClick={() => avatarFileRef.current?.click()}
                  disabled={avatarBusy}
                  className="absolute bottom-0 right-0 w-6 h-6 xs:w-7 xs:h-7 rounded-full bg-blue-500 hover:bg-blue-400 border-2 border-[#0f0f0f] flex items-center justify-center transition-colors disabled:opacity-50"
                  title="프로필 사진 변경"
                >
                  {avatarBusy
                    ? <span className="text-white text-[9px] leading-none">…</span>
                    : <Icon type="edit" size={11} className="text-white" />
                  }
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 mb-1 xs:mb-1.5 sm:mb-2 flex-wrap">
                  {/* 티어 아이콘 — 선수만 */}
                  {(profile?.role === 'player_common' || profile?.role === 'player_athlete') && profile?.tier ? (
                    <TierIcon tier={profile.tier} size={28} />
                  ) : null}
                  <h3 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold text-white truncate">
                    {profile?.nickname || profile?.name || '사용자'}
                  </h3>
                  {/* 실명 — 닉네임과 다를 때만 괄호로 */}
                  {profile?.name && profile?.name !== (profile?.nickname || '') ? (
                    <span className="text-xs xs:text-sm sm:text-base text-gray-400 font-medium truncate">
                      ({profile.name})
                    </span>
                  ) : null}
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
                  {(profile?.role === 'player_common' || profile?.role === 'player_athlete') && profile?.tier && (() => {
                    const tc = getTierColor(profile.tier);
                    return (
                      <>
                        <span
                          className={`font-bold whitespace-nowrap ${tc.text} ${tc.glowClass || ''}`}
                          style={tc.shadow ? { textShadow: tc.shadow } : undefined}
                        >
                          {profile.tier}
                        </span>
                        <span className="hidden xs:inline">•</span>
                        <span className="whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs">{tierBoardUi.mp} {t('victoryPoints')}</span>
                        <span className="hidden xs:inline">•</span>
                      </>
                    );
                  })()}
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

            {/* 핵심 전적 - 4개의 주요 지표 (matchHistory 단일 source — MatchHistorySection 과 일치) */}
            <div className="rounded-2xl border border-white/8 overflow-hidden bg-white/[0.03] mb-3 xs:mb-3.5 sm:mb-4">
              <div className="flex divide-x divide-white/8">
                <div className="flex-1 py-2.5 px-2 text-center min-w-0">
                  <div className="text-sm sm:text-base font-bold text-white tabular-nums leading-none">{matchAgg.totalMatches}</div>
                  <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">{t('totalMatches')}</div>
                </div>
                <div className="flex-1 py-2.5 px-2 text-center min-w-0">
                  <div className="text-sm sm:text-base font-bold text-white tabular-nums leading-none">
                    <span className="text-blue-400">{matchAgg.wins}</span>
                    <span className="text-gray-600 text-[10px] mx-0.5">/</span>
                    <span className="text-gray-300">{matchAgg.draws}</span>
                    <span className="text-gray-600 text-[10px] mx-0.5">/</span>
                    <span className="text-red-400">{matchAgg.losses}</span>
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">{t('record')}</div>
                </div>
                <div className="flex-1 py-2.5 px-2 text-center min-w-0">
                  <div className="text-sm sm:text-base font-bold text-red-400 tabular-nums leading-none">{matchAgg.kos}</div>
                  <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">{t('koWins')}</div>
                </div>
                <div className="flex-1 py-2.5 px-2 text-center min-w-0">
                  <div className="text-sm sm:text-base font-bold text-purple-400 tabular-nums leading-none">{matchAgg.currentStreak}</div>
                  <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">{t('winStreak')}</div>
                </div>
              </div>
            </div>

            {/* 전적 초기화권 사용 버튼 + 보유 개수 */}
            <div className="mb-4 xs:mb-5 sm:mb-6 flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-400">
                <span>전적 초기화권</span>
                <span className="px-1.5 py-0.5 rounded-md bg-white/8 border border-white/10 text-amber-300 font-bold tabular-nums">
                  {matchResetTickets}
                </span>
                <span className="text-gray-500">장</span>
              </div>
              <button
                type="button"
                onClick={handleResetMatchRecords}
                disabled={matchResetBusy || matchResetTickets <= 0}
                className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors ${
                  matchResetBusy || matchResetTickets <= 0
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                }`}
              >
                {matchResetBusy ? '초기화 중…' : '전적 초기화'}
              </button>
            </div>

            {/* 신체 정보 + 복싱 스타일 통합 */}
            {(profile?.height || profile?.weight || profile?.gender || profile?.boxing_style) && (
              <div className="mb-4">
                <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">{t('bodyInfo')}</p>
                <div className="rounded-xl border border-white/8 overflow-hidden bg-white/[0.03]">
                  <div className="flex divide-x divide-white/8">
                    {profile?.height && (
                      <div className="flex-1 py-2 px-2 text-center min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-white tabular-nums leading-none">
                          {profile.height}<span className="text-[9px] font-normal text-gray-500 ml-0.5">cm</span>
                        </div>
                        <div className="text-[9px] text-gray-500 mt-1 tracking-wide">{t('height') || '키'}</div>
                      </div>
                    )}
                    {profile?.weight && (
                      <div className="flex-1 py-2 px-2 text-center min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-white tabular-nums leading-none">
                          {profile.weight}<span className="text-[9px] font-normal text-gray-500 ml-0.5">kg</span>
                        </div>
                        <div className="text-[9px] text-gray-500 mt-1 tracking-wide">{t('weight') || '체중'}</div>
                      </div>
                    )}
                    {profile?.gender && (
                      <div className="flex-1 py-2 px-2 text-center min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-white leading-none">
                          {profile.gender === 'male' ? (t('male') || '남') : (t('female') || '여')}
                        </div>
                        <div className="text-[9px] text-gray-500 mt-1 tracking-wide">{t('gender') || '성별'}</div>
                      </div>
                    )}
                    {profile?.boxing_style && (
                      <div className="flex-1 py-2 px-2 text-center min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-orange-300 truncate leading-none">{profile.boxing_style}</div>
                        <div className="text-[9px] text-gray-500 mt-1 tracking-wide">{t('mainStyle') || '스타일'}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </SpotlightCard>
        </div>

        {/* 오른쪽: 출석 (대시보드 전용 컴팩트 레이아웃) */}
        <div className="min-h-[280px] lg:min-h-0">
          <DashboardAttendanceInline t={t} setActiveTab={setActiveTab} />
        </div>
      </div>

      {/* 하단 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 xs:gap-4 sm:gap-6">
        {/* Tier Points */}
        <div>
          <SpotlightCard
            className="p-4 sm:p-6 bg-[#1a2138] cursor-pointer hover:bg-[#1e1e1e] transition-all overflow-hidden relative"
            onClick={() => setActiveTab && setActiveTab('ranking')}
          >

            {(() => {
              const currentTier = profile?.tier || 'Bronze III';
              const tc = getTierColor(currentTier);
              const tcNext = getTierColor(tierBoardUi.next.nextLabel || currentTier);
              return (
            <div className="relative flex flex-col gap-4">
              {/* 상단: 타이틀 + 티어 뱃지 — '티어 점수' 단어 색은 유지 (사용자 지정) */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-400/70">{t('tierPoints')}</p>
                  <h3
                    className={`text-xl font-black mt-0.5 leading-tight ${tc.text} ${tc.glowClass || ''}`}
                    style={tc.shadow ? { textShadow: tc.shadow } : undefined}
                  >
                    {currentTier}
                  </h3>
                </div>
                <div
                  className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${tc.bg} border ${tc.border} flex items-center justify-center shrink-0 ${tc.glowClass || ''}`}
                  style={tc.shadow ? { boxShadow: tc.shadow } : undefined}
                >
                  <Icon type="trophy" size={18} className={tc.text} />
                </div>
              </div>

              {/* 포인트 숫자 */}
              <div className="flex items-end gap-1.5">
                <span className={`text-5xl font-black tabular-nums leading-none text-transparent bg-clip-text bg-gradient-to-r ${tc.bar}`}>
                  {tierBoardUi.mp}
                </span>
                <span className="text-sm font-semibold text-gray-500 mb-1">pts</span>
              </div>

              {/* 프로그레스 바 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[10px] font-semibold ${tc.text}`}>{currentTier}</span>
                  <span className={`text-[10px] font-semibold ${tcNext.text}`}>{tierBoardUi.next.nextLabel || '최고 티어'}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${tc.bar} transition-all duration-700`}
                    style={{ width: `${Math.max(4, Math.round(tierBoardUi.ring * 100))}%` }}
                  />
                </div>
                <p className={`text-right text-[10px] mt-1 ${tc.text}`}>
                  {Math.round(tierBoardUi.ring * 100)}%
                </p>
              </div>

              {/* 다음 티어 정보 */}
              <div className="flex gap-2">
                <div className="flex-1 p-3 rounded-2xl bg-white/[0.04] border border-white/8">
                  <p className="text-[10px] text-gray-500 mb-0.5">{t('nextTier')}</p>
                  <p
                    className={`text-sm font-bold truncate ${tcNext.text} ${tcNext.glowClass || ''}`}
                    style={tcNext.shadow ? { textShadow: tcNext.shadow } : undefined}
                  >
                    {tierBoardUi.next.nextLabel || '—'}
                  </p>
                </div>
                <div className="flex-1 p-3 rounded-2xl bg-white/[0.04] border border-white/8">
                  <p className="text-[10px] text-gray-500 mb-0.5">{t('pointsNeeded')}</p>
                  <p className={`text-sm font-bold ${tc.text}`}>{tierBoardUi.next.nextLabel ? `+${tierBoardUi.next.pointsToNext}` : '최고 티어'}</p>
                </div>
              </div>
            </div>
              );
            })()}
          </SpotlightCard>
        </div>

        {/* Match History */}
        <div className="lg:col-span-2" id="match-history-section">
          <SpotlightCard 
            className="p-3 xs:p-4 sm:p-6 bg-[#1a2138] transition-all"
          >
            <div className="mb-3 xs:mb-4 sm:mb-6 flex items-center justify-between gap-2">
              <h3 className="text-sm xs:text-base sm:text-lg font-bold text-white">{t('matchHistory')}</h3>
            </div>

            {matchHistory.length > 0 ? (
              <MatchHistorySection
                matches={matchHistory}
                onOpenOpponent={(id) => setActiveTab(`opponent-profile-${id}`)}
                limit={10}
              />
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
    </div>
  );
};

export { DashboardView };

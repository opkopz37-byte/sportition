'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ProfileAvatarImg from '@/components/ProfileAvatarImg';
import TierIcon from '@/components/TierIcon';
import MatchHistorySection from '@/components/MatchHistorySection';
import { normalizeRawMatch } from '@/lib/matchRecords';
import Link from 'next/link';
import { Icon, PageHeader, SpotlightCard, BackgroundGrid, THEME_ATHLETE, THEME_COACH, getMenuStructure } from '@/components/ui';
import { DashboardView } from '@/components/views/dashboard';
import { translations } from '@/lib/translations';
import { useAuth } from '@/lib/AuthContext';
import {
  TERMS_OF_SERVICE_FULL_TEXT,
  TERMS_DOCUMENT_TITLE_KO,
} from '@/lib/legal/termsOfService';
import { formatAuthPasswordErrorMessage, isAuthPasswordPolicyError } from '@/lib/authPasswordErrors';
import { computeMatchPoints, getNextTierInfo, getTierRingProgress, getTierColor } from '@/lib/tierLadder';

// 체육관 코드 형식: 2글자 prefix + 4자리 숫자
const MYPAGE_GYM_CODE_REGEX = /^(se|gg|gw|cc|jl|gs|jj)\d{4}$/;
const normalizeMypageGymCode = (raw) => String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
const formatHistoryDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '';
  }
};

// 회원 체육관 이력 — 출신 체육관 표시 (자기 본인 only via get_my_gym_history RPC)
const GymHistoryList = ({ items, loading }) => {
  if (loading) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">출신 체육관 이력</label>
        <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-500">불러오는 중...</div>
      </div>
    );
  }
  if (!items || items.length === 0) return null;
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">출신 체육관 이력</label>
      <ul className="bg-white/5 border border-white/10 rounded-lg divide-y divide-white/5">
        {items.map((h, i) => (
          <li key={`${h.gym_user_id || 'none'}-${h.joined_at || i}`} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-white truncate">{h.gym_name || '(이름 없음)'}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {formatHistoryDate(h.joined_at)} ~ {h.is_current ? '현재' : formatHistoryDate(h.left_at)}
              </div>
            </div>
            {h.is_current && (
              <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">현 소속</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

// 회원 체육관 변경 모달 — 2단계: 경고 → 코드 입력
const GymChangeModal = ({ open, currentCode, onClose, onApply }) => {
  const [stage, setStage] = useState('warning');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState({ status: 'idle', gymName: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStage('warning');
      setCode('');
      setPreview({ status: 'idle', gymName: null });
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  // 코드 입력 시 미리보기
  useEffect(() => {
    if (!open || stage !== 'input') return;
    if (!code) {
      setPreview({ status: 'idle', gymName: null });
      return;
    }
    if (!MYPAGE_GYM_CODE_REGEX.test(code)) {
      setPreview({ status: 'invalid', gymName: null });
      return;
    }
    if (currentCode && code === currentCode) {
      setPreview({ status: 'same', gymName: null });
      return;
    }
    let cancelled = false;
    setPreview({ status: 'checking', gymName: null });
    const timer = setTimeout(async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error: rpcError } = await supabase.rpc('lookup_gym_by_code', { p_code: code });
        if (cancelled) return;
        if (rpcError) {
          setPreview({ status: 'error', gymName: null });
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (row && row.gym_name) {
          setPreview({ status: 'found', gymName: row.gym_name });
        } else {
          setPreview({ status: 'notfound', gymName: null });
        }
      } catch {
        if (!cancelled) setPreview({ status: 'error', gymName: null });
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [code, open, stage, currentCode]);

  const handleApply = async (forceLeave = false) => {
    setError('');
    const codeToApply = forceLeave ? '' : code;
    if (!forceLeave) {
      if (!codeToApply) {
        setError('코드를 입력해주세요.');
        return;
      }
      if (preview.status === 'invalid') {
        setError('코드 형식이 올바르지 않습니다.');
        return;
      }
      if (preview.status === 'notfound') {
        setError('존재하지 않는 코드입니다.');
        return;
      }
      if (preview.status === 'checking') {
        setError('코드 확인 중입니다. 잠시만 기다려주세요.');
        return;
      }
      if (preview.status === 'same') {
        setError('현재 소속과 같은 코드입니다.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const result = await onApply(codeToApply);
      if (result?.ok) {
        onClose();
      } else {
        setError(result?.message || '변경 실패. 다시 시도해주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0a0e14] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {stage === 'warning' && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-lg">⚠</div>
              <h3 className="text-lg font-bold text-white">체육관 변경</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-300">
              <p className="text-gray-400">체육관을 변경하면 다음이 처리됩니다:</p>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                <div className="flex gap-2"><span className="text-amber-400">•</span><span>진행 중인 승단 신청이 새 체육관으로 이동되어 새 관장이 다시 검토합니다.</span></div>
                <div className="flex gap-2"><span className="text-amber-400">•</span><span>이 시점 이후 매치는 새 체육관 소속으로 기록됩니다.</span></div>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 space-y-2">
                <div className="text-emerald-400 font-medium text-xs">유지되는 데이터:</div>
                <div className="flex gap-2"><span className="text-emerald-400">✓</span><span>출석 기록·스킬 진행도</span></div>
                <div className="flex gap-2"><span className="text-emerald-400">✓</span><span>과거 매치 기록 (옛 체육관 소속으로 보존)</span></div>
                <div className="flex gap-2"><span className="text-emerald-400">✓</span><span>완료된 승단 기록 (옛 체육관에서 받은 것)</span></div>
                <div className="flex gap-2"><span className="text-emerald-400">✓</span><span>출신 체육관 이력에 옛 체육관 자동 기록</span></div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => setStage('input')}
                className="flex-1 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
              >
                계속
              </button>
            </div>
          </>
        )}

        {stage === 'input' && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-white">새 체육관 코드</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">새로 가입할 체육관의 관장에게 코드를 받아 입력하세요.</p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(normalizeMypageGymCode(e.target.value))}
              maxLength={6}
              placeholder="gg0001"
              autoCapitalize="none"
              disabled={submitting}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all font-mono tracking-widest text-lg"
            />
            {code && (
              <p className={`mt-2 text-xs ${
                preview.status === 'found' ? 'text-emerald-400' :
                preview.status === 'notfound' || preview.status === 'invalid' || preview.status === 'error' ? 'text-red-400' :
                preview.status === 'same' ? 'text-amber-400' :
                'text-gray-500'
              }`}>
                {preview.status === 'checking' && '확인 중...'}
                {preview.status === 'found' && `✓ ${preview.gymName}`}
                {preview.status === 'notfound' && '✗ 존재하지 않는 코드입니다'}
                {preview.status === 'invalid' && '코드 형식: 지역 2글자 + 숫자 4자리 (예: GG0001)'}
                {preview.status === 'error' && '확인 중 오류가 발생했습니다'}
                {preview.status === 'same' && '현재 소속 체육관과 같은 코드입니다'}
              </p>
            )}
            {error && (
              <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">{error}</div>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setStage('warning')}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-colors disabled:opacity-50"
              >
                뒤로
              </button>
              <button
                type="button"
                onClick={() => handleApply(false)}
                disabled={submitting || preview.status !== 'found'}
                className="flex-1 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '변경 중...' : '변경 적용'}
              </button>
            </div>
            {currentCode && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('현재 체육관에서 탈퇴하시겠습니까? 이후 어느 체육관에도 소속되지 않은 상태가 됩니다.')) {
                    handleApply(true);
                  }
                }}
                disabled={submitting}
                className="mt-3 w-full py-2 text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                또는 체육관에서 탈퇴 (소속 비우기)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// 체육관 코드 표시 (read-only). role='gym' 은 자기 코드, member 는 소속 체육관 코드.
// 외부 노출 금지: RPC 로만 가져오며 화면 표시는 본인 프로필 편집에서만.
const GymCodeDisplay = ({ role, code, loading, copied, onCopy }) => {
  const isGym = role === 'gym';
  const accent = isGym ? 'border-purple-500/30 bg-purple-500/5' : 'border-blue-500/30 bg-blue-500/5';
  const helpText = isGym
    ? '회원에게 이 코드를 알려주면 회원가입 시 입력하여 우리 체육관에 자동 등록됩니다. 외부에 공개 게시하지 마세요.'
    : '소속된 체육관의 코드입니다. 외부에 공유하지 마세요.';
  const emptyText = isGym ? '코드 미발급 (지역을 먼저 등록해주세요)' : '소속된 체육관이 없습니다';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">체육관 코드</label>
      <div className={`w-full px-4 py-3 ${accent} border rounded-lg flex items-center justify-between gap-3`}>
        <span className="text-white font-mono text-lg tracking-widest">
          {loading ? '...' : (code || <span className="text-gray-500 text-sm font-sans tracking-normal">{emptyText}</span>)}
        </span>
        {code && (
          <button
            type="button"
            onClick={onCopy}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
          >
            {copied ? '✓ 복사됨' : '복사'}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-gray-500">{helpText}</p>
    </div>
  );
};

// 마이페이지 뷰들

const MyPageView = ({ setActiveTab, t }) => {
  const { profile } = useAuth();
  const isPlayer = profile?.role === 'player_common' || profile?.role === 'player_athlete';
  const isGym = profile?.role === 'gym' || profile?.role === 'admin';
  const embedDashboard = isPlayer || isGym;

  return (
  <div className="animate-fade-in-up">
    <div className="mb-6 flex items-center justify-between gap-3">
      <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('myPage')}</h2>
      <button
        type="button"
        onClick={() => setActiveTab('mypage-edit-profile')}
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-semibold text-gray-300 hover:text-white transition-colors"
      >
        <Icon type="edit" size={14} />
        프로필 편집
      </button>
    </div>

    {embedDashboard ? (
      <DashboardView
        setActiveTab={setActiveTab}
        t={t}
        role={profile?.role || 'player_common'}
        embeddedInMyPage
      />
    ) : null}
  </div>
);
};

// 설정 페이지 (네비게이션 드롭다운에서 접근)
const SettingsView = ({ setActiveTab, t = (key) => key }) => {
  return (
    <div className="animate-fade-in-up w-full">
      <PageHeader
        title={t('settings')}
        onBack={() => setActiveTab('home')}
      />

      <SpotlightCard className="p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { id: 'edit-profile', label: t('editProfile') },
            { id: 'privacy', label: t('privacySettings') },
            { id: 'terms', label: t('termsOfService') },
          ].map((setting) => (
            <button
              key={setting.id}
              onClick={() => setActiveTab(`mypage-${setting.id}`)}
              className="w-full p-3.5 rounded-lg bg-white/5 hover:bg-white/10 text-left text-white text-sm transition-colors flex items-center justify-between group"
            >
              <span>{setting.label}</span>
              <Icon type="chevronRight" size={16} className="text-gray-500 group-hover:text-white transition-colors" />
            </button>
          ))}
        </div>
      </SpotlightCard>
    </div>
  );
};

// Edit Profile 페이지
const EditProfileView = ({ setActiveTab, t = (key) => key }) => {
  const { profile, user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** 닉네임 중복 확인: idle | checking | available | taken | error | unchanged
   *  unchanged = 본인의 기존 닉네임과 동일 (변경 없음 → 통과 처리) */
  const [nicknameCheckStatus, setNicknameCheckStatus] = useState('unchanged');

  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    phone: '',
    birth_date: '',
    gender: '',
    height: '',
    weight: '',
    boxing_style: '',
    gym_name: '',
    gym_location: '',
    representative_phone: '',
  });

  // 체육관 코드 — 회원/체육관이 자기 코드 확인용 (read-only). 외부 노출 차단을 위해 RPC 로만 조회.
  const [gymCode, setGymCode] = useState(null);
  const [gymCodeLoading, setGymCodeLoading] = useState(false);
  const [gymCodeCopied, setGymCodeCopied] = useState(false);
  // 회원 출신 체육관 이력 + 변경 모달
  const [gymHistory, setGymHistory] = useState([]);
  const [gymHistoryLoading, setGymHistoryLoading] = useState(false);
  const [gymChangeModalOpen, setGymChangeModalOpen] = useState(false);

  useEffect(() => {
    console.log('[EditProfile] 프로필 데이터 확인:', profile);
    if (profile) {
      const newFormData = {
        name: profile.name || '',
        nickname: profile.nickname || profile.name || '',
        phone: profile.phone || '',
        birth_date: profile.birth_date || '',
        gender: profile.gender || '',
        height: profile.height ? String(profile.height) : '',
        weight: profile.weight ? String(profile.weight) : '',
        boxing_style: profile.boxing_style || '',
        gym_name: profile.gym_name || '',
        gym_location: profile.gym_location || '',
        representative_phone: profile.representative_phone || '',
      };
      console.log('[EditProfile] formData 설정:', newFormData);
      setFormData(newFormData);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const role = profile.role;
    const isMember = role === 'player_common' || role === 'player_athlete';
    const isGymRole = role === 'gym';
    if (!isMember && !isGymRole) return;

    let cancelled = false;
    (async () => {
      setGymCodeLoading(true);
      try {
        const { supabase } = await import('@/lib/supabase');
        const rpcName = isGymRole ? 'get_my_gym_code' : 'get_my_current_gym_code';
        const { data, error: rpcError } = await supabase.rpc(rpcName);
        if (cancelled) return;
        if (rpcError) {
          console.warn('[EditProfile] gym_code RPC 에러:', rpcError);
          setGymCode(null);
        } else {
          setGymCode(data || null);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[EditProfile] gym_code 조회 실패:', e);
          setGymCode(null);
        }
      } finally {
        if (!cancelled) setGymCodeLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [profile]);

  const handleCopyGymCode = useCallback(async () => {
    if (!gymCode) return;
    try {
      await navigator.clipboard.writeText(gymCode);
      setGymCodeCopied(true);
      setTimeout(() => setGymCodeCopied(false), 1500);
    } catch (e) {
      console.error('[EditProfile] 클립보드 복사 실패:', e);
    }
  }, [gymCode]);

  // 회원의 출신 체육관 이력 로드
  const loadGymHistory = useCallback(async () => {
    if (!profile) return;
    const isMember = profile.role === 'player_common' || profile.role === 'player_athlete';
    if (!isMember) return;
    setGymHistoryLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data, error: rpcError } = await supabase.rpc('get_my_gym_history');
      if (rpcError) {
        console.warn('[EditProfile] gym_history RPC 에러:', rpcError);
        setGymHistory([]);
      } else {
        setGymHistory(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('[EditProfile] gym_history 조회 실패:', e);
      setGymHistory([]);
    } finally {
      setGymHistoryLoading(false);
    }
  }, [profile]);

  useEffect(() => { loadGymHistory(); }, [loadGymHistory]);

  // 모달에서 코드 변경 적용 — change_my_gym_by_code RPC 호출
  const handleApplyGymChange = useCallback(async (newCode) => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data, error: rpcError } = await supabase.rpc('change_my_gym_by_code', { p_code: newCode || '' });
      if (rpcError) {
        return { ok: false, message: rpcError.message || '변경 실패' };
      }
      if (!data || data.ok === false) {
        const errMap = {
          not_authenticated: '로그인이 필요합니다.',
          not_a_member: '회원 계정만 변경 가능합니다.',
          invalid_code_format: '코드 형식이 올바르지 않습니다.',
          code_not_found: '존재하지 않는 코드입니다.',
        };
        return { ok: false, message: errMap[data?.error] || '변경 실패' };
      }
      // 성공 → 코드/이력 새로고침 + 프로필 새로고침
      await refreshProfile();
      await loadGymHistory();
      // gymCode 도 새로 가져옴
      const isMember = profile?.role === 'player_common' || profile?.role === 'player_athlete';
      if (isMember) {
        const { data: newCodeData } = await supabase.rpc('get_my_current_gym_code');
        setGymCode(newCodeData || null);
      }
      return { ok: true };
    } catch (e) {
      console.error('[EditProfile] gym change 실패:', e);
      return { ok: false, message: e.message || '변경 실패' };
    }
  }, [profile, refreshProfile, loadGymHistory]);

  const handleSave = async () => {
    if (!user?.id) {
      setError('사용자 정보가 없습니다');
      return;
    }

    // 이름 검증
    const trimmedName = (formData.name || '').trim();
    if (!trimmedName) {
      setError('이름을 입력해주세요.');
      return;
    }
    // 닉네임 검증 — 변경된 경우에만 중복확인 통과 필수
    const trimmedNick = formData.nickname.trim();
    if (!trimmedNick) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    const original = (profile?.nickname || profile?.name || '').trim();
    if (trimmedNick !== original && nicknameCheckStatus !== 'available') {
      setError('닉네임 중복 확인을 완료해주세요.');
      return;
    }

    console.log('[EditProfile] 저장 시작, formData:', formData);
    setLoading(true);
    setError('');

    try {
      const { updateUserProfile } = await import('@/lib/supabase');
      
      const updates = {
        name: trimmedName,
        nickname: trimmedNick,
        phone: formData.phone || null,
        birth_date: formData.birth_date || null,
        gender: formData.gender || null,
        height: formData.height ? parseInt(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
      };

      if (profile?.role === 'player_common') {
        // 체육관(gym_name) 변경은 GymChangeModal → change_my_gym_by_code RPC 로만.
        // 이 저장 경로에선 gym_name 을 보내지 않음 (의도치 않은 덮어쓰기 방지).
      } else if (profile?.role === 'player_athlete') {
        updates.boxing_style = formData.boxing_style || null;
        // 위와 동일한 이유로 gym_name 미전송.
      } else if (profile?.role === 'gym') {
        updates.gym_name = formData.gym_name || null;
        updates.gym_location = formData.gym_location || null;
        updates.representative_phone = formData.representative_phone || null;
      }

      console.log('[EditProfile] 업데이트 데이터:', updates);
      const { data, error: updateError } = await updateUserProfile(user.id, updates);
      
      if (updateError) {
        console.error('[EditProfile] 업데이트 에러:', updateError);
        throw updateError;
      }

      console.log('[EditProfile] 업데이트 성공:', data);
      console.log('[EditProfile] 프로필 새로고침 시작');
      await refreshProfile();
      console.log('[EditProfile] 프로필 새로고침 완료');
      
      alert('프로필이 성공적으로 업데이트되었습니다!');
      setActiveTab('mypage');
    } catch (err) {
      console.error('[EditProfile] 프로필 업데이트 에러:', err);
      setError('프로필 업데이트에 실패했습니다: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up w-full">
      <PageHeader
        title={t('editProfile')}
        onBack={() => setActiveTab('mypage')}
      />

      <SpotlightCard className="p-5 sm:p-6">
        <h3 className="text-lg font-bold text-white mb-6">기본 정보</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">이름</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              placeholder="실제 이름 (예: 홍길동)"
              disabled={loading}
              maxLength={30}
            />
            <p className="text-xs text-gray-500 mt-1">상대 프로필 등에서 닉네임 옆에 표시됩니다</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">닉네임</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => {
                  const next = e.target.value;
                  setFormData({ ...formData, nickname: next });
                  // 본인 기존 닉네임과 같으면 별도 확인 불필요 (unchanged 로 통과)
                  const original = profile?.nickname || profile?.name || '';
                  if (next.trim() === original.trim()) {
                    setNicknameCheckStatus('unchanged');
                  } else {
                    setNicknameCheckStatus('idle');
                  }
                }}
                placeholder="닉네임을 입력하세요"
                maxLength={30}
                className="flex-1 min-w-0 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              />
              <button
                type="button"
                disabled={
                  loading
                  || !formData.nickname.trim()
                  || nicknameCheckStatus === 'checking'
                  || nicknameCheckStatus === 'unchanged'
                }
                onClick={async () => {
                  setError('');
                  setNicknameCheckStatus('checking');
                  const { checkNicknameAvailable } = await import('@/lib/nicknameAvailability');
                  const r = await checkNicknameAvailable(formData.nickname);
                  if (!r.ok) {
                    setNicknameCheckStatus('error');
                    setError('닉네임 확인 중 오류가 발생했습니다.');
                    return;
                  }
                  if (r.available) {
                    setNicknameCheckStatus('available');
                  } else {
                    setNicknameCheckStatus('taken');
                    setError('이미 사용 중인 닉네임입니다.');
                  }
                }}
                className="shrink-0 px-4 py-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {nicknameCheckStatus === 'checking' ? '확인 중…'
                  : nicknameCheckStatus === 'unchanged' ? '변경 없음'
                  : '중복 확인'}
              </button>
            </div>
            {nicknameCheckStatus === 'available' && (
              <p className="text-xs text-emerald-400 mt-1.5">사용 가능한 닉네임입니다.</p>
            )}
            {nicknameCheckStatus === 'taken' && (
              <p className="text-xs text-red-400 mt-1.5">이미 사용 중인 닉네임입니다.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">이메일</label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">이메일은 변경할 수 없습니다</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">전화번호</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="010-1234-5678"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">키 (cm)</label>
              <input
                type="number"
                value={formData.height}
                onChange={(e) => setFormData({...formData, height: e.target.value})}
                placeholder="175"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">체중 (kg)</label>
              <input
                type="number"
                value={formData.weight}
                onChange={(e) => setFormData({...formData, weight: e.target.value})}
                placeholder="70"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              />
            </div>
          </div>

          {profile?.role === 'player_common' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">소속 체육관</label>
                <div className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-200 flex items-center justify-between gap-3">
                  <span className="truncate">{formData.gym_name || <span className="text-gray-500">소속 없음</span>}</span>
                  <button
                    type="button"
                    onClick={() => setGymChangeModalOpen(true)}
                    className="flex-shrink-0 text-xs px-3 py-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 transition-colors"
                  >
                    변경
                  </button>
                </div>
              </div>
              <GymCodeDisplay
                role="member"
                code={gymCode}
                loading={gymCodeLoading}
                copied={gymCodeCopied}
                onCopy={handleCopyGymCode}
              />
              <GymHistoryList items={gymHistory} loading={gymHistoryLoading} />
            </>
          )}

          {profile?.role === 'player_athlete' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">복싱 스타일</label>
                <select
                  value={formData.boxing_style}
                  onChange={(e) => setFormData({...formData, boxing_style: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all"
                >
                  <option value="">선택하세요</option>
                  <option value="아웃복서">아웃복서</option>
                  <option value="인파이터">인파이터</option>
                  <option value="스워머">스워머</option>
                  <option value="펀처">펀처</option>
                  <option value="카운터 펀처">카운터 펀처</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">소속 체육관</label>
                <div className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-200 flex items-center justify-between gap-3">
                  <span className="truncate">{formData.gym_name || <span className="text-gray-500">소속 없음</span>}</span>
                  <button
                    type="button"
                    onClick={() => setGymChangeModalOpen(true)}
                    className="flex-shrink-0 text-xs px-3 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors"
                  >
                    변경
                  </button>
                </div>
              </div>
              <GymCodeDisplay
                role="member"
                code={gymCode}
                loading={gymCodeLoading}
                copied={gymCodeCopied}
                onCopy={handleCopyGymCode}
              />
              <GymHistoryList items={gymHistory} loading={gymHistoryLoading} />
            </>
          )}

          {profile?.role === 'gym' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">체육관 이름</label>
                <input
                  type="text"
                  value={formData.gym_name}
                  onChange={(e) => setFormData({...formData, gym_name: e.target.value})}
                  placeholder="체육관 이름을 입력하세요"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">체육관 위치</label>
                <input
                  type="text"
                  value={formData.gym_location}
                  onChange={(e) => setFormData({...formData, gym_location: e.target.value})}
                  placeholder="체육관 위치를 입력하세요"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">대표 전화번호</label>
                <input
                  type="tel"
                  value={formData.representative_phone}
                  onChange={(e) => setFormData({...formData, representative_phone: e.target.value})}
                  placeholder="대표 전화번호를 입력하세요"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                />
              </div>
              <GymCodeDisplay
                role="gym"
                code={gymCode}
                loading={gymCodeLoading}
                copied={gymCodeCopied}
                onCopy={handleCopyGymCode}
              />
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">생년월일</label>
              <input
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">성별</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({...formData, gender: e.target.value})}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              >
                <option value="">선택</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                저장 중...
              </>
            ) : (
              '변경사항 저장'
            )}
          </button>
          <button
            onClick={() => setActiveTab('mypage')}
            disabled={loading}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
          >
            취소
          </button>
        </div>
      </SpotlightCard>

      <GymChangeModal
        open={gymChangeModalOpen}
        currentCode={gymCode}
        onClose={() => setGymChangeModalOpen(false)}
        onApply={handleApplyGymChange}
      />
    </div>
  );
};

// Privacy Settings 페이지 (비밀번호 변경 + 약관 포함)
const PrivacySettingsView = ({ setActiveTab, t = (key) => key }) => {
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: null, text: '' });
  const [termsOpen, setTermsOpen] = useState(false);
  // 'idle' | 'checking' | 'match' | 'mismatch'
  const [currentPwStatus, setCurrentPwStatus] = useState('idle');

  // 현재 비밀번호 디바운스 검증
  // (passwordData.current 를 별도 변수로 추출 — ESLint 가 state.current 를 ref.current 로
  //  오인하지 않도록 함. 의도된 동작은 동일.)
  const currentPwInput = passwordData.current;
  useEffect(() => {
    if (!currentPwInput) {
      setCurrentPwStatus('idle');
      return undefined;
    }
    setCurrentPwStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const { verifyCurrentPassword } = await import('@/lib/supabase');
        const { ok } = await verifyCurrentPassword(currentPwInput);
        // 사용자가 그 사이에 값을 바꿨을 수 있으므로 확인
        setPasswordData((cur) => {
          if (cur.current !== currentPwInput) return cur;
          setCurrentPwStatus(ok ? 'match' : 'mismatch');
          return cur;
        });
      } catch {
        setCurrentPwStatus('mismatch');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [currentPwInput]);

  const newPwMatch =
    passwordData.new && passwordData.confirm
      ? passwordData.new === passwordData.confirm
      : null;

  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: null, text: '' });

    if (passwordData.new !== passwordData.confirm) {
      setPasswordMessage({ type: 'error', text: t('passwordMismatch') });
      return;
    }

    setPasswordSaving(true);
    try {
      const { changePasswordWithCurrentVerification } = await import('@/lib/supabase');
      const { error } = await changePasswordWithCurrentVerification(
        passwordData.current,
        passwordData.new
      );
      if (error) {
        if (isAuthPasswordPolicyError(error)) {
          setPasswordMessage({ type: 'error', text: t('passwordPolicySupabaseHint') });
          return;
        }
        const code = error?.code || error?.status;
        const msg = String(error.message || error).toLowerCase();
        const isInvalid =
          code === 'invalid_credentials' ||
          msg.includes('invalid login') ||
          msg.includes('invalid credentials') ||
          msg.includes('wrong password');
        setPasswordMessage({
          type: 'error',
          text: isInvalid ? t('currentPasswordWrong') : error.message || t('passwordChangeFailed'),
        });
        return;
      }
      setPasswordMessage({ type: 'ok', text: t('passwordChangedSuccess') });
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text: formatAuthPasswordErrorMessage(err, t),
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="animate-fade-in-up w-full">
      <PageHeader
        title={t('privacySettings')}
        onBack={() => setActiveTab('mypage')}
      />

      <div className="space-y-4">
        {/* 비밀번호 변경 */}
        <SpotlightCard className="p-5 sm:p-6">
          <h3 className="text-lg font-bold text-white mb-5">{t('changePassword')}</h3>
          <form onSubmit={handleSubmitPassword} className="space-y-3">
            {passwordMessage.text ? (
              <p
                className={`text-sm rounded-lg px-3 py-2 ${
                  passwordMessage.type === 'ok'
                    ? 'bg-green-500/15 text-green-200 border border-green-500/30'
                    : 'bg-red-500/15 text-red-200 border border-red-500/30'
                }`}
              >
                {passwordMessage.text}
              </p>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('currentPassword')}</label>
              <input
                type="password"
                autoComplete="current-password"
                value={passwordData.current}
                onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              />
              {passwordData.current && currentPwStatus === 'checking' && (
                <p className="text-xs text-gray-400 mt-1.5">확인 중…</p>
              )}
              {currentPwStatus === 'match' && (
                <p className="text-xs text-emerald-400 mt-1.5">현재 비밀번호가 일치합니다</p>
              )}
              {currentPwStatus === 'mismatch' && passwordData.current && (
                <p className="text-xs text-red-400 mt-1.5">현재 비밀번호가 일치하지 않습니다</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('newPassword')}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordData.new}
                onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('confirmPassword')}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordData.confirm}
                onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              />
              {newPwMatch === true && (
                <p className="text-xs text-emerald-400 mt-1.5">새 비밀번호가 일치합니다</p>
              )}
              {newPwMatch === false && (
                <p className="text-xs text-red-400 mt-1.5">새 비밀번호가 일치하지 않습니다</p>
              )}
            </div>
            <button
              type="submit"
              disabled={passwordSaving}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:pointer-events-none rounded-lg text-white font-medium transition-colors"
            >
              {passwordSaving ? '…' : t('updatePassword')}
            </button>
          </form>
        </SpotlightCard>

        {/* 이용약관 · 개인정보 수집·이용 동의 (접기/상세보기) */}
        <SpotlightCard className="p-5 sm:p-6">
          <button
            type="button"
            onClick={() => setTermsOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <h3 className="text-base sm:text-lg font-bold text-white">{TERMS_DOCUMENT_TITLE_KO}</h3>
            <span className="flex-shrink-0 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              {termsOpen ? '접기' : '상세보기'}
            </span>
          </button>

          {termsOpen && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-3">
                전체 페이지로 보기:{' '}
                <Link href="/terms" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
                  새 창으로 열기
                </Link>
              </p>
              <div className="max-h-[min(50vh,22rem)] overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-4">
                <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed text-gray-300">
                  {TERMS_OF_SERVICE_FULL_TEXT}
                </pre>
              </div>
            </div>
          )}
        </SpotlightCard>
      </div>
    </div>
  );
};


// Activity History 페이지
const ActivityHistoryView = ({ setActiveTab, t = (key) => key }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailPage, setShowDetailPage] = useState(false);
  
  // 복싱 훈련 데이터 (날짜별)
  const trainingData = {
    '2024-02-07': {
      date: '2024-02-07',
      dayOfWeek: '수요일',
      totalTime: 120,
      calories: 850,
      exercises: [
        { name: '미트 트레이닝', duration: 60, rounds: 8, totalPunches: 800, intensity: 'high', icon: '🎯' },
        { name: '로드워크', duration: 30, distance: 5.2, calories: 350, pace: '5:46/km', intensity: 'medium', icon: '🏃' },
        { name: '스트레칭', duration: 30, type: '회복', flexibility: 85, intensity: 'low', icon: '🧘' },
      ],
      note: '오늘 컨디션 최상! 펀치 스피드 향상',
      coach: '김코치',
      satisfaction: 5,
    },
    '2024-02-06': {
      date: '2024-02-06',
      dayOfWeek: '화요일',
      totalTime: 90,
      calories: 620,
      exercises: [
        { name: '스파링', duration: 45, rounds: 6, intensity: 'high', icon: '🥊' },
        { name: '코어 강화', duration: 30, sets: 8, reps: 120, intensity: 'medium', icon: '💪' },
        { name: '쿨다운', duration: 15, type: '회복', intensity: 'low', icon: '🌊' },
      ],
      note: '스파링 파트너와 좋은 훈련',
      coach: '이코치',
      satisfaction: 4,
    },
    '2024-02-05': {
      date: '2024-02-05',
      dayOfWeek: '월요일',
      totalTime: 75,
      calories: 480,
      exercises: [
        { name: '섀도우 복싱', duration: 60, rounds: 8, intensity: 'medium', icon: '👤' },
        { name: '스트레칭', duration: 15, type: '유연성', intensity: 'low', icon: '🕉️' },
      ],
      note: '테크닉과 풋워크 집중',
      coach: '박코치',
      satisfaction: 5,
    },
    '2024-02-04': {
      date: '2024-02-04',
      dayOfWeek: '일요일',
      totalTime: 0,
      calories: 0,
      exercises: [],
      note: '휴식일',
      coach: null,
      satisfaction: null,
    },
    '2024-02-03': {
      date: '2024-02-03',
      dayOfWeek: '토요일',
      totalTime: 105,
      calories: 780,
      exercises: [
        { name: '헤비백 파워 훈련', duration: 60, rounds: 8, intensity: 'very-high', icon: '💥' },
        { name: '컨디셔닝', duration: 45, type: '체력강화', intensity: 'medium', icon: '🏃' },
      ],
      note: '개인 최고 기록! 펀치력 향상',
      coach: '최코치',
      satisfaction: 5,
    },
  };

  // 캘린더 생성
  const generateCalendar = () => {
    const calendar = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // 이번 달 1일
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    // 시작 요일 (일요일 = 0)
    const startDay = firstDay.getDay();
    
    // 빈 칸 추가
    for (let i = 0; i < startDay; i++) {
      calendar.push(null);
    }
    
    // 날짜 추가
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      calendar.push({
        day,
        dateStr,
        data: trainingData[dateStr] || null,
      });
    }
    
    return calendar;
  };

  const calendar = generateCalendar();

  const handleDateClick = (dateData) => {
    if (dateData && dateData.data) {
      setSelectedDate(dateData.data);
      setShowDetailPage(false);
    }
  };

  // 상세 페이지 렌더링
  if (showDetailPage && selectedDate) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader 
          title={`🗓️ ${selectedDate.date} (${selectedDate.dayOfWeek})`}
          description="상세 트레이닝 리포트"
          onBack={() => setShowDetailPage(false)}
        />

        {/* 전체 통계 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <SpotlightCard className="p-5 border-l-4 border-blue-500">
            <div className="text-sm text-gray-400 mb-1">총 운동 시간</div>
            <div className="text-3xl font-bold text-white">{selectedDate.totalTime}분</div>
          </SpotlightCard>
          <SpotlightCard className="p-5 border-l-4 border-red-500">
            <div className="text-sm text-gray-400 mb-1">소모 칼로리</div>
            <div className="text-3xl font-bold text-white">{selectedDate.calories}kcal</div>
          </SpotlightCard>
          <SpotlightCard className="p-5 border-l-4 border-purple-500">
            <div className="text-sm text-gray-400 mb-1">운동 종목</div>
            <div className="text-3xl font-bold text-white">{selectedDate.exercises.length}개</div>
          </SpotlightCard>
          <SpotlightCard className="p-5 border-l-4 border-yellow-500">
            <div className="text-sm text-gray-400 mb-1">만족도</div>
            <div className="text-3xl font-bold text-white">
              {'⭐'.repeat(selectedDate.satisfaction || 0)}
            </div>
          </SpotlightCard>
        </div>

        {/* 운동 상세 */}
        <SpotlightCard className="p-6 mb-6">
          <h3 className="text-2xl font-bold text-white mb-6">📋 운동 상세 내역</h3>
          <div className="space-y-6">
            {selectedDate.exercises.map((exercise, idx) => (
              <div key={idx} className="p-6 bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 rounded-xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-5xl">{exercise.icon}</div>
                  <div className="flex-1">
                    <h4 className="text-2xl font-bold text-white mb-1">{exercise.name}</h4>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        exercise.intensity === 'very-high' ? 'bg-red-500/20 text-red-400' :
                        exercise.intensity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        exercise.intensity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {exercise.intensity === 'very-high' ? '매우 높음' :
                         exercise.intensity === 'high' ? '높음' :
                         exercise.intensity === 'medium' ? '중간' : '낮음'}
                      </span>
                      <span className="text-gray-400 text-sm">{exercise.duration}분</span>
                    </div>
                  </div>
                </div>

                {/* 세부 정보 */}
                <div className="grid grid-cols-4 gap-4 mt-4">
                  {exercise.sets && (
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">세트</div>
                      <div className="text-xl font-bold text-blue-400">{exercise.sets}</div>
                    </div>
                  )}
                  {exercise.reps && (
                    <div className="p-3 bg-purple-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">총 반복</div>
                      <div className="text-xl font-bold text-purple-400">{exercise.reps}</div>
                    </div>
                  )}
                  {exercise.weight && (
                    <div className="p-3 bg-red-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">총 중량</div>
                      <div className="text-xl font-bold text-red-400">{exercise.weight}kg</div>
                    </div>
                  )}
                  {exercise.distance && (
                    <div className="p-3 bg-emerald-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">거리</div>
                      <div className="text-xl font-bold text-emerald-400">{exercise.distance}km</div>
                    </div>
                  )}
                  {exercise.calories && (
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">칼로리</div>
                      <div className="text-xl font-bold text-orange-400">{exercise.calories}kcal</div>
                    </div>
                  )}
                  {exercise.pace && (
                    <div className="p-3 bg-cyan-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">페이스</div>
                      <div className="text-xl font-bold text-cyan-400">{exercise.pace}</div>
                    </div>
                  )}
                  {exercise.rounds && (
                    <div className="p-3 bg-pink-500/10 rounded-lg">
                      <div className="text-xs text-gray-400">라운드</div>
                      <div className="text-xl font-bold text-pink-400">{exercise.rounds}</div>
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
              {selectedDate.note}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">👨‍🏫 담당 코치</h3>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
                {selectedDate.coach?.charAt(0)}
              </div>
              <div>
                <div className="text-xl font-bold text-white">{selectedDate.coach}</div>
                <div className="text-sm text-gray-400">담당 코치</div>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader 
        title="🗓️ 트레이닝 캘린더" 
        description="날짜를 클릭하여 운동 기록을 확인하세요"
        onBack={() => setActiveTab('mypage')}
      >
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-all">
            ← 이전 달
          </button>
          <button className="px-4 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-lg text-sm font-bold">
            2024년 2월
          </button>
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-all">
            다음 달 →
          </button>
        </div>
      </PageHeader>

      {/* 캘린더 */}
      <SpotlightCard className="p-6">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={i} className={`text-center font-bold py-2 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}>
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-2">
          {calendar.map((dateData, i) => (
            <div
              key={i}
              onClick={() => handleDateClick(dateData)}
              className={`aspect-square p-2 rounded-xl border-2 transition-all ${
                dateData === null
                  ? 'border-transparent cursor-default'
                  : dateData.data
                  ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/20 to-green-500/10 hover:border-emerald-500 cursor-pointer hover:scale-105'
                  : dateData.data !== undefined && dateData.data === null
                  ? 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 cursor-pointer'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer'
              }`}
            >
              {dateData && (
                <div className="flex flex-col h-full">
                  <div className="text-white font-bold text-lg mb-1">{dateData.day}</div>
                  {dateData.data && dateData.data.totalTime > 0 && (
                    <>
                      <div className="text-xs text-emerald-400 font-bold">{dateData.data.totalTime}분</div>
                      <div className="text-xs text-gray-500">{dateData.data.exercises.length}개 운동</div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </SpotlightCard>

      {/* 날짜 클릭 모달 */}
      {selectedDate && !showDetailPage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedDate(null)}
        >
          <div 
            className="bg-[#0A0A0A] border border-white/20 rounded-2xl max-w-[95vw] sm:max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">{selectedDate.date} ({selectedDate.dayOfWeek})</h2>
                  <p className="text-gray-400">{t('trainingSummary')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowDetailPage(true)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all hover:scale-105"
                  >
                    📊 자세히 보기
                  </button>
                  <button 
                    onClick={() => setSelectedDate(null)}
                    className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                  >
                    <span className="text-2xl">✕</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {selectedDate.totalTime === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">😴</div>
                  <div className="text-2xl font-bold text-white mb-2">휴식일</div>
                  <div className="text-gray-400">이 날은 운동을 하지 않았습니다</div>
                </div>
              ) : (
                <>
                  {/* 통계 카드 */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">총 운동 시간</div>
                      <div className="text-2xl font-bold text-blue-400">{selectedDate.totalTime}분</div>
                    </div>
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">소모 칼로리</div>
                      <div className="text-2xl font-bold text-red-400">{selectedDate.calories}kcal</div>
                    </div>
                    <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">운동 종목</div>
                      <div className="text-2xl font-bold text-purple-400">{selectedDate.exercises.length}개</div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">만족도</div>
                      <div className="text-2xl font-bold text-yellow-400">
                        {'⭐'.repeat(selectedDate.satisfaction || 0)}
                      </div>
                    </div>
                  </div>

                  {/* 운동 리스트 */}
                  <div className="space-y-4 mb-6">
                    {selectedDate.exercises.map((exercise, idx) => (
                      <div key={idx} className="p-5 bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 rounded-xl hover:border-white/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="text-4xl">{exercise.icon}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-xl font-bold text-white">{exercise.name}</h4>
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
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <span>⏱️ {exercise.duration}분</span>
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
                    <p className="text-gray-300">{selectedDate.note}</p>
                  </div>

                  {/* 담당 코치 */}
                  {selectedDate.coach && (
                    <div className="p-5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                          {selectedDate.coach.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">담당 코치</div>
                          <div className="text-xl font-bold text-white">{selectedDate.coach}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Opponent Profile 페이지
const OpponentProfileView = ({ setActiveTab, t = (key) => key, opponentId }) => {
  const [opponent, setOpponent] = useState(null);
  const [opponentMatches, setOpponentMatches] = useState([]);
  const [showAllOpponentMatches, setShowAllOpponentMatches] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOpponent = async () => {
      setLoading(true);
      const { getPublicPlayerProfileById, getPublicPlayerMatches } = await import('@/lib/supabase');
      const [{ data: profileData }, { data: matchData }] = await Promise.all([
        getPublicPlayerProfileById(opponentId),
        // RLS 우회 — 상대 회원의 전적 전부 조회 (sql/56). 폴백 자동.
        getPublicPlayerMatches(opponentId, 50),
      ]);
      setOpponent(profileData);
      setOpponentMatches(matchData || []);
      setLoading(false);
    };

    if (opponentId) {
      loadOpponent();
    }
  }, [opponentId]);

  if (loading) {
    return (
      <div className="animate-fade-in-up w-full">
        <PageHeader
          title="프로필 불러오는 중"
          onBack={() => setActiveTab('ranking-tier-board')}
        />
        <div className="py-16 text-center text-gray-400 text-sm">잠시만 기다려주세요.</div>
      </div>
    );
  }

  if (!opponent) {
    return (
      <div className="animate-fade-in-up w-full">
        <PageHeader
          title="프로필을 찾을 수 없음"
          onBack={() => setActiveTab('ranking-tier-board')}
        />
        <div className="py-16 text-center text-gray-400 text-sm">존재하지 않거나 비공개 처리된 선수입니다.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up w-full">
      {/* 헤더: 좌측 [← 뒤로] (이름은 아래 카드에 이미 노출) */}
      <div className="mb-5 sm:mb-7">
        <button
          type="button"
          onClick={() => setActiveTab('ranking-tier-board')}
          aria-label="뒤로가기"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all flex items-center justify-center group"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-white transition-colors">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
      </div>

      {/* 프로필 헤더 카드 — 마이페이지 대시보드와 동일 */}
      <SpotlightCard className="p-3 xs:p-4 sm:p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] mb-3 xs:mb-4">
        {/* 선수 프로필 헤더 */}
        <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 mb-4 xs:mb-5 sm:mb-6 pb-3 xs:pb-4 border-b border-white/5">
          <ProfileAvatarImg
            avatarUrl={opponent.avatar_url}
            name={opponent.display_name}
            className="w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-full shadow-lg border-2 border-blue-400/50 text-2xl xs:text-3xl sm:text-4xl flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 mb-1 xs:mb-1.5 sm:mb-2 flex-wrap">
              {/* 티어 아이콘 — 선수만 */}
              {(opponent.role === 'player_common' || opponent.role === 'player_athlete') && opponent.tier ? (
                <TierIcon tier={opponent.tier} size={28} />
              ) : null}
              <h3 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold text-white truncate">
                {opponent.nickname || opponent.display_name}
              </h3>
              {opponent.name && opponent.name !== (opponent.nickname || opponent.display_name) ? (
                <span className="text-xs xs:text-sm sm:text-base text-gray-400 font-medium truncate">
                  ({opponent.name})
                </span>
              ) : null}
              <span className={`px-2 py-0.5 xs:px-2.5 xs:py-1 sm:px-3 rounded-full text-[10px] xs:text-xs sm:text-sm font-bold shadow-lg whitespace-nowrap ${
                opponent.role === 'player_common' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                opponent.role === 'player_athlete' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                'bg-gray-500/20 text-gray-400 border border-gray-500/30'
              }`}>
                {opponent.role === 'player_athlete' ? t('player_athlete') : t('player_common')}
              </span>
            </div>
            <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-[10px] xs:text-xs sm:text-sm text-gray-400 flex-wrap">
              {opponent.tier && (
                <>
                  <span className="font-bold text-yellow-400 whitespace-nowrap">{opponent.tier}</span>
                  <span className="hidden xs:inline">•</span>
                  <span className="whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs">
                    #{opponent.rank || '-'}
                  </span>
                  <span className="hidden xs:inline">•</span>
                </>
              )}
              {opponent.boxing_style && (
                <>
                  <span className="whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs">{opponent.boxing_style}</span>
                  <span className="hidden xs:inline">•</span>
                </>
              )}
              {(opponent.height || opponent.weight) && (
                <>
                  <span className="whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs">
                    {opponent.height && `${opponent.height}cm`}
                    {opponent.height && opponent.weight && ' / '}
                    {opponent.weight && `${opponent.weight}kg`}
                  </span>
                  {opponent.gym_name && <span className="hidden xs:inline">•</span>}
                </>
              )}
              {opponent.gym_name && (
                <span className="whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs">{opponent.gym_name}</span>
              )}
            </div>
          </div>
        </div>

        {/* 핵심 전적 - 4개의 주요 지표 */}
        <div className="rounded-2xl border border-white/8 overflow-hidden bg-white/[0.03] mb-4 xs:mb-5 sm:mb-6">
          <div className="flex divide-x divide-white/8">
            <div className="flex-1 py-2.5 px-2 text-center min-w-0">
              <div className="text-sm sm:text-base font-bold text-white tabular-nums leading-none">{opponent.total_matches || 0}</div>
              <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">{t('totalMatches')}</div>
            </div>
            <div className="flex-1 py-2.5 px-2 text-center min-w-0">
              <div className="text-sm sm:text-base font-bold text-white tabular-nums leading-none">
                <span className="text-blue-400">{opponent.wins || 0}</span>
                <span className="text-gray-600 text-[10px] mx-0.5">/</span>
                <span className="text-gray-300">{opponent.draws || 0}</span>
                <span className="text-gray-600 text-[10px] mx-0.5">/</span>
                <span className="text-red-400">{opponent.losses || 0}</span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">{t('record')}</div>
            </div>
            <div className="flex-1 py-2.5 px-2 text-center min-w-0">
              <div className="text-sm sm:text-base font-bold text-red-400 tabular-nums leading-none">{opponent.ko_wins || 0}</div>
              <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">{t('koWins')}</div>
            </div>
            <div className="flex-1 py-2.5 px-2 text-center min-w-0">
              <div className="text-sm sm:text-base font-bold text-purple-400 tabular-nums leading-none">{opponent.current_win_streak || 0}</div>
              <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 tracking-wide">{t('winStreak')}</div>
            </div>
          </div>
        </div>

        {/* 신체 정보 + 복싱 스타일 통합 */}
        {(opponent.height || opponent.weight || opponent.gender || opponent.boxing_style) && (
          <div className="mb-4">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">{t('bodyInfo')}</p>
            <div className="rounded-xl border border-white/8 overflow-hidden bg-white/[0.03]">
              <div className="flex divide-x divide-white/8">
                {opponent.height && (
                  <div className="flex-1 py-2 px-2 text-center min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white tabular-nums leading-none">
                      {opponent.height}<span className="text-[9px] font-normal text-gray-500 ml-0.5">cm</span>
                    </div>
                    <div className="text-[9px] text-gray-500 mt-1 tracking-wide">{t('height') || '키'}</div>
                  </div>
                )}
                {opponent.weight && (
                  <div className="flex-1 py-2 px-2 text-center min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white tabular-nums leading-none">
                      {opponent.weight}<span className="text-[9px] font-normal text-gray-500 ml-0.5">kg</span>
                    </div>
                    <div className="text-[9px] text-gray-500 mt-1 tracking-wide">{t('weight') || '체중'}</div>
                  </div>
                )}
                {opponent.gender && (
                  <div className="flex-1 py-2 px-2 text-center min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white leading-none">
                      {opponent.gender === 'male' ? (t('male') || '남') : (t('female') || '여')}
                    </div>
                    <div className="text-[9px] text-gray-500 mt-1 tracking-wide">{t('gender') || '성별'}</div>
                  </div>
                )}
                {opponent.boxing_style && (
                  <div className="flex-1 py-2 px-2 text-center min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-orange-300 truncate leading-none">{opponent.boxing_style}</div>
                    <div className="text-[9px] text-gray-500 mt-1 tracking-wide">{t('mainStyle') || '스타일'}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SpotlightCard>

      {/* 하단 그리드 — 마이페이지 동일 구조: Tier Points + Match History */}
      {(() => {
        const mp = opponent.match_points ?? opponent.tier_points ?? computeMatchPoints(opponent.wins, opponent.draws, opponent.losses);
        const mpNum = Number(mp) || 0;
        const ring = getTierRingProgress(mpNum);
        const next = getNextTierInfo(mpNum);
        const currentTier = opponent.tier || 'Unranked';
        const tc = getTierColor(currentTier);
        const tcNext = getTierColor(next.nextLabel || currentTier);
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 xs:gap-4 sm:gap-6">
            {/* Tier Points */}
            <div>
              <SpotlightCard className="p-4 sm:p-6 bg-[#1a2138] overflow-hidden relative">
                <div className="relative flex flex-col gap-4">
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

                  <div className="flex items-end gap-1.5">
                    <span className={`text-5xl font-black tabular-nums leading-none text-transparent bg-clip-text bg-gradient-to-r ${tc.bar}`}>
                      {mpNum}
                    </span>
                    <span className="text-sm font-semibold text-gray-500 mb-1">pts</span>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-[10px] font-semibold ${tc.text}`}>{currentTier}</span>
                      <span className={`text-[10px] font-semibold ${tcNext.text}`}>{next.nextLabel || '최고 티어'}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${tc.bar} transition-all duration-700`}
                        style={{ width: `${Math.max(4, Math.round(ring * 100))}%` }}
                      />
                    </div>
                    <p className={`text-right text-[10px] mt-1 ${tc.text}`}>
                      {Math.round(ring * 100)}%
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1 p-3 rounded-2xl bg-white/[0.04] border border-white/8">
                      <p className="text-[10px] text-gray-500 mb-0.5">{t('nextTier')}</p>
                      <p
                        className={`text-sm font-bold truncate ${tcNext.text} ${tcNext.glowClass || ''}`}
                        style={tcNext.shadow ? { textShadow: tcNext.shadow } : undefined}
                      >
                        {next.nextLabel || '—'}
                      </p>
                    </div>
                    <div className="flex-1 p-3 rounded-2xl bg-white/[0.04] border border-white/8">
                      <p className="text-[10px] text-gray-500 mb-0.5">{t('pointsNeeded')}</p>
                      <p className={`text-sm font-bold ${tc.text}`}>{next.nextLabel ? `+${next.pointsToNext}` : '최고 티어'}</p>
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </div>

            {/* Match History — 마이페이지 동일 */}
            <div className="lg:col-span-2">
              <SpotlightCard className="p-3 xs:p-4 sm:p-6 bg-[#1a2138]">
                <div className="mb-3 xs:mb-4 sm:mb-6 flex items-center justify-between gap-2">
                  <h3 className="text-sm xs:text-base sm:text-lg font-bold text-white">{t('matchHistory')}</h3>
                </div>

                {opponentMatches.length > 0 ? (
                  <MatchHistorySection
                    matches={opponentMatches.map(normalizeRawMatch)}
                    onOpenOpponent={(id) => setActiveTab(`opponent-profile-${id}`)}
                    limit={10}
                  />
                ) : (
                  <div className="text-center py-8 xs:py-10 sm:py-12">
                    <div className="w-12 h-12 xs:w-16 xs:h-16 sm:w-20 sm:h-20 mx-auto mb-3 xs:mb-4 sm:mb-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                      <Icon type="trophy" size={24} className="xs:w-8 xs:h-8 sm:w-10 sm:h-10 text-gray-500" />
                    </div>
                    <h4 className="text-sm xs:text-base sm:text-lg font-bold text-white mb-1 xs:mb-2">아직 경기 기록이 없습니다</h4>
                  </div>
                )}
              </SpotlightCard>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// 전체 전적 목록 페이지
const MatchHistoryView = ({ setActiveTab, t = (key) => key }) => {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { getUserMatches } = await import('@/lib/supabase');
        const { data } = await getUserMatches(user.id);
        if (cancelled) return;
        setMatches(data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="animate-fade-in-up w-full">
      <PageHeader
        title={t('matchHistory') || '전적'}
        onBack={() => setActiveTab('mypage')}
      />

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">전적을 불러오는 중…</div>
      ) : (
        <MatchHistorySection
          matches={matches.map(normalizeRawMatch)}
          onOpenOpponent={(id) => setActiveTab(`opponent-profile-${id}`)}
          limit={matches.length}
        />
      )}
    </div>
  );
};

// 다른 회원의 전체 전적 페이지 — 본인용 MatchHistoryView 와 동일한 디자인, opponentId 로 동작
const OpponentMatchHistoryView = ({ setActiveTab, opponentId, t = (key) => key }) => {
  const [opponent, setOpponent] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!opponentId) return;
    let cancelled = false;
    (async () => {
      try {
        const { getPublicPlayerProfileById, getPublicPlayerMatches } = await import('@/lib/supabase');
        const [profRes, matchRes] = await Promise.all([
          getPublicPlayerProfileById(opponentId),
          // RLS 우회 — 상대 회원의 전적 전부 조회 (sql/56)
          getPublicPlayerMatches(opponentId),
        ]);
        if (cancelled) return;
        setOpponent(profRes?.data || null);
        setMatches(matchRes?.data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [opponentId]);

  const titleText = `${nickName}${realName ? ` (${realName})` : ''} ${t('matchHistory') || '전적'}`;

  return (
    <div className="animate-fade-in-up w-full">
      <PageHeader
        title={titleText}
        onBack={() => setActiveTab(`opponent-profile-${opponentId}`)}
      />

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">전적을 불러오는 중…</div>
      ) : (
        <MatchHistorySection
          matches={matches.map(normalizeRawMatch)}
          onOpenOpponent={(id) => setActiveTab(`opponent-profile-${id}`)}
          limit={matches.length}
        />
      )}
    </div>
  );
};

export { MyPageView, SettingsView, EditProfileView, PrivacySettingsView, ActivityHistoryView, OpponentProfileView, MatchHistoryView, OpponentMatchHistoryView };

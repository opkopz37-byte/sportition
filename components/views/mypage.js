'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ProfileAvatarImg from '@/components/ProfileAvatarImg';
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
// 마이페이지 뷰들

const MyPageView = ({ setActiveTab, t }) => {
  const { profile } = useAuth();
  const isPlayer = profile?.role === 'player_common' || profile?.role === 'player_athlete';
  const isGym = profile?.role === 'gym' || profile?.role === 'admin';
  const embedDashboard = isPlayer || isGym;

  return (
  <div className="animate-fade-in-up">
    <div className="mb-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('myPage')}</h2>
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
      <div className="mb-5 sm:mb-7 flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white break-words flex-1 min-w-0">
          {t('settings')}
        </h2>
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="flex-shrink-0 px-4 py-2 text-sm sm:text-base font-semibold text-gray-300 hover:text-white transition-colors"
        >
          ← 뒤로
        </button>
      </div>

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

  const [formData, setFormData] = useState({
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

  useEffect(() => {
    console.log('[EditProfile] 프로필 데이터 확인:', profile);
    if (profile) {
      const newFormData = {
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

  const handleSave = async () => {
    if (!user?.id) {
      setError('사용자 정보가 없습니다');
      return;
    }
    
    console.log('[EditProfile] 저장 시작, formData:', formData);
    setLoading(true);
    setError('');

    try {
      const { updateUserProfile } = await import('@/lib/supabase');
      
      const updates = {
        name: formData.nickname,
        nickname: formData.nickname,
        phone: formData.phone || null,
        birth_date: formData.birth_date || null,
        gender: formData.gender || null,
        height: formData.height ? parseInt(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
      };

      if (profile?.role === 'player_common') {
        updates.gym_name = formData.gym_name || null;
      } else if (profile?.role === 'player_athlete') {
        updates.boxing_style = formData.boxing_style || null;
        updates.gym_name = formData.gym_name || null;
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
            <label className="block text-sm font-medium text-gray-400 mb-2">닉네임</label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({...formData, nickname: e.target.value})}
              placeholder="닉네임을 입력하세요"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            />
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
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">소속 체육관</label>
              <input
                type="text"
                value={formData.gym_name}
                onChange={(e) => setFormData({...formData, gym_name: e.target.value})}
                placeholder="체육관 이름을 입력하세요"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              />
            </div>
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
                <input
                  type="text"
                  value={formData.gym_name}
                  onChange={(e) => setFormData({...formData, gym_name: e.target.value})}
                  placeholder="체육관 이름을 입력하세요"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all"
                />
              </div>
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
  useEffect(() => {
    const pw = passwordData.current;
    if (!pw) {
      setCurrentPwStatus('idle');
      return;
    }
    setCurrentPwStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const { verifyCurrentPassword } = await import('@/lib/supabase');
        const { ok } = await verifyCurrentPassword(pw);
        // 사용자가 그 사이에 값을 바꿨을 수 있으므로 확인
        setPasswordData((cur) => {
          if (cur.current !== pw) return cur;
          setCurrentPwStatus(ok ? 'match' : 'mismatch');
          return cur;
        });
      } catch {
        setCurrentPwStatus('mismatch');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [passwordData.current]);

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
      <div className="mb-5 sm:mb-7 flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white break-words flex-1 min-w-0">
          {t('privacySettings')}
        </h2>
        <button
          type="button"
          onClick={() => setActiveTab('mypage')}
          className="flex-shrink-0 px-4 py-2 text-sm sm:text-base font-semibold text-gray-300 hover:text-white transition-colors"
        >
          ← 뒤로
        </button>
      </div>

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
      const { getPublicPlayerProfileById, getUserMatches } = await import('@/lib/supabase');
      const [{ data: profileData }, { data: matchData }] = await Promise.all([
        getPublicPlayerProfileById(opponentId),
        getUserMatches(opponentId, 50),
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
      <div className="animate-fade-in-up">
        <PageHeader
          title="프로필 불러오는 중"
          description="선수 공개 프로필을 가져오고 있습니다"
          onBack={() => setActiveTab('ranking-tier-board')}
        />
        <SpotlightCard className="p-10 text-center text-gray-400">잠시만 기다려주세요.</SpotlightCard>
      </div>
    );
  }

  if (!opponent) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader
          title="프로필을 찾을 수 없음"
          description="선수 공개 프로필 데이터가 없습니다"
          onBack={() => setActiveTab('ranking-tier-board')}
        />
        <SpotlightCard className="p-10 text-center text-gray-400">존재하지 않거나 비공개 처리된 선수입니다.</SpotlightCard>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <PageHeader
        title={`${opponent.display_name} 프로필`}
        description="공개 선수 프로필"
        onBack={() => setActiveTab('ranking-tier-board')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SpotlightCard className="p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg border-2 border-purple-400/50">
                {(opponent.display_name || 'U').charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="text-3xl font-bold text-white">{opponent.display_name}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold border ${
                    opponent.role === 'player_athlete'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}>
                    {opponent.role === 'player_athlete' ? t('player_athlete') : t('player_common')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
                  <span className="font-bold text-yellow-400 whitespace-nowrap">{opponent.tier || 'Unranked'}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="whitespace-nowrap">{t('nationalRanking')} #{opponent.rank || '-'}</span>
                  {opponent.gym_name && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="whitespace-nowrap">{opponent.gym_name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-3 border border-blue-500/20">
                <div className="text-xs text-blue-300 mb-1 whitespace-nowrap">{t('totalMatches')}</div>
                <div className="text-2xl font-bold text-white">{opponent.total_matches || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-3 border border-emerald-500/20">
                <div className="text-xs text-emerald-300 mb-1 whitespace-nowrap">{t('record')}</div>
                <div className="text-lg font-bold text-white">
                  {opponent.wins || 0}승 {opponent.draws || 0}무 {opponent.losses || 0}패
                </div>
                <div className="text-xs text-emerald-400 mt-1">승률 {opponent.win_rate || 0}%</div>
              </div>
              <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-3 border border-red-500/20">
                <div className="text-xs text-red-300 mb-1 whitespace-nowrap">{t('koWins')}</div>
                <div className="text-2xl font-bold text-red-400">{opponent.ko_wins || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-3 border border-purple-500/20">
                <div className="text-xs text-purple-300 mb-1 whitespace-nowrap">{t('winStreak')}</div>
                <div className="text-2xl font-bold text-purple-400">{opponent.current_win_streak || 0}</div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-bold text-white mb-3">{t('boxingStyle')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="text-xs text-gray-400 mb-1">{t('mainStyle')}</div>
                  <div className="text-sm font-bold text-white">{opponent.boxing_style || '미등록'}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="text-xs text-gray-400 mb-1">{t('gender')}</div>
                  <div className="text-sm font-bold text-white">
                    {opponent.gender === 'female' ? t('female') : opponent.gender === 'male' ? t('male') : '미등록'}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-4">{t('athleteInfo')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 border border-blue-500/20">
                  <div className="text-xs text-gray-400 whitespace-nowrap">{t('height')}</div>
                  <div className="text-lg font-bold text-white">{opponent.height ? `${opponent.height}cm` : '미등록'}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-4 border border-purple-500/20">
                  <div className="text-xs text-gray-400 whitespace-nowrap">{t('weight')}</div>
                  <div className="text-lg font-bold text-white">{opponent.weight ? `${opponent.weight}kg` : '미등록'}</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-4 border border-emerald-500/20">
                  <div className="text-xs text-gray-400 whitespace-nowrap">{t('gender')}</div>
                  <div className="text-lg font-bold text-white">
                    {opponent.gender === 'female' ? t('female') : opponent.gender === 'male' ? t('male') : '미등록'}
                  </div>
                </div>
              </div>
            </div>
          </SpotlightCard>
        </div>

        <div className="space-y-4">
          <SpotlightCard className="p-6 bg-[#1a1a1a]">
            <h3 className="text-lg font-bold text-white mb-4">티어 정보</h3>
            <div className="text-center mb-4">
              <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-1">
                {opponent.tier || 'Unranked'}
              </div>
              <div className="text-sm text-blue-300 font-semibold mb-0.5">
                {t('victoryPoints') || '승점'} {opponent.match_points ?? opponent.tier_points ?? 0}
              </div>
              <div className="text-sm text-gray-400">전국 랭킹 #{opponent.rank || '-'}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">전적</span>
                <span className="text-sm font-bold text-white">
                  {opponent.wins || 0}승 {opponent.draws || 0}무 {opponent.losses || 0}패
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">KO승</span>
                <span className="text-sm font-bold text-red-400">{opponent.ko_wins || 0}회</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-400">현재 연승</span>
                <span className="text-sm font-bold text-purple-400">{opponent.current_win_streak || 0}연승</span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white">상대 전적 리스트</h4>
                <button
                  onClick={() => setShowAllOpponentMatches(prev => !prev)}
                  className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white"
                >
                  {showAllOpponentMatches ? '접기' : '펼치기'}
                </button>
              </div>

              {opponentMatches.length === 0 ? (
                <div className="text-xs text-gray-500">표시할 전적이 없습니다.</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {(showAllOpponentMatches ? opponentMatches : opponentMatches.slice(0, 5)).map((match) => (
                    <div key={match.id} className={`p-2 rounded-lg border-l-4 ${
                      match.result === 'win' ? 'bg-blue-900/50 border-l-blue-400 border border-blue-500/40' :
                      match.result === 'loss' ? 'bg-red-900/50 border-l-red-400 border border-red-500/40' :
                      'bg-zinc-900/55 border-l-gray-500 border border-zinc-600/40'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-white font-bold truncate">
                          vs {match.opponent_name || match.opponent?.nickname || match.opponent?.name || '상대 미상'}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {match.played_at ? new Date(match.played_at).toISOString().split('T')[0] : '-'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-gray-300">
                        <span>{match.score || '-'}</span>
                        <span>{(match.method || 'decision').toUpperCase()}</span>
                        <span className={`font-bold ${
                          match.result === 'win' ? 'text-blue-400' :
                          match.result === 'loss' ? 'text-red-400' : 'text-gray-300'
                        }`}>
                          {match.result === 'win' ? '승' : match.result === 'loss' ? '패' : '무'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SpotlightCard>
        </div>
      </div>
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
      <div className="mb-5 sm:mb-7 flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white break-words flex-1 min-w-0">
          {t('matchHistory') || '전적'}
        </h2>
        <button
          type="button"
          onClick={() => setActiveTab('mypage')}
          className="flex-shrink-0 px-4 py-2 text-sm sm:text-base font-semibold text-gray-300 hover:text-white transition-colors"
        >
          ← 뒤로
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">전적을 불러오는 중…</div>
      ) : matches.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">아직 경기 기록이 없습니다.</div>
      ) : (
        <div className="space-y-2.5">
          {matches.map((m) => {
            const playedAt = m.played_at ? new Date(m.played_at) : null;
            const dateLabel = playedAt && !Number.isNaN(playedAt.getTime())
              ? playedAt.toISOString().split('T')[0]
              : '-';
            const result = m.result === 'win' || m.result === 'loss' || m.result === 'draw' ? m.result : 'draw';
            const resultLabel = result === 'win' ? '승' : result === 'loss' ? '패' : '무';
            const accent = result === 'win' ? 'text-blue-300' : result === 'loss' ? 'text-red-300' : 'text-gray-300';
            const dotColor = result === 'win' ? 'bg-blue-400' : result === 'loss' ? 'bg-red-400' : 'bg-gray-500';
            const bgClass = result === 'win'
              ? 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-400/30 hover:border-blue-400/50'
              : result === 'loss'
              ? 'bg-red-500/15 hover:bg-red-500/25 border-red-400/30 hover:border-red-400/50'
              : 'bg-white/[0.04] hover:bg-white/[0.07] border-white/10 hover:border-white/20';
            const opponent = m.opponent_name || m.opponent?.nickname || m.opponent?.name || '상대 미상';
            const opponentId = m.opponent?.id || m.opponent_id;
            const opponentAvatarUrl = m.opponent?.avatar_url || null;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (opponentId) setActiveTab(`opponent-profile-${opponentId}`);
                }}
                className={`w-full p-4 border rounded-2xl transition-all text-left flex items-center gap-4 group ${bgClass}`}
              >
                <div className="relative flex-shrink-0">
                  <ProfileAvatarImg
                    avatarUrl={opponentAvatarUrl}
                    name={opponent}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-white/15 text-lg"
                  />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0a0a0a] ${dotColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500 whitespace-nowrap">vs</p>
                    <h4 className="text-base sm:text-lg font-bold text-white truncate">{opponent}</h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="whitespace-nowrap">{dateLabel}</span>
                    <span className="text-gray-700">·</span>
                    <span className="whitespace-nowrap uppercase">{m.method || 'decision'}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-2xl sm:text-3xl font-black tabular-nums leading-none ${accent}`}>
                    {resultLabel}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 tabular-nums">
                    {m.score || '-'} · {m.rounds || '-'}R
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { MyPageView, SettingsView, EditProfileView, PrivacySettingsView, ActivityHistoryView, OpponentProfileView, MatchHistoryView };

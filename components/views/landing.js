'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon, PageHeader, SpotlightCard, BackgroundGrid, THEME_ATHLETE, THEME_COACH, getMenuStructure } from '@/components/ui';
import { translations } from '@/lib/translations';
import { signIn, sendPasswordResetEmail } from '@/lib/supabase';
import TermsOfServiceModal from '@/components/legal/TermsOfServiceModal';
import {
  OPTIONAL_MARKETING_CONSENT_FULL_TEXT,
  OPTIONAL_MARKETING_CONSENT_TITLE_KO,
} from '@/lib/legal/termsOfService';
import {
  BIRTH_YEAR_OPTIONS,
  MONTH_OPTIONS,
  BIRTH_DAY_OPTIONS,
  isValidCalendarDate,
} from '@/lib/birthDate';
import { checkEmailAvailable } from '@/lib/emailAvailability';
import { formatAuthPasswordErrorMessage, isAuthPasswordPolicyError } from '@/lib/authPasswordErrors';

/** 숫자만 입력해도 010-1234-5678 / 02-1234-5678 형태로 표시 */
function formatKoreanPhone(raw) {
  const d = String(raw).replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.startsWith('01')) {
    if (d.length <= 3) return d;
    // 11자리(010-xxxx-xxxx) vs 10자리(011-xxx-xxxx 등)
    if (d.length <= 10) {
      if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
      return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}`;
    }
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

// 로그인 모달
const LoginModal = ({ isOpen, onClose, onSignup, onLoginSuccess, t = (key) => key }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [findIdOpen, setFindIdOpen] = useState(false);
  const [forgotPwOpen, setForgotPwOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  if (!isOpen) return null;

  const handleSendReset = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError('');
    setResetMessage('');
    const { error: resetErr } = await sendPasswordResetEmail(resetEmail);
    setResetLoading(false);
    if (resetErr) {
      setResetError(t('forgotPasswordError'));
      return;
    }
    setResetMessage(t('forgotPasswordSent'));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await signIn(email, password);
      
      if (error) {
        setError(error.message || '로그인에 실패했습니다.');
        return;
      }

      if (data?.user) {
        onLoginSuccess && onLoginSuccess(data.user);
        onClose();
      }
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-3 xs:p-4">
  <div className="relative w-full max-w-md">
    <SpotlightCard className="p-5 xs:p-6 sm:p-8">
      <button 
        onClick={onClose}
        className="absolute top-3 right-3 xs:top-4 xs:right-4 text-gray-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center"
      >
        <Icon type="x" size={18} className="xs:w-5 xs:h-5" />
      </button>

      <div className="text-center mb-6 xs:mb-8">
        <div className="inline-flex items-center justify-center w-10 h-10 xs:w-12 xs:h-12 rounded-xl bg-blue-500/20 text-blue-400 mb-3 xs:mb-4">
          <Icon type="zap" size={20} className="xs:w-6 xs:h-6" fill="currentColor" />
        </div>
        <h2 className="text-xl xs:text-2xl font-bold text-white mb-1.5 xs:mb-2">{t('welcomeBack')}</h2>
        <p className="text-gray-500 text-xs xs:text-sm">{t('loginToContinue')}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-3 xs:space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs xs:text-sm font-medium text-gray-400 mb-1.5 xs:mb-2">{t('email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 xs:px-4 xs:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder={t('email')}
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs xs:text-sm font-medium text-gray-400 mb-1.5 xs:mb-2">{t('password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 xs:px-4 xs:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 xs:py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm xs:text-base font-medium rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '로그인 중...' : t('login')} 
          {!loading && <Icon type="login" size={16} className="xs:w-[18px] xs:h-[18px]" />}
        </button>
      </form>

      <div className="mt-6 text-center">
        <span className="text-gray-500 text-sm">{t('noAccount')} </span>
        <button
          type="button"
          onClick={onSignup}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
        >
          {t('signup')}
        </button>
      </div>

      <div className="mt-5 pt-5 border-t border-white/10">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setFindIdOpen(true)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {t('findIdLink')}
          </button>
          <span className="text-gray-600 select-none" aria-hidden>
            |
          </span>
          <button
            type="button"
            onClick={() => {
              setResetEmail(email);
              setResetMessage('');
              setResetError('');
              setForgotPwOpen(true);
            }}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {t('findPasswordLink')}
          </button>
        </div>
      </div>
    </SpotlightCard>

    {findIdOpen ? (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4"
        role="presentation"
        onClick={() => setFindIdOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="find-id-title"
          className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0c0c12] p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="find-id-title" className="text-lg font-bold text-white mb-3">
            {t('findIdModalTitle')}
          </h3>
          <p className="text-sm text-gray-400 whitespace-pre-line leading-relaxed mb-5">{t('findIdModalBody')}</p>
          <button
            type="button"
            className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
            onClick={() => setFindIdOpen(false)}
          >
            {t('close')}
          </button>
        </div>
      </div>
    ) : null}

    {forgotPwOpen ? (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4"
        role="presentation"
        onClick={() => {
          setForgotPwOpen(false);
          setResetMessage('');
          setResetError('');
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-pw-title"
          className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0c0c12] p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="forgot-pw-title" className="text-lg font-bold text-white mb-1">
            {t('forgotPasswordModalTitle')}
          </h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">{t('forgotPasswordModalDesc')}</p>
          <form onSubmit={handleSendReset} className="space-y-3">
            {resetError ? (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{resetError}</div>
            ) : null}
            {resetMessage ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-200 text-sm">
                {resetMessage}
              </div>
            ) : null}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('email')}</label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                placeholder={t('email')}
                required
                disabled={resetLoading || Boolean(resetMessage)}
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={resetLoading || Boolean(resetMessage)}
              className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetLoading ? '…' : t('forgotPasswordSubmit')}
            </button>
            <button
              type="button"
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-300"
              onClick={() => {
                setForgotPwOpen(false);
                setResetMessage('');
                setResetError('');
              }}
            >
              {t('cancel')}
            </button>
          </form>
        </div>
      </div>
    ) : null}
  </div>
</div>
  );
};

// 회원가입 페이지
const SignupPage = ({ onBack, language, t, onSignupSuccess, initialRole = 'player_common' }) => {
  const [step, setStep] = useState(1); // 1: 계정 생성, 2: 프로필 입력
  const [formData, setFormData] = useState({
    // Step 1: 계정 생성 및 인증
    role: initialRole,
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
    agreePrivacy: false,
    agreeMarketing: false,

    // Step 2: 프로필 정보
    nickname: '',
    phone: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    gender: '',
    height: '',
    weight: '',
    boxingStyle: '', // 선수만
    gymName: '', // 일반/선수
    gymLocation: '', // 체육관만
    representativePhone: '', // 체육관만
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  /** 이메일(아이디) 중복 확인: idle | checking | available | taken | error | unavailable */
  const [emailCheckStatus, setEmailCheckStatus] = useState('idle');
  /** null | 'full' 필수 약관 전문 | 'optional' 선택(마케팅) 동의 전문 */
  const [termsModalView, setTermsModalView] = useState(null);

  // Step 1 검증
  const validateStep1 = () => {
    if (!formData.email) {
      setError('이메일을 입력해주세요.');
      return false;
    }
    if (emailCheckStatus !== 'available') {
      setError('이메일 중복 확인을 완료해주세요.');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }

    if (!formData.agreeTerms || !formData.agreePrivacy) {
      setError('필수 약관에 동의해주세요.');
      return false;
    }

    return true;
  };

  // Step 2 검증
  const validateStep2 = () => {
    if (!formData.nickname) {
      setError('닉네임을 입력해주세요.');
      return false;
    }
    
    if (!formData.phone) {
      setError('핸드폰 번호를 입력해주세요.');
      return false;
    }

    if (!formData.birthYear || !formData.birthMonth || !formData.birthDay) {
      setError('생년월일을 모두 선택해주세요.');
      return false;
    }
    if (!isValidCalendarDate(formData.birthYear, formData.birthMonth, formData.birthDay)) {
      setError('올바른 생년월일을 선택해주세요.');
      return false;
    }

    if (!formData.gender) {
      setError('성별을 선택해주세요.');
      return false;
    }

    // 체육관 역할인 경우 추가 검증
    if (formData.role === 'gym') {
      if (!formData.gymName) {
        setError('체육관 이름을 입력해주세요.');
        return false;
      }
      if (!formData.gymLocation) {
        setError('체육관 위치를 입력해주세요.');
        return false;
      }
      if (!formData.representativePhone) {
        setError('대표 연락처를 입력해주세요.');
        return false;
      }
    }

    return true;
  };

  // Step 1 다음으로
  const handleStep1Next = () => {
    setError('');
    if (validateStep1()) {
      setStep(2);
    }
  };

  // Step 2 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!validateStep2()) {
      setLoading(false);
      return;
    }

    try {
      const { signUp } = await import('@/lib/supabase');
      
      console.log('[SignUp] 회원가입 폼 데이터:', formData);

      const y = String(formData.birthYear).padStart(4, '0');
      const m = String(formData.birthMonth).padStart(2, '0');
      const d = String(formData.birthDay).padStart(2, '0');
      const birthDateIso = `${y}-${m}-${d}`;
      
      const userData = {
        name: formData.nickname,
        phone: formData.phone,
        birth_date: birthDateIso,
        role: formData.role,
        gender: formData.gender,
        height: formData.height || null,
        weight: formData.weight || null,
        marketing_consent: formData.agreeMarketing === true,
      };

      // 역할별 추가 데이터 (멤버십은 가입 시 UI 없음 → 기본 베이직)
      if (formData.role === 'player_common') {
        userData.gym_name = formData.gymName || null;
        userData.membership_type = 'basic';
      } else if (formData.role === 'player_athlete') {
        userData.boxing_style = formData.boxingStyle || null;
        userData.gym_name = formData.gymName || null;
        userData.membership_type = 'basic';
      } else if (formData.role === 'gym') {
        // 체육관
        userData.gym_name = formData.gymName;
        userData.gym_location = formData.gymLocation;
        userData.representative_phone = formData.representativePhone;
      }
      
      console.log('[SignUp] signUp 함수에 전달할 userData:', userData);
      
      const { data, error: signUpError } = await signUp(
        formData.email,
        formData.password,
        userData
      );

      if (signUpError) {
        console.error('Signup error:', signUpError);
        if (isAuthPasswordPolicyError(signUpError)) {
          setError(formatAuthPasswordErrorMessage(signUpError, t));
          return;
        }
        if (
          signUpError.message?.toLowerCase().includes('user already registered') ||
          signUpError.code === 'user_already_exists' ||
          (signUpError.status === 422 &&
            /already|registered|exists|duplicate/i.test(String(signUpError.message || '')))
        ) {
          setError('이미 가입된 이메일입니다. 로그인 페이지에서 로그인해주세요.');
          setTimeout(() => {
            if (onSignupSuccess) onSignupSuccess(null);
            else onBack();
          }, 2000);
        } else {
          setError(signUpError.message || '회원가입에 실패했습니다.');
        }
        return;
      }

      if (data?.user) {
        alert('회원가입이 완료되었습니다! 로그인해주세요.');
        if (onSignupSuccess) {
          onSignupSuccess(data.user);
        } else {
          onBack();
        }
      }
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다: ' + (err.message || err));
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="relative z-10 min-h-screen flex items-center justify-center p-6">
  <BackgroundGrid theme={{ accent: 'blue' }} />
  
  <button
    onClick={step === 1 ? onBack : () => setStep(1)}
    className="fixed top-6 left-6 z-50 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm font-medium transition-all flex items-center gap-2"
  >
    <Icon type="arrowRight" size={16} className="rotate-180" />
    {step === 1 ? t('back') : '이전'}
  </button>

  <div className="w-full max-w-lg">
    <SpotlightCard className="p-8">
      {/* 진행 표시 바 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Step {step} of 2</span>
          <span className="text-xs text-gray-400">{step === 1 ? '계정 생성' : '프로필 입력'}</span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>
      </div>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 mb-4">
          <Icon type="zap" size={24} fill="currentColor" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {step === 1 ? '계정 생성 및 인증' : '프로필 정보 입력'}
        </h2>
        <p className="text-gray-500 text-sm">
          {step === 1 ? '기본 정보를 입력하고 계정을 만들어주세요' : '추가 정보를 입력해주세요'}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Step 1: 계정 생성 및 인증 */}
      {step === 1 && (
        <div className="space-y-4">
          {/* 역할 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">역할 선택 *</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({...formData, role: 'player_common'})}
                disabled={loading}
                className={`p-3 rounded-lg border transition-all ${
                  formData.role === 'player_common'
                    ? 'border-blue-500 bg-blue-500/10 text-white' 
                    : 'border-white/10 bg-white/5 text-gray-400'
                }`}
              >
                <Icon type="zap" size={18} className="mx-auto mb-1" />
                <span className="text-xs font-medium">일반회원</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({...formData, role: 'player_athlete'})}
                disabled={loading}
                className={`p-3 rounded-lg border transition-all ${
                  formData.role === 'player_athlete'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white' 
                    : 'border-white/10 bg-white/5 text-gray-400'
                }`}
              >
                <Icon type="target" size={18} className="mx-auto mb-1" />
                <span className="text-xs font-medium">선수</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({...formData, role: 'gym'})}
                disabled={loading}
                className={`p-3 rounded-lg border transition-all ${
                  formData.role === 'gym' 
                    ? 'border-purple-500 bg-purple-500/10 text-white' 
                    : 'border-white/10 bg-white/5 text-gray-400'
                }`}
              >
                <Icon type="home" size={18} className="mx-auto mb-1" />
                <span className="text-xs font-medium">체육관</span>
              </button>
            </div>
          </div>

          {/* 이메일 (아이디) + 중복 확인 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">이메일 (아이디) *</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setEmailCheckStatus('idle');
                }}
                className="flex-1 min-w-0 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                placeholder="example@email.com"
                disabled={loading}
                autoComplete="email"
              />
              <button
                type="button"
                disabled={loading || !formData.email.trim() || emailCheckStatus === 'checking'}
                onClick={async () => {
                  setError('');
                  setEmailCheckStatus('checking');
                  const r = await checkEmailAvailable(formData.email);
                  if (!r.ok) {
                    setEmailCheckStatus(r.error === 'service_unavailable' ? 'unavailable' : 'error');
                    setError(
                      r.error === 'service_unavailable'
                        ? '이메일 확인 서비스를 사용할 수 없습니다. 환경 설정을 확인하거나 잠시 후 다시 시도해 주세요.'
                        : '이메일 확인 중 오류가 발생했습니다.'
                    );
                    return;
                  }
                  if (r.available) {
                    setEmailCheckStatus('available');
                    setError('');
                  } else {
                    setEmailCheckStatus('taken');
                    setError('이미 사용 중인 이메일입니다. 다른 이메일을 입력해 주세요.');
                  }
                }}
                className="shrink-0 px-4 py-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {emailCheckStatus === 'checking' ? '확인 중…' : '중복 확인'}
              </button>
            </div>
            {emailCheckStatus === 'available' && (
              <p className="text-xs text-emerald-400 mt-1.5">사용 가능한 이메일입니다.</p>
            )}
            {emailCheckStatus === 'taken' && (
              <p className="text-xs text-red-400 mt-1.5">이미 등록된 이메일입니다.</p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">비밀번호 *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                <Icon type={showPassword ? "eyeOff" : "eye"} size={18} />
              </button>
            </div>
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">비밀번호 확인 *</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              disabled={loading}
            />
          </div>

          {/* 약관 동의 — 전문은 lib/legal/termsOfService.js 의 TERMS_OF_SERVICE_FULL_TEXT */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer group rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <input
                type="checkbox"
                checked={
                  formData.agreeTerms &&
                  formData.agreePrivacy &&
                  formData.agreeMarketing
                }
                onChange={(e) => {
                  const on = e.target.checked;
                  setFormData({
                    ...formData,
                    agreeTerms: on,
                    agreePrivacy: on,
                    agreeMarketing: on,
                  });
                }}
                className="mt-0.5 w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 shrink-0"
              />
              <span className="text-sm font-medium text-white group-hover:text-white transition-colors">
                전체 동의 (필수·선택 항목 포함)
              </span>
            </label>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-200/95 tracking-wide">
                필수 동의
              </p>
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.agreeTerms}
                  onChange={(e) =>
                    setFormData({ ...formData, agreeTerms: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 shrink-0"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">
                  <span className="text-amber-300/90 font-medium">[필수]</span> 이용약관에 동의합니다
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsModalView('full');
                    }}
                    className="ml-1.5 text-blue-400 hover:text-blue-300 underline text-xs align-baseline"
                  >
                    전문 보기
                  </button>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.agreePrivacy}
                  onChange={(e) =>
                    setFormData({ ...formData, agreePrivacy: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 shrink-0"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">
                  <span className="text-amber-300/90 font-medium">[필수]</span> 개인정보 수집 및 이용에 동의합니다 (휴대폰 번호 포함)
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsModalView('full');
                    }}
                    className="ml-1.5 text-blue-400 hover:text-blue-300 underline text-xs align-baseline"
                  >
                    전문 보기
                  </button>
                </span>
              </label>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-400 tracking-wide">
                선택 동의
              </p>
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.agreeMarketing}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      agreeMarketing: e.target.checked,
                    })
                  }
                  className="mt-0.5 w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 shrink-0"
                />
                <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors flex-1 leading-relaxed">
                  <span className="text-gray-500 font-medium">[선택]</span> 이벤트·혜택·서비스 안내를 이메일·문자·앱 알림 등으로 받습니다. 동의하지 않아도 회원가입 및 기본 서비스 이용은 가능합니다.{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsModalView('optional');
                    }}
                    className="text-blue-400 hover:text-blue-300 underline text-xs align-baseline whitespace-nowrap"
                  >
                    전문 보기
                  </button>
                </span>
              </label>
            </div>

            <p className="text-[11px] text-gray-500 pl-0.5">
              이용약관 전문은 「개인정보 수집·이용 동의」 본문과 동일합니다.{' '}
              <Link
                href="/terms"
                className="text-blue-400/90 hover:text-blue-300 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                새 창에서 페이지로 보기
              </Link>
            </p>
          </div>

          <button
            type="button"
            onClick={handleStep1Next}
            disabled={loading}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            다음 단계
            <Icon type="arrowRight" size={16} />
          </button>
        </div>
      )}

      {/* Step 2: 프로필 정보 */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 공통 필드 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">닉네임 *</label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({...formData, nickname: e.target.value})}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              placeholder="닉네임"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">핸드폰 번호 *</label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: formatKoreanPhone(e.target.value) })
              }
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              placeholder="010-1234-5678"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">출석 체크 시 마지막 4자리를 사용합니다</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">생년월일 *</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">연도</label>
                <select
                  value={formData.birthYear}
                  onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
                  className="w-full px-2 sm:px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-sm"
                  disabled={loading}
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
                <label className="block text-[10px] text-gray-500 mb-1">월</label>
                <select
                  value={formData.birthMonth}
                  onChange={(e) => setFormData({ ...formData, birthMonth: e.target.value })}
                  className="w-full px-2 sm:px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-sm"
                  disabled={loading}
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
                <label className="block text-[10px] text-gray-500 mb-1">일</label>
                <select
                  value={formData.birthDay}
                  onChange={(e) => setFormData({ ...formData, birthDay: e.target.value })}
                  className="w-full px-2 sm:px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-sm"
                  disabled={loading}
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
            <label className="block text-sm font-medium text-gray-400 mb-2">성별 *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({...formData, gender: 'male'})}
                disabled={loading}
                className={`p-3 rounded-lg border transition-all ${
                  formData.gender === 'male'
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-white/10 bg-white/5 text-gray-400'
                }`}
              >
                남성
              </button>
              <button
                type="button"
                onClick={() => setFormData({...formData, gender: 'female'})}
                disabled={loading}
                className={`p-3 rounded-lg border transition-all ${
                  formData.gender === 'female'
                    ? 'border-pink-500 bg-pink-500/10 text-white'
                    : 'border-white/10 bg-white/5 text-gray-400'
                }`}
              >
                여성
              </button>
            </div>
          </div>

          {/* 일반/선수 공통 */}
          {(formData.role === 'player_common' || formData.role === 'player_athlete') && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">키 (cm)</label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData({...formData, height: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                    placeholder="170"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">몸무게 (kg)</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({...formData, weight: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                    placeholder="70"
                    disabled={loading}
                  />
                </div>
              </div>

              {formData.role === 'player_athlete' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">복싱 스타일</label>
                    <select
                      value={formData.boxingStyle}
                      onChange={(e) => setFormData({...formData, boxingStyle: e.target.value})}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all"
                      disabled={loading}
                    >
                      <option value="">선택하세요</option>
                      <option value="아웃복서">아웃복서</option>
                      <option value="인파이터">인파이터</option>
                      <option value="스워머">스워머</option>
                      <option value="펀처">펀처</option>
                      <option value="카운터 펀처">카운터 펀처</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">소속 체육관</label>
                <input
                  type="text"
                  value={formData.gymName}
                  onChange={(e) => setFormData({...formData, gymName: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                  placeholder="체육관 이름"
                  disabled={loading}
                />
              </div>
            </>
          )}

          {/* 체육관 전용 */}
          {formData.role === 'gym' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">체육관 이름 *</label>
                <input
                  type="text"
                  value={formData.gymName}
                  onChange={(e) => setFormData({...formData, gymName: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                  placeholder="체육관 이름"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">체육관 위치 (주소) *</label>
                <input
                  type="text"
                  value={formData.gymLocation}
                  onChange={(e) => setFormData({...formData, gymLocation: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                  placeholder="서울시 강남구..."
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">대표 연락처 *</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={formData.representativePhone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      representativePhone: formatKoreanPhone(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                  placeholder="02-1234-5678"
                  disabled={loading}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '가입 중...' : '계정 만들기'}
          </button>
        </form>
      )}
    </SpotlightCard>
  </div>

  <TermsOfServiceModal
    open={termsModalView !== null}
    onClose={() => setTermsModalView(null)}
    title={
      termsModalView === 'optional'
        ? OPTIONAL_MARKETING_CONSENT_TITLE_KO
        : undefined
    }
    content={
      termsModalView === 'optional'
        ? OPTIONAL_MARKETING_CONSENT_FULL_TEXT
        : undefined
    }
  />
</div>
  );
};

// 랜딩 페이지 — 로고, 전적 검색, 로그인·회원가입 (앱 홈과 동일 다크 톤)
const LandingPage = ({ onLoginClick, onSignupClick, language, setLanguage }) => {
  const router = useRouter();
  const t = (key) => translations[language][key] || key;
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  const goToTierBoardSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/tier-board?q=${encodeURIComponent(q)}`);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-8 w-full max-w-[100vw] overflow-x-hidden text-center">
      <div className="fixed z-50 top-4 right-4 sm:top-5 sm:right-5">
        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="rounded-xl border border-white/[0.12] bg-[#121212] hover:bg-white/[0.06] p-2.5 text-white transition-colors"
            aria-label={language === 'ko' ? '언어 선택' : 'Language'}
          >
            <Icon type="globe" className="w-5 h-5" />
          </button>

          {showLangMenu && (
            <div className="absolute top-full right-0 mt-1.5 w-36 bg-[#121212] border border-white/[0.1] rounded-xl overflow-hidden shadow-2xl animate-fade-in-up">
              <button
                type="button"
                onClick={() => {
                  setLanguage('ko');
                  setShowLangMenu(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                  language === 'ko' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>한국어</span>
                {language === 'ko' && <span className="text-blue-400">✓</span>}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguage('en');
                  setShowLangMenu(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                  language === 'en' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>English</span>
                {language === 'en' && <span className="text-blue-400">✓</span>}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-6xl flex flex-col items-center px-0">
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-bold mb-8 sm:mb-10 tracking-tight bg-gradient-to-r from-blue-400 via-violet-400 to-purple-500 bg-clip-text text-transparent"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          Sportition
        </h1>

        <div className="w-full relative">
          <div className="flex w-full min-h-[3.25rem] items-center rounded-2xl border border-white/[0.1] bg-[#121212] pl-4 sm:pl-5 pr-1.5 py-1 shadow-inner focus-within:border-blue-500/35 focus-within:ring-1 focus-within:ring-blue-500/30">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') goToTierBoardSearch();
              }}
              placeholder={t('recordSearchPlaceholderTierBoard')}
              className="flex-1 min-w-0 bg-transparent border-0 py-3 sm:py-3.5 pr-3 text-sm sm:text-base text-white placeholder:text-gray-500 focus:outline-none focus:ring-0"
            />
            <button
              type="button"
              onClick={goToTierBoardSearch}
              className="shrink-0 rounded-2xl border border-white/[0.12] bg-white/[0.08] hover:bg-white/[0.12] text-white font-medium px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base transition-colors"
            >
              {t('search')}
            </button>
          </div>
        </div>

        <div className="mt-10 sm:mt-12 flex w-full justify-center items-stretch gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => onLoginClick?.()}
            className="flex-1 rounded-xl border border-white/[0.12] bg-[#121212] hover:bg-white/[0.06] text-white text-sm sm:text-base font-medium py-3 px-4 transition-colors"
          >
            {t('login')}
          </button>
          <button
            type="button"
            onClick={() => onSignupClick?.()}
            className="flex-1 rounded-xl border border-white/[0.12] bg-[#121212] hover:bg-white/[0.06] text-white text-sm sm:text-base font-medium py-3 px-4 transition-colors"
          >
            {t('signup')}
          </button>
        </div>
      </div>
    </div>
  );
};

export { LoginModal, SignupPage, LandingPage };

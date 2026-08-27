'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon, PageHeader, SpotlightCard, BackgroundGrid, THEME_ATHLETE, THEME_COACH, getMenuStructure } from '@/components/ui';
import { translations } from '@/lib/translations';
import { signIn } from '@/lib/supabase';
import Modal, { ModalFooter, ModalButton } from '@/components/Modal';
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
import { checkNicknameAvailable } from '@/lib/nicknameAvailability';
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

/** 국내 전화번호 자릿수 검증 (지역번호 9자리 ~ 휴대폰 11자리) */
function isPhoneNumberValid(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 11;
}

/**
 * 생년월일 전용 커스텀 드롭다운.
 * iOS 네이티브 <select> 는 "완료" 버튼을 요구해서 사용성이 나쁨 →
 * 옵션 클릭 즉시 값 적용 + 패널 닫힘.
 */
function BirthSelect({ value, onChange, options, suffix = '', placeholder = '선택', disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="w-full px-2 sm:px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-left focus:outline-none focus:border-blue-500 transition-all text-sm flex items-center justify-between disabled:opacity-60"
      >
        <span className={value ? 'text-white' : 'text-gray-500'}>
          {value ? `${value}${suffix}` : placeholder}
        </span>
        <span className="text-gray-500 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-gray-900 border border-white/10 rounded-lg shadow-xl">
          {options.map((opt) => {
            const v = String(opt);
            const selected = v === String(value);
            return (
              <button
                key={v}
                type="button"
                onClick={() => { onChange(v); setOpen(false); }}
                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                  selected ? 'bg-blue-500/20 text-blue-400' : 'text-white hover:bg-white/10'
                }`}
              >
                {opt}{suffix}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 레이블·값이 다른 선택 항목을 다크 테마 커스텀 드롭다운으로 표시.
 * options: string[] (값=레이블) 또는 { value, label }[] 혼용 가능
 */
function CustomSelect({ value, onChange, options = [], placeholder = '선택', disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const normalized = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );
  const selectedLabel = normalized.find((o) => o.value === value)?.label ?? null;

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="w-full px-2 sm:px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-left focus:outline-none focus:border-blue-500 transition-all text-sm flex items-center justify-between disabled:opacity-60"
      >
        <span className={selectedLabel ? 'text-white' : 'text-gray-500'}>
          {selectedLabel ?? placeholder}
        </span>
        <span className="text-gray-500 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-gray-900 border border-white/10 rounded-lg shadow-xl">
          {normalized.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                opt.value === value ? 'bg-blue-500/20 text-blue-400' : 'text-white hover:bg-white/10'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 로그인 모달
const LoginModal = ({ isOpen, onClose, onSignup, onLoginSuccess, t = (key) => key }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSuccessOpen, setResetSuccessOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetAutoLoginBusy, setResetAutoLoginBusy] = useState(false);
  // 통합 계정 찾기("로그인이 안 되나요?") — 이름+전화번호로 아이디 확인·비밀번호 초기화까지 한 흐름
  // mode 'find': 계정 찾기(이메일 표시 후 로그인/초기화 선택) · 'reset': 비밀번호 찾기(입력 즉시 초기화)
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState('find');
  const [recoveryName, setRecoveryName] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');

  if (!isOpen) return null;

  const handleRecoverySearch = async (e) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError('');
    setRecoveryEmail('');
    try {
      const res = await fetch('/api/auth/find-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: recoveryName, phone: recoveryPhone }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRecoveryError(body?.error === 'rate_limited' ? t('forgotPasswordRateLimited') : t('findIdError'));
        return;
      }
      setRecoveryEmail(body.email);
    } catch (err) {
      setRecoveryError(t('findIdError'));
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleRecoveryReset = async () => {
    if (resetLoading) return;
    setResetLoading(true);
    setRecoveryError('');
    try {
      const res = await fetch('/api/auth/self-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: recoveryName, phone: recoveryPhone }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRecoveryError(
          body?.error === 'rate_limited' ? t('forgotPasswordRateLimited') : t('forgotPasswordError')
        );
        return;
      }
      setResetEmail(body.email || recoveryEmail);
      setRecoveryOpen(false);
      setResetSuccessOpen(true);
    } catch (err) {
      setRecoveryError(t('forgotPasswordError'));
    } finally {
      setResetLoading(false);
    }
  };

  /** 초기화 완료 모달의 두 버튼 — 둘 다 새 비밀번호(123456)로 자동 로그인.
   *  goChangePassword 면 로그인 후 회원정보 수정 페이지로 착지 */
  const finishResetLogin = async (goChangePassword) => {
    if (resetAutoLoginBusy) return;
    setResetAutoLoginBusy(true);
    try {
      const { data, error: loginErr } = await signIn(resetEmail.trim(), '123456');
      if (loginErr || !data?.user) {
        // 자동 로그인 실패 — 로그인 폼으로 복귀, 이메일 채워주고 안내
        setResetSuccessOpen(false);
        setEmail(resetEmail);
        setError(t('forgotPasswordAutoLoginFailed'));
        return;
      }
      setResetSuccessOpen(false);
      if (onLoginSuccess) {
        onLoginSuccess(data.user, goChangePassword ? { nextTab: 'mypage-edit-profile' } : undefined);
      }
      onClose();
    } catch (err) {
      setResetSuccessOpen(false);
      setEmail(resetEmail);
      setError(t('forgotPasswordAutoLoginFailed'));
    } finally {
      setResetAutoLoginBusy(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await signIn(email, password);

      if (error) {
        setError(error.message || '이메일 또는 비밀번호가 올바르지 않습니다.');
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

      <form onSubmit={handleLogin} className="space-y-3 xs:space-y-4" noValidate>
        <div>
          <label className="block text-xs xs:text-sm font-medium text-gray-400 mb-1.5 xs:mb-2">{t('email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 xs:px-4 xs:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder={t('email')}
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
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm sm:text-base">
          <button
            type="button"
            onClick={() => {
              setRecoveryName('');
              setRecoveryPhone('');
              setRecoveryError('');
              setRecoveryEmail('');
              setRecoveryMode('find');
              setRecoveryOpen(true);
            }}
            className="text-white hover:text-blue-200 transition-colors"
          >
            {t('loginHelpLink')}
          </button>
          <span className="text-gray-600 select-none" aria-hidden>
            |
          </span>
          <button
            type="button"
            onClick={() => {
              setRecoveryName('');
              setRecoveryPhone('');
              setRecoveryError('');
              setRecoveryEmail('');
              setRecoveryMode('reset');
              setRecoveryOpen(true);
            }}
            className="text-white hover:text-blue-200 transition-colors"
          >
            {t('findPasswordLink')}
          </button>
        </div>
      </div>
    </SpotlightCard>

    {recoveryOpen ? (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4"
        role="presentation"
        onClick={() => setRecoveryOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-recovery-title"
          className={`w-full max-w-sm rounded-xl border bg-[#0c0c12] p-5 shadow-2xl ${
            recoveryMode === 'reset' ? 'border-amber-500/30' : 'border-blue-500/30'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5 mb-1">
            <div
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${
                recoveryMode === 'reset' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              <Icon type={recoveryMode === 'reset' ? 'shield' : 'search'} size={16} />
            </div>
            <h3 id="account-recovery-title" className="text-lg font-bold text-white">
              {recoveryMode === 'reset' ? t('forgotPasswordModalTitle') : t('accountRecoveryTitle')}
            </h3>
          </div>

          {recoveryEmail ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-1 leading-relaxed">{t('accountRecoveryFoundDesc')}</p>
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center break-all">
                {recoveryEmail}
              </div>
              {recoveryError ? (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{recoveryError}</div>
              ) : null}
              <button
                type="button"
                className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                disabled={resetLoading}
                onClick={() => {
                  setEmail(recoveryEmail);
                  setRecoveryOpen(false);
                }}
              >
                {t('findIdUseThis')}
              </button>
              <button
                type="button"
                className="w-full py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/25 text-sm font-medium transition-colors disabled:opacity-50"
                disabled={resetLoading}
                onClick={handleRecoveryReset}
              >
                {resetLoading ? '…' : t('forgotPasswordSubmit')}
              </button>
              <button
                type="button"
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-300"
                onClick={() => setRecoveryOpen(false)}
              >
                {t('close')}
              </button>
            </div>
          ) : (
            <>
              {recoveryMode === 'reset' ? (
                <div className="mt-2 mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200 text-xs leading-relaxed">
                  {t('forgotPasswordModalDesc')}
                </div>
              ) : (
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">{t('accountRecoveryDesc')}</p>
              )}
              <form
                onSubmit={
                  recoveryMode === 'reset'
                    ? (e) => {
                        e.preventDefault();
                        handleRecoveryReset();
                      }
                    : handleRecoverySearch
                }
                className="space-y-3"
              >
                {recoveryError ? (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{recoveryError}</div>
                ) : null}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('name')}</label>
                  <input
                    type="text"
                    value={recoveryName}
                    onChange={(e) => setRecoveryName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                    placeholder={t('name')}
                    required
                    disabled={recoveryLoading || resetLoading}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('phone')}</label>
                  <input
                    type="tel"
                    value={recoveryPhone}
                    onChange={(e) => setRecoveryPhone(formatKoreanPhone(e.target.value))}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                    placeholder="010-1234-5678"
                    required
                    disabled={recoveryLoading || resetLoading}
                    autoComplete="tel"
                  />
                </div>
                <button
                  type="submit"
                  disabled={recoveryLoading || resetLoading}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    recoveryMode === 'reset'
                      ? 'bg-amber-500 hover:bg-amber-400 text-black font-bold'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {recoveryLoading || resetLoading
                    ? '…'
                    : recoveryMode === 'reset'
                      ? t('forgotPasswordSubmit')
                      : t('accountRecoverySubmit')}
                </button>
                <button
                  type="button"
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-300"
                  onClick={() => setRecoveryOpen(false)}
                >
                  {t('cancel')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    ) : null}

    <Modal
      open={!!error}
      onClose={() => setError('')}
      title="로그인 실패"
      variant="danger"
      size="sm"
      zIndexClass="z-[120]"
    >
      <p className="text-sm text-gray-300 leading-relaxed">{error}</p>
      <ModalFooter>
        <ModalButton variant="danger" onClick={() => setError('')}>
          {t('close')}
        </ModalButton>
      </ModalFooter>
    </Modal>

    <Modal
      open={resetSuccessOpen}
      onClose={() => finishResetLogin(false)}
      title={t('forgotPasswordModalTitle')}
      variant="success"
      size="sm"
      zIndexClass="z-[120]"
    >
      <p className="text-sm text-gray-300 leading-relaxed">{t('forgotPasswordSent')}</p>
      <ModalFooter>
        <ModalButton onClick={() => finishResetLogin(false)} disabled={resetAutoLoginBusy}>
          {t('forgotPasswordLater')}
        </ModalButton>
        <ModalButton variant="success" onClick={() => finishResetLogin(true)} disabled={resetAutoLoginBusy}>
          {resetAutoLoginBusy ? '…' : t('forgotPasswordGoChange')}
        </ModalButton>
      </ModalFooter>
    </Modal>
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
    name: '',
    nickname: '',
    phone: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    gender: '',
    height: '',
    weight: '',
    boxingStyle: '', // 선수만
    gymCode: '', // 일반/선수 — 체육관 코드 입력 (gym_name 자유 입력 대체)
    gymName: '', // 체육관만 — 자기 체육관 이름
    gymLocation: '', // 체육관만
    representativePhone: '', // 체육관만
    region: '', // 체육관만 — 지역 (코드 prefix 결정)
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  /** 이메일(아이디) 중복 확인: idle | checking | available | taken | error | unavailable */
  const [emailCheckStatus, setEmailCheckStatus] = useState('idle');
  /** 닉네임 중복 확인: idle | checking | available | taken | error */
  const [nicknameCheckStatus, setNicknameCheckStatus] = useState('idle');
  /** null | 'full' 필수 약관 전문 | 'optional' 선택(마케팅) 동의 전문 */
  const [termsModalView, setTermsModalView] = useState(null);
  /** 체육관 코드 미리보기: { status: 'idle'|'checking'|'found'|'notfound'|'invalid'|'error', gymName: string|null } */
  const [gymCodePreview, setGymCodePreview] = useState({ status: 'idle', gymName: null });
  /** 계정 만들기 클릭 시 비어있는 필수 항목을 한 번에 안내하는 모달 */
  const [missingFieldsModal, setMissingFieldsModal] = useState({ open: false, items: [] });
  /** 이메일/닉네임 중복 확인 버튼 클릭 결과를 안내하는 모달 */
  const [dupCheckModal, setDupCheckModal] = useState({ open: false, variant: 'info', message: '' });
  /** 회원가입 완료 축하 모달 */
  const [signupSuccessOpen, setSignupSuccessOpen] = useState(false);
  const [signedUpUser, setSignedUpUser] = useState(null);
  /** 축하 모달 [확인] → 방금 가입한 계정으로 자동 로그인 중 */
  const [postSignupLoginBusy, setPostSignupLoginBusy] = useState(false);

  // 체육관 코드 형식: 2글자 prefix + 4자리 숫자 (예: gg0001)
  const GYM_CODE_REGEX = /^(se|gg|gw|cc|jl|gs|jj)\d{4}$/;
  const normalizeGymCode = (raw) => String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);

  // 체육관 코드 입력 → 디바운스 후 lookup_gym_by_code RPC 호출
  // eslint-disable-next-line react-hooks/exhaustive-deps -- GYM_CODE_REGEX는 컴포넌트 외부 상수와 동일하게 불변
  useEffect(() => {
    const isMember = formData.role === 'player_common' || formData.role === 'player_athlete';
    if (!isMember) {
      setGymCodePreview({ status: 'idle', gymName: null });
      return;
    }
    const code = formData.gymCode;
    if (!code) {
      setGymCodePreview({ status: 'idle', gymName: null });
      return;
    }
    if (!GYM_CODE_REGEX.test(code)) {
      setGymCodePreview({ status: 'invalid', gymName: null });
      return;
    }
    let cancelled = false;
    setGymCodePreview({ status: 'checking', gymName: null });
    const timer = setTimeout(async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error: rpcError } = await supabase.rpc('lookup_gym_by_code', { p_code: code });
        if (cancelled) return;
        if (rpcError) {
          setGymCodePreview({ status: 'error', gymName: null });
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (row && row.gym_name) {
          setGymCodePreview({ status: 'found', gymName: row.gym_name });
        } else {
          setGymCodePreview({ status: 'notfound', gymName: null });
        }
      } catch (e) {
        if (!cancelled) setGymCodePreview({ status: 'error', gymName: null });
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formData.gymCode, formData.role]);

  // Step 1 검증
  const validateStep1 = () => {
    if (!formData.email) {
      setError('이메일을 입력해주세요.');
      return false;
    }
    if (emailCheckStatus !== 'available' && emailCheckStatus !== 'unavailable') {
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
    if (!formData.name || !formData.name.trim()) {
      setError('이름을 입력해주세요.');
      return false;
    }
    if (formData.name.trim().length < 2) {
      setError('이름은 2자 이상 입력해주세요.');
      return false;
    }
    if (!formData.nickname) {
      setError('닉네임을 입력해주세요.');
      return false;
    }
    if (nicknameCheckStatus !== 'available') {
      setError('닉네임 중복 확인을 완료해주세요.');
      return false;
    }

    if (!formData.phone) {
      setError('핸드폰 번호를 입력해주세요.');
      return false;
    }
    if (!isPhoneNumberValid(formData.phone)) {
      setError('올바른 핸드폰 번호를 입력해주세요.');
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

    // 체육관 역할인 경우 추가 검증
    if (formData.role === 'gym') {
      if (!formData.gymName) {
        setError('체육관 이름을 입력해주세요.');
        return false;
      }
      if (!formData.region) {
        setError('체육관 지역을 선택해주세요.');
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

    // 회원/선수는 체육관 코드 필수 — 형식·존재 모두 통과해야 가입 가능
    if (formData.role === 'player_common' || formData.role === 'player_athlete') {
      if (!formData.gymCode || !formData.gymCode.trim()) {
        setError('체육관 코드를 입력해주세요.');
        return false;
      }
      if (!GYM_CODE_REGEX.test(formData.gymCode)) {
        setError('체육관 코드 형식이 올바르지 않습니다. (예: gg0001)');
        return false;
      }
      if (gymCodePreview.status === 'checking') {
        setError('체육관 코드 확인 중입니다. 잠시만 기다려주세요.');
        return false;
      }
      if (gymCodePreview.status === 'notfound') {
        setError('존재하지 않는 체육관 코드입니다.');
        return false;
      }
      if (gymCodePreview.status === 'error') {
        setError('체육관 코드 확인 중 오류가 발생했습니다. 다시 시도해주세요.');
        return false;
      }
      if (gymCodePreview.status !== 'found') {
        setError('체육관 코드 확인이 완료되어야 가입할 수 있습니다.');
        return false;
      }
    }

    return true;
  };

  // Step 2에서 비어있거나 조건을 만족하지 못한 필수 항목을 전부 모아 반환 (계정 만들기 클릭 시 한 번에 안내)
  const getStep2MissingFields = () => {
    const missing = [];
    if (!formData.name || !formData.name.trim()) {
      missing.push('이름');
    } else if (formData.name.trim().length < 2) {
      missing.push('이름 (2자 이상 입력)');
    }

    if (!formData.nickname) {
      missing.push('닉네임');
    } else if (nicknameCheckStatus !== 'available') {
      missing.push('닉네임 (중복 확인 필요)');
    }

    if (!formData.phone) {
      missing.push('핸드폰 번호');
    } else if (!isPhoneNumberValid(formData.phone)) {
      missing.push('핸드폰 번호 (형식 확인)');
    }

    if (!formData.birthYear || !formData.birthMonth || !formData.birthDay) {
      missing.push('생년월일');
    } else if (!isValidCalendarDate(formData.birthYear, formData.birthMonth, formData.birthDay)) {
      missing.push('생년월일 (올바른 날짜 확인)');
    }

    if (formData.role === 'gym') {
      if (!formData.gymName) missing.push('체육관 이름');
      if (!formData.region) missing.push('체육관 지역');
      if (!formData.gymLocation) missing.push('체육관 위치');
      if (!formData.representativePhone) missing.push('대표 연락처');
    }

    if (formData.role === 'player_common' || formData.role === 'player_athlete') {
      if (!formData.gymCode || !formData.gymCode.trim()) missing.push('체육관 코드');
    }

    return missing;
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
    setError('');

    const missingFields = getStep2MissingFields();
    if (missingFields.length > 0) {
      setMissingFieldsModal({ open: true, items: missingFields });
      return;
    }

    setLoading(true);

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
        name: formData.name.trim(),
        nickname: formData.nickname.trim(),
        phone: formData.phone,
        birth_date: birthDateIso,
        role: formData.role,
        gender: formData.gender,
        height: formData.height || null,
        weight: formData.weight || null,
        marketing_consent: formData.agreeMarketing === true,
      };

      // 역할별 추가 데이터 (멤버십은 가입 시 UI 없음 → 기본 베이직)
      const normalizedGymCode = formData.gymCode ? formData.gymCode.trim().toLowerCase() : null;
      if (formData.role === 'player_common') {
        // gym_name 은 트리거가 코드 → 이름으로 자동 채움. 입력값 없음.
        userData.gym_code = normalizedGymCode;
        userData.membership_type = 'basic';
      } else if (formData.role === 'player_athlete') {
        userData.boxing_style = formData.boxingStyle || null;
        userData.gym_code = normalizedGymCode;
        userData.membership_type = 'basic';
      } else if (formData.role === 'gym') {
        // 체육관
        userData.gym_name = formData.gymName;
        userData.gym_location = formData.gymLocation;
        userData.representative_phone = formData.representativePhone;
        userData.region = formData.region; // 트리거가 region → gym_code 자동 발급
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
        const errMsg = String(signUpError.message || '');
        if (errMsg.includes('gym_code_required')) {
          setError('체육관 코드를 입력해야 가입할 수 있습니다.');
          return;
        }
        if (errMsg.includes('gym_code_not_found')) {
          setError('존재하지 않는 체육관 코드입니다. 코드를 다시 확인해주세요.');
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
        setSignedUpUser(data.user);
        setSignupSuccessOpen(true);
      }
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다: ' + (err.message || err));
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="relative z-10 min-h-screen flex items-start md:items-center justify-center px-4 py-20 md:py-8">
  <BackgroundGrid theme={{ accent: 'blue' }} />
  
  <button
    onClick={step === 1 ? onBack : () => setStep(1)}
    className="fixed z-50 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm font-medium transition-all flex items-center gap-2"
    style={{
      top: 'max(env(safe-area-inset-top), 24px)',
      left: 'max(env(safe-area-inset-left), 24px)',
    }}
  >
    <Icon type="arrowRight" size={16} className="rotate-180" />
    {step === 1 ? t('back') : '이전'}
  </button>

  <div className="w-full max-w-lg">
    <SpotlightCard className="p-5 xs:p-6 sm:p-8">
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
                    const unavailable = r.error === 'service_unavailable';
                    setEmailCheckStatus(unavailable ? 'unavailable' : 'error');
                    setDupCheckModal({
                      open: true,
                      variant: unavailable ? 'warning' : 'danger',
                      message: unavailable
                        ? '이메일 사전 확인을 사용할 수 없어 가입 단계에서 다시 확인합니다.'
                        : '이메일 확인 중 오류가 발생했습니다.',
                    });
                    return;
                  }
                  if (r.available) {
                    setEmailCheckStatus('available');
                    setDupCheckModal({ open: true, variant: 'success', message: '사용 가능한 이메일입니다.' });
                  } else {
                    setEmailCheckStatus('taken');
                    setDupCheckModal({
                      open: true,
                      variant: 'danger',
                      message: '이미 사용 중인 이메일입니다. 다른 이메일을 입력해 주세요.',
                    });
                  }
                }}
                className="shrink-0 px-4 py-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {emailCheckStatus === 'checking' ? '확인 중…' : '중복 확인'}
              </button>
            </div>
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
          {/* 이름 (실명) — 닉네임과 별도 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">이름 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              placeholder="실제 이름 (예: 홍길동)"
              disabled={loading}
              maxLength={30}
            />
            {formData.name.trim().length === 0 ? (
              <p className="text-xs text-gray-500 mt-1">상대 프로필 등에서 닉네임 옆에 표시됩니다</p>
            ) : formData.name.trim().length < 2 ? (
              <p className="text-xs text-red-400 mt-1.5">이름은 2자 이상 입력해주세요.</p>
            ) : (
              <p className="text-xs text-emerald-400 mt-1.5">확인되었습니다.</p>
            )}
          </div>

          {/* 공통 필드 — 닉네임 + 중복 확인 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">닉네임 *</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => {
                  setFormData({ ...formData, nickname: e.target.value });
                  setNicknameCheckStatus('idle');
                }}
                className="flex-1 min-w-0 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                placeholder="닉네임"
                disabled={loading}
                maxLength={30}
              />
              <button
                type="button"
                disabled={loading || !formData.nickname.trim() || nicknameCheckStatus === 'checking'}
                onClick={async () => {
                  setError('');
                  setNicknameCheckStatus('checking');
                  const r = await checkNicknameAvailable(formData.nickname);
                  if (!r.ok) {
                    setNicknameCheckStatus('error');
                    setDupCheckModal({ open: true, variant: 'danger', message: '닉네임 확인 중 오류가 발생했습니다.' });
                    return;
                  }
                  if (r.available) {
                    setNicknameCheckStatus('available');
                    setDupCheckModal({ open: true, variant: 'success', message: '사용 가능한 닉네임입니다.' });
                  } else {
                    setNicknameCheckStatus('taken');
                    setDupCheckModal({
                      open: true,
                      variant: 'danger',
                      message: '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.',
                    });
                  }
                }}
                className="shrink-0 px-4 py-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {nicknameCheckStatus === 'checking' ? '확인 중…' : '중복 확인'}
              </button>
            </div>
            {formData.nickname.trim().length === 0 ? null : nicknameCheckStatus === 'available' ? (
              <p className="text-xs text-emerald-400 mt-1.5">사용 가능한 닉네임입니다. (확인 완료)</p>
            ) : nicknameCheckStatus === 'taken' ? (
              <p className="text-xs text-red-400 mt-1.5">이미 사용 중인 닉네임입니다.</p>
            ) : nicknameCheckStatus === 'error' ? (
              <p className="text-xs text-red-400 mt-1.5">닉네임 확인 중 오류가 발생했습니다.</p>
            ) : nicknameCheckStatus === 'checking' ? null : (
              <p className="text-xs text-amber-300 mt-1.5">중복 확인 버튼을 눌러 확인해주세요.</p>
            )}
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
            {formData.phone.length === 0 ? (
              <p className="text-xs text-gray-500 mt-1">출석 체크 시 마지막 4자리를 사용합니다</p>
            ) : isPhoneNumberValid(formData.phone) ? (
              <p className="text-xs text-emerald-400 mt-1.5">확인되었습니다.</p>
            ) : (
              <p className="text-xs text-red-400 mt-1.5">올바른 핸드폰 번호를 입력해주세요.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">생년월일 *</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">연도</label>
                <BirthSelect
                  value={formData.birthYear}
                  onChange={(v) => setFormData({ ...formData, birthYear: v })}
                  options={BIRTH_YEAR_OPTIONS}
                  suffix="년"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">월</label>
                <BirthSelect
                  value={formData.birthMonth}
                  onChange={(v) => setFormData({ ...formData, birthMonth: v })}
                  options={MONTH_OPTIONS}
                  suffix="월"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">일</label>
                <BirthSelect
                  value={formData.birthDay}
                  onChange={(v) => setFormData({ ...formData, birthDay: v })}
                  options={BIRTH_DAY_OPTIONS}
                  suffix="일"
                  disabled={loading}
                />
              </div>
            </div>
            {formData.birthYear && formData.birthMonth && formData.birthDay && (
              isValidCalendarDate(formData.birthYear, formData.birthMonth, formData.birthDay) ? (
                <p className="text-xs text-emerald-400 mt-1.5">확인되었습니다.</p>
              ) : (
                <p className="text-xs text-red-400 mt-1.5">존재하지 않는 날짜입니다. 다시 선택해주세요.</p>
              )
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">성별 (선택)</label>
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
                    <CustomSelect
                      value={formData.boxingStyle}
                      onChange={(v) => setFormData({ ...formData, boxingStyle: v })}
                      options={['아웃복서', '인파이터', '스워머', '펀처', '카운터 펀처']}
                      placeholder="선택하세요"
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  소속 체육관 코드 * <span className="text-gray-500 text-xs">(체육관 관장에게 받으세요)</span>
                </label>
                <input
                  type="text"
                  value={formData.gymCode}
                  onChange={(e) => setFormData({...formData, gymCode: normalizeGymCode(e.target.value)})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all font-mono tracking-widest"
                  placeholder=""
                  maxLength={6}
                  autoCapitalize="none"
                  disabled={loading}
                />
                {formData.gymCode && (
                  <p className={`mt-1.5 text-xs ${
                    gymCodePreview.status === 'found' ? 'text-emerald-400' :
                    gymCodePreview.status === 'notfound' ? 'text-red-400' :
                    gymCodePreview.status === 'invalid' ? 'text-red-400' :
                    gymCodePreview.status === 'error' ? 'text-red-400' :
                    'text-gray-500'
                  }`}>
                    {gymCodePreview.status === 'checking' && '확인 중...'}
                    {gymCodePreview.status === 'found' && `✓ ${gymCodePreview.gymName}`}
                    {gymCodePreview.status === 'notfound' && '✗ 존재하지 않는 코드입니다'}
                    {gymCodePreview.status === 'invalid' && '코드 형식: 지역 2글자 + 숫자 4자리'}
                    {gymCodePreview.status === 'error' && '확인 중 오류가 발생했습니다'}
                  </p>
                )}
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
                <label className="block text-sm font-medium text-gray-400 mb-2">지역 *</label>
                <CustomSelect
                  value={formData.region}
                  onChange={(v) => setFormData({ ...formData, region: v })}
                  options={[
                    { value: 'seoul',       label: '서울' },
                    { value: 'gyeonggi',    label: '경기' },
                    { value: 'gangwon',     label: '강원' },
                    { value: 'chungcheong', label: '충청' },
                    { value: 'jeolla',      label: '전라' },
                    { value: 'gyeongsang',  label: '경상' },
                    { value: 'jeju',        label: '제주' },
                  ]}
                  placeholder="선택하세요"
                  disabled={loading}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  지역에 따라 가입 직후 고유 체육관 코드가 자동 발급됩니다 (예: 경기 → GG0002).
                </p>
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

  <Modal
    open={dupCheckModal.open}
    onClose={() => setDupCheckModal({ open: false, variant: 'info', message: '' })}
    title={dupCheckModal.variant === 'success' ? '확인 완료' : '중복 확인'}
    variant={dupCheckModal.variant}
    size="sm"
  >
    <p className="text-sm text-gray-300">{dupCheckModal.message}</p>
    <ModalFooter>
      <ModalButton
        variant={dupCheckModal.variant === 'success' ? 'success' : dupCheckModal.variant === 'warning' ? 'warning' : 'danger'}
        onClick={() => setDupCheckModal({ open: false, variant: 'info', message: '' })}
      >
        확인
      </ModalButton>
    </ModalFooter>
  </Modal>

  <Modal
    open={missingFieldsModal.open}
    onClose={() => setMissingFieldsModal({ open: false, items: [] })}
    title="입력하지 않은 항목이 있어요"
    variant="warning"
    size="sm"
  >
    <p className="text-sm text-gray-300 mb-2">아래 항목을 입력해주세요.</p>
    <ul className="list-disc list-inside text-sm text-gray-200 space-y-1">
      {missingFieldsModal.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
    <ModalFooter>
      <ModalButton variant="warning" onClick={() => setMissingFieldsModal({ open: false, items: [] })}>
        확인
      </ModalButton>
    </ModalFooter>
  </Modal>

  <Modal
    open={signupSuccessOpen}
    closable={false}
    title={t('signupSuccessTitle')}
    variant="success"
    size="sm"
  >
    <p className="text-sm text-gray-300 leading-relaxed">{t('signupSuccessBody')}</p>
    <ModalFooter>
      <ModalButton
        variant="success"
        disabled={postSignupLoginBusy}
        onClick={async () => {
          if (postSignupLoginBusy) return;
          setPostSignupLoginBusy(true);
          try {
            // 방금 가입한 계정으로 자동 로그인 — 성공 시 바로 앱 진입
            const { data: loginData } = await signIn(formData.email, formData.password);
            setSignupSuccessOpen(false);
            if (onSignupSuccess) {
              onSignupSuccess(signedUpUser, loginData?.user ? { autoLoggedIn: true } : undefined);
            } else {
              onBack();
            }
          } catch (err) {
            // 자동 로그인 실패(이메일 확인 필요 등) — 기존처럼 로그인 화면으로
            setSignupSuccessOpen(false);
            if (onSignupSuccess) onSignupSuccess(signedUpUser);
            else onBack();
          } finally {
            setPostSignupLoginBusy(false);
          }
        }}
      >
        {postSignupLoginBusy ? '…' : t('confirm')}
      </ModalButton>
    </ModalFooter>
  </Modal>

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
        {/* 로고 워드마크 — 흰색 굵은 SPORTITION (이미지 동일 스타일) */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-8 sm:mb-10 tracking-tight text-white"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', letterSpacing: '0.04em' }}
        >
          SPORTITION
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

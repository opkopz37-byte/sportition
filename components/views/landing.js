'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon, PageHeader, SpotlightCard, BackgroundGrid, THEME_ATHLETE, THEME_COACH, getMenuStructure } from '@/components/ui';
import { translations } from '@/lib/translations';
import { signIn } from '@/lib/supabase';

// 로그인 모달
const LoginModal = ({ isOpen, onClose, onSignup, onLoginSuccess, t = (key) => key }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

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
            placeholder={t('password')}
            required
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
          onClick={onSignup}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
        >
          {t('signup')}
        </button>
      </div>
    </SpotlightCard>
  </div>
</div>
  );
};

// 비밀번호 검증 함수
const validatePassword = (password) => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
  
  const strength = Object.values(checks).filter(Boolean).length;
  return { checks, strength };
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
    
    // Step 2: 프로필 정보
    nickname: '',
    phone: '',
    birthDate: '',
    gender: '',
    height: '',
    weight: '',
    boxingStyle: '', // 선수만
    gymName: '', // 일반/선수
    gymLocation: '', // 체육관만
    representativePhone: '', // 체육관만
    membershipType: 'basic' // 일반/선수만
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ checks: {}, strength: 0 });
  const [showPassword, setShowPassword] = useState(false);

  // 비밀번호 변경 시 강도 체크
  const handlePasswordChange = (value) => {
    setFormData({...formData, password: value});
    setPasswordStrength(validatePassword(value));
  };

  // Step 1 검증
  const validateStep1 = () => {
    if (!formData.email) {
      setError('이메일을 입력해주세요.');
      return false;
    }
    
    if (!formData.password) {
      setError('비밀번호를 입력해주세요.');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }

    const { checks } = validatePassword(formData.password);
    if (!checks.length || !checks.uppercase || !checks.lowercase || !checks.special) {
      setError('비밀번호는 8자 이상, 대문자, 소문자, 특수문자를 포함해야 합니다.');
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

    if (!formData.birthDate) {
      setError('생년월일을 입력해주세요.');
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
      
      const userData = {
        name: formData.nickname,
        phone: formData.phone,
        birth_date: formData.birthDate,
        role: formData.role,
        gender: formData.gender,
        height: formData.height || null,
        weight: formData.weight || null,
      };

      // 역할별 추가 데이터
      if (formData.role === 'player_common') {
        // 일반 회원
        userData.gym_name = formData.gymName || null;
        userData.membership_type = formData.membershipType;
      } else if (formData.role === 'player_athlete') {
        // 선수
        userData.boxing_style = formData.boxingStyle || null;
        userData.gym_name = formData.gymName || null;
        userData.membership_type = formData.membershipType;
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
        // 이미 가입된 이메일인 경우 → 로그인 유도
        if (
          signUpError.message?.toLowerCase().includes('user already registered') ||
          signUpError.code === 'user_already_exists' ||
          signUpError.status === 422
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

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">이메일 *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              placeholder="example@email.com"
              disabled={loading}
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">비밀번호 *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all pr-10"
                placeholder="8자 이상, 대/소문자, 특수문자"
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
            
            {/* 비밀번호 강도 표시 */}
            {formData.password && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        passwordStrength.strength >= level
                          ? passwordStrength.strength === 4
                            ? 'bg-green-500'
                            : passwordStrength.strength === 3
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={passwordStrength.checks.length ? 'text-green-400' : 'text-gray-500'}>
                    ✓ 8자 이상
                  </span>
                  <span className={passwordStrength.checks.uppercase ? 'text-green-400' : 'text-gray-500'}>
                    ✓ 대문자
                  </span>
                  <span className={passwordStrength.checks.lowercase ? 'text-green-400' : 'text-gray-500'}>
                    ✓ 소문자
                  </span>
                  <span className={passwordStrength.checks.special ? 'text-green-400' : 'text-gray-500'}>
                    ✓ 특수문자
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">비밀번호 확인 *</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              placeholder="비밀번호 재입력"
              disabled={loading}
            />
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-red-400 mt-1">비밀번호가 일치하지 않습니다</p>
            )}
            {formData.confirmPassword && formData.password === formData.confirmPassword && (
              <p className="text-xs text-green-400 mt-1">비밀번호가 일치합니다</p>
            )}
          </div>

          {/* 약관 동의 */}
          <div className="space-y-2 pt-2">
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={formData.agreeTerms}
                onChange={(e) => setFormData({...formData, agreeTerms: e.target.checked})}
                className="mt-0.5 w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-400 group-hover:text-white transition-colors">
                [필수] 이용약관에 동의합니다
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={formData.agreePrivacy}
                onChange={(e) => setFormData({...formData, agreePrivacy: e.target.checked})}
                className="mt-0.5 w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-400 group-hover:text-white transition-colors">
                [필수] 개인정보 수집 및 이용에 동의합니다 (핸드폰 번호 포함)
              </span>
            </label>
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
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              placeholder="010-1234-5678"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">출석 체크 시 마지막 4자리를 사용합니다</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">생년월일 *</label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              disabled={loading}
            />
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

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">멤버십 타입</label>
                <div className="grid grid-cols-3 gap-2">
                  {['basic', 'standard', 'premium'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({...formData, membershipType: type})}
                      disabled={loading}
                      className={`p-2 rounded-lg border transition-all text-xs ${
                        formData.membershipType === type
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-white/10 bg-white/5 text-gray-400'
                      }`}
                    >
                      {type === 'basic' ? '베이직' : type === 'standard' ? '스탠다드' : '프리미엄'}
                    </button>
                  ))}
                </div>
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
                  value={formData.representativePhone}
                  onChange={(e) => setFormData({...formData, representativePhone: e.target.value})}
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
</div>
  );
};

// 랜딩 페이지
const LandingPage = ({ onSelectRole, onLoginClick, language, setLanguage }) => {
  const t = (key) => translations[language][key] || key;
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langRef = useRef(null);

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
<div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-[clamp(0.75rem,4vw,1.5rem)] py-[clamp(0.75rem,3vw,1.5rem)] text-center w-full max-w-[100vw] overflow-x-hidden">
  <div className="fixed z-50 flex items-center gap-[clamp(0.375rem,1.5vw,0.75rem)] top-[clamp(0.5rem,2vw,1.5rem)] right-[clamp(0.5rem,2vw,1.5rem)]">
    <div className="relative" ref={langRef}>
      <button 
        onClick={() => setShowLangMenu(!showLangMenu)}
        className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition-all flex items-center gap-[clamp(0.25rem,1vw,0.5rem)] px-[clamp(0.5rem,2vw,1rem)] py-[clamp(0.375rem,1.2vw,0.5rem)] text-[clamp(0.6875rem,calc(1.5vw+0.25rem),0.875rem)] min-h-[2.25rem] sm:min-h-0"
      >
        <Icon type="globe" className="w-[clamp(0.875rem,2.5vw,1rem)] h-[clamp(0.875rem,2.5vw,1rem)] shrink-0" />
        <span className="hidden xs:inline whitespace-nowrap">{language === 'ko' ? '한국어' : 'English'}</span>
        <span className="xs:hidden">{language === 'ko' ? 'KR' : 'EN'}</span>
      </button>
      
      {showLangMenu && (
        <div className="absolute top-full right-0 mt-1.5 w-[clamp(7.5rem,40vw,8.5rem)] bg-[#0A0A0A] border border-white/10 rounded-lg overflow-hidden shadow-2xl animate-fade-in-up">
          <button
            onClick={() => { setLanguage('ko'); setShowLangMenu(false); }}
            className={`w-full px-[clamp(0.75rem,3vw,1rem)] py-[clamp(0.5rem,2vw,0.75rem)] text-left text-[clamp(0.75rem,1.8vw,0.875rem)] transition-colors flex items-center justify-between ${
              language === 'ko' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>한국어</span>
            {language === 'ko' && <span className="text-blue-400">✓</span>}
          </button>
          <button
            onClick={() => { setLanguage('en'); setShowLangMenu(false); }}
            className={`w-full px-[clamp(0.75rem,3vw,1rem)] py-[clamp(0.5rem,2vw,0.75rem)] text-left text-[clamp(0.75rem,1.8vw,0.875rem)] transition-colors flex items-center justify-between ${
              language === 'en' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>English</span>
            {language === 'en' && <span className="text-blue-400">✓</span>}
          </button>
        </div>
      )}
    </div>

    <button
      onClick={onLoginClick}
      className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition-all flex items-center gap-[clamp(0.25rem,1vw,0.5rem)] group px-[clamp(0.5rem,2vw,1rem)] py-[clamp(0.375rem,1.2vw,0.5rem)] text-[clamp(0.6875rem,calc(1.5vw+0.25rem),0.875rem)] min-h-[2.25rem] sm:min-h-0"
    >
      <Icon type="login" className="w-[clamp(0.875rem,2.5vw,1rem)] h-[clamp(0.875rem,2.5vw,1rem)] shrink-0 group-hover:rotate-12 transition-transform" />
      <span className="hidden xs:inline whitespace-nowrap">{t('login')}</span>
      <span className="xs:hidden whitespace-nowrap">로그인</span>
    </button>
  </div>

  <div className="mb-[clamp(1.25rem,4vw,3rem)] space-y-[clamp(0.5rem,2vw,1rem)] animate-fade-in-up w-full max-w-[min(42rem,100%)] px-[clamp(0.25rem,2vw,0.5rem)]">
    <div className="inline-flex items-center gap-[clamp(0.25rem,1vw,0.5rem)] px-[clamp(0.5rem,2vw,0.75rem)] py-[clamp(0.125rem,0.8vw,0.25rem)] rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-[clamp(0.5625rem,calc(1.2vw+0.2rem),0.75rem)] text-gray-400 mb-[clamp(0.375rem,1.5vw,1rem)]">
      <span className="rounded-full bg-blue-500 animate-pulse shrink-0 w-[clamp(0.25rem,1vw,0.5rem)] h-[clamp(0.25rem,1vw,0.5rem)]" />
      Sportition {t('version')} 2.0
    </div>
    <h1 className="font-bold tracking-tight text-white leading-[1.12] text-[clamp(1.375rem,calc(5vw+0.5rem),4.5rem)] break-keep">
      <span className="block">{t('buildYourLegacy')}</span>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-white">
        {t('buildLegacy')}
      </span>
    </h1>
    <p className="text-gray-400 max-w-[min(36rem,92vw)] mx-auto whitespace-pre-line leading-relaxed text-[clamp(0.75rem,calc(1.6vw+0.35rem),1.125rem)]">
      {t('landingDesc')}
    </p>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-[clamp(0.75rem,2.5vw,1.5rem)] w-full max-w-4xl animate-fade-in-up px-[clamp(0.25rem,1.5vw,0.5rem)]" style={{ animationDelay: '200ms' }}>
    <SpotlightCard 
      onClick={() => onSelectRole('player_common')}
      theme="blue"
      className="p-[clamp(1rem,3vw,2rem)] group text-left min-h-[clamp(11rem,32vh,16rem)] flex flex-col justify-between hover:bg-white/[0.02]"
    >
      <div className="min-w-0">
        <div className="rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 mb-[clamp(0.5rem,2vw,1rem)] group-hover:scale-110 transition-transform w-[clamp(2.25rem,6vw,3rem)] h-[clamp(2.25rem,6vw,3rem)]">
          <Icon type="zap" className="w-[clamp(1.125rem,3vw,1.5rem)] h-[clamp(1.125rem,3vw,1.5rem)]" />
        </div>
        <h3 className="font-bold text-white mb-[clamp(0.25rem,1vw,0.5rem)] group-hover:text-blue-400 transition-colors text-[clamp(1rem,calc(2.4vw+0.25rem),1.5rem)] break-keep">{t('player')}</h3>
        <p className="text-gray-500 whitespace-pre-line leading-relaxed text-[clamp(0.6875rem,calc(1.35vw+0.3rem),0.875rem)]">
          {t('playerDesc')}
        </p>
      </div>
      <div className="flex items-center text-gray-400 group-hover:text-white transition-colors mt-2 text-[clamp(0.6875rem,calc(1.35vw+0.3rem),0.875rem)]">
        <span className="truncate">{t('enterDashboard')}</span>
        <Icon type="arrowRight" className="ml-[clamp(0.375rem,1vw,0.5rem)] shrink-0 w-[clamp(0.75rem,2vw,1rem)] h-[clamp(0.75rem,2vw,1rem)] group-hover:translate-x-1 transition-transform" />
      </div>
    </SpotlightCard>

    <SpotlightCard 
      onClick={() => onSelectRole('gym')} 
      theme="blue"
      className="p-[clamp(1rem,3vw,2rem)] group text-left min-h-[clamp(11rem,32vh,16rem)] flex flex-col justify-between hover:bg-white/[0.02]"
      style={{ '--spotlight-color': '168, 85, 247' }}
    >
      <div className="min-w-0">
        <div className="rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 mb-[clamp(0.5rem,2vw,1rem)] group-hover:scale-110 transition-transform w-[clamp(2.25rem,6vw,3rem)] h-[clamp(2.25rem,6vw,3rem)]">
          <Icon type="home" className="w-[clamp(1.125rem,3vw,1.5rem)] h-[clamp(1.125rem,3vw,1.5rem)]" />
        </div>
        <h3 className="font-bold text-white mb-[clamp(0.25rem,1vw,0.5rem)] group-hover:text-purple-400 transition-colors text-[clamp(1rem,calc(2.4vw+0.25rem),1.5rem)] break-keep">{t('gym')}</h3>
        <p className="text-gray-500 whitespace-pre-line leading-relaxed text-[clamp(0.6875rem,calc(1.35vw+0.3rem),0.875rem)]">
          {t('gymDesc')}
        </p>
      </div>
      <div className="flex items-center text-gray-400 group-hover:text-white transition-colors mt-2 text-[clamp(0.6875rem,calc(1.35vw+0.3rem),0.875rem)]">
        <span className="truncate">{t('openGym')}</span>
        <Icon type="arrowRight" className="ml-[clamp(0.375rem,1vw,0.5rem)] shrink-0 w-[clamp(0.75rem,2vw,1rem)] h-[clamp(0.75rem,2vw,1rem)] group-hover:translate-x-1 transition-transform" />
      </div>
    </SpotlightCard>
  </div>
</div>
  );
};

export { LoginModal, SignupPage, LandingPage };

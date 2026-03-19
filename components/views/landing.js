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

// 회원가입 페이지
const SignupPage = ({ onBack, language, t, onSignupSuccess }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    birthDate: '',
    role: 'athlete',
    membershipType: 'basic'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    try {
      const { signUp } = await import('@/lib/supabase');
      
      const { data, error: signUpError } = await signUp(
        formData.email,
        formData.password,
        {
          name: formData.fullName,
          phone: formData.phone,
          birth_date: formData.birthDate,
          role: formData.role,
          membership_type: formData.membershipType,
        }
      );

      if (signUpError) {
        console.error('Signup error:', signUpError);
        setError(signUpError.message || '회원가입에 실패했습니다.');
        return;
      }

      if (data?.user) {
        alert('회원가입이 완료되었습니다! 이메일을 확인하고 로그인해주세요.');
        onSignupSuccess && onSignupSuccess(data.user);
        onBack();
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
    onClick={onBack}
    className="fixed top-6 left-6 z-50 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm font-medium transition-all flex items-center gap-2"
  >
    <Icon type="arrowRight" size={16} className="rotate-180" />
    {t('back')}
  </button>

  <div className="w-full max-w-lg">
    <SpotlightCard className="p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 mb-4">
          <Icon type="zap" size={24} fill="currentColor" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('createAccount')}</h2>
        <p className="text-gray-500 text-sm">{t('joinCommunity')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">이름</label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder="홍길동"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('email')}</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder="example@email.com"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">전화번호</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder="010-1234-5678"
            required
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">출석 체크 시 마지막 4자리를 사용합니다</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">생년월일</label>
          <input
            type="date"
            value={formData.birthDate}
            onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('password')}</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder="최소 6자 이상"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">비밀번호 확인</label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder="비밀번호 재입력"
            required
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

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('iAm')}</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({...formData, role: 'athlete'})}
              disabled={loading}
              className={`p-3 rounded-lg border transition-all ${
                formData.role === 'athlete' 
                  ? 'border-blue-500 bg-blue-500/10 text-white' 
                  : 'border-white/10 bg-white/5 text-gray-400'
              }`}
            >
              <Icon type="zap" size={20} className="mx-auto mb-1" />
              <span className="text-sm font-medium">{t('athlete')}</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData({...formData, role: 'coach'})}
              disabled={loading}
              className={`p-3 rounded-lg border transition-all ${
                formData.role === 'coach' 
                  ? 'border-emerald-500 bg-emerald-500/10 text-white' 
                  : 'border-white/10 bg-white/5 text-gray-400'
              }`}
            >
              <Icon type="target" size={20} className="mx-auto mb-1" />
              <span className="text-sm font-medium">{t('coach')}</span>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '가입 중...' : t('createAccount')}
        </button>
      </form>
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
<div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-3 sm:p-6 text-center">
  <div className="fixed top-3 right-3 sm:top-6 sm:right-6 z-50 flex items-center gap-2 sm:gap-3">
    <div className="relative" ref={langRef}>
      <button 
        onClick={() => setShowLangMenu(!showLangMenu)}
        className="px-2 py-1.5 sm:px-4 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-2"
      >
        <Icon type="globe" size={14} className="sm:w-4 sm:h-4" />
        <span className="hidden xs:inline">{language === 'ko' ? '한국어' : 'English'}</span>
        <span className="xs:hidden">{language === 'ko' ? 'KR' : 'EN'}</span>
      </button>
      
      {showLangMenu && (
        <div className="absolute top-full right-0 mt-2 w-32 bg-[#0A0A0A] border border-white/10 rounded-lg overflow-hidden shadow-2xl animate-fade-in-up">
          <button
            onClick={() => { setLanguage('ko'); setShowLangMenu(false); }}
            className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between ${
              language === 'ko' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>한국어</span>
            {language === 'ko' && <span className="text-blue-400">✓</span>}
          </button>
          <button
            onClick={() => { setLanguage('en'); setShowLangMenu(false); }}
            className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between ${
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
      className="px-2 py-1.5 sm:px-4 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-2 group"
    >
      <Icon type="login" size={14} className="sm:w-4 sm:h-4 group-hover:rotate-12 transition-transform" />
      <span className="hidden xs:inline">{t('login')}</span>
      <span className="xs:hidden">로그인</span>
    </button>
  </div>

  <div className="mb-6 xs:mb-8 sm:mb-12 space-y-2 xs:space-y-3 sm:space-y-4 animate-fade-in-up px-3 xs:px-4">
    <div className="inline-flex items-center gap-1.5 xs:gap-2 px-2 xs:px-2.5 sm:px-3 py-0.5 xs:py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-[9px] xs:text-[10px] sm:text-xs text-gray-400 mb-1.5 xs:mb-2 sm:mb-4">
      <span className="w-1 h-1 xs:w-1.5 xs:h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 animate-pulse"></span>
      Sportition {t('version')} 2.0
    </div>
    <h1 className="text-2xl xs:text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
      <span className="block">{t('buildYourLegacy')}</span>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-white">
        {t('buildLegacy')}
      </span>
    </h1>
    <p className="text-gray-400 max-w-lg mx-auto text-xs xs:text-sm sm:text-lg whitespace-pre-line leading-relaxed">
      {t('landingDesc')}
    </p>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 xs:gap-4 sm:gap-6 w-full max-w-4xl px-3 xs:px-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
    <SpotlightCard 
      onClick={() => onSelectRole('athlete')} 
      theme="blue"
      className="p-4 xs:p-5 sm:p-8 group text-left h-40 xs:h-48 sm:h-64 flex flex-col justify-between hover:bg-white/[0.02]"
    >
      <div>
        <div className="w-9 h-9 xs:w-10 xs:h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 mb-2 xs:mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
          <Icon type="zap" size={18} className="xs:w-5 xs:h-5 sm:w-6 sm:h-6" />
        </div>
        <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-white mb-1 xs:mb-1.5 sm:mb-2 group-hover:text-blue-400 transition-colors">{t('player')}</h3>
        <p className="text-gray-500 text-[11px] xs:text-xs sm:text-sm whitespace-pre-line leading-relaxed">
          {t('playerDesc')}
        </p>
      </div>
      <div className="flex items-center text-[11px] xs:text-xs sm:text-sm text-gray-400 group-hover:text-white transition-colors">
        {t('enterDashboard')} <Icon type="arrowRight" size={12} className="xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 ml-1.5 xs:ml-2 group-hover:translate-x-1 transition-transform" />
      </div>
    </SpotlightCard>

    <SpotlightCard 
      onClick={() => onSelectRole('coach')} 
      theme="emerald"
      className="p-4 xs:p-5 sm:p-8 group text-left h-40 xs:h-48 sm:h-64 flex flex-col justify-between hover:bg-white/[0.02]"
    >
      <div>
        <div className="w-9 h-9 xs:w-10 xs:h-10 sm:w-12 sm:h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2 xs:mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
          <Icon type="chart" size={18} className="xs:w-5 xs:h-5 sm:w-6 sm:h-6" />
        </div>
        <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-white mb-1 xs:mb-1.5 sm:mb-2 group-hover:text-emerald-400 transition-colors">{t('coach')}</h3>
        <p className="text-gray-500 text-[11px] xs:text-xs sm:text-sm whitespace-pre-line leading-relaxed">
          {t('coachDesc')}
        </p>
      </div>
      <div className="flex items-center text-[11px] xs:text-xs sm:text-sm text-gray-400 group-hover:text-white transition-colors">
        {t('openAdmin')} <Icon type="arrowRight" size={12} className="xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 ml-1.5 xs:ml-2 group-hover:translate-x-1 transition-transform" />
      </div>
    </SpotlightCard>
  </div>
</div>
  );
};

export { LoginModal, SignupPage, LandingPage };

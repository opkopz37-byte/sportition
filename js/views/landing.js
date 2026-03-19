// 랜딩, 로그인, 회원가입 관련 컴포넌트
const { useState, useEffect, useRef } = React;

// 로그인 모달
const LoginModal = ({ isOpen, onClose, onSignup, t = (key) => key }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleLogin = (e) => {
e.preventDefault();
console.log('Login:', username);
onClose();
  };

  return (
<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
  <div className="relative w-full max-w-md mx-4">
    <SpotlightCard className="p-8">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
      >
        <Icon type="x" size={20} />
      </button>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 mb-4">
          <Icon type="zap" size={24} fill="currentColor" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('welcomeBack')}</h2>
        <p className="text-gray-500 text-sm">{t('loginToContinue')}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('username')}</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder={t('username')}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder={t('password')}
            required
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {t('login')} <Icon type="login" size={18} />
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
const SignupPage = ({ onBack, language, t }) => {
  const [formData, setFormData] = useState({
username: '',
email: '',
password: '',
confirmPassword: '',
role: 'athlete'
  });

  const handleSubmit = (e) => {
e.preventDefault();
console.log('Signup:', formData);
onBack();
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
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('username')}</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder="Choose your username"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('email')}</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder={t('email')}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('password')}</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
            placeholder={t('password')}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">{t('iAm')}</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({...formData, role: 'athlete'})}
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
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
        >
          {t('createAccount')}
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

  <div className="mb-8 sm:mb-12 space-y-3 sm:space-y-4 animate-fade-in-up px-4">
    <div className="inline-flex items-center gap-2 px-2 sm:px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-[10px] sm:text-xs text-gray-400 mb-2 sm:mb-4">
      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 animate-pulse"></span>
      Sportition {t('version')} 2.0
    </div>
    <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white">
      <span className="block">{t('buildYourLegacy')}</span>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-white">
        {t('buildLegacy')}
      </span>
    </h1>
    <p className="text-gray-400 max-w-lg mx-auto text-sm sm:text-lg whitespace-pre-line">
      {t('landingDesc')}
    </p>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-4xl px-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
    <SpotlightCard 
      onClick={() => onSelectRole('athlete')} 
      theme="blue"
      className="p-5 sm:p-8 group text-left h-48 sm:h-64 flex flex-col justify-between hover:bg-white/[0.02]"
    >
      <div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
          <Icon type="zap" size={20} className="sm:w-6 sm:h-6" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2 group-hover:text-blue-400 transition-colors">{t('player')}</h3>
        <p className="text-gray-500 text-xs sm:text-sm whitespace-pre-line">
          {t('playerDesc')}
        </p>
      </div>
      <div className="flex items-center text-xs sm:text-sm text-gray-400 group-hover:text-white transition-colors">
        {t('enterDashboard')} <Icon type="arrowRight" size={14} className="sm:w-4 sm:h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </div>
    </SpotlightCard>

    <SpotlightCard 
      onClick={() => onSelectRole('coach')} 
      theme="emerald"
      className="p-5 sm:p-8 group text-left h-48 sm:h-64 flex flex-col justify-between hover:bg-white/[0.02]"
    >
      <div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
          <Icon type="chart" size={20} className="sm:w-6 sm:h-6" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2 group-hover:text-emerald-400 transition-colors">{t('coach')}</h3>
        <p className="text-gray-500 text-xs sm:text-sm whitespace-pre-line">
          {t('coachDesc')}
        </p>
      </div>
      <div className="flex items-center text-xs sm:text-sm text-gray-400 group-hover:text-white transition-colors">
        {t('openAdmin')} <Icon type="arrowRight" size={14} className="sm:w-4 sm:h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </div>
    </SpotlightCard>
  </div>
</div>
  );
};

'use client';

import { PageHeader, SpotlightCard } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

// 통계 뷰
const StyleStatsView = ({ t = (key) => key, setActiveTab }) => {
  const { profile } = useAuth();
  
  return (
  <div className="animate-fade-in-up">
<PageHeader 
  title={t('styleStats')} 
  description={t('analyzePlayingStyle')}
/>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xs:gap-4 mb-4 xs:mb-5 sm:mb-6">
  <SpotlightCard className="p-4 xs:p-5 sm:p-6">
    <div className="flex items-center justify-between mb-3 xs:mb-4">
      <h3 className="text-base xs:text-lg font-bold text-white">{t('offensive')}</h3>
      <span className="text-xl xs:text-2xl font-bold text-blue-400">78%</span>
    </div>
    <div className="w-full bg-white/5 rounded-full h-2 xs:h-2.5 sm:h-3">
      <div className="bg-blue-500 h-2 xs:h-2.5 sm:h-3 rounded-full transition-all" style={{ width: '78%' }}></div>
    </div>
  </SpotlightCard>

  <SpotlightCard className="p-4 xs:p-5 sm:p-6">
    <div className="flex items-center justify-between mb-3 xs:mb-4">
      <h3 className="text-base xs:text-lg font-bold text-white">{t('defensive')}</h3>
      <span className="text-xl xs:text-2xl font-bold text-emerald-400">65%</span>
    </div>
    <div className="w-full bg-white/5 rounded-full h-2 xs:h-2.5 sm:h-3">
      <div className="bg-emerald-500 h-2 xs:h-2.5 sm:h-3 rounded-full transition-all" style={{ width: '65%' }}></div>
    </div>
  </SpotlightCard>
</div>

<SpotlightCard className="p-4 xs:p-5 sm:p-6">
  <h3 className="text-base xs:text-lg font-bold text-white mb-4 xs:mb-5 sm:mb-6">{t('recentMatches')}</h3>
  <div className="space-y-2 xs:space-y-3 sm:space-y-4">
    {[
      { date: '2024-01-15', opponent: '박준혁', result: 'Win', detail: 'KO 3R', type: 'ko' },
      { date: '2024-01-12', opponent: '이성민', result: 'Win', detail: '판정승', type: 'decision' },
      { date: '2024-01-10', opponent: '최동훈', result: 'Loss', detail: '판정패', type: 'decision' },
    ].map((match, i) => (
      <div key={i} className="flex items-center justify-between p-3 xs:p-3.5 sm:p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all gap-2">
        <div className="min-w-0">
          <div className="text-[10px] xs:text-xs sm:text-sm text-gray-400 mb-0.5 xs:mb-1">{match.date}</div>
          <div className="font-bold text-sm xs:text-base text-white truncate">vs. {match.opponent}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`font-bold text-base xs:text-lg mb-0.5 xs:mb-1 ${match.result === 'Win' ? 'text-emerald-400' : 'text-red-400'}`}>
            {match.result === 'Win' ? '승리' : '패배'}
          </div>
          <div className={`text-[9px] xs:text-[10px] sm:text-xs px-1.5 xs:px-2 py-0.5 rounded-full inline-block whitespace-nowrap ${
            match.type === 'ko' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
          }`}>
            {match.detail}
          </div>
        </div>
      </div>
    ))}
  </div>
</SpotlightCard>
  </div>
);
};

export { StyleStatsView };

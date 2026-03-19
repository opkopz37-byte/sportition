// 통계 뷰
const StyleStatsView = ({ t = (key) => key, setActiveTab }) => (
  <div className="animate-fade-in-up">
<PageHeader 
  title={t('styleStats')} 
  description={t('analyzePlayingStyle')}
/>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
  <SpotlightCard className="p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-bold text-white">{t('offensive')}</h3>
      <span className="text-2xl font-bold text-blue-400">78%</span>
    </div>
    <div className="w-full bg-white/5 rounded-full h-3">
      <div className="bg-blue-500 h-3 rounded-full" style={{ width: '78%' }}></div>
    </div>
  </SpotlightCard>

  <SpotlightCard className="p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-bold text-white">{t('defensive')}</h3>
      <span className="text-2xl font-bold text-emerald-400">65%</span>
    </div>
    <div className="w-full bg-white/5 rounded-full h-3">
      <div className="bg-emerald-500 h-3 rounded-full" style={{ width: '65%' }}></div>
    </div>
  </SpotlightCard>
</div>

<SpotlightCard className="p-6">
  <h3 className="text-lg font-bold text-white mb-6">{t('recentMatches')}</h3>
  <div className="space-y-4">
    {[
      { date: '2024-01-15', opponent: '박준혁', result: 'Win', detail: 'KO 3R', type: 'ko' },
      { date: '2024-01-12', opponent: '이성민', result: 'Win', detail: '판정승', type: 'decision' },
      { date: '2024-01-10', opponent: '최동훈', result: 'Loss', detail: '판정패', type: 'decision' },
    ].map((match, i) => (
      <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
        <div>
          <div className="text-sm text-gray-400 mb-1">{match.date}</div>
          <div className="font-bold text-white">vs. {match.opponent}</div>
        </div>
        <div className="text-right">
          <div className={`font-bold text-lg mb-1 ${match.result === 'Win' ? 'text-emerald-400' : 'text-red-400'}`}>
            {match.result === 'Win' ? '승리' : '패배'}
          </div>
          <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${
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

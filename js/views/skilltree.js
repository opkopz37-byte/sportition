// 스킬 트리 뷰
const SkillTreeView = ({ t = (key) => key, setActiveTab }) => (
  <div className="animate-fade-in-up">
<PageHeader 
  title={t('skillTree')} 
  description={t('unlockAndUpgrade')}
/>

<div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
  <SpotlightCard className="p-3 sm:p-5">
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
        <Icon type="zap" size={16} className="sm:w-5 sm:h-5 text-blue-400" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{t('totalPoints')}</div>
        <div className="text-base sm:text-xl font-bold text-white whitespace-nowrap">1,250</div>
      </div>
    </div>
  </SpotlightCard>

  <SpotlightCard className="p-3 sm:p-5">
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
        <Icon type="star" size={16} className="sm:w-5 sm:h-5 text-emerald-400" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{t('unlockedSkills')}</div>
        <div className="text-base sm:text-xl font-bold text-white whitespace-nowrap">12/30</div>
      </div>
    </div>
  </SpotlightCard>

  <SpotlightCard className="p-3 sm:p-5">
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
        <Icon type="trophy" size={16} className="sm:w-5 sm:h-5 text-purple-400" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{t('masteryLevel')}</div>
        <div className="text-base sm:text-xl font-bold text-white whitespace-nowrap">{t('advanced')}</div>
      </div>
    </div>
  </SpotlightCard>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
  {[
    { name: '강력한 훅', nameEn: 'Power Hook', level: 2 },
    { name: '카운터 펀치', nameEn: 'Counter Punch', level: 3 },
    { name: '슬립 & 롤', nameEn: 'Slip & Roll', level: 4 },
    { name: '스태미나 부스트', nameEn: 'Stamina Boost', level: 5 }
  ].map((skill, i) => (
    <SpotlightCard key={skill.nameEn} className="p-3 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm sm:text-base font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{t('hi') === '안녕하세요' ? skill.name : skill.nameEn}</h3>
        <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-blue-500/20 text-blue-400 whitespace-nowrap flex-shrink-0">Lv. {skill.level}</span>
      </div>
      <p className="text-[10px] sm:text-xs text-gray-400 mb-2 sm:mb-3">{t('hi') === '안녕하세요' ? '스킬 설명이 여기에 표시됩니다.' : 'Skill description will be displayed here.'}</p>
      <div className="w-full bg-white/5 rounded-full h-1.5 sm:h-2">
        <div className="bg-blue-500 h-1.5 sm:h-2 rounded-full" style={{ width: `${(i + 1) * 20}%` }}></div>
      </div>
    </SpotlightCard>
  ))}
</div>
  </div>
);

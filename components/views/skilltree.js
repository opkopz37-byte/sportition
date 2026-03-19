'use client';

import { Icon, PageHeader, SpotlightCard } from '@/components/ui';

// 스킬 정보 뷰 - 회원의 스킬 정보를 정리한 페이지
const SkillTreeView = ({ t = (key) => key, setActiveTab }) => (
  <div className="animate-fade-in-up">
    <PageHeader 
      title={t('skillTree')} 
      description="스킬 목록과 레벨을 확인하세요"
    />

    <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-2 xs:gap-2.5 sm:gap-3 mb-3 xs:mb-4 sm:mb-6">
      <SpotlightCard className="p-2.5 xs:p-3 sm:p-5">
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3">
          <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Icon type="zap" size={14} className="xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] xs:text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">총 스킬 포인트</div>
            <div className="text-sm xs:text-base sm:text-xl font-bold text-white whitespace-nowrap">1,250</div>
          </div>
        </div>
      </SpotlightCard>

      <SpotlightCard className="p-2.5 xs:p-3 sm:p-5">
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3">
          <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Icon type="star" size={14} className="xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] xs:text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">습득 스킬</div>
            <div className="text-sm xs:text-base sm:text-xl font-bold text-white whitespace-nowrap">12/30</div>
          </div>
        </div>
      </SpotlightCard>

      <SpotlightCard className="p-2.5 xs:p-3 sm:p-5 xs:col-span-2 md:col-span-1">
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3">
          <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Icon type="trophy" size={14} className="xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] xs:text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">숙련도</div>
            <div className="text-sm xs:text-base sm:text-xl font-bold text-white whitespace-nowrap">고급</div>
          </div>
        </div>
      </SpotlightCard>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 xs:gap-2.5 sm:gap-3">
      {[
        { name: '강력한 훅', nameEn: 'Power Hook', level: 2, type: 'offensive' },
        { name: '카운터 펀치', nameEn: 'Counter Punch', level: 3, type: 'defensive' },
        { name: '슬립 & 롤', nameEn: 'Slip & Roll', level: 4, type: 'utility' },
        { name: '스태미나 부스트', nameEn: 'Stamina Boost', level: 5, type: 'special' }
      ].map((skill, i) => (
        <SpotlightCard key={skill.nameEn} className="p-2.5 xs:p-3 sm:p-5">
          <div className="flex items-center justify-between mb-1.5 xs:mb-2">
            <h3 className="text-xs xs:text-sm sm:text-base font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{t('hi') === '안녕하세요' ? skill.name : skill.nameEn}</h3>
            <span className="text-[9px] xs:text-[10px] sm:text-xs px-1.5 xs:px-2 py-0.5 xs:py-1 rounded bg-blue-500/20 text-blue-400 whitespace-nowrap flex-shrink-0">Lv. {skill.level}</span>
          </div>
          <p className="text-[9px] xs:text-[10px] sm:text-xs text-gray-400 mb-1.5 xs:mb-2 sm:mb-3 line-clamp-2">
            {t('hi') === '안녕하세요' ? '스킬 효과와 설명이 표시됩니다.' : 'Skill effect and description will be displayed here.'}
          </p>
          <div className="w-full bg-white/5 rounded-full h-1.5 xs:h-2">
            <div className="bg-blue-500 h-1.5 xs:h-2 rounded-full transition-all" style={{ width: `${(i + 1) * 20}%` }}></div>
          </div>
        </SpotlightCard>
      ))}
    </div>
  </div>
);

export { SkillTreeView };

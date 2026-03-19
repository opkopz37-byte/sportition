'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui';

const ActiveSkillsView = ({ t = (key) => key, setActiveTab, addSkillRequest }) => {
  const [talentPoints, setTalentPoints] = useState(40);
  
  // 초기 스킬 레벨 (중앙 노드는 항상 활성화)
  const [skills, setSkills] = useState({
    100: 1,  // 중앙 특성 노드
    4: 1,    // 원 투 훅
    5: 2,    // 원 앞 옆
    10: 3,   // 원 족 (오른쪽)
    11: 2,   // 원 두 옆
    12: 1,   // 백 투 훅
  });

  // 중앙에서 시작하는 스킬 노드 데이터
  const baseSkillNodes = [
    // 중앙 시작 노드
    { id: 100, x: 50, y: 50, name: '복싱\n기본기', maxLevel: 1, type: 'star', size: 'star' },
    
    // 왼쪽 상단 경로 (파란색 영역)
    { id: 1, x: 38, y: 38, name: '원툭투', maxLevel: 3, type: 'offensive', size: 'medium' },
    { id: 2, x: 28, y: 30, name: '원백투', maxLevel: 5, type: 'offensive', size: 'medium' },
    { id: 3, x: 35, y: 25, name: '타이슨의\n워먼더\n블록', maxLevel: 5, type: 'offensive', size: 'small' },
    { id: 4, x: 42, y: 32, name: '원 투 훅', maxLevel: 5, type: 'offensive', size: 'medium' },
    { id: 5, x: 35, y: 18, name: '원 앞 옆', maxLevel: 5, type: 'offensive', size: 'medium' },
    { id: 6, x: 28, y: 42, name: '원백\n다리잡기\n사이드 스텝', maxLevel: 5, type: 'offensive', size: 'small' },
    { id: 7, x: 20, y: 35, name: '발놀림', maxLevel: 5, type: 'offensive', size: 'medium' },
    { id: 8, x: 22, y: 22, name: '번개잽', maxLevel: 5, type: 'offensive', size: 'large' },
    { id: 9, x: 12, y: 28, name: '스피드\n스터', maxLevel: 5, type: 'offensive', size: 'large' },
    
    // 오른쪽 하단 경로 (빨간색 영역)
    { id: 10, x: 58, y: 55, name: '원 족', maxLevel: 5, type: 'defensive', size: 'large' },
    { id: 11, x: 65, y: 60, name: '원 두 옆', maxLevel: 5, type: 'defensive', size: 'large' },
    { id: 12, x: 72, y: 65, name: '백 투 훅\n(몸 옆)', maxLevel: 5, type: 'defensive', size: 'large' },
    { id: 13, x: 62, y: 68, name: '투 훅\n(몸 옆 턴)', maxLevel: 5, type: 'defensive', size: 'medium' },
    { id: 14, x: 70, y: 73, name: '투 훅\n원 백', maxLevel: 5, type: 'defensive', size: 'medium' },
    { id: 15, x: 78, y: 70, name: '스쿼피\n피 옷', maxLevel: 5, type: 'defensive', size: 'medium' },
    { id: 16, x: 72, y: 78, name: '소렐티\n메이너괸', maxLevel: 5, type: 'defensive', size: 'medium' },
    { id: 17, x: 80, y: 78, name: '소렉', maxLevel: 5, type: 'defensive', size: 'small' },
    { id: 18, x: 85, y: 72, name: '철벽수비', maxLevel: 5, type: 'defensive', size: 'large' },
    { id: 19, x: 88, y: 65, name: '무적의 벽', maxLevel: 5, type: 'defensive', size: 'large' },
  ];

  const skillNodes = baseSkillNodes.map(node => ({
    ...node,
    level: skills[node.id] || 0
  }));

  const connections = [
    // 중앙에서 왼쪽 상단으로
    [100, 1], [1, 2], [1, 3], [1, 4], [4, 5], [1, 6], [2, 7], [5, 8], [8, 9],
    // 중앙에서 오른쪽 하단으로
    [100, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [12, 16], [16, 17], [15, 18], [18, 19],
  ];

  const tierInfo = [
    { name: '아이언', icon: '⚫', desc: '기본 스킬' },
    { name: '브론즈', icon: '🟤', desc: '초급 스킬' },
    { name: '실버', icon: '⚪', desc: '중급 스킬' },
    { name: '골드', icon: '🟡', desc: '고급 스킬' },
    { name: '에메랄드', icon: '🟢', desc: '숙련 스킬' },
    { name: '다이아', icon: '🔵', desc: '엘리트 스킬' },
    { name: '챌린저', icon: '🟣', desc: '전설 스킬' },
  ];

  const getNodeSize = (size) => {
    if (size === 'star') return 'w-16 h-16 sm:w-20 sm:h-20';
    if (size === 'large') return 'w-14 h-14 sm:w-16 sm:h-16';
    if (size === 'medium') return 'w-12 h-12 sm:w-14 sm:h-14';
    return 'w-10 h-10 sm:w-12 sm:h-12';
  };

  const getNodeColor = (type, level) => {
    if (type === 'star') {
      return level > 0 
        ? 'bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 border-yellow-300 shadow-2xl shadow-yellow-500/60' 
        : 'bg-gradient-to-br from-gray-800 to-black border-gray-700 shadow-lg';
    }
    if (type === 'offensive') {
      return level > 0 
        ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 border-blue-300 shadow-xl shadow-blue-500/60' 
        : 'bg-gradient-to-br from-gray-800 to-black border-gray-700 shadow-lg';
    }
    if (type === 'defensive') {
      return level > 0 
        ? 'bg-gradient-to-br from-red-500 via-rose-600 to-red-700 border-red-300 shadow-xl shadow-red-500/60' 
        : 'bg-gradient-to-br from-gray-800 to-black border-gray-700 shadow-lg';
    }
    if (type === 'utility') {
      return level > 0 
        ? 'bg-gradient-to-br from-green-500 via-emerald-600 to-green-700 border-green-300 shadow-xl shadow-green-500/60' 
        : 'bg-gradient-to-br from-gray-800 to-black border-gray-700 shadow-lg';
    }
    if (type === 'special') {
      return level > 0 
        ? 'bg-gradient-to-br from-purple-500 via-violet-600 to-purple-700 border-purple-300 shadow-xl shadow-purple-500/60' 
        : 'bg-gradient-to-br from-gray-800 to-black border-gray-700 shadow-lg';
    }
    if (type === 'elite') {
      return level > 0 
        ? 'bg-gradient-to-br from-orange-500 via-amber-600 to-yellow-600 border-orange-300 shadow-xl shadow-orange-500/60' 
        : 'bg-gradient-to-br from-gray-800 to-black border-gray-700 shadow-lg';
    }
    return 'bg-gradient-to-br from-gray-800 to-black border-gray-700 shadow-lg';
  };

  const handleSkillClick = (node) => {
    const currentLevel = skills[node.id] || 0;
    if (talentPoints > 0 && currentLevel < node.maxLevel) {
      setSkills({ ...skills, [node.id]: currentLevel + 1 });
      setTalentPoints(talentPoints - 1);
    }
  };

  return (
    <div className="relative -m-2 xs:-m-3 sm:-m-4 lg:-m-6 min-h-screen overflow-hidden">
      {/* 대각선 배경 - 오른쪽 아래에서 왼쪽 위로 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* 파란색 영역 (왼쪽 상단) */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-blue-950 via-blue-900/70 to-transparent opacity-90"
          style={{ clipPath: 'polygon(0 0, 100% 0, 49% 100%, 0 100%)' }}
        />
        
        {/* 빨간색 영역 (오른쪽 하단) */}
        <div 
          className="absolute inset-0 bg-gradient-to-tl from-red-950 via-red-900/70 to-transparent opacity-90"
          style={{ clipPath: 'polygon(51% 0, 100% 0, 100% 100%, 0 100%)' }}
        />
        
        {/* 얇은 중앙 블렌드 라인 */}
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-black/60 to-transparent"
          style={{ clipPath: 'polygon(49% 0, 51% 0, 51% 100%, 49% 100%)' }}
        />
        
        {/* 별 효과 */}
        <div className="absolute inset-0">
          {[...Array(80)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.7 + 0.3,
                animation: `pulse ${Math.random() * 3 + 2}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`
              }}
            />
          ))}
        </div>

        {/* 다이아몬드 반짝임 효과 */}
        <div className="absolute top-1/4 right-1/4 w-2 h-2 text-white text-2xl opacity-80 animate-pulse">✦</div>
        <div className="absolute top-1/2 right-1/3 w-2 h-2 text-white text-xl opacity-60 animate-pulse" style={{ animationDelay: '0.5s' }}>✦</div>
        <div className="absolute top-2/3 right-1/5 w-2 h-2 text-white text-lg opacity-70 animate-pulse" style={{ animationDelay: '1s' }}>✦</div>

        {/* 중앙 발광 효과 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-500/10 rounded-full blur-[150px] animate-pulse-slow" />
      </div>

      {/* 헤더 */}
      <div className="relative z-10 flex items-center justify-between p-3 sm:p-4 md:p-6">
        <button 
          onClick={() => setActiveTab('roadmap-skill-tree')}
          className="flex items-center gap-1 sm:gap-2 text-white hover:text-blue-400 transition-colors group"
        >
          <Icon type="chevronLeft" size={20} className="sm:w-6 sm:h-6 group-hover:-translate-x-1 transition-transform" />
          <span className="text-base sm:text-xl md:text-2xl font-bold tracking-wider">SET TALENT</span>
        </button>
        
        <div className="flex items-center gap-1.5 sm:gap-3">
          <span className="text-xs sm:text-sm md:text-base text-gray-400 whitespace-nowrap">Talent point:</span>
          <span className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-400">{talentPoints}</span>
        </div>
      </div>

      {/* 우측 티어 정보 표시 (선택 불가) */}
      <div className="absolute top-16 right-2 sm:top-20 sm:right-4 md:right-6 z-20 flex flex-col gap-1.5 sm:gap-2">
        {tierInfo.map((tier, index) => (
          <div
            key={tier.name}
            className="relative group"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg sm:text-xl md:text-2xl bg-black/60 backdrop-blur-sm shadow-lg border border-white/20">
              {tier.icon}
            </div>
            
            {/* 호버 툴팁 */}
            <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-black/95 border border-white/30 rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm whitespace-nowrap">
                <div className="text-xs sm:text-sm font-bold text-white">{tier.name}</div>
                <div className="text-[10px] sm:text-xs text-gray-400">{tier.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 스킬 트리 캔버스 */}
      <div className="relative z-10 w-full overflow-x-auto" style={{ height: 'calc(100vh - 130px)', minHeight: '500px' }}>
        <div className="relative w-full h-full min-w-[700px]">
          {/* 연결선 */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            {connections.map(([from, to], idx) => {
              const nodeFrom = skillNodes.find(n => n.id === from);
              const nodeTo = skillNodes.find(n => n.id === to);
              if (!nodeFrom || !nodeTo) return null;
              
              const fromLevel = nodeFrom.level;
              const toLevel = nodeTo.level;
              const isActive = fromLevel > 0 && toLevel > 0;
              
              // 영역에 따라 색상 결정
              let color = 'rgba(107, 114, 128, 0.3)';
              if (isActive) {
                if (nodeTo.type === 'defensive' || nodeTo.type === 'special' || nodeTo.type === 'elite') {
                  color = 'rgba(239, 68, 68, 0.8)';
                } else {
                  color = 'rgba(59, 130, 246, 0.8)';
                }
              }
              
              return (
                <line
                  key={idx}
                  x1={`${nodeFrom.x}%`}
                  y1={`${nodeFrom.y}%`}
                  x2={`${nodeTo.x}%`}
                  y2={`${nodeTo.y}%`}
                  stroke={color}
                  strokeWidth={isActive ? '3' : '2'}
                  strokeDasharray={isActive ? '0' : '5,5'}
                  style={{
                    filter: isActive ? `drop-shadow(0 0 8px ${color})` : 'none',
                    transition: 'all 0.3s ease'
                  }}
                />
              );
            })}
          </svg>

          {/* 스킬 노드 */}
          <div className="relative w-full h-full" style={{ zIndex: 2 }}>
            {skillNodes.map((node) => (
              <div
                key={node.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                {/* 발광 효과 */}
                {node.level > 0 && (
                  <div 
                    className={`absolute inset-0 rounded-full blur-xl animate-pulse-slow ${
                      node.type === 'star' ? 'bg-yellow-500' :
                      node.type === 'defensive' || node.type === 'special' || node.type === 'elite' ? 'bg-red-500' : 
                      'bg-blue-500'
                    }`}
                    style={{ transform: 'scale(1.6)', opacity: 0.5 }}
                  />
                )}
                
                {/* 노드 본체 */}
                <div
                  onClick={() => handleSkillClick(node)}
                  className={`relative ${getNodeSize(node.size)} rounded-full border-3 flex items-center justify-center transition-all duration-300 cursor-pointer group ${getNodeColor(node.type, node.level)} ${
                    node.level > 0 ? 'hover:scale-110' : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  {/* 노드 라벨 (아래에 표시) */}
                  <div className="absolute top-full mt-1.5 sm:mt-2 text-center w-20 sm:w-24">
                    <div className={`text-[8px] sm:text-[9px] md:text-[10px] font-bold whitespace-pre-line leading-tight ${
                      node.level > 0 ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-gray-600'
                    }`}>
                      {node.name}
                    </div>
                  </div>

                  {/* 레벨 표시 */}
                  {node.level > 0 && node.type !== 'star' && (
                    <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 border-2 border-white flex items-center justify-center shadow-lg shadow-yellow-500/50">
                      <span className="text-[10px] sm:text-xs font-bold text-white">{node.level}</span>
                    </div>
                  )}

                  {/* 레벨업 가능 표시 */}
                  {node.level < node.maxLevel && talentPoints > 0 && (
                    <div className="absolute -top-1.5 -left-1.5 sm:-top-2 sm:-left-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-white flex items-center justify-center animate-bounce shadow-lg shadow-green-500/50">
                      <span className="text-[10px] sm:text-xs font-bold text-white">+</span>
                    </div>
                  )}
                </div>

                {/* 호버 툴팁 */}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-10 sm:mt-14 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  <div className="bg-black/95 border-2 border-white/30 rounded-lg px-3 py-2 sm:px-4 sm:py-3 shadow-2xl backdrop-blur-sm min-w-[180px] sm:min-w-[220px]">
                    <div className="font-bold text-white text-xs sm:text-sm mb-1 whitespace-pre-line leading-tight">{node.name}</div>
                    <div className="text-[10px] sm:text-xs text-gray-400 mb-2">
                      레벨: {node.level} / {node.maxLevel}
                    </div>
                    {node.level < node.maxLevel && talentPoints > 0 && (
                      <div className="text-[10px] sm:text-xs text-emerald-400 font-bold">
                        ✨ 클릭하여 레벨업!
                      </div>
                    )}
                    {talentPoints === 0 && node.level < node.maxLevel && (
                      <div className="text-[10px] sm:text-xs text-red-400 font-bold">
                        탤런트 포인트가 부족합니다
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 안내 */}
      <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 xs:gap-3 sm:gap-4 md:gap-6 text-[10px] xs:text-xs sm:text-sm text-gray-400">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 border border-blue-300 flex-shrink-0 shadow-lg shadow-blue-500/50" />
          <span className="whitespace-nowrap">오펜시브</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br from-red-500 to-rose-600 border border-red-300 flex-shrink-0 shadow-lg shadow-red-500/50" />
          <span className="whitespace-nowrap">디펜시브</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 border border-yellow-300 flex-shrink-0 shadow-lg shadow-yellow-500/50" />
          <span className="whitespace-nowrap">특성</span>
        </div>
      </div>
    </div>
  );
};

export { ActiveSkillsView };

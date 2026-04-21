// 스킬 관련 뷰들
// 스킬 관련 뷰들
const { useState } = React;

const ActiveSkillsView = ({ t = (key) => key, setActiveTab, addSkillRequest }) => {
  // 스킬 레벨 시스템 (각 스킬은 0~maxLevel까지 레벨업 가능)
  const [skillLevels, setSkillLevels] = useState({
    1: 3, // 스킬 ID: 현재 레벨
  });
  const [availablePoints, setAvailablePoints] = useState(5); // 출석으로 얻은 포인트
  const [hoveredSkill, setHoveredSkill] = useState(null); // 현재 호버 중인 스킬

  // === 복싱 스킬 트리 ===
  const skillNodes = [
    // 중앙 시작 노드
    { id: 1, x: 50, y: 50, size: 'large', type: 'core', name: '복싱 기본기', desc: '모든 능력 +1%', icon: '🥊', maxLevel: 3, requires: [] },
    
    // === 상단 경로 (파워 펀치) ===
    { id: 2, x: 50, y: 40, size: 'small', type: 'offensive', name: '펀치력', desc: '펀치 데미지 +2%', icon: '👊', maxLevel: 5, requires: [1] },
    { id: 3, x: 50, y: 30, size: 'medium', type: 'offensive', name: '헤비 블로우', desc: '펀치 데미지 +4%', icon: '💥', maxLevel: 7, requires: [2] },
    { id: 101, x: 50, y: 20, size: 'star', type: 'star', name: '⭐ 녹아웃킹', desc: 'KO의 달인', icon: '⭐', isStar: true, starLevel: 1, requires: [3] },
    { id: 4, x: 50, y: 10, size: 'large', type: 'elite', name: '원펀치맨', desc: '최종 펀치력 +10%', icon: '🔥', maxLevel: 10, requires: [101] },
    
    // === 우측 경로 (스피드) ===
    { id: 5, x: 60, y: 50, size: 'small', type: 'utility', name: '발놀림', desc: '이동속도 +2%', icon: '⚡', maxLevel: 5, requires: [1] },
    { id: 6, x: 70, y: 50, size: 'medium', type: 'utility', name: '번개잽', desc: '펀치속도 +4%', icon: '💨', maxLevel: 7, requires: [5] },
    { id: 102, x: 80, y: 50, size: 'star', type: 'star', name: '⭐ 스피드스터', desc: '속도의 극한', icon: '⭐', isStar: true, starLevel: 2, requires: [6] },
    { id: 7, x: 90, y: 50, size: 'large', type: 'elite', name: '번개주먹', desc: '공격속도 +15%', icon: '🌪️', maxLevel: 10, requires: [102] },
    
    // === 하단 경로 (디펜스) ===
    { id: 8, x: 50, y: 60, size: 'small', type: 'defensive', name: '가드 자세', desc: '방어력 +2%', icon: '🛡️', maxLevel: 5, requires: [1] },
    { id: 9, x: 50, y: 70, size: 'medium', type: 'defensive', name: '철벽수비', desc: '방어력 +4%', icon: '🔰', maxLevel: 7, requires: [8] },
    { id: 103, x: 50, y: 80, size: 'star', type: 'star', name: '⭐ 디펜스마스터', desc: '방어의 극한', icon: '⭐', isStar: true, starLevel: 3, requires: [9] },
    { id: 10, x: 50, y: 90, size: 'large', type: 'elite', name: '무적의 벽', desc: '피해 감소 +20%', icon: '🏰', maxLevel: 10, requires: [103] },
    
    // === 좌측 경로 (테크닉) ===
    { id: 11, x: 40, y: 50, size: 'small', type: 'special', name: '정타', desc: '명중률 +2%', icon: '🎯', maxLevel: 5, requires: [1] },
    { id: 12, x: 30, y: 50, size: 'medium', type: 'special', name: '카운터', desc: '명중률 +4%', icon: '👁️', maxLevel: 7, requires: [11] },
    { id: 104, x: 20, y: 50, size: 'star', type: 'star', name: '⭐ 테크니션', desc: '기술의 극한', icon: '⭐', isStar: true, starLevel: 4, requires: [12] },
    { id: 13, x: 10, y: 50, size: 'large', type: 'elite', name: '퍼펙트 복서', desc: '치명타율 +25%', icon: '🏹', maxLevel: 10, requires: [104] },
  ];

  // 연결선 데이터 (십자가 패턴)
  const connections = [
    // 상단 경로
    [1, 2], [2, 3], [3, 101], [101, 4],
    // 우측 경로
    [1, 5], [5, 6], [6, 102], [102, 7],
    // 하단 경로
    [1, 8], [8, 9], [9, 103], [103, 10],
    // 좌측 경로
    [1, 11], [11, 12], [12, 104], [104, 13],
  ];

  const getNodeColor = (type) => {
    const colors = {
      core: { gradient: 'from-purple-400 via-pink-500 to-purple-600', glow: '#A855F7', shadow: 'shadow-purple-500/50' },
      offensive: { gradient: 'from-red-400 via-orange-500 to-red-600', glow: '#EF4444', shadow: 'shadow-red-500/50' },
      defensive: { gradient: 'from-blue-400 via-cyan-500 to-blue-600', glow: '#3B82F6', shadow: 'shadow-blue-500/50' },
      utility: { gradient: 'from-green-400 via-emerald-500 to-green-600', glow: '#10B981', shadow: 'shadow-green-500/50' },
      special: { gradient: 'from-yellow-400 via-amber-500 to-yellow-600', glow: '#FBBF24', shadow: 'shadow-yellow-500/50' },
      hybrid: { gradient: 'from-indigo-400 via-purple-500 to-indigo-600', glow: '#6366F1', shadow: 'shadow-indigo-500/50' },
      elite: { gradient: 'from-pink-400 via-rose-500 to-pink-600', glow: '#EC4899', shadow: 'shadow-pink-500/50' },
      star: { gradient: 'from-yellow-300 via-amber-400 to-yellow-500', glow: '#FBBF24', shadow: 'shadow-yellow-400/60' },
    };
    return colors[type] || { gradient: 'from-gray-500 to-gray-600', glow: '#6B7280', shadow: 'shadow-gray-500/50' };
  };

  const getNodeSize = (size) => {
    if (size === 'star') return 'w-10 h-10 sm:w-12 sm:h-12 text-lg sm:text-xl';
    if (size === 'large') return 'w-8 h-8 sm:w-10 sm:h-10 text-base sm:text-lg';
    if (size === 'medium') return 'w-7 h-7 sm:w-8 sm:h-8 text-sm sm:text-base';
    return 'w-5 h-5 sm:w-6 sm:h-6 text-xs sm:text-sm';
  };

  // 스킬의 현재 레벨 가져오기
  const getSkillLevel = (id) => skillLevels[id] || 0;

  // 스킬이 마스터되었는지 확인
  const isSkillMastered = (id) => {
    const node = skillNodes.find(n => n.id === id);
    return node && getSkillLevel(id) >= node.maxLevel;
  };

  // 스킬을 배울 수 있는지 확인 (전제조건 충족 여부)
  const canLearnSkill = (node) => {
    if (node.isStar) return false; // 별 노드는 특별 처리
    if (!node.requires || node.requires.length === 0) return true; // 전제조건 없음
    return node.requires.every(reqId => isSkillMastered(reqId)); // 모든 전제 스킬이 마스터되어야 함
  };

  // 스킬 레벨업
  const handleNodeClick = (node) => {
    if (node.isStar) {
      // 별 노드 - 챔피언 테스트
      const canTest = node.requires.every(reqId => isSkillMastered(reqId));
      if (canTest) {
        alert(`${node.name}\n\n챔피언 테스트를 시작하시겠습니까?\n\n해금 조건을 모두 충족했습니다!`);
      } else {
        alert(`${node.name}\n\n아직 테스트에 도전할 수 없습니다.\n\n전제 스킬을 모두 마스터해야 합니다.`);
      }
      return;
    }

    const currentLevel = getSkillLevel(node.id);
    
    // 레벨업 가능 조건: 포인트 있음 + 아직 만렙 아님 + 전제조건 충족
    if (availablePoints > 0 && currentLevel < node.maxLevel && canLearnSkill(node)) {
      setSkillLevels({ ...skillLevels, [node.id]: currentLevel + 1 });
      setAvailablePoints(availablePoints - 1);
    }
  };

  const masteredCount = skillNodes.filter(n => !n.isStar && isSkillMastered(n.id)).length;
  const totalSkills = skillNodes.filter(n => !n.isStar).length;

  return (
    <div className="animate-fade-in-up">
      {/* 헤더 */}
      <PageHeader 
        title={t('activeSkills')} 
        description="출석하고 포인트를 얻어 스킬을 강화하세요"
        onBack={() => setActiveTab('roadmap-skill-tree')}
      >
        {/* 포인트 표시 */}
        <SpotlightCard className="px-3 sm:px-5 py-2 sm:py-3 bg-blue-500/10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-center">
              <div className="text-[9px] sm:text-[10px] text-gray-400 mb-0.5 whitespace-nowrap">보유 포인트</div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-400">{availablePoints}</div>
            </div>
            <div className="h-8 sm:h-10 w-[1px] bg-white/10" />
            <div className="text-center">
              <div className="text-[9px] sm:text-[10px] text-gray-400 mb-0.5 whitespace-nowrap">마스터</div>
              <div className="text-base sm:text-lg lg:text-xl font-bold text-emerald-400 whitespace-nowrap">{masteredCount}/{totalSkills}</div>
            </div>
          </div>
        </SpotlightCard>
      </PageHeader>

      <div className="mb-4 sm:mb-6">

        {/* 별 노드 진행 상황 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-black/30 rounded-lg sm:rounded-xl p-2.5 sm:p-3 border border-white/5 gap-2">
          <span className="text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">🏆 성장 로드맵</span>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full sm:w-auto">
            {[1, 2, 3, 4].map((starNum) => {
              const starNode = skillNodes.find(n => n.starLevel === starNum);
              const unlocked = starNode && skillLevels[starNode.id] > 0;
              const canTest = starNode && starNode.requires.every(reqId => isSkillMastered(reqId));
              
              return (
                <div key={starNum} className="flex items-center gap-1 sm:gap-1.5">
                  <div className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                    unlocked
                      ? 'bg-yellow-500/30 text-yellow-300 border-2 border-yellow-400'
                      : canTest
                      ? 'bg-yellow-500/10 text-yellow-500 border-2 border-yellow-600 animate-pulse'
                      : 'bg-white/5 text-gray-600 border border-white/10'
                  }`}>
                    ⭐ {starNum}
                  </div>
                  {starNum < 4 && <div className="w-3 sm:w-4 h-[1px] sm:h-[2px] bg-white/10" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        {/* 스킬 트리 메인 - 전체 너비 사용 */}
        <div>
          <SpotlightCard className="p-3 sm:p-6 bg-gradient-to-br from-[#0a0a1a] to-[#050508] relative overflow-hidden" style={{ minHeight: '450px' }}>
            {/* 중앙 발광 효과 */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
            
            {/* 원형 패턴 배경 */}
            <div className="absolute inset-0 opacity-5" style={{
              backgroundImage: `
                radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.2) 0%, transparent 50%),
                radial-gradient(circle at 50% 50%, transparent 20%, rgba(59, 130, 246, 0.1) 20%, rgba(59, 130, 246, 0.1) 21%, transparent 21%),
                radial-gradient(circle at 50% 50%, transparent 40%, rgba(59, 130, 246, 0.1) 40%, rgba(59, 130, 246, 0.1) 41%, transparent 41%),
                radial-gradient(circle at 50% 50%, transparent 60%, rgba(59, 130, 246, 0.1) 60%, rgba(59, 130, 246, 0.1) 61%, transparent 61%)
              `
            }} />
            
            {/* 그리드 효과 */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 1px, transparent 1px)',
              backgroundSize: '30px 30px'
            }} />

            {/* 연결선 */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
              {connections.map(([from, to], idx) => {
                const nodeFrom = skillNodes.find(n => n.id === from);
                const nodeTo = skillNodes.find(n => n.id === to);
                if (!nodeFrom || !nodeTo) return null;
                const isActive = getSkillLevel(from) > 0 && getSkillLevel(to) > 0;
                
                return (
                  <line
                    key={idx}
                    x1={`${nodeFrom.x}%`}
                    y1={`${nodeFrom.y}%`}
                    x2={`${nodeTo.x}%`}
                    y2={`${nodeTo.y}%`}
                    stroke={isActive ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255, 255, 255, 0.1)'}
                    strokeWidth={isActive ? '3' : '2'}
                    style={{
                      filter: isActive ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.8))' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  />
                );
              })}
            </svg>

            {/* 스킬 노드들 */}
            <div className="relative w-full h-full" style={{ minHeight: '450px', zIndex: 2 }}>
              {skillNodes.map((node) => {
                const currentLevel = getSkillLevel(node.id);
                const isMastered = isSkillMastered(node.id);
                const canLearn = canLearnSkill(node);
                const hasLevel = currentLevel > 0;
                const colorData = getNodeColor(node.type);
                
                return (
                  <div
                    key={node.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all duration-300"
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() => setHoveredSkill(node.id)}
                    onMouseLeave={() => setHoveredSkill(null)}
                  >
                    {/* 별 노드 특수 효과 */}
                    {node.isStar && (
                      <div className="absolute inset-0 rounded-full blur-xl opacity-50 bg-gradient-to-br from-yellow-400 to-amber-500 animate-pulse-slow" 
                           style={{ transform: 'scale(2)' }} />
                    )}
                    
                    {/* 발광 효과 */}
                    {hasLevel && !node.isStar && (
                      <div className={`absolute inset-0 rounded-full blur-lg opacity-50 bg-gradient-to-br ${colorData.gradient}`} 
                           style={{ transform: 'scale(1.5)' }} />
                    )}
                    
                    {/* 노드 본체 */}
                    <div className={`relative ${getNodeSize(node.size)} rounded-full border-2 flex flex-col items-center justify-center transition-all duration-300 ${
                      node.isStar
                        ? 'bg-gradient-to-br from-yellow-500 to-amber-600 border-yellow-300 shadow-2xl'
                        : isMastered
                        ? `bg-gradient-to-br ${colorData.gradient} border-white shadow-2xl`
                        : hasLevel
                        ? `bg-gradient-to-br ${colorData.gradient} border-white/40 shadow-lg`
                        : canLearn && availablePoints > 0
                        ? 'bg-white/10 border-blue-400/60 hover:border-blue-400 hover:bg-blue-500/20 hover:scale-110 shadow-md'
                        : 'bg-black/60 border-white/10 opacity-40'
                    }`}>
                      <span className={hasLevel || node.isStar ? 'drop-shadow-lg' : ''}>{node.icon}</span>
                      
                      {/* 레벨 배지 */}
                      {!node.isStar && hasLevel && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white flex items-center justify-center shadow-md shadow-blue-500/50">
                          <span className="text-[10px] font-bold text-white">{currentLevel}</span>
                        </div>
                      )}
                      
                      {/* 마스터 배지 */}
                      {isMastered && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 border-2 border-white flex items-center justify-center shadow-md shadow-yellow-500/50 animate-pulse">
                          <span className="text-[10px] font-bold">✓</span>
                        </div>
                      )}
                      
                      {/* 레벨업 가능 인디케이터 */}
                      {!node.isStar && canLearn && availablePoints > 0 && currentLevel < node.maxLevel && (
                        <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 border border-white flex items-center justify-center shadow-md shadow-green-500/50 animate-bounce">
                          <span className="text-[10px] font-bold text-white">+</span>
                        </div>
                      )}
                    </div>

                    {/* 호버 툴팁 - 하나씩만 표시 */}
                    {hoveredSkill === node.id && (
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-[100] pointer-events-none animate-fade-in">
                        <div className="bg-[#0A0A0A] border-2 border-white/30 rounded-lg px-3 py-2.5 shadow-2xl" style={{ minWidth: '200px', maxWidth: '90vw' }}>
                          {/* 헤더 */}
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-white text-xs sm:text-sm mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{node.name}</div>
                              <div className="text-gray-400 text-[10px] sm:text-xs">{node.desc}</div>
                            </div>
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br ${colorData.gradient} flex items-center justify-center flex-shrink-0`}>
                              {node.icon}
                            </div>
                          </div>
                          
                          <div className="h-[1px] bg-white/10 my-2" />
                          
                          {node.isStar ? (
                            <>
                              <div className="text-yellow-400 text-xs sm:text-sm font-bold mb-1">⭐ 별 노드 - 레벨 {node.starLevel}</div>
                              <div className="text-[10px] sm:text-xs text-gray-400 mb-1">챔피언 테스트 필요</div>
                              <div className="text-[10px] sm:text-xs text-gray-500">
                                전제 조건: {node.requires.map(id => skillNodes.find(n => n.id === id)?.name).join(', ')} 마스터
                              </div>
                            </>
                          ) : (
                            <>
                              {/* 레벨 및 타입 */}
                              <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1.5">
                                <span className="text-gray-500 whitespace-nowrap">타입</span>
                                <span className={`px-1.5 py-0.5 rounded text-white font-bold text-[9px] sm:text-[10px] bg-gradient-to-r ${colorData.gradient} whitespace-nowrap`}>
                                  {node.type.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1.5">
                                <span className="text-gray-500 whitespace-nowrap">레벨</span>
                                <span className="text-white font-bold whitespace-nowrap">{currentLevel} / {node.maxLevel}</span>
                              </div>
                              
                              {/* 프로그레스 바 */}
                              <div className="w-full bg-gray-800 rounded-full h-1.5 sm:h-2 mb-2">
                                <div 
                                  className={`h-full rounded-full bg-gradient-to-r ${colorData.gradient} transition-all`}
                                  style={{ width: `${(currentLevel / node.maxLevel) * 100}%` }}
                                />
                              </div>
                              
                              {isMastered && (
                                <div className="text-emerald-400 text-[10px] sm:text-xs font-bold mb-1.5">✓ 마스터 완료!</div>
                              )}
                              
                              {/* 전제 조건 */}
                              {node.requires && node.requires.length > 0 && (
                                <div className="text-[10px] sm:text-xs text-gray-500 mb-1.5">
                                  필요: {node.requires.map(id => {
                                    const reqNode = skillNodes.find(n => n.id === id);
                                    const reqMastered = isSkillMastered(id);
                                    return `${reqNode?.name} ${reqMastered ? '✓' : '✗'}`;
                                  }).join(', ')}
                                </div>
                              )}
                              
                              {/* 레벨업 가능 표시 */}
                              {availablePoints > 0 && currentLevel < node.maxLevel && canLearn && (
                                <div className="mt-2 text-center text-emerald-400 text-xs font-bold animate-pulse">
                                  ✨ 클릭하여 레벨업!
                                </div>
                              )}
                              
                              {/* 코치에게 요청 버튼 */}
                              {!canLearn && !node.isStar && currentLevel === 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addSkillRequest('김철수', node.name, node.type === 'mastery' ? 'passive' : 'active', 'Master I');
                                    alert(t('requestSent'));
                                  }}
                                  className="mt-2 w-full py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap"
                                >
                                  🎯 {t('requestToCoach')}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SpotlightCard>
        </div>

        {/* 범례 - 하단에 표시 */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <SpotlightCard className="p-4">
            <h4 className="text-sm font-bold text-white mb-3">📋 노드 상태</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white/50 flex items-center justify-center relative">
                  <span>⚡</span>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-600 border border-black flex items-center justify-center text-[8px] font-bold">3</div>
                </div>
                <span className="text-gray-300">레벨업된 스킬 (레벨 표시)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 border-2 border-white flex items-center justify-center relative">
                  <span>💪</span>
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-yellow-500 border border-black flex items-center justify-center text-[8px]">✓</div>
                </div>
                <span className="text-gray-300">마스터한 스킬</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-blue-400/60 flex items-center justify-center relative">
                  <span className="opacity-70">🎯</span>
                  <div className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full bg-green-500 border border-black animate-pulse text-[8px]">+</div>
                </div>
                <span className="text-gray-300">레벨업 가능 (클릭!)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-black/60 border border-white/10 opacity-40 flex items-center justify-center">
                  <span>🔒</span>
                </div>
                <span className="text-gray-400">잠김 (전제조건 필요)</span>
              </div>
            </div>
          </SpotlightCard>
          
          <SpotlightCard className="p-4">
            <h4 className="text-sm font-bold text-white mb-3">⭐ 별 노드 시스템</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 border-2 border-yellow-300 flex items-center justify-center shadow-lg">
                  <span>⭐</span>
                </div>
                <span className="text-gray-300">별 노드 (챔피언 테스트)</span>
              </div>
              <div className="text-gray-400 text-[11px] ml-10 space-y-1">
                <div>• 전제 스킬 모두 마스터 시 도전 가능</div>
                <div>• 4개의 별 노드를 모두 해금하여 성장</div>
                <div>• 별 노드는 다음 단계로 가는 관문</div>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
};
const PassiveSkillsView = ({ t = (key) => key, setActiveTab, addSkillRequest }) => {
  // 스킬 레벨 시스템 (각 스킬은 0~maxLevel까지 레벨업 가능)
  const [skillLevels, setSkillLevels] = useState({
    1: 2, // 스킬 ID: 현재 레벨
  });
  const [availablePoints, setAvailablePoints] = useState(5); // 출석으로 얻은 포인트
  const [hoveredSkill, setHoveredSkill] = useState(null); // 현재 호버 중인 스킬

  // === 복싱 패시브 스킬 트리 ===
  const skillNodes = [
    // 중앙 시작 노드
    { id: 1, x: 50, y: 50, size: 'large', type: 'mastery', name: '체력단련', desc: '기본 체력 +1%', icon: '💎', maxLevel: 3, requires: [] },
    
    // === 상단 경로 (체력/스태미나) ===
    { id: 2, x: 50, y: 40, size: 'small', type: 'vitality', name: '지구력', desc: '최대 스태미나 +2%', icon: '❤️', maxLevel: 5, requires: [1] },
    { id: 3, x: 50, y: 30, size: 'medium', type: 'vitality', name: '강인한 체력', desc: '최대 스태미나 +4%', icon: '💚', maxLevel: 7, requires: [2] },
    { id: 101, x: 50, y: 20, size: 'star', type: 'star', name: '⭐ 철인', desc: '체력의 극한', icon: '⭐', isStar: true, starLevel: 1, requires: [3] },
    { id: 4, x: 50, y: 10, size: 'large', type: 'legendary', name: '불굴의 투혼', desc: '최대 스태미나 +15%', icon: '💚', maxLevel: 10, requires: [101] },
    
    // === 우측 경로 (치명타) ===
    { id: 5, x: 60, y: 50, size: 'small', type: 'agility', name: '크리티컬 히트', desc: '치명타율 +2%', icon: '💥', maxLevel: 5, requires: [1] },
    { id: 6, x: 70, y: 50, size: 'medium', type: 'agility', name: '급소 타격', desc: '치명타율 +4%', icon: '🎯', maxLevel: 7, requires: [5] },
    { id: 102, x: 80, y: 50, size: 'star', type: 'star', name: '⭐ 원펀치', desc: '치명타의 극한', icon: '⭐', isStar: true, starLevel: 2, requires: [6] },
    { id: 7, x: 90, y: 50, size: 'large', type: 'legendary', name: '필살의 주먹', desc: '치명타율 +20%', icon: '🗡️', maxLevel: 10, requires: [102] },
    
    // === 하단 경로 (회복) ===
    { id: 8, x: 50, y: 60, size: 'small', type: 'resistance', name: '재생력', desc: '체력 회복 +2%', icon: '🛡️', maxLevel: 5, requires: [1] },
    { id: 9, x: 50, y: 70, size: 'medium', type: 'resistance', name: '빠른 회복', desc: '체력 회복 +4%', icon: '🔰', maxLevel: 7, requires: [8] },
    { id: 103, x: 50, y: 80, size: 'star', type: 'star', name: '⭐ 리커버리', desc: '회복의 극한', icon: '⭐', isStar: true, starLevel: 3, requires: [9] },
    { id: 10, x: 50, y: 90, size: 'large', type: 'legendary', name: '불사조', desc: '모든 회복력 +25%', icon: '🛡️', maxLevel: 10, requires: [103] },
    
    // === 좌측 경로 (정신력) ===
    { id: 11, x: 40, y: 50, size: 'small', type: 'spirit', name: '집중력', desc: '집중도 +2%', icon: '💙', maxLevel: 5, requires: [1] },
    { id: 12, x: 30, y: 50, size: 'medium', type: 'spirit', name: '정신력', desc: '집중도 +4%', icon: '🔮', maxLevel: 7, requires: [11] },
    { id: 104, x: 20, y: 50, size: 'star', type: 'star', name: '⭐ 강철멘탈', desc: '정신력의 극한', icon: '⭐', isStar: true, starLevel: 4, requires: [12] },
    { id: 13, x: 10, y: 50, size: 'large', type: 'legendary', name: '챔피언의 마인드', desc: '멘탈 보너스 +30%', icon: '🔮', maxLevel: 10, requires: [104] },
  ];

  // 패시브 스킬 연결선 (십자가 패턴)
  const connections = [
    // 상단 경로
    [1, 2], [2, 3], [3, 101], [101, 4],
    // 우측 경로
    [1, 5], [5, 6], [6, 102], [102, 7],
    // 하단 경로
    [1, 8], [8, 9], [9, 103], [103, 10],
    // 좌측 경로
    [1, 11], [11, 12], [12, 104], [104, 13],
  ];

  const getNodeColor = (type) => {
    const colors = {
      mastery: { gradient: 'from-amber-400 via-yellow-500 to-amber-600', glow: '#F59E0B', shadow: 'shadow-amber-500/50' },
      strength: { gradient: 'from-red-500 via-orange-500 to-red-600', glow: '#EF4444', shadow: 'shadow-red-500/50' },
      vitality: { gradient: 'from-rose-400 via-pink-500 to-rose-600', glow: '#EC4899', shadow: 'shadow-pink-500/50' },
      agility: { gradient: 'from-cyan-400 via-blue-500 to-cyan-600', glow: '#06B6D4', shadow: 'shadow-cyan-500/50' },
      speed: { gradient: 'from-sky-400 via-cyan-400 to-sky-500', glow: '#0EA5E9', shadow: 'shadow-sky-500/50' },
      intelligence: { gradient: 'from-purple-500 via-indigo-500 to-purple-600', glow: '#8B5CF6', shadow: 'shadow-purple-500/50' },
      wisdom: { gradient: 'from-violet-400 via-purple-500 to-violet-600', glow: '#A855F7', shadow: 'shadow-violet-500/50' },
      spirit: { gradient: 'from-blue-500 via-indigo-500 to-blue-600', glow: '#3B82F6', shadow: 'shadow-blue-500/50' },
      resistance: { gradient: 'from-emerald-400 via-green-500 to-emerald-600', glow: '#10B981', shadow: 'shadow-emerald-500/50' },
      fortitude: { gradient: 'from-teal-500 via-emerald-500 to-teal-600', glow: '#14B8A6', shadow: 'shadow-teal-500/50' },
      legendary: { gradient: 'from-yellow-400 via-amber-500 to-orange-500', glow: '#F59E0B', shadow: 'shadow-amber-500/60' },
      harmony: { gradient: 'from-pink-400 via-rose-500 to-purple-500', glow: '#EC4899', shadow: 'shadow-pink-500/50' },
      star: { gradient: 'from-yellow-300 via-amber-400 to-yellow-500', glow: '#FBBF24', shadow: 'shadow-yellow-400/60' },
    };
    return colors[type] || { gradient: 'from-gray-500 to-gray-600', glow: '#6B7280', shadow: 'shadow-gray-500/50' };
  };

  const getNodeSize = (size) => {
    if (size === 'star') return 'w-10 h-10 sm:w-12 sm:h-12 text-lg sm:text-xl';
    if (size === 'large') return 'w-8 h-8 sm:w-10 sm:h-10 text-base sm:text-lg';
    if (size === 'medium') return 'w-7 h-7 sm:w-8 sm:h-8 text-sm sm:text-base';
    return 'w-5 h-5 sm:w-6 sm:h-6 text-xs sm:text-sm';
  };

  // 스킬의 현재 레벨 가져오기
  const getSkillLevel = (id) => skillLevels[id] || 0;

  // 스킬이 마스터되었는지 확인
  const isSkillMastered = (id) => {
    const node = skillNodes.find(n => n.id === id);
    return node && getSkillLevel(id) >= node.maxLevel;
  };

  // 스킬을 배울 수 있는지 확인 (전제조건 충족 여부)
  const canLearnSkill = (node) => {
    if (node.isStar) return false; // 별 노드는 특별 처리
    if (!node.requires || node.requires.length === 0) return true; // 전제조건 없음
    return node.requires.every(reqId => isSkillMastered(reqId)); // 모든 전제 스킬이 마스터되어야 함
  };

  // 스킬 레벨업
  const handleNodeClick = (node) => {
    if (node.isStar) {
      // 별 노드 - 챔피언 테스트
      const canTest = node.requires.every(reqId => isSkillMastered(reqId));
      if (canTest) {
        alert(`${node.name}\n\n챔피언 테스트를 시작하시겠습니까?\n\n해금 조건을 모두 충족했습니다!`);
      } else {
        alert(`${node.name}\n\n아직 테스트에 도전할 수 없습니다.\n\n전제 스킬을 모두 마스터해야 합니다.`);
      }
      return;
    }

    const currentLevel = getSkillLevel(node.id);
    
    // 레벨업 가능 조건: 포인트 있음 + 아직 만렙 아님 + 전제조건 충족
    if (availablePoints > 0 && currentLevel < node.maxLevel && canLearnSkill(node)) {
      setSkillLevels({ ...skillLevels, [node.id]: currentLevel + 1 });
      setAvailablePoints(availablePoints - 1);
    }
  };

  const masteredCount = skillNodes.filter(n => !n.isStar && isSkillMastered(n.id)).length;
  const totalSkills = skillNodes.filter(n => !n.isStar).length;

  return (
    <div className="animate-fade-in-up">
      {/* 헤더 */}
      <PageHeader 
        title={t('passiveSkills')} 
        description="출석하고 포인트를 얻어 스킬을 강화하세요"
        onBack={() => setActiveTab('roadmap-skill-tree')}
      >
        {/* 포인트 표시 */}
        <SpotlightCard className="px-6 py-3 bg-amber-500/10">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">보유 포인트</div>
              <div className="text-3xl font-bold text-amber-400">{availablePoints}</div>
            </div>
            <div className="h-12 w-[1px] bg-white/10" />
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">마스터</div>
              <div className="text-2xl font-bold text-emerald-400">{masteredCount}/{totalSkills}</div>
            </div>
          </div>
        </SpotlightCard>
      </PageHeader>

      <div className="mb-6">

        {/* 별 노드 진행 상황 */}
        <div className="flex items-center justify-between bg-black/30 rounded-xl p-4 border border-white/5">
          <span className="text-sm font-medium text-gray-400">🏆 성장 로드맵</span>
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4].map((starNum) => {
              const starNode = skillNodes.find(n => n.starLevel === starNum);
              const unlocked = starNode && skillLevels[starNode.id] > 0;
              const canTest = starNode && starNode.requires.every(reqId => isSkillMastered(reqId));
              
              return (
                <div key={starNum} className="flex items-center gap-2">
                  <div className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    unlocked
                      ? 'bg-yellow-500/30 text-yellow-300 border-2 border-yellow-400'
                      : canTest
                      ? 'bg-yellow-500/10 text-yellow-500 border-2 border-yellow-600 animate-pulse'
                      : 'bg-white/5 text-gray-600 border border-white/10'
                  }`}>
                    ⭐ Star {starNum}
                  </div>
                  {starNum < 4 && <div className="w-6 h-[2px] bg-white/10" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        {/* 패시브 스킬 트리 메인 - 전체 너비 사용 */}
        <div>
          <SpotlightCard className="p-8 bg-gradient-to-br from-[#1a0a0a] to-[#0a0505] relative overflow-hidden" style={{ minHeight: '650px' }}>
            {/* 중앙 발광 효과 - 황금색 */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
            
            {/* 원형 패턴 배경 - 황금색 */}
            <div className="absolute inset-0 opacity-5" style={{
              backgroundImage: `
                radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.2) 0%, transparent 50%),
                radial-gradient(circle at 50% 50%, transparent 20%, rgba(245, 158, 11, 0.1) 20%, rgba(245, 158, 11, 0.1) 21%, transparent 21%),
                radial-gradient(circle at 50% 50%, transparent 40%, rgba(245, 158, 11, 0.1) 40%, rgba(245, 158, 11, 0.1) 41%, transparent 41%),
                radial-gradient(circle at 50% 50%, transparent 60%, rgba(245, 158, 11, 0.1) 60%, rgba(245, 158, 11, 0.1) 61%, transparent 61%)
              `
            }} />
            
            {/* 그리드 효과 */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 1px, transparent 1px)',
              backgroundSize: '30px 30px'
            }} />

            {/* 연결선 - 다른 색상 */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
              {connections.map(([from, to], idx) => {
                const nodeFrom = skillNodes.find(n => n.id === from);
                const nodeTo = skillNodes.find(n => n.id === to);
                if (!nodeFrom || !nodeTo) return null;
                const isActive = getSkillLevel(from) > 0 && getSkillLevel(to) > 0;
                
                return (
                  <line
                    key={idx}
                    x1={`${nodeFrom.x}%`}
                    y1={`${nodeFrom.y}%`}
                    x2={`${nodeTo.x}%`}
                    y2={`${nodeTo.y}%`}
                    stroke={isActive ? 'rgba(245, 158, 11, 0.8)' : 'rgba(255, 255, 255, 0.1)'}
                    strokeWidth={isActive ? '3' : '2'}
                    style={{
                      filter: isActive ? 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  />
                );
              })}
            </svg>

            {/* 패시브 노드들 */}
            <div className="relative w-full h-full" style={{ minHeight: '650px', zIndex: 2 }}>
              {skillNodes.map((node) => {
                const currentLevel = getSkillLevel(node.id);
                const isMastered = isSkillMastered(node.id);
                const canLearn = canLearnSkill(node);
                const hasLevel = currentLevel > 0;
                const colorData = getNodeColor(node.type);
                
                return (
                  <div
                    key={node.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all duration-300"
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() => setHoveredSkill(node.id)}
                    onMouseLeave={() => setHoveredSkill(null)}
                  >
                    {/* 외부 링 애니메이션 (활성화된 노드) */}
                    {(hasLevel || node.isStar) && (
                      <>
                        <div 
                          className={`absolute inset-0 rounded-full animate-pulse-slow`}
                          style={{
                            transform: 'scale(2.2)',
                            background: `radial-gradient(circle, ${colorData.glow}40 0%, transparent 70%)`,
                            filter: 'blur(20px)'
                          }}
                        />
                        <div 
                          className={`absolute inset-0 rounded-full ${colorData.shadow}`}
                          style={{
                            transform: 'scale(1.5)',
                            background: `radial-gradient(circle, ${colorData.glow}60 0%, transparent 60%)`,
                            filter: 'blur(12px)',
                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                          }}
                        />
                      </>
                    )}
                    
                    {/* 별 노드 특수 효과 */}
                    {node.isStar && (
                      <div 
                        className="absolute inset-0 rounded-full" 
                        style={{ 
                          transform: 'scale(3)',
                          background: `radial-gradient(circle, ${colorData.glow}50 0%, transparent 50%)`,
                          filter: 'blur(30px)',
                          animation: 'pulse 1.5s ease-in-out infinite'
                        }}
                      />
                    )}
                    
                    {/* 노드 본체 (글래스모피즘) */}
                    <div className={`relative ${getNodeSize(node.size)} rounded-full flex flex-col items-center justify-center transition-all duration-300 backdrop-blur-sm ${
                      node.isStar
                        ? `bg-gradient-to-br ${colorData.gradient} border-4 border-white shadow-2xl ${colorData.shadow} group-hover:scale-110`
                        : isMastered
                        ? `bg-gradient-to-br ${colorData.gradient} border-4 border-white shadow-2xl ${colorData.shadow} group-hover:scale-110`
                        : hasLevel
                        ? `bg-gradient-to-br ${colorData.gradient} border-3 border-white/70 shadow-xl ${colorData.shadow} group-hover:scale-110`
                        : canLearn && availablePoints > 0
                        ? 'bg-gradient-to-br from-white/20 to-white/10 border-3 border-amber-400 hover:border-amber-300 hover:from-amber-500/30 hover:to-amber-600/20 shadow-lg shadow-amber-500/30 hover:scale-125 hover:shadow-amber-400/50'
                        : 'bg-gradient-to-br from-black/60 to-black/40 border-2 border-white/10 opacity-40'
                    }`}
                    style={{
                      boxShadow: hasLevel || node.isStar ? `0 0 30px ${colorData.glow}60, 0 0 60px ${colorData.glow}30` : undefined
                    }}>
                      {/* 노드 아이콘 */}
                      <span className={`${hasLevel || node.isStar ? 'drop-shadow-2xl' : ''} transition-transform group-hover:scale-110`} 
                            style={{ filter: hasLevel || node.isStar ? 'drop-shadow(0 0 8px rgba(255,255,255,0.8))' : undefined }}>
                        {node.icon}
                      </span>
                      
                      {/* 레벨 배지 */}
                      {!node.isStar && hasLevel && (
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 border-3 border-white flex items-center justify-center shadow-lg shadow-amber-500/50">
                          <span className="text-sm font-bold text-white">{currentLevel}</span>
                        </div>
                      )}
                      
                      {/* 마스터 배지 */}
                      {isMastered && (
                        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 border-3 border-white flex items-center justify-center shadow-lg shadow-yellow-500/50 animate-pulse">
                          <span className="text-sm font-bold">✓</span>
                        </div>
                      )}
                      
                      {/* 레벨업 가능 인디케이터 */}
                      {!node.isStar && canLearn && availablePoints > 0 && currentLevel < node.maxLevel && (
                        <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-white flex items-center justify-center shadow-lg shadow-green-500/50 animate-bounce">
                          <span className="text-xs font-bold text-white">+</span>
                        </div>
                      )}
                    </div>

                    {/* 호버 툴팁 - 하나씩만 표시 */}
                    {hoveredSkill === node.id && (
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-[100] pointer-events-none animate-fade-in">
                        <div className="bg-[#0A0A0A] border-2 border-white/30 rounded-lg px-3 py-2.5 shadow-2xl" style={{ minWidth: '200px', maxWidth: '90vw' }}>
                          {/* 헤더 */}
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-white text-xs sm:text-sm mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{node.name}</div>
                              <div className="text-gray-400 text-[10px] sm:text-xs">{node.desc}</div>
                            </div>
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br ${colorData.gradient} flex items-center justify-center flex-shrink-0`}>
                              {node.icon}
                            </div>
                          </div>
                          
                          <div className="h-[1px] bg-white/10 my-2" />
                          
                          {node.isStar ? (
                            <>
                              <div className="text-yellow-400 text-xs sm:text-sm font-bold mb-1">⭐ 별 노드 - 레벨 {node.starLevel}</div>
                              <div className="text-[10px] sm:text-xs text-gray-400 mb-1">챔피언 테스트 필요</div>
                              <div className="text-[10px] sm:text-xs text-gray-500">
                                전제 조건: {node.requires.map(id => skillNodes.find(n => n.id === id)?.name).join(', ')} 마스터
                              </div>
                            </>
                          ) : (
                            <>
                              {/* 레벨 및 타입 */}
                              <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1.5">
                                <span className="text-gray-500 whitespace-nowrap">타입</span>
                                <span className={`px-1.5 py-0.5 rounded text-white font-bold text-[9px] sm:text-[10px] bg-gradient-to-r ${colorData.gradient} whitespace-nowrap`}>
                                  {node.type.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1.5">
                                <span className="text-gray-500 whitespace-nowrap">레벨</span>
                                <span className="text-white font-bold whitespace-nowrap">{currentLevel} / {node.maxLevel}</span>
                              </div>
                              
                              {/* 프로그레스 바 */}
                              <div className="w-full bg-gray-800 rounded-full h-1.5 sm:h-2 mb-2">
                                <div 
                                  className={`h-full rounded-full bg-gradient-to-r ${colorData.gradient} transition-all`}
                                  style={{ width: `${(currentLevel / node.maxLevel) * 100}%` }}
                                />
                              </div>
                              
                              {isMastered && (
                                <div className="text-emerald-400 text-[10px] sm:text-xs font-bold mb-1.5">✓ 마스터 완료!</div>
                              )}
                              
                              {/* 전제 조건 */}
                              {node.requires && node.requires.length > 0 && (
                                <div className="text-[10px] sm:text-xs text-gray-500 mb-1.5">
                                  필요: {node.requires.map(id => {
                                    const reqNode = skillNodes.find(n => n.id === id);
                                    const reqMastered = isSkillMastered(id);
                                    return `${reqNode?.name} ${reqMastered ? '✓' : '✗'}`;
                                  }).join(', ')}
                                </div>
                              )}
                              
                              {/* 레벨업 가능 표시 */}
                              {availablePoints > 0 && currentLevel < node.maxLevel && canLearn && (
                                <div className="mt-2 text-center text-emerald-400 text-xs font-bold animate-pulse">
                                  ✨ 클릭하여 레벨업!
                                </div>
                              )}
                              
                              {/* 코치에게 요청 버튼 */}
                              {!canLearn && !node.isStar && currentLevel === 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addSkillRequest('김철수', node.name, node.type === 'mastery' ? 'passive' : 'active', 'Master I');
                                    alert(t('requestSent'));
                                  }}
                                  className="mt-2 w-full py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap"
                                >
                                  🎯 {t('requestToCoach')}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SpotlightCard>
        </div>

        {/* 범례 - 하단에 표시 */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <SpotlightCard className="p-4">
            <h4 className="text-sm font-bold text-white mb-3">📋 노드 상태</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 border-2 border-white/50 flex items-center justify-center relative">
                  <span>❤️</span>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-600 border border-black flex items-center justify-center text-[8px] font-bold">3</div>
                </div>
                <span className="text-gray-300">레벨업된 스킬 (레벨 표시)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-orange-600 border-2 border-white flex items-center justify-center relative">
                  <span>💪</span>
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-yellow-500 border border-black flex items-center justify-center text-[8px]">✓</div>
                </div>
                <span className="text-gray-300">마스터한 스킬</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-amber-400/60 flex items-center justify-center relative">
                  <span className="opacity-70">🎯</span>
                  <div className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full bg-green-500 border border-black animate-pulse text-[8px]">+</div>
                </div>
                <span className="text-gray-300">레벨업 가능 (클릭!)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-black/60 border border-white/10 opacity-40 flex items-center justify-center">
                  <span>🔒</span>
                </div>
                <span className="text-gray-400">잠김 (전제조건 필요)</span>
              </div>
            </div>
          </SpotlightCard>
          
          <SpotlightCard className="p-4">
            <h4 className="text-sm font-bold text-white mb-3">⭐ 별 노드 시스템</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 border-2 border-yellow-300 flex items-center justify-center shadow-lg">
                  <span>⭐</span>
                </div>
                <span className="text-gray-300">별 노드 (챔피언 테스트)</span>
              </div>
              <div className="text-gray-400 text-[11px] ml-10 space-y-1">
                <div>• 전제 스킬 모두 마스터 시 도전 가능</div>
                <div>• 4개의 별 노드를 모두 해금하여 성장</div>
                <div>• 별 노드는 다음 단계로 가는 관문</div>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
};

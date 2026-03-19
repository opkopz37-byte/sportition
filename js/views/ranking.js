// 랭킹 뷰
const { useState } = React;

const TierBoardView = ({ t = (key) => key, setActiveTab }) => {
  const [selectedTier, setSelectedTier] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // 티어 목록
  const tiers = ['All', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];
  
  // 전체 선수 데이터 (실제로는 API에서 가져와야 함)
  const allMembers = [
    { rank: 1, name: '김철수', tier: 'Master I', points: 3200, level: 247, workouts: ['스파링', '미트훈련', '컨디셔닝'], winRate: 89, attendance: 156 },
    { rank: 2, name: '이영희', tier: 'Master II', points: 3100, level: 218, workouts: ['테크닉', '섀도우복싱', '스파링'], winRate: 87, attendance: 148 },
    { rank: 3, name: '박민준', tier: 'Master III', points: 3000, level: 205, workouts: ['파워훈련', '스파링', '컨디셔닝'], winRate: 85, attendance: 142 },
    { rank: 4, name: '최서연', tier: 'Diamond I', points: 2800, level: 193, workouts: ['스피드훈련', '미트훈련', '섀도우복싱'], winRate: 83, attendance: 135 },
    { rank: 5, name: '정지훈', tier: 'Diamond II', points: 2750, level: 187, workouts: ['스파링', '헤비백', '컨디셔닝'], winRate: 81, attendance: 130 },
    { rank: 6, name: '강민서', tier: 'Diamond III', points: 2650, level: 175, workouts: ['테크닉', '미트훈련', '스트레칭'], winRate: 79, attendance: 125 },
    { rank: 7, name: '윤준호', tier: 'Platinum I', points: 2500, level: 168, workouts: ['파워훈련', '스파링', '컨디셔닝'], winRate: 77, attendance: 120 },
    { rank: 8, name: '조은비', tier: 'Platinum II', points: 2400, level: 156, workouts: ['스피드백', '미트훈련', '풋워크'], winRate: 75, attendance: 115 },
    { rank: 9, name: '한지우', tier: 'Platinum III', points: 2300, level: 145, workouts: ['섀도우복싱', '테크닉', '스트레칭'], winRate: 73, attendance: 110 },
    { rank: 10, name: '송민재', tier: 'Gold I', points: 2200, level: 138, workouts: ['헤비백', '스파링', '컨디셔닝'], winRate: 71, attendance: 105 },
    { rank: 11, name: '임수진', tier: 'Gold II', points: 2100, level: 125, workouts: ['미트훈련', '풋워크', '스트레칭'], winRate: 69, attendance: 98 },
    { rank: 12, name: '배준혁', tier: 'Gold III', points: 2000, level: 118, workouts: ['파워훈련', '스파링', '헤비백'], winRate: 67, attendance: 92 },
    { rank: 13, name: '오서영', tier: 'Silver I', points: 1900, level: 105, workouts: ['스피드훈련', '미트훈련', '풋워크'], winRate: 65, attendance: 85 },
    { rank: 14, name: '신동현', tier: 'Silver II', points: 1800, level: 98, workouts: ['헤비백', '스파링', '컨디셔닝'], winRate: 63, attendance: 78 },
    { rank: 15, name: '권예린', tier: 'Silver III', points: 1700, level: 87, workouts: ['섀도우복싱', '테크닉', '스트레칭'], winRate: 61, attendance: 72 },
    { rank: 16, name: '홍재민', tier: 'Bronze I', points: 1600, level: 76, workouts: ['기본훈련', '미트훈련', '컨디셔닝'], winRate: 59, attendance: 65 },
    { rank: 17, name: '유채원', tier: 'Bronze II', points: 1500, level: 68, workouts: ['풋워크', '섀도우복싱', '스트레칭'], winRate: 57, attendance: 58 },
    { rank: 18, name: '서준호', tier: 'Bronze III', points: 1400, level: 54, workouts: ['기본훈련', '헤비백', '컨디셔닝'], winRate: 55, attendance: 48 },
  ];

  // 티어별 색상
  const getTierColor = (tier) => {
    if (tier.includes('Master')) return { bg: 'from-purple-500/20 to-pink-500/20', text: 'text-purple-400', border: 'border-purple-500/50' };
    if (tier.includes('Diamond')) return { bg: 'from-blue-500/20 to-cyan-500/20', text: 'text-blue-400', border: 'border-blue-500/50' };
    if (tier.includes('Platinum')) return { bg: 'from-emerald-500/20 to-green-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50' };
    if (tier.includes('Gold')) return { bg: 'from-yellow-500/20 to-amber-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' };
    if (tier.includes('Silver')) return { bg: 'from-gray-400/20 to-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' };
    return { bg: 'from-orange-600/20 to-orange-700/20', text: 'text-orange-400', border: 'border-orange-600/50' };
  };

  // 필터링된 회원
  const filteredMembers = selectedTier === 'All' 
    ? allMembers 
    : allMembers.filter(m => m.tier.includes(selectedTier));

  // 페이지네이션
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="animate-fade-in-up">
      {/* 헤더 */}
      <PageHeader 
        title={t('tierBoard')}
        description={`전체 ${allMembers.length.toLocaleString()}명의 선수가 경쟁하고 있습니다`}
      />

      {/* 티어 필터 */}
      <div className="mb-4 sm:mb-5 flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2">
        {tiers.map((tier) => (
          <button
            key={tier}
            onClick={() => { setSelectedTier(tier); setCurrentPage(1); }}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-[11px] sm:text-xs whitespace-nowrap transition-all flex-shrink-0 ${
              selectedTier === tier
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tier === 'All' ? '전체 티어' : tier}
          </button>
        ))}
      </div>

      {/* 내 랭킹 카드 */}
      <SpotlightCard className="p-5 mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xl font-bold text-white">
                #5
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                    {t('athlete')}
                  </span>
                  <div className="text-lg font-bold text-white">김태양</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-blue-400 to-cyan-500 text-black text-xs font-bold">
                    Diamond II
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              2,750
            </div>
            <div className="text-xs text-gray-500">포인트</div>
          </div>
        </div>
      </SpotlightCard>

      {/* 랭킹 테이블 */}
      <SpotlightCard className="overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="bg-white/5 px-2 sm:px-4 py-2 border-b border-white/10 overflow-x-auto">
          <div className="grid grid-cols-12 gap-2 sm:gap-3 items-center text-[10px] sm:text-xs font-bold text-gray-400 uppercase min-w-[500px]">
            <div className="col-span-1">#</div>
            <div className="col-span-3">선수명</div>
            <div className="col-span-2">티어</div>
            <div className="col-span-2">포인트</div>
            <div className="col-span-3">주 훈련</div>
            <div className="col-span-1 text-right">승률</div>
          </div>
        </div>

        {/* 테이블 바디 */}
        <div className="divide-y divide-white/5 overflow-x-auto">
          {paginatedMembers.map((member, idx) => {
            const tierColor = getTierColor(member.tier);
            const isTopThree = member.rank <= 3;
            
            return (
              <div
                key={member.rank}
                className={`px-2 sm:px-4 py-2 sm:py-3 transition-all hover:bg-white/5 ${
                  isTopThree ? 'bg-gradient-to-r from-white/5 to-transparent' : ''
                }`}
              >
                <div className="grid grid-cols-12 gap-2 sm:gap-3 items-center min-w-[500px]">
                  {/* 순위 */}
                  <div className="col-span-1">
                    <div className={`inline-flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg font-bold text-xs sm:text-sm ${
                      member.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black' :
                      member.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-black' :
                      member.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-black' :
                      'bg-white/10 text-white'
                    }`}>
                      {member.rank === 1 ? '👑' : member.rank === 2 ? '🥈' : member.rank === 3 ? '🥉' : member.rank}
                    </div>
                  </div>

                  {/* 선수명 */}
                  <div className="col-span-3">
                    <button 
                      onClick={() => setActiveTab(`opponent-profile-${member.name}`)}
                      className="flex items-center gap-2 w-full hover:scale-105 transition-transform"
                    >
                      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="font-bold text-white text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis hover:text-blue-400 transition-colors">{member.name}</div>
                        <div className="text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap">Lv.{member.level}</div>
                      </div>
                    </button>
                  </div>

                  {/* 티어 */}
                  <div className="col-span-2">
                    <div className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-gradient-to-r ${tierColor.bg} border ${tierColor.border}`}>
                      <span className={`font-bold text-[10px] sm:text-xs ${tierColor.text} whitespace-nowrap`}>{member.tier}</span>
                    </div>
                  </div>

                  {/* 포인트 */}
                  <div className="col-span-2">
                    <div className="font-bold text-sm sm:text-base text-white whitespace-nowrap">{member.points.toLocaleString()}</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap">pts</div>
                  </div>

                  {/* 모스트 운동 */}
                  <div className="col-span-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {member.workouts.slice(0, 3).map((workout, i) => (
                        <div
                          key={i}
                          className="px-1.5 sm:px-2 py-0.5 rounded-md bg-white/10 text-[9px] sm:text-[10px] text-gray-300 whitespace-nowrap"
                        >
                          {workout}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 출석률 */}
                  <div className="col-span-1 text-right">
                    <div className={`font-bold text-sm sm:text-base ${
                      member.winRate >= 80 ? 'text-green-400' : 
                      member.winRate >= 60 ? 'text-blue-400' : 'text-gray-400'
                    }`}>
                      {member.winRate}%
                    </div>
                    <div className="text-xs text-gray-500">{member.attendance}일</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-white/5 border-t border-white/10">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all"
              >
                ←
              </button>
              
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-lg font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-gray-400'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all"
              >
                →
              </button>
            </div>
            <div className="text-center mt-3 text-sm text-gray-500">
              #{(currentPage - 1) * itemsPerPage + 1} ~ #{Math.min(currentPage * itemsPerPage, filteredMembers.length)} / 총 {filteredMembers.length}명
            </div>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
};

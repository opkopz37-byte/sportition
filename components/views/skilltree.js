'use client';

import { PageHeader, SpotlightCard, Icon } from '@/components/ui';

/**
 * 로드맵 > 스킬 정보 — 스킬 시스템 설명·가이드라인 전용 (인터랙티브 트리는 스킬 탭)
 */
const SkillTreeView = ({ t = (key) => key, setActiveTab }) => {
  return (
    <div className="animate-fade-in-up space-y-4 xs:space-y-6">
      <PageHeader
        title={t('skillTree')}
        description="스킬·스킬 트리·진영을 이해하고 빌드를 설계할 때 참고하세요"
      >
        <button
          type="button"
          onClick={() => setActiveTab('skills')}
          className="px-3 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-sm font-bold text-white shadow-lg shadow-violet-900/30 transition-all"
        >
          스킬 트리 열기
        </button>
      </PageHeader>

      <SpotlightCard className="p-5 sm:p-6 border border-white/10">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center flex-shrink-0">
            <Icon type="map" size={20} className="text-cyan-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white mb-1">스킬 트리가 하는 일</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              각 <strong className="text-gray-200 font-semibold">노드</strong>는 출석으로 쌓인{' '}
              <strong className="text-cyan-200/90">스킬 포인트</strong>를 써서 찍는 성장 슬롯입니다. 중앙은 잽{' '}
              <strong className="text-gray-200 font-semibold">한 줄 스파인</strong>에서 시작해 단계가 깊어질수록 심화
              노드로 이어지며,{' '}
              <strong className="text-orange-200/90">인파이터</strong>·
              <strong className="text-emerald-200/90">아웃복서</strong>·
              <strong className="text-yellow-200/90">전설</strong> 진영이 갈라집니다. 선행 노드를 모두 찍어야 다음
              단계 노드를 찍을 수 있습니다.
            </p>
          </div>
        </div>
      </SpotlightCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SpotlightCard className="p-5 border border-orange-500/20 bg-orange-500/[0.04]">
          <h3 className="text-sm font-bold text-orange-200 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            인파이터
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            근거리 압박·바디·파워 계열 노드가 왼쪽에 모여 있습니다. 근접 교전·지속 딜을 노릴 때 선택합니다.
          </p>
        </SpotlightCard>
        <SpotlightCard className="p-5 border border-emerald-500/20 bg-emerald-500/[0.04]">
          <h3 className="text-sm font-bold text-emerald-200 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            아웃복서
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            거리·발·카운터·회피 계열 노드가 오른쪽에 모여 있습니다. 간격 싸움과 리듬 운영을 중시할 때 맞춥니다.
          </p>
        </SpotlightCard>
        <SpotlightCard className="p-5 border border-yellow-500/20 bg-yellow-500/[0.04]">
          <h3 className="text-sm font-bold text-yellow-200 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            전설
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            중앙에서 이어지는 <strong className="text-gray-300">전설</strong> 체인입니다.{' '}
            양 진영을 일정 수준 찍은 뒤 포인트로 이어갈 수 있는 최종 강화 루트로 생각하면 됩니다.
          </p>
        </SpotlightCard>
      </div>

      <SpotlightCard className="p-5 sm:p-6 border border-white/10">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Icon type="target" size={20} className="text-violet-300" />
          운영 가이드라인
        </h2>
        <ol className="space-y-3 text-sm text-gray-400 list-decimal list-inside marker:text-violet-400/80">
          <li>
            <span className="text-gray-300">튜토리얼(중앙 기초 노드)</span>는 비용이 없거나 낮은 경우가 많습니다. 잽부터
            여기서 시작해 좌·우 본 트리로 자연스럽게 확장할 수 있습니다.
          </li>
          <li>
            아직 찍지 않은 노드는 <span className="text-gray-300">잠금</span>으로 표시됩니다. 선행 노드를 모두 찍으면
            자식 노드에 포인트를 쓸 수 있습니다.
          </li>
          <li>
            <span className="text-gray-300">스킬</span> 화면에서 맵을 드래그·휠·핀치로 이동·확대할 수 있습니다.
          </li>
          <li>
            <span className="text-gray-300">스킬 포인트</span>는 출석이 기록될 때마다 쌓입니다. 부족하면 출석을 이어가며
            모은 뒤 다시 찍어 보세요.
          </li>
        </ol>
      </SpotlightCard>

      <SpotlightCard className="p-5 sm:p-6 border border-white/10 bg-white/[0.02]">
        <h2 className="text-base font-bold text-white mb-3">용어 정리</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">노드</dt>
            <dd className="text-gray-300">스킬 포인트를 써서 찍는 슬롯. 타입은 기본·소켓·전설 소켓 등으로 나뉩니다.</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">선행 노드</dt>
            <dd className="text-gray-300">트리 상에서 먼저 채워야 다음 노드가 열리는 관계입니다.</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">스킬</dt>
            <dd className="text-gray-300">트리에서 찍어 둔 노드 구성이 곧 빌드입니다.</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">스타일</dt>
            <dd className="text-gray-300">인파이터/아웃복서 등 노드 진영. 빌드 밸런스에 직접 영향을 줍니다.</dd>
          </div>
        </dl>
      </SpotlightCard>

      <div className="flex flex-wrap gap-3 justify-center pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('skills')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold text-sm shadow-lg"
        >
          트리에서 찍기
        </button>
      </div>
    </div>
  );
};

export { SkillTreeView };

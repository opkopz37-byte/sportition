-- ============================================================
-- 스킬 노드 콘텐츠 필드 (맵 짧은 제목 / 원문 / 설명 / 훈련 의도 / 연결 흐름)
-- Supabase SQL Editor에서 기존 DB에 적용하세요. (06 시드 이후, 20 마이그레이션 이후에도 실행 가능)
-- ============================================================

ALTER TABLE public.skill_tree_nodes
  ADD COLUMN IF NOT EXISTS display_title TEXT,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS training_intent TEXT,
  ADD COLUMN IF NOT EXISTS flow_summary TEXT;

COMMENT ON COLUMN public.skill_tree_nodes.display_title IS '맵 노드에 표시할 짧은 제목(2~4단어 권장)';
COMMENT ON COLUMN public.skill_tree_nodes.source_name IS '엑셀·현장 원문명(상세 패널)';
COMMENT ON COLUMN public.skill_tree_nodes.description IS '상세 설명(훈련 의미·연결 구조)';
COMMENT ON COLUMN public.skill_tree_nodes.training_intent IS '훈련 의도';
COMMENT ON COLUMN public.skill_tree_nodes.flow_summary IS '연결 흐름 한 줄(없으면 클라이언트에서 선행 체인 표시)';

-- 공통 기본기 1~26: 맵에는 name과 동일하게 채움(추후 짧은 display만 따로 조정 가능)
UPDATE public.skill_tree_nodes
SET
  display_title = name,
  source_name = name,
  flow_summary = CASE node_number
    WHEN 1 THEN NULL
    ELSE '선행: 이전 단계 기본기 완료'
  END
WHERE node_number BETWEEN 1 AND 26 AND zone = 'tutorial';

UPDATE public.skill_tree_nodes SET
  description = '리드 핸드로 거리·리듬을 확인하는 가장 기본 타격입니다.',
  training_intent = '거리 감·리듬·다음 연계의 출발점을 익힙니다.',
  flow_summary = NULL
WHERE node_number = 1;

UPDATE public.skill_tree_nodes SET
  description = '잽에 리어 스트레이트를 붙인 직선 조합입니다.',
  training_intent = '전후 체중 이동과 투 스트레이트 정확도를 익힙니다.',
  flow_summary = '잽 → 원투'
WHERE node_number = 2;

UPDATE public.skill_tree_nodes SET
  description = '백스텝과 연계한 잽·원투 응용입니다.',
  training_intent = '후퇴 거리에서의 리듬·연속 타격을 익힙니다.',
  flow_summary = '원투 → 잽빽 원투'
WHERE node_number = 3;

-- 인파이터·아웃복서 루트(새 번호)
UPDATE public.skill_tree_nodes SET
  display_title = '근력 강화',
  source_name = '근력 강화',
  description = '근접 교전을 지탱하는 힘·지구력 기반 훈련 항목입니다.',
  training_intent = '압박 스타일에 필요한 지속력과 파워 기반을 쌓습니다.',
  flow_summary = NULL
WHERE node_number = 101;

UPDATE public.skill_tree_nodes SET
  display_title = '스피드 훈련',
  source_name = '스피드 훈련',
  description = '거리 운영과 반응에 필요한 발·상체 속도를 다룹니다.',
  training_intent = '간격 싸움·카운터 타이밍의 기초 속도를 올립니다.',
  flow_summary = NULL
WHERE node_number = 201;

-- 잽빽 원투원투(4) 직후 좌·우 분기 예시(맵 짧은 제목)
UPDATE public.skill_tree_nodes SET
  display_title = '백스텝 롱가드',
  source_name = '백스텝 롱 가드-앞손 블라인드',
  description = '거리를 벌리며 앞손으로 시야를 가리는 운영 쪽 응용입니다.',
  training_intent = '백스텝·롱가드에서 다음 연계로 이어지는 리듬을 익힙니다.',
  flow_summary = '잽빽 원투원투 → (아웃) 백스텝 롱가드'
WHERE node_number = 301;

UPDATE public.skill_tree_nodes SET
  display_title = '쓱 빡',
  source_name = '쓱 빡',
  description = '짧은 거리에서 빠르게 끊어 치는 아웃복서형 응용입니다.',
  training_intent = '스냅과 각도 변화로 상대 리듬을 흔듭니다.',
  flow_summary = '잽빽 원투원투 → (아웃) 쓱 빡'
WHERE node_number = 302;

UPDATE public.skill_tree_nodes SET
  display_title = '흔들기',
  source_name = '흔들기(헤드 무브먼트)',
  description = '상체 흔들기로 타격선을 바꿉니다.',
  training_intent = '압박 속에서 헤드 무브로 생존·카운터 타이밍을 만듭니다.',
  flow_summary = '잽빽 원투원투 → (인) 흔들기'
WHERE node_number = 303;

UPDATE public.skill_tree_nodes SET
  display_title = '풋 워킹',
  source_name = '풋 워킹',
  description = '발밑 스텝으로 거리·각도를 조정합니다.',
  training_intent = '인파이트에서 밀고 들어가기 위한 발 기반을 다집니다.',
  flow_summary = '잽빽 원투원투 → (인) 풋 워킹'
WHERE node_number = 304;

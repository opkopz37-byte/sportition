# 🎴 스킬 카드 가챠 시스템 구현 완료 보고서

## ✅ 완료된 작업

### 1. 데이터베이스 설계 및 스키마 생성

**새로 추가된 테이블 (10개):**

1. **skill_masters** - 마스터 복서 정보 (10명)
2. **skill_cards** - 스킬 카드 마스터 데이터 (100개)
3. **skill_tree_nodes** - 스킬 트리 노드 정보 (135개)
4. **user_inventory** - 유저 인벤토리 (코인, 뽑기권, 천장 카운터)
5. **user_cards** - 유저 보유 카드 (보관함)
6. **user_card_fragments** - 카드 조각 보관함
7. **gacha_history** - 가챠 히스토리
8. **skill_approval_queue** - 스킬 승인 대기열 (관장님)
9. **collections** - 도감 정의
10. **user_collection_progress** - 유저 도감 진행도

**파일 위치:**
- `sql/6_create_skill_gacha_system.sql` - 스키마 정의
- `sql/7_insert_test_skill_data.sql` - 테스트 데이터

---

### 2. 백엔드 API 함수 구현

**lib/supabase.js에 추가된 함수들:**

#### 가챠 시스템
- `getUserInventory(userId)` - 인벤토리 조회
- `performGacha(userId, pullCount)` - 가챠 실행 (1/10/30회)
- `calculateGachaRarity(pityCounter)` - 확률 계산 (천장 시스템 포함)
- `performSingleGacha(userId, pityCounter)` - 단일 가챠

#### 카드 관리
- `getUserCards(userId, filters)` - 보유 카드 조회 (필터링)
- `getAllSkillCards()` - 전체 카드 마스터 데이터 조회
- `upgradeCard(userCardId)` - 카드 레벨업 (조각 소모)
- `synthesizeFragments(userId, fragmentIds)` - 조각 합성

#### 스킬 트리
- `getSkillTreeNodes()` - 트리 노드 전체 조회
- `getUserSkillTree(userId)` - 유저 트리 상태 조회
- `equipCard(userCardId, nodeId, equip)` - 카드 장착/해제

#### 승인 시스템
- `requestSkillApproval(userId, cardId, nodeId)` - 승인 요청
- `getApprovalQueue(status)` - 승인 대기열 조회 (관장님용)
- `approveSkill(approvalId, approved, coachId, notes)` - 승인 처리

#### 테스트
- `addTestCoins(userId, amount)` - 테스트용 코인 지급

**핵심 로직:**
- 가챠 확률: Normal 50%, Rare 40%, Epic 8.5%, Legendary 1.5%
- 천장 시스템: 200회 뽑기 시 전설 선택권
- 완제품 vs 조각: 10% 완제품, 90% 조각
- 중복 카드: 조각으로 변환 후 레벨업 재료

---

### 3. 프론트엔드 UI 페이지 생성

#### 🎴 카드뽑기 페이지 (`components/views/gacha.js`)

**기능:**
- 보유 코인/무료뽑기권 표시
- 1회/10회/30회 뽑기 버튼
- 천장 시스템 진행도 바
- 확률 정보 표시
- 뽑기 결과 모달 (애니메이션 준비)
- 테스트용 코인 지급 버튼 (개발 환경)

**UI 특징:**
- 등급별 그라데이션 (전설: 금색, 영웅: 보라, 희귀: 파랑, 일반: 회색)
- 완제품 vs 조각 구분 표시
- 보관함으로 바로 이동 버튼

#### 🎒 카드 보관함 페이지 (`components/views/inventory.js`)

**기능:**
- 보유 카드 그리드 표시
- 등급/타입별 필터링 (전설/영웅/희귀/일반, 인파이터/아웃복서)
- 카드 상세 정보 모달
- 레벨업 기능 (조각 5개 소모)
- 스킬 트리 장착 버튼
- 통계 (보유 카드 수, 장착 중, 전설 카드 수, 최고 레벨)

**UI 특징:**
- 장착 중인 카드 체크 표시
- 등급별 색상 구분
- 레벨/조각 수 표시
- 빈 보관함 안내 (카드 뽑으러 가기 버튼)

#### 🌳 스킬 트리 개편 (`components/views/skilltree.js`)

**기능:**
- 135개 노드 방사형 구조 (DB 기반)
- 줌 인/아웃 컨트롤
- 드래그 이동
- 노드 간 연결선 표시 (SVG)
- 튜토리얼 잠금 시스템
- 노드 클릭 → 카드 장착
- 선행 노드 검증

**구역 구분:**
- 튜토리얼 (중앙) - 회색
- 인파이터 (좌측) - 파란색
- 아웃복서 (우측) - 빨간색
- 전설의 경계선 (대각선) - 금색

**노드 타입:**
- 기본 노드 (체육관 훈련으로 해금)
- 히든 소켓 (카드 장착 필요)
- 전설 소켓 (전설 카드 전용)

#### 📋 스킬 승인 관리 페이지 (`components/views/approval.js`)

**기능 (관장님 전용):**
- 승인 대기열 표시
- 상태별 필터링 (대기 중/승인 완료/거절됨)
- 승인 요청 상세 정보 모달
- 승인/거절 처리
- 관장님 메모 입력
- 자동 카드 장착 (승인 시)

**통계:**
- 대기 중 건수
- 승인 완료 건수
- 거절됨 건수

---

### 4. 메뉴 구조 업데이트

**일반회원(athlete) 메뉴에 추가:**
- 🎴 카드 뽑기 (`gacha`)
- 🎒 보관함 (`inventory`)

**선수(coach) 메뉴에 추가:**
- 📋 승인 관리 (`approval`)
- 🎴 카드 뽑기 (`gacha`)
- 🎒 보관함 (`inventory`)

**체육관(gym) 메뉴에 추가:**
- 📋 승인 관리 (`approval`)

**번역 추가:**
- 한국어: 카드 뽑기, 보관함, 승인 관리
- English: Card Gacha, Inventory, Skill Approval

---

## 🎯 시스템 플로우

### 가챠 시스템 플로우

```
1. 회원 가입
   ↓
2. 자동으로 user_inventory 생성
   (초기 코인 1000개 + 무료 뽑기권 5회)
   ↓
3. [카드 뽑기] 페이지 방문
   ↓
4. 1/10/30회 뽑기 선택
   ↓
5. 코인 차감 + 가챠 실행
   - 확률 계산 (천장 카운터 고려)
   - 카드 선택
   - 완제품(10%) vs 조각(90%) 결정
   ↓
6. user_cards 테이블에 저장
   - 신규: 새 레코드 생성
   - 중복: 조각 추가
   ↓
7. gacha_history에 기록
   ↓
8. [보관함] 페이지에서 확인
   ↓
9. 조각 5개 모으면 레벨업
   ↓
10. 레벨 1 이상이면 [스킬 트리]에 장착 가능
```

### 스킬 트리 플로우

```
1. [스킬 트리] 페이지 접속
   ↓
2. 튜토리얼 5개 노드 완료 필수
   ↓
3. 노드 클릭
   ↓
4. 보유 카드 목록에서 선택
   ↓
5. 카드 장착 (user_cards의 is_equipped = true)
   ↓
6. 노드 활성화 (네온 효과)
   ↓
7. 다음 노드 해금 (parent_nodes 조건)
```

### 관장 승인 플로우

```
1. 회원이 스킬 마스터 완료
   ↓
2. requestSkillApproval() 호출
   ↓
3. skill_approval_queue에 추가
   ↓
4. 관장님 [승인 관리] 페이지 접속
   ↓
5. 대기 중인 요청 확인
   ↓
6. 승인 or 거절 선택
   ↓
7. approveSkill() 실행
   - 승인: 자동으로 스킬 트리에 장착
   - 거절: 메모와 함께 반려
   ↓
8. 회원에게 알림 (TODO: 추후 구현)
```

---

## 🧪 테스트 방법

### 1단계: SQL 실행 (Supabase)
```sql
-- 6번과 7번 SQL을 순서대로 실행
-- 7번 실행 후 아래 쿼리로 확인:

SELECT * FROM skill_masters;
SELECT name, rarity FROM skill_cards;
SELECT node_number, name, zone FROM skill_tree_nodes ORDER BY node_number;
```

### 2단계: 회원가입 테스트
1. 브라우저에서 앱 실행
2. 새 계정 회원가입
3. SQL Editor에서 확인:
```sql
SELECT * FROM user_inventory WHERE user_id = '[회원ID]';
-- coins=1000, free_pulls=5 확인
```

### 3단계: 카드 뽑기 테스트
1. 네비게이션에서 **카드 뽑기** 클릭
2. "1회 뽑기" 버튼 클릭
3. 결과 모달 확인
4. "보관함 확인" 버튼 클릭
5. 획득한 카드 확인

### 4단계: 카드 장착 테스트
1. **스킬 트리** 페이지 이동
2. 튜토리얼 노드(중앙 5개) 클릭
3. 보유 카드 선택하여 장착
4. 노드 활성화 확인 (네온 효과)

### 5단계: 관장 승인 테스트 (관장님 계정 필요)
1. 관장님 계정으로 로그인
2. **승인 관리** 메뉴 클릭
3. 대기 중인 요청 확인
4. 승인/거절 처리

---

## 📊 가챠 확률표

| 등급 | 기본 확률 | 완제품 | 조각 |
|------|-----------|--------|------|
| 전설 | 1.5% | 0.2% | 1.3% |
| 영웅 | 8.5% | 1.5% | 7.0% |
| 희귀 | 40.0% | 10.0% | 30.0% |
| 일반 | 50.0% | 15.0% | 35.0% |

**천장 시스템:**
- 200회 뽑기마다 천장 도달
- 원하는 전설 스킬 선택 가능
- 전설 카드 뽑으면 카운터 리셋

**레벨업 시스템:**
- 조각 5개 = 레벨 1 상승
- 최대 레벨: Lv.5
- 레벨 0 카드는 장착 불가

---

## 🎨 UI/UX 특징

### 색상 체계
- **전설**: 금색 그라데이션 (`yellow-500` → `amber-600`)
- **영웅**: 보라-핑크 (`purple-500` → `pink-600`)
- **희귀**: 파랑-청록 (`blue-500` → `cyan-600`)
- **일반**: 회색 (`gray-500` → `gray-600`)

### 진영 구분
- **인파이터**: 파란색 (`blue-500`)
- **아웃복서**: 빨간색 (`red-500`)
- **전설**: 금색 (`yellow-500`)
- **튜토리얼**: 회색 (`gray-400`)

### 애니메이션 준비
- 카드 뽑기 결과 순차 표시 (`animationDelay`)
- 페이드 인 효과 (`animate-fade-in`)
- 호버 스케일 (`hover:scale-105`)
- 노드 활성화 네온 효과 (`shadow-white/50`)

---

## 🔧 Supabase에서 해야 할 일

### 필수 실행 (순서대로)

#### 1단계: 기본 시스템 (이미 실행했다면 스킵)
```bash
sql/1_add_skill_points.sql
sql/2_add_attendance_date.sql
sql/3_add_statistics_columns.sql
sql/4_create_rls_policies.sql
sql/5_create_skill_ranking_view.sql
```

#### 2단계: 가챠 시스템 (신규)
```bash
sql/6_create_skill_gacha_system.sql  ← 이것부터 실행!
sql/7_insert_test_skill_data.sql     ← 그 다음 실행!
```

### 실행 방법

1. **Supabase 대시보드** → **SQL Editor** 이동
2. 각 `.sql` 파일 열기
3. **전체 내용 복사** (Ctrl+A → Ctrl+C)
4. SQL Editor에 **붙여넣기** (Ctrl+V)
5. 우측 하단 **Run** 버튼 클릭
6. ✅ 성공 메시지 확인

**주의사항:**
- Markdown 헤더(`#`)나 설명 텍스트는 복사하지 마세요
- SQL 코드만 복사하세요
- 에러 발생 시: 이미 실행한 파일일 수 있습니다 (무시하고 다음 파일로)

---

## 🎮 테스트 데이터

### 마스터 복서 (2명)
1. **브루클린의 흑표범** (인파이터) - 타이슨 모티브
   - 전설 스킬: 뎀프시 롤
   
2. **나비의 춤** (아웃복서) - 알리 모티브
   - 전설 스킬: 알리 셔플

### 스킬 카드 (각 10개, 총 20개)
- Normal 카드: 3개
- Rare 카드: 3개
- Epic 카드: 3개
- Legendary 카드: 1개

### 스킬 트리 노드 (45개 샘플)
- 튜토리얼: 5개 (중앙)
- 인파이터: 15개 (좌측 상단)
- 아웃복서: 15개 (우측 하단)
- 전설 소켓: 10개 (대각선)

**⚠️ 참고:** 실제 기획서에는 135개 노드가 필요하지만, 초기 테스트를 위해 45개만 샘플로 삽입했습니다. 나머지 90개는 추후 좌표를 계산하여 추가할 수 있습니다.

---

## 🚀 다음 단계

### Phase 1: 현재 완료 (MVP)
- ✅ DB 스키마 설계
- ✅ 백엔드 API 함수
- ✅ 기본 UI 페이지
- ✅ 메뉴 구조 통합

### Phase 2: 다음 구현 (추천)
- [ ] 135개 전체 노드 좌표 계산 및 삽입
- [ ] 100개 전체 카드 데이터 작성
- [ ] 카드 일러스트 이미지 (실루엣 + 네온)
- [ ] 30회 뽑기 애니메이션 (샌드백 폭발)
- [ ] 전설 카드 등장 애니메이션 (황금 섬광)
- [ ] 도감 시스템 UI
- [ ] 조각 합성 UI
- [ ] 프로필 커스터마이징 (테두리, 테마)

### Phase 3: 고급 기능
- [ ] 결제 시스템 연동 (PG사)
- [ ] 관장님 승인 태블릿 UI (오프라인 전용)
- [ ] 실시간 알림 (Supabase Realtime)
- [ ] 카드 거래 시스템
- [ ] 친구 도전 시스템
- [ ] 리더보드 (카드 수집률)

### Phase 4: 법적/운영
- [ ] 가챠 법률 검토 (확률형 아이템)
- [ ] 청소년 보호 조치
- [ ] 환불 정책 수립
- [ ] 고객 지원 시스템

---

## 💡 주요 설계 결정

### 1. 카드 보유 방식
**채택:** 1 카드 = 1 레코드 (레벨업 방식)
- 중복 카드는 조각으로 변환
- `user_cards` 테이블에 `UNIQUE(user_id, card_id)` 제약

**장점:**
- 데이터 구조 단순
- 조각 관리 용이
- 레벨업 시각화 명확

### 2. 천장 시스템
**기획서 반영:** 200회마다 전설 선택권
- `pity_counter` 컬럼으로 카운터 관리
- 전설 뽑으면 자동 리셋
- 매 가챠마다 1씩 증가

### 3. 스킬 트리 구조
**채택:** DB 기반 동적 로딩
- `skill_tree_nodes` 테이블에서 노드 정보 조회
- `position_x`, `position_y`로 좌표 저장
- `parent_nodes` 배열로 의존성 표현

**장점:**
- 유연한 확장 가능
- 노드 추가/수정 용이
- 관리자 페이지에서 편집 가능 (추후)

### 4. 승인 시스템
**오프라인 통합:**
- 관장님이 직접 태블릿으로 승인
- `skill_approval_queue` 테이블로 대기열 관리
- 승인 시 자동 카드 장착

---

## 🔒 보안 (RLS 정책)

모든 테이블에 Row Level Security 적용:

- **skill_masters, skill_cards, skill_tree_nodes, collections**: 모두 조회 가능 (공개 데이터)
- **user_inventory**: 본인만 조회/수정
- **user_cards**: 본인만 조회/관리
- **user_card_fragments**: 본인만 조회/관리
- **gacha_history**: 본인만 조회, 시스템만 삽입
- **skill_approval_queue**: 본인 조회 + 관장님(gym/admin) 전체 조회/수정
- **user_collection_progress**: 본인만 조회/관리

---

## 📝 코드 품질

### 성능 최적화
- `Promise.all`로 병렬 데이터 로딩
- 인덱스 적용 (`user_id`, `card_id`, `status`, `rarity` 등)
- 뷰(View) 활용으로 복잡한 JOIN 간소화

### 에러 핸들링
- 모든 API 함수에 `try-catch`
- 사용자 친화적 에러 메시지
- 콘솔 로그로 디버깅 지원

### UI/UX 개선
- 로딩 스피너
- 빈 상태 안내 (Empty State)
- 호버 효과 및 트랜지션
- 반응형 디자인 (모바일 지원)

---

## ⚠️ 알려진 제한사항

### 1. 애니메이션
- 30회 뽑기 샌드백 애니메이션 미구현
- 전설 카드 황금 섬광 효과 미구현
- 노드 활성화 네온 애니메이션 미구현

### 2. 데이터
- 전체 135개 노드 중 45개만 샘플 삽입
- 전체 100개 카드 중 20개만 테스트 데이터
- 카드 이미지 미적용 (이모지 대체)

### 3. 기능
- 결제 시스템 미구현 (테스트용 코인 지급으로 대체)
- 조각 합성 로직 미완성 (synthesizeFragments)
- 실시간 알림 미구현
- 도감 시스템 UI 미구현

### 4. 관장 승인
- 태블릿 전용 UI 미구현
- 오프라인 동기화 미구현
- 승인 알림 미구현

---

## 💰 비용 예상

### 개발 비용
- **Phase 1 (MVP)**: 완료 ✅
- **Phase 2 (전체 데이터 + 애니메이션)**: 약 40-60시간
- **Phase 3 (고급 기능)**: 약 80-120시간
- **Phase 4 (법적/운영)**: 협의 필요

### 디자인 비용
- **100개 카드 일러스트**: 외주 필요 (실루엣 + 네온 스타일)
- **애니메이션 효과**: Lottie JSON 또는 CSS 애니메이션

### 운영 비용
- **Supabase**: Free tier로 시작 (DB 500MB, Bandwidth 5GB)
- **PG사 수수료**: 결제 시 약 3-4%
- **법률 자문**: 가챠 법 검토 (1회성)

---

## 🎉 요약

**현재 상태:**
- 가챠 시스템 MVP 완성 ✅
- 테스트 가능 상태 ✅
- 결제 없이 코인 지급으로 테스트 ✅

**다음 작업:**
1. Supabase SQL 실행 (6번, 7번)
2. 로컬에서 `npm run dev` 실행
3. 회원가입 후 카드 뽑기 테스트
4. 피드백 수집 후 다음 단계 진행

**변경된 파일:**
- `lib/supabase.js` (API 함수 추가)
- `components/views/gacha.js` (신규)
- `components/views/inventory.js` (신규)
- `components/views/skilltree.js` (대폭 개편)
- `components/views/approval.js` (신규)
- `components/ui.js` (메뉴 구조 업데이트)
- `lib/translations.js` (번역 추가)
- `components/SportitionApp.js` (라우팅 추가)

---

질문이나 추가 수정 사항이 있으면 언제든 말씀해주세요! 🥊✨

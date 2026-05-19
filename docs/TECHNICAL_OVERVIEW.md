# SPORTITION MVP3 — 종합 기술 문서

> 본 문서는 Sportition MVP3 프로젝트의 기획 배경, 설계 의도, 시스템 구성, 그리고 단계별 작업 진행 과정을 한 권으로 정리한 종합 기술 문서입니다. 신규 합류자 온보딩, 외부 협업자 컨텍스트 공유, 후속 단계 의사결정의 기준 문서로 사용됩니다.

---

## 목차

1. [프로젝트 개요 및 기획](#1-프로젝트-개요-및-기획)
2. [시스템 목적과 설계 원칙](#2-시스템-목적과-설계-원칙)
3. [기술 스택 및 아키텍처](#3-기술-스택-및-아키텍처)
4. [데이터베이스 설계](#4-데이터베이스-설계)
5. [기능 모듈 상세](#5-기능-모듈-상세)
6. [작업 진행 히스토리](#6-작업-진행-히스토리)
7. [배포·운영·디버깅](#7-배포운영디버깅)
8. [향후 로드맵](#8-향후-로드맵)

---

## 1. 프로젝트 개요 및 기획

### 1.1 서비스 정의

**Sportition**은 권투(복싱) 및 격투기 종목을 중심으로 한 **선수 기록 증명 + 코치 성장 설계 + 체육관 회원 관리**를 결합한 스포츠 커뮤니티 플랫폼입니다.

기존의 체육관 운영은 종이 출석부, 메신저로 흩어진 진급 기록, 비공식적인 스파링 결과 등 **검증되지 않는 데이터**에 의존해 왔습니다. Sportition은 이 모든 데이터를 한 곳에서 기록·검증·시각화하여 다음 세 가지를 가능하게 합니다.

- **선수**: 자신의 훈련·경기 이력을 검증된 데이터로 보여줄 수 있다
- **코치/관장**: 회원 한 명 한 명의 성장 경로를 설계하고 추적할 수 있다
- **체육관**: 회원 관리·진급·매치 운영을 디지털 워크플로로 통합한다

### 1.2 해결하고자 한 문제

| 기존 운영의 페인 포인트 | Sportition의 접근 |
|---|---|
| 출석을 종이/구두로 관리 → 누락·조작 가능 | 키오스크 출석 + DB 기록 + 1일 1회 제약 |
| 회원 진급(승급) 기준이 비공식 | 스킬트리 기반 5/5 마스터 + 코치 승인 큐 |
| 스파링 결과가 기록되지 않음 | 매치 양방 기록 + 자동 통계 집계 |
| 체육관 이름이 자유 텍스트 → 오타/중복 | 체육관 코드 시스템(SE/GG/JJ + 4자리) |
| 동기 부여 부족 | 가챠·스킬트리·티어로 게임화 |

### 1.3 타겟 사용자와 4가지 역할

플랫폼은 단일 회원 모델이 아니라, **권한과 화면이 다른 4가지 역할**로 분리되어 설계되었습니다. 이는 [01_core_schema.sql](../sql/01_core_schema.sql)의 `users.role` 컬럼 CHECK 제약으로 강제됩니다.

| 역할 | role 값 | 주요 권한 |
|---|---|---|
| 일반회원 | `player_common` | 출석·매치 기록·스킬트리 투자·가챠·자기 프로필 |
| 선수(코치) | `player_athlete` | 일반회원 권한 + 매치룸 운영 + 스킬 승인 |
| 체육관 | `gym` | 코드 기반 회원 등록·관리, 진급 승인, 체육관 정보 |
| 관리자 | `admin` | 전체 데이터 접근, 운영 보조 기능 |

### 1.4 핵심 기능 카테고리

여덟 개 모듈로 구성되며, 각각 자체 데이터·UI·업무 흐름을 갖습니다. 자세한 내용은 [5장](#5-기능-모듈-상세)에서 다룹니다.

1. 인증·회원가입 (2단계, 역할별 동적 필드)
2. 체육관 시스템 (코드 기반, 이력 추적)
3. 출석 시스템 (키오스크, 스킬 포인트 적립)
4. 스킬트리 (86노드, 마스터/승인)
5. 가챠 시스템 (스킬 카드 뽑기, 조각 레벨업)
6. 매치/스파링 (양방 기록, 자동 통계)
7. 프로필·아바타 (공개/비공개 분리)
8. 모바일 최적화 (375px~)

---

## 2. 시스템 목적과 설계 원칙

기능을 나열하기 전에, 본 프로젝트가 일관되게 따르는 **다섯 가지 설계 원칙**을 정리합니다. 이 원칙은 신규 기능을 추가할 때 의사결정 기준으로 사용됩니다.

### 2.1 체육관 단위 독립 운영

모든 데이터는 기본적으로 **체육관(gym) 스코프**에서 동작합니다.

- 코치는 자기 체육관 회원만 매치룸에 호출할 수 있다
- 출석/진급 승인은 같은 체육관 내에서만 일어난다
- 회원이 체육관을 옮기면 이력이 끊기지 않고 `user_gym_history`로 보존된다

이는 RLS 정책([04_rls_policies.sql](../sql/04_rls_policies.sql))과 `gym_user_id` 외래키로 강제됩니다.

### 2.2 식별자 분리 (Single Source of Truth)

체육관 식별에 세 가지 컬럼이 공존하지만 **역할이 명확히 분리**되어 있습니다.

| 컬럼 | 타입 | 역할 | 사용처 |
|---|---|---|---|
| `gym_user_id` | UUID | **진짜 연결고리** | 모든 JOIN, RLS, 시스템 로직 |
| `gym_code` | TEXT | **사람이 입력하는 lookup key** | 가입·체육관 변경 시에만 |
| `gym_name` | TEXT | **표시용 캐시** | UI 표시 전용 (로직 금지) |

이 분리는 [58_gym_code_schema.sql](../sql/58_gym_code_schema.sql)에서 도입되었으며, 자유 텍스트 매칭에 의존하던 초기 구조의 한계를 해결한 핵심 설계 결정입니다.

### 2.3 게임화로 동기 부여

훈련은 본질적으로 반복적이며 동기 유지가 어렵습니다. Sportition은 **세 가지 게임 메커닉**으로 동기를 강화합니다.

- **스킬 포인트(SP)**: 출석할 때마다 모달에서 명시적으로 적립
- **스킬트리**: 86개 노드를 단계적으로 해금 (5/5 마스터 → 코치 승인 → 다음 노드)
- **가챠 + 카드 장착**: 스킬 카드를 뽑아 노드에 장착하면 시각 효과·티어 변동

이 메커닉은 `users.skill_points`, `skill_tree_nodes`, `user_cards`, `user_inventory` 테이블이 함께 만드는 시스템입니다.

### 2.4 공개/비공개 데이터 엄격 분리

회원 정보는 두 곳에 분리되어 저장됩니다.

- **공개**: `users` 테이블 + `public_player_profiles` 뷰 (닉네임, 티어, 전적 등)
- **비공개**: `user_private_profiles` 테이블 (전화, 생년월일, 대표 연락처)

비공개 정보는 **본인만** 조회 가능하며, 모든 외부 조회는 뷰를 거쳐 민감 컬럼이 노출되지 않도록 합니다. 이는 [04_rls_policies.sql](../sql/04_rls_policies.sql)과 [05_views.sql](../sql/05_views.sql)에서 강제됩니다.

### 2.5 모바일 우선

체육관 현장에서의 키오스크 출석, 코치의 즉석 매치 기록, 회원의 빠른 프로필 조회 등 모든 사용 시나리오가 **모바일 우선**으로 설계되었습니다.

- 기준 해상도: iPhone SE 375px
- 터치 타겟 최소 44×44px
- 출석 페이지는 별도 키오스크 모드 지원

---

## 3. 기술 스택 및 아키텍처

### 3.1 기술 스택과 선정 근거

| 레이어 | 선택 | 선정 이유 |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR/Edge 지원, Cloudflare Workers 호환 |
| UI | React 19 + Tailwind CSS 3.3 | 컴포넌트 재사용성 + 빠른 반응형 작성 |
| BaaS | Supabase (PostgreSQL + Auth + Storage) | RLS로 인증·권한 한곳에서 처리, 별도 백엔드 불필요 |
| 배포 | Cloudflare Workers (OpenNext) | 글로벌 엣지, 한국 사용자에 낮은 지연 |
| 빌드 | OpenNext + Wrangler | Next.js를 Workers 런타임으로 변환 |

핵심 의존성은 [package.json](../package.json)에 정의되어 있으며, npm 스크립트는 다음과 같습니다.

| 스크립트 | 용도 |
|---|---|
| `npm run dev` | 로컬 개발 서버 (127.0.0.1:3000) |
| `npm run dev:clean` | `.next` 캐시 삭제 후 개발 서버 |
| `npm run build` | Next.js 프로덕션 빌드 |
| `npm run build:cloudflare` | OpenNext 빌드 (Workers용) |
| `npm run verify:cloudflare` | OpenNext 빌드 검증 |
| `npm run deploy` | Cloudflare Workers 배포 |
| `npm run lint` | ESLint 검사 |

### 3.2 전체 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  사용자 (모바일/데스크톱 브라우저)                          │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Workers (Edge)                              │
│  ├─ Next.js 15 (OpenNext 변환)                          │
│  ├─ React 19 + Tailwind                                 │
│  └─ AuthContext + Supabase 클라이언트                    │
└────────────────────────┬────────────────────────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │ Supabase │ │ Supabase │ │ Supabase │
      │   Auth   │ │ Postgres │ │ Storage  │
      │  (JWT)   │ │ (RLS)    │ │ (avatars)│
      └──────────┘ └──────────┘ └──────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Triggers/RPC  │
              │ - 자동 통계    │
              │ - SP 적립      │
              │ - 코드 발급    │
              └────────────────┘
```

세 가지 흐름이 핵심입니다.

- **인증 흐름**: 클라이언트 → Supabase Auth(JWT) → `auth.users` → 트리거가 `public.users` 자동 생성
- **데이터 흐름**: 클라이언트 → `lib/supabase.js` API 함수 → Supabase REST → RLS 검증 → PostgreSQL
- **배포 흐름**: Git push → Cloudflare Workers Builds → `npm run build:cloudflare` → 엣지 배포

### 3.3 디렉토리 구조

```
sportition-mvp3/
├── app/                           # Next.js App Router
│   ├── layout.js                  # 루트 레이아웃 (AuthProvider 주입)
│   ├── page.js                    # 홈
│   ├── attendance/page.js         # 출석 키오스크
│   ├── tier-board/                # 티어보드
│   └── terms/                     # 약관
├── components/
│   ├── SportitionApp.js           # 메인 라우팅 + 메뉴 네비게이션
│   ├── ui.js                      # 공용 UI
│   ├── navigation.js              # 네비게이션 바
│   └── views/                     # 16개 주요 화면
│       ├── landing.js             # 로그인/회원가입 (1,380줄)
│       ├── dashboard.js           # 대시보드 (1,194줄)
│       ├── mypage.js              # 마이페이지 (2,002줄)
│       ├── skills.js              # 스킬 관리 (2,472줄)
│       ├── coach.js               # 코치 패널 (3,933줄)
│       ├── attendance.js          # 출석 (377줄)
│       ├── approval.js            # 승인 관리 (591줄)
│       ├── ranking.js             # 랭킹 (470줄)
│       ├── gacha.js               # 가챠 (386줄)
│       ├── inventory.js           # 보관함 (390줄)
│       └── ...
├── lib/                           # 클라이언트 라이브러리
│   ├── supabase.js                # 모든 API 함수 (2,665줄)
│   ├── AuthContext.js             # 인증 Context
│   ├── translations.js            # 다국어 (한/영)
│   ├── matchRecords.js            # 매치 기록 헬퍼
│   ├── tierLadder.js              # 티어 변동 로직
│   ├── gymMemberAccess.js         # 체육관 멤버 접근 제어
│   ├── nicknameAvailability.js    # 닉네임 중복 검사
│   └── avatarClient.js            # 아바타 업로드
├── sql/                           # 마이그레이션 (62개)
│   ├── 00_reset_all.sql           # 전체 리셋 (위험)
│   ├── 01_core_schema.sql         # 핵심 테이블
│   ├── 02_game_schema.sql         # 게임 테이블
│   ├── 03_auth_and_triggers.sql   # 인증 트리거
│   ├── 04_rls_policies.sql        # RLS
│   ├── 05_views.sql               # 공개 뷰
│   ├── 06_seed_game_content.sql   # 시드 데이터
│   ├── 52_consolidated_runtime_state.sql  # 출석/SP/스킬/승단 통합
│   ├── 58_gym_code_schema.sql     # 체육관 코드 (Phase 1)
│   ├── 59_gym_code_migrate.sql    # 데이터 백필 (Phase 2)
│   ├── 61_signup_gym_code_handler.sql  # 가입 시 코드 (Phase 5)
│   ├── 62_change_gym_by_code.sql  # 체육관 변경 (Phase 6)
│   └── skill_tree/SKILL_TREE_UNIFIED.sql  # 86개 노드
├── supabase/config.toml           # Supabase 로컬 설정
├── public/                        # 정적 자산
├── scripts/dev.sh                 # 개발 서버 스크립트
├── wrangler.jsonc                 # Cloudflare Workers 설정
├── open-next.config.ts            # OpenNext 설정
└── docs/                          # 본 문서 등
```

---

## 4. 데이터베이스 설계

### 4.1 마이그레이션 관리 방식

`sql/` 디렉토리에 **숫자 prefix 순서**대로 적용되는 단방향 마이그레이션을 둡니다. 각 파일은 멱등성(여러 번 실행해도 같은 결과)을 가지도록 작성되어 운영 중 재실행이 가능합니다.

**최소 필수 6단계 (신규 환경 셋업)**

```
01_core_schema.sql         핵심 테이블 (users, attendance, statistics 등)
02_game_schema.sql         게임 테이블 (skill_*, gacha 관련)
03_auth_and_triggers.sql   auth.users → public.users 동기화
04_rls_policies.sql        RLS 정책
05_views.sql               공개 뷰
06_seed_game_content.sql   초기 데이터 (마스터, 카드, 노드)
```

**이후 누적 마이그레이션 중 핵심 4단계**

```
52_consolidated_runtime_state.sql   출석/SP/스킬/승단 로직 통합
58_gym_code_schema.sql              체육관 코드 시스템 도입
59_gym_code_migrate.sql             기존 데이터 백필
61_signup_gym_code_handler.sql      가입 시 코드 자동 처리
62_change_gym_by_code.sql           체육관 변경 RPC
```

### 4.2 핵심 테이블

#### users (회원 마스터)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | `auth.users.id` FK |
| `email` | TEXT UNIQUE | 로그인 식별자 |
| `nickname` | TEXT UNIQUE | 표시 이름 (55_nickname_unique 적용) |
| `role` | TEXT | `player_common` / `player_athlete` / `gym` / `admin` |
| `gender`, `height`, `weight` | — | 신체 정보 |
| `boxing_style` | TEXT | infighter / outboxer / swarmer / counter_puncher |
| `gym_user_id` | UUID FK | **진짜 체육관 연결** (gym 역할 user의 id) |
| `gym_code` | TEXT UNIQUE | **체육관 고유 코드** (gym 역할만 보유) |
| `gym_name`, `gym_location` | TEXT | 표시용 캐시 |
| `region` | TEXT | 지역 코드 (체육관 코드 prefix 결정) |
| `skill_points` | INTEGER | 스킬 포인트 잔액 |
| `tier`, `tier_points` | — | 티어 시스템 |

#### user_private_profiles (민감 정보 분리)

전화, 생년월일, 대표 연락처를 별도 테이블로 분리. 본인만 조회 가능.

#### attendance (출석)

`UNIQUE(user_id, attendance_date)` 제약으로 **하루 1회** 출석을 강제합니다.

#### matches (경기) + statistics (자동 집계)

매 경기는 양쪽 행으로 저장(같은 `match_id` 공유). `on_match_recorded_update_stats` 트리거가 `statistics`에 누적 집계합니다.

| 컬럼 | 의미 |
|---|---|
| `match_id` | 같은 경기를 양 행으로 묶는 UUID |
| `gym_user_id_at_match` | 매치 시점의 체육관 스냅샷 (회원 이동 후에도 기록 보존) |
| `result` | win / loss / draw / ko_win / ko_loss |

#### skill_tree_nodes (86개 스킬 노드)

| 컬럼 | 의미 |
|---|---|
| `node_number` | 1~86 고유 번호 |
| `zone` | tutorial / infighter / outboxer / legendary |
| `position_x/y` | SVG 좌표 |
| `parent_nodes` | INT[] 선행 조건 |
| `base_cost` | SP 비용 |
| `card_id` | 장착 가능한 카드 |

전체 정의는 [skill_tree/SKILL_TREE_UNIFIED.sql](../sql/skill_tree/SKILL_TREE_UNIFIED.sql)에 통합되어 있습니다.

#### skill_cards / user_cards / user_inventory (가챠 3종)

- `skill_cards`: 카드 마스터 데이터 (rarity, card_type, max_level)
- `user_cards`: 보유 카드 (level 0~5, is_equipped, equipped_node_id)
- `user_inventory`: 코인·무료 뽑기권·천장 카운터

#### user_gym_history (체육관 이력)

[58_gym_code_schema.sql](../sql/58_gym_code_schema.sql)에서 도입. 회원이 체육관을 옮길 때 이전 소속이 끊기지 않고 history로 누적됩니다.

| 컬럼 | 의미 |
|---|---|
| `user_id` | 회원 |
| `gym_user_id` | 소속 체육관 |
| `start_date` | 가입(이동) 시점 |
| `end_date` | 종료 시점 (현재 소속이면 NULL) |

#### skill_approval_queue (스킬 승인 대기열)

회원이 노드를 5/5 마스터하면 승인 신청. 코치/관리자가 승인하면 다음 노드 해금이 가능해집니다.

### 4.3 RLS 보안 모델

[04_rls_policies.sql](../sql/04_rls_policies.sql) 한 곳에서 모든 테이블의 RLS를 정의합니다. 정책의 일관된 패턴은 다음과 같습니다.

| 테이블 | 정책 |
|---|---|
| `users` | 본인만 조회/수정. 외부 조회는 `public_player_profiles` 뷰로만 |
| `user_private_profiles` | 본인만 |
| `attendance` | 본인 + 같은 체육관 코치/관리자 |
| `matches` | 자신이 user_id 또는 opponent_id인 경기만 |
| `user_cards` | 본인만 |
| `skill_approval_queue` | 본인 + 코치/관리자(전체 관리) |

검증은 `auth.uid()` 기반이며, 역할 확인은 `EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN (...))` 패턴을 사용합니다.

### 4.4 공개 뷰

[05_views.sql](../sql/05_views.sql)에서 정의되며, 클라이언트는 민감 컬럼이 제거된 뷰만 조회할 수 있습니다.

- `public_player_profiles`: 닉네임, 티어, 복싱 스타일, 전적, 출석 통계, 아바타 URL
- `skill_tree_nodes_with_cards`: 노드 + 장착 카드 정보 결합

---

## 5. 기능 모듈 상세

각 모듈은 **목적 → 데이터 → 흐름 → 관련 파일** 순으로 정리됩니다.

### 5.1 인증 및 회원가입

**목적**: 다중 역할 인증 + 강화된 비밀번호 보안 + 역할별 동적 프로필 수집.

**관련 파일**
- UI: [components/views/landing.js](../components/views/landing.js) (1,380줄)
- API: [lib/supabase.js](../lib/supabase.js) (`signUp`, `signIn`)
- DB: [03_auth_and_triggers.sql](../sql/03_auth_and_triggers.sql), [24_ensure_my_profile_from_auth.sql](../sql/24_ensure_my_profile_from_auth.sql)
- 변경 이력: [CHANGELOG_SIGNUP.md](../CHANGELOG_SIGNUP.md)

**플로우 (2단계)**

1. **Step 1 — 계정 생성**
   - 역할 선택 (일반회원/선수/체육관)
   - 이메일 + 비밀번호 (8자, 대소문자, 특수문자, 실시간 강도 4단계)
   - 약관·개인정보 수집 동의

2. **Step 2 — 프로필 (역할별 동적 필드)**
   - 공통: 닉네임(중복 검사), 전화, 생년월일, 성별
   - 선수/일반회원: 키, 몸무게, 복싱 스타일(선수만), 소속 체육관, 멤버십
   - 체육관: 체육관 이름, 위치, 대표 연락처

3. **자동 처리**: `handle_new_user()` 트리거가 `auth.users` 생성을 받아 `public.users` + `user_private_profiles` + `user_inventory` + `statistics`를 한 번에 초기화. 역할이 `gym`이면 [58_gym_code_schema.sql](../sql/58_gym_code_schema.sql)의 트리거가 체육관 코드를 자동 발급합니다.

### 5.2 체육관 코드 시스템 (Phase 1~6, 최신)

**목적**: 자유 텍스트 체육관 매칭의 한계(이름 중복·오타)를 제거하고, 회원-체육관 연결을 자동화/이력화.

**관련 파일**
- UI: [components/views/landing.js](../components/views/landing.js) (가입 시 코드 입력), [components/views/coach.js](../components/views/coach.js) (회원 관리)
- API: [lib/supabase.js](../lib/supabase.js), [lib/gymMemberAccess.js](../lib/gymMemberAccess.js)
- DB: [58_gym_code_schema.sql](../sql/58_gym_code_schema.sql) ~ [62_change_gym_by_code.sql](../sql/62_change_gym_by_code.sql)

**코드 형식**: 6자 = 2글자 지역 prefix + 4자리 0패딩 숫자

| Prefix | 지역 | 예시 |
|---|---|---|
| SE | 서울 | SE0001 |
| GG | 경기 | GG0042 |
| GW | 강원 | GW0007 |
| CC | 충청 | CC0099 |
| JL | 전라 | JL0123 |
| GS | 경상 | GS0250 |
| JJ | 제주 | JJ9999 |

**Phase 별 작업**

| Phase | 파일 | 내용 |
|---|---|---|
| 1 | [58_gym_code_schema.sql](../sql/58_gym_code_schema.sql) | `region`, `gym_code` 컬럼 + 7개 지역별 sequence + 자동 발급 트리거 |
| 2 | [59_gym_code_migrate.sql](../sql/59_gym_code_migrate.sql) | 기존 회원-체육관 관계 백필, `user_gym_history` 자동 생성 |
| 3 | (스키마 외) | gym 역할의 코드 노출 UI, 마이페이지 연동 |
| 4 | (스키마 외) | 회원가입 Step 2에 코드 입력 필드 추가 |
| 5 | [61_signup_gym_code_handler.sql](../sql/61_signup_gym_code_handler.sql) | RPC `handle_gym_code_signup()` — 가입 시 코드 검증 → `gym_user_id` 설정 → history 생성 |
| 6 | [62_change_gym_by_code.sql](../sql/62_change_gym_by_code.sql) | RPC `change_gym_by_code()` — 기존 history `end_date` 채우고 새 history 시작 |

**회원 이동 시나리오**

```
1. 회원이 마이페이지 → "체육관 변경" → 새 코드 입력 (예: JJ0007)
2. change_gym_by_code(user_id, 'JJ0007') 호출
3. 트랜잭션 내에서:
   - user_gym_history.end_date = NOW() (기존 행)
   - user_gym_history INSERT (새 체육관, start_date = NOW())
   - users.gym_user_id = 새 체육관 user.id
   - users.gym_name, gym_location 캐시 갱신
4. 매치 기록은 gym_user_id_at_match 스냅샷으로 보존됨
```

### 5.3 출석 시스템

**목적**: 키오스크 출석 + 명시적 SP 적립 + 통계 자동 반영.

**관련 파일**
- UI: [components/views/attendance.js](../components/views/attendance.js) (377줄), [app/attendance/page.js](../app/attendance/page.js)
- API: [lib/supabase.js](../lib/supabase.js) (`checkAttendance`, `claimSkillPoints`)
- DB: [46_attendance_rpc_kst.sql](../sql/46_attendance_rpc_kst.sql), [50_attendance_claim_split.sql](../sql/50_attendance_claim_split.sql), [51_attendance_rpc_optimization.sql](../sql/51_attendance_rpc_optimization.sql), [52_consolidated_runtime_state.sql](../sql/52_consolidated_runtime_state.sql)
- 문서: [ATTENDANCE_SKILL_POINTS.md](../ATTENDANCE_SKILL_POINTS.md)

**플로우**

```
1. 키오스크 모드 진입 (체육관에 비치된 태블릿)
2. 회원이 전화번호 마지막 4자리 입력
3. 동명이인 처리 후 본인 선택
4. attendance INSERT (UNIQUE 제약으로 1일 1회 강제)
5. SP 적립 모달 표시 → "[스킬 포인트 적립]" 클릭 시에만 +1 SP
   ※ 5/5 마스터 + 미승인 노드가 있으면 차단
6. users.skill_points +1, 통계(연속/최장/이번 달) 갱신
```

**시간대 처리**: KST 기준 자정으로 `attendance_date` 산출 ([46_attendance_rpc_kst.sql](../sql/46_attendance_rpc_kst.sql)). UTC 기준으로 처리하면 한국 사용자가 새벽에 출석할 때 날짜가 어긋나는 문제를 해결.

### 5.4 스킬트리 (86노드)

**목적**: 게임화된 기술 학습 경로. 단순 기능 목록이 아니라 **선행 조건 → 마스터 → 코치 승인 → 다음 노드 해금**의 흐름으로 동기를 강화.

**관련 파일**
- UI: [components/views/skills.js](../components/views/skills.js) (2,472줄), [components/views/skilltree.js](../components/views/skilltree.js)
- DB: [skill_tree/SKILL_TREE_UNIFIED.sql](../sql/skill_tree/SKILL_TREE_UNIFIED.sql), [33_redesign_skill_tree.sql](../sql/33_redesign_skill_tree.sql), [40_skill_tree_data_integrity.sql](../sql/40_skill_tree_data_integrity.sql)
- 문서: [SKILL_TREE_LEVEL_CHANGE_BODY_JAB.md](../SKILL_TREE_LEVEL_CHANGE_BODY_JAB.md)

**구조 (총 86노드)**

| 구역 | 색상 | 노드 수 | 설명 |
|---|---|---|---|
| Tutorial | 회색 | 5 | 중앙 기초 |
| Infighter | 파랑 | ~40 | 좌측 근거리 스타일 |
| Outboxer | 빨강 | ~40 | 우측 거리 스타일 |
| Legendary | 금색 | 1 | 대각선 전설 노드 |

**투자 흐름**

```
1. 회원이 스킬트리 화면에서 노드 클릭
2. 보유 카드 중 노드 타입에 맞는 카드 선택 → 장착
3. SP 1점 이상 투자 (base_cost ≥ 1)
4. 5번 누적 투자 = 마스터(5/5)
5. "스킬 승인 신청" → skill_approval_queue INSERT
6. 코치(player_athlete)가 승인 화면에서 승인/거절
7. 승인 시 다음 노드 해금 가능
```

**제약**: 5/5 마스터한 노드 중 승인 대기인 것이 하나라도 있으면 신규 SP 투자가 차단됩니다 ([52_consolidated_runtime_state.sql](../sql/52_consolidated_runtime_state.sql)). 무한히 노드를 쌓는 것을 막기 위한 게임 설계.

### 5.5 가챠 시스템

**목적**: 스킬 카드를 뽑기로 획득 → 노드에 장착하여 시각·기능 보상.

**관련 파일**
- UI: [components/views/gacha.js](../components/views/gacha.js) (386줄), [components/views/inventory.js](../components/views/inventory.js) (390줄)
- DB: [02_game_schema.sql](../sql/02_game_schema.sql)
- 문서: [GACHA_SYSTEM_GUIDE.md](../GACHA_SYSTEM_GUIDE.md)

**확률 (요약)**

| 등급 | 완제품 | 조각 |
|---|---|---|
| Normal | 15.0% | 35.0% |
| Rare | 10.0% | 30.0% |
| Epic | 1.5% | 7.0% |
| Legendary | 0.2% | 1.3% |

**천장 시스템**: 200회 누적 시 전설 선택권 → `pity_counter` 리셋.

**조각 → 레벨업**: 같은 카드 조각 5개 → 카드 레벨 +1 (최대 5).

**장착**: 레벨 1 이상 카드만 스킬트리 노드에 장착 가능 (`is_equipped = true`, `equipped_node_id`).

### 5.6 매치/스파링 시스템

**목적**: 1:1 경기 기록 → 자동 통계 집계 → 공개 전적 조회.

**관련 파일**
- UI: [components/views/coach.js](../components/views/coach.js) (매치룸 운영)
- 공개 전적: [components/views/PublicPlayerRecordView.js](../components/views/PublicPlayerRecordView.js)
- API: [lib/matchRecords.js](../lib/matchRecords.js), [lib/tierLadder.js](../lib/tierLadder.js)
- DB: [02_game_schema.sql](../sql/02_game_schema.sql), [07_staff_match_access.sql](../sql/07_staff_match_access.sql), [42_match_reset_tickets.sql](../sql/42_match_reset_tickets.sql), [56_public_player_matches.sql](../sql/56_public_player_matches.sql), [60_match_cutoff_reset_20260427.sql](../sql/60_match_cutoff_reset_20260427.sql)

**기록 방식**: 한 경기 = `match_id` 공유 + 양방 행 2개. JOIN 시 `UNIQUE(match_id, user_id)` 덕분에 중복 카운트가 발생하지 않습니다.

**자동 집계**: `on_match_recorded_update_stats` 트리거가 `statistics` 테이블의 `total_matches`, `wins/losses/draws`, `ko_wins`를 INSERT 시점에 갱신.

**컷오프**: [60_match_cutoff_reset_20260427.sql](../sql/60_match_cutoff_reset_20260427.sql) — 특정 시점 이전 데이터를 정리/리셋하는 운영 스크립트. 시즌제 운영의 기반.

### 5.7 프로필·아바타

**목적**: 공개/비공개 분리 + 닉네임 정합성 + Storage 기반 아바타.

**관련 파일**
- UI: [components/views/mypage.js](../components/views/mypage.js) (2,002줄), [components/views/dashboard.js](../components/views/dashboard.js)
- API: [lib/supabase.js](../lib/supabase.js), [lib/avatarClient.js](../lib/avatarClient.js), [lib/nicknameAvailability.js](../lib/nicknameAvailability.js)
- DB: [15_get_my_profile_rpc.sql](../sql/15_get_my_profile_rpc.sql), [31_avatar_url_storage.sql](../sql/31_avatar_url_storage.sql), [43_public_player_profiles_avatar.sql](../sql/43_public_player_profiles_avatar.sql), [44_avatars_bucket_setup.sql](../sql/44_avatars_bucket_setup.sql), [45_nickname_availability.sql](../sql/45_nickname_availability.sql), [55_nickname_unique.sql](../sql/55_nickname_unique.sql)
- 문서: [PROFILE_DATA_FLOW.md](../PROFILE_DATA_FLOW.md)

**아바타 저장**: Supabase Storage `avatars` 버킷, 경로 `{user_id}/{filename}`. 공개 URL 형태로 노출.

**닉네임 정합성**: 실시간 중복 검사([nicknameAvailability.js](../lib/nicknameAvailability.js)) + DB UNIQUE 제약([55_nickname_unique.sql](../sql/55_nickname_unique.sql)) 이중 보장.

### 5.8 모바일 최적화

**목적**: iPhone SE(375px) 부터 데스크톱까지 단일 코드베이스로 대응.

**관련 문서**
- [MOBILE_RESPONSIVE.md](../MOBILE_RESPONSIVE.md)
- [MOBILE_OPTIMIZATION.md](../MOBILE_OPTIMIZATION.md)
- [RESPONSIVE_DESIGN_CHECKLIST.md](../RESPONSIVE_DESIGN_CHECKLIST.md)

**Tailwind 브레이크포인트**

| Prefix | 너비 | 대상 |
|---|---|---|
| (기본) | 375px+ | iPhone SE |
| sm: | 640px+ | 일반 모바일 |
| md: | 768px+ | 태블릿 |
| lg: | 1024px+ | 데스크톱 |
| xl: | 1280px+ | 대형 |

**원칙**: 1단 → 2단 → 다단으로 확장, 터치 타겟 최소 44×44px, 출석 키오스크는 숫자 키패드(`type="tel"`)와 키보드 단축키(Enter, Backspace, ESC)를 동시 지원.

---

## 6. 작업 진행 히스토리

프로젝트는 8단계의 큰 흐름으로 발전해 왔습니다. 각 단계의 **변경 이유**와 **주요 산출물**을 정리합니다.

### Phase 1 — 초기 개발 (first commit ~ 베타테스트)

**의사결정**: Next.js + Supabase BaaS 스택으로 시작. 별도 백엔드 없이 RLS로 권한을 처리하여 MVP 속도 우선.

**산출물**
- 회원가입/로그인 (단순 1단계)
- 출석 체크 (1차 버전)
- 매치룸 (수기 기록)
- 스킬트리 UI (확대/축소, 검색)

### Phase 2 — 매치 시스템 강화

**문제**: 매치 결과를 기록해도 통계가 자동 반영되지 않아 별도 집계 작업 필요.

**해결**
- `statistics` 테이블 + `on_match_recorded_update_stats` 트리거 도입
- 양방 기록 방식 (`match_id` 공유)
- 매치룸 회원 선택을 DB 기반으로 전환
- H2H(상호 전적) 쿼리 추가

### Phase 3 — 구조 개편 및 배포 안정화

**문제**: 반복적인 Cloudflare 배포 실패 (key 문제, 빌드 캐시 등).

**해결**
- Next.js 버전 업그레이드
- OpenNext 빌드 검증 스크립트(`verify:cloudflare`) 추가
- 배포 파이프라인 안정화

### Phase 4 — 회원가입/프로필 대규모 업데이트

**문제**: 단일 회원 모델로는 코치/체육관/회원의 요구사항을 동시에 충족 불가.

**해결**
- 2단계 회원가입 도입 (계정 → 프로필)
- 역할별 동적 필드
- 비밀번호 보안 강화 (실시간 강도 4단계)
- 이메일/닉네임 유효성 검사 개선
- 변경 내역: [CHANGELOG_SIGNUP.md](../CHANGELOG_SIGNUP.md)

### Phase 5 — 모바일 안정화

**문제**: 데스크톱 우선 설계의 잔재로 모바일에서 출석/프로필 조작이 불편.

**해결**
- 출석 키오스크 모드 분리
- 프로필 사진(아바타) Storage 기반 업로드
- 닉네임 변경 흐름 정비
- Tailwind 반응형 클래스 일괄 점검

관련 문서: [MOBILE_OPTIMIZATION.md](../MOBILE_OPTIMIZATION.md)

### Phase 6 — 가챠 + 스킬트리 재설계 (대규모 업데이트 v2)

**의사결정**: 단순 기록 도구를 넘어 **게임화된 학습 플랫폼**으로 전환.

**해결**
- 스킬트리 86노드 재설계 ([33_redesign_skill_tree.sql](../sql/33_redesign_skill_tree.sql))
- 가챠 시스템 도입 (확률, 천장, 조각 레벨업)
- 스킬 카드 ↔ 스킬트리 노드 장착 시스템
- 코치 승인 큐(`skill_approval_queue`)로 진급 공식화

관련 문서: [GACHA_SYSTEM_GUIDE.md](../GACHA_SYSTEM_GUIDE.md)

### Phase 7 — 운영 최적화

**문제**: 마이그레이션이 누적되며 출석/SP/스킬 로직이 분산되어 운영 부담 증가.

**해결**
- [52_consolidated_runtime_state.sql](../sql/52_consolidated_runtime_state.sql)에 통합 (멱등성 보장)
- 빌드 설정 정리, phantom submodule 제거
- 안정성 개선

### Phase 8 — 체육관 코드 시스템 (최신, abc2723)

**문제**: 체육관 이름이 자유 텍스트라 동명/오타로 인한 회원-체육관 매칭 실패가 누적.

**해결 (Phase 1~6 단계로 분리 적용)**

| 단계 | 적용 내용 |
|---|---|
| Phase 1 | [58_gym_code_schema.sql](../sql/58_gym_code_schema.sql) — 컬럼/시퀀스/트리거 |
| Phase 2 | [59_gym_code_migrate.sql](../sql/59_gym_code_migrate.sql) — 기존 데이터 백필 |
| Phase 3 | gym 역할 코드 노출 UI |
| Phase 4 | 회원가입 Step 2 코드 입력 |
| Phase 5 | [61_signup_gym_code_handler.sql](../sql/61_signup_gym_code_handler.sql) — 가입 처리 RPC |
| Phase 6 | [62_change_gym_by_code.sql](../sql/62_change_gym_by_code.sql) — 변경 RPC |

**핵심 설계 결정**: `gym_user_id`(진짜 연결) / `gym_code`(입력용 lookup) / `gym_name`(표시용 캐시)의 **3계층 분리**. 시스템 로직은 항상 `gym_user_id`만 사용하고, `gym_name`은 절대 매칭 키로 쓰지 않는다는 규칙을 코드 레벨에서 강제.

---

## 7. 배포·운영·디버깅

### 7.1 배포 흐름

| 단계 | 명령 |
|---|---|
| 빌드 검증 | `npm run verify:cloudflare` |
| 빌드 | `npm run build:cloudflare` |
| 배포 | `npm run deploy` (= build + `wrangler deploy`) |

Cloudflare Workers Builds 연동 시 git push가 트리거가 됩니다. 자세한 가이드: [CLOUDFLARE.md](../CLOUDFLARE.md)

### 7.2 환경 변수

`.env.example` 템플릿 참조. 실제 값은 `.env.local`(git 무시)에 작성.

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 anon key |

### 7.3 디버깅 자료

| 자료 | 용도 |
|---|---|
| [DEBUGGING_MODE_INFO.md](../DEBUGGING_MODE_INFO.md) | 디버깅 모드 활성화 |
| [QUICK_FIX.md](../QUICK_FIX.md) | 자주 마주치는 이슈 핫픽스 |
| [SUPABASE_SETUP.md](../SUPABASE_SETUP.md) | Supabase 환경 셋업 |
| [SUPABASE_수정_가이드.md](../SUPABASE_수정_가이드.md) | 마이그레이션 적용 절차 |

### 7.4 운영 체크리스트

- 새 마이그레이션 적용 시: SQL Editor에서 실행 → RLS 정책 영향 확인 → 인덱스 성능 점검
- 배포 전: `npm run lint` + `npm run verify:cloudflare`
- 출석/SP 관련 변경 시: [52_consolidated_runtime_state.sql](../sql/52_consolidated_runtime_state.sql)을 통합 지점으로 사용
- 체육관 코드 발급 실패 시: `region` 컬럼 누락 여부 확인

---

## 8. 향후 로드맵

현재 시점 기준의 우선순위입니다. 변경될 수 있습니다.

### 단기 (Phase 9 후보)

- 체육관 코드 시스템 UI 마무리 (코치 패널의 회원 검색 통합)
- 가챠 애니메이션 완성 (10/30회 연출, 황금 섬광)
- 스킬트리 노드 좌표 최종 조정

### 중기

- 친구·팔로우 시스템
- Supabase Realtime 기반 알림
- 매치 결과 알림/이의 제기 기능
- 어드민 대시보드 (회원/매치/SP 통계)

### 장기

- 결제 시스템 연동 (가챠 코인)
- 푸시 알림 (FCM)
- A/B 테스팅 프레임워크
- 시즌제 운영 자동화 (매치 컷오프 정기화)

---

## 부록 A. 주요 문서 인덱스

| 문서 | 경로 | 내용 |
|---|---|---|
| README | [README.md](../README.md) | 프로젝트 시작 가이드 |
| Supabase 셋업 | [SUPABASE_SETUP.md](../SUPABASE_SETUP.md) | 환경 설정 |
| Cloudflare 배포 | [CLOUDFLARE.md](../CLOUDFLARE.md) | Workers 배포 |
| DB 스키마 | [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) | 초기 스키마 설계 |
| DB 업데이트 | [DATABASE_SCHEMA_UPDATE.md](../DATABASE_SCHEMA_UPDATE.md) | 회원가입 필드 추가 |
| 회원가입 변경 | [CHANGELOG_SIGNUP.md](../CHANGELOG_SIGNUP.md) | 2단계 회원가입 |
| 프로필 흐름 | [PROFILE_DATA_FLOW.md](../PROFILE_DATA_FLOW.md) | 프로필 데이터 흐름 |
| 출석/SP | [ATTENDANCE_SKILL_POINTS.md](../ATTENDANCE_SKILL_POINTS.md) | 출석 + SP |
| 가챠 가이드 | [GACHA_SYSTEM_GUIDE.md](../GACHA_SYSTEM_GUIDE.md) | 가챠 전체 |
| 모바일 반응형 | [MOBILE_RESPONSIVE.md](../MOBILE_RESPONSIVE.md) | 반응형 |
| 모바일 최적화 | [MOBILE_OPTIMIZATION.md](../MOBILE_OPTIMIZATION.md) | 체크리스트 |
| 반응형 체크 | [RESPONSIVE_DESIGN_CHECKLIST.md](../RESPONSIVE_DESIGN_CHECKLIST.md) | 점검 항목 |
| 스킬트리 변경 | [SKILL_TREE_LEVEL_CHANGE_BODY_JAB.md](../SKILL_TREE_LEVEL_CHANGE_BODY_JAB.md) | 노드 변경 사례 |
| 디버깅 | [DEBUGGING_MODE_INFO.md](../DEBUGGING_MODE_INFO.md) | 디버깅 모드 |
| 핫픽스 | [QUICK_FIX.md](../QUICK_FIX.md) | 자주 보는 이슈 |
| SQL 가이드 | [sql/README.md](../sql/README.md) | 마이그레이션 적용 순서 |

## 부록 B. 핵심 테이블·뷰 한눈 보기

```
[회원/인증]
  users ── (1:1) ── user_private_profiles
  users ── (1:N) ── user_gym_history
  users.gym_user_id → users.id (gym 역할)

[활동]
  users ── (1:N) ── attendance
  users ── (1:N) ── matches (양방)
  users ── (1:1) ── statistics

[게임]
  skill_tree_nodes (86)
  skill_cards ── (1:N) ── user_cards ── (FK) ── skill_tree_nodes
  users ── (1:1) ── user_inventory
  users ── (1:N) ── gacha_history
  users ── (1:N) ── skill_approval_queue ── (FK) ── skill_tree_nodes

[공개 뷰]
  public_player_profiles (users + statistics + 아바타, 민감 컬럼 제외)
  skill_tree_nodes_with_cards (노드 + 장착 카드)
```

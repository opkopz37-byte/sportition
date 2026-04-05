# Sportition - Next.js Version

스포티션(Sportition)은 선수들의 기록 증명과 코치들의 성장 설계를 위한 진보된 스포츠 커뮤니티 플랫폼입니다.

## 🚀 시작하기

### 1. 필수 준비사항

- Node.js 18.17 이상
- npm 또는 yarn
- Supabase 계정 (데이터베이스용)

### 2. 설치

```bash
# npm 캐시 권한 문제가 있는 경우 (Mac)
sudo chown -R 501:20 "/Users/$USER/.npm"

# 의존성 설치
npm install
```

### 3. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 환경 변수 파일 만들기 (예시 파일 복사 후 값만 채우면 됩니다):
   ```bash
   cp .env.example .env.local
   ```
3. `.env.local`을 열고 **Settings → API**에서 복사한 값으로 채웁니다:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `anon` `public` 키  
   *(서비스 롤 secret 키는 브라우저용이 아니라 서버 전용입니다. 위 두 개만 있으면 회원가입/로그인이 동작합니다.)*
4. 개발 서버를 **반드시 재시작**합니다: `npm run dev`
5. `DATABASE_SCHEMA.md` 파일의 SQL을 Supabase SQL Editor에서 실행

📖 자세한 설정 가이드는 [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)를 참고하세요.

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

### 5. 빌드

```bash
npm run build
npm start
```

`npm run build`는 Next.js 프로덕션 빌드입니다. OpenNext가 내부에서 이 스크립트를 호출하므로 **여기서는 `next build`만** 두는 것이 맞습니다(무한 재귀 방지).

#### Cloudflare Workers (Git / Workers Builds)

대시보드 **Settings → Build**에서 다음을 맞춥니다. Workers Builds는 [Wrangler의 `build.command`를 사용하지 않습니다](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

| 항목 | 값 |
|------|-----|
| **Build command** | `npm run build:cloudflare` |
| **Deploy command** | `npx wrangler deploy` (기본값 그대로 가능) |

`npm run build`만 쓰면 `.open-next`가 없어 배포 단계에서 *compiled Open Next config* 오류가 납니다.

## 📁 프로젝트 구조

```
sportition-mvp3/
├── app/                    # Next.js App Router
│   ├── layout.js          # 루트 레이아웃 (AuthProvider 포함)
│   ├── page.js            # 홈 페이지
│   ├── attendance/        # 출석 체크 페이지
│   │   └── page.js
│   └── globals.css        # 글로벌 스타일
├── components/            # React 컴포넌트
│   ├── SportitionApp.js   # 메인 앱 컴포넌트
│   ├── ui.js              # UI 컴포넌트
│   ├── navigation.js      # 네비게이션 컴포넌트
│   └── views/             # 뷰 컴포넌트
│       ├── landing.js     # 랜딩/로그인/회원가입 (Supabase 연동)
│       ├── dashboard.js   # 대시보드
│       ├── ranking.js     # 랭킹
│       ├── skills.js      # 스킬 관리
│       ├── mypage.js      # 마이페이지
│       └── coach.js       # 코치 전용
├── lib/                   # 유틸리티 및 설정
│   ├── supabase.js        # Supabase 클라이언트 및 API
│   ├── AuthContext.js     # 인증 컨텍스트
│   └── translations.js    # 다국어 지원
├── public/                # 정적 파일
├── .env.example           # 환경 변수 템플릿 (복사 → .env.local)
├── DATABASE_SCHEMA.md     # 데이터베이스 스키마
├── SUPABASE_SETUP.md      # Supabase 설정 가이드
├── MOBILE_RESPONSIVE.md   # 모바일 반응형 가이드
└── package.json          # 프로젝트 설정
```

## ✨ 주요 기능

### 🔐 인증 시스템 (Supabase)
- ✅ 회원가입 (이메일, 비밀번호, 프로필 정보)
- ✅ 로그인/로그아웃
- ✅ 세션 관리
- ✅ 역할 기반 접근 제어 (선수/코치/관리자)
- ✅ 프로필 관리

### 📋 출석 관리 시스템
- ✅ 키오스크 모드 출석 체크 (`/attendance`)
- ✅ 전화번호 마지막 4자리로 빠른 검색
- ✅ 멤버십 타입별 관리
- ✅ 출석 기록 저장 및 조회
- ✅ 모바일/태블릿 최적화

### 선수(Athlete) 기능
- 📊 대시보드 - 훈련 캘린더, 경기 기록
- 🗺️ 로드맵 - 스킬 트리, 액티브/패시브 스킬
- 🏆 랭킹 - 티어 보드, 스타일별/지역별 랭킹
- 📈 통계 - 스타일 분석, 티어 통계
- 👤 마이페이지 - 프로필, 설정, 업적

### 코치(Coach) 기능
- 📊 인사이트 - 체육관 운영 현황
- 👥 회원 관리 - 신규 등록, 정보 관리
- 🥊 매치 룸 - 경기 매칭 및 심판
- ⚙️ 관리 - 출석체크, 시설 관리

## 🌐 다국어 지원

- 한국어 (ko)
- English (en)

## 📱 모바일 최적화

이 프로젝트는 iPhone SE(375px)를 포함한 다양한 모바일 기기에 최적화되어 있습니다.

### 지원 화면 크기
- **iPhone SE**: 375px (xs 브레이크포인트)
- **일반 모바일**: 640px (sm 브레이크포인트)
- **태블릿**: 768px (md 브레이크포인트)
- **데스크톱**: 1024px+ (lg, xl, 2xl 브레이크포인트)

### 모바일 기능
- ✅ 반응형 레이아웃
- ✅ 터치 최적화 (최소 44x44px 터치 타겟)
- ✅ 모바일 네비게이션 메뉴
- ✅ 작은 화면 전용 폰트 크기 조정
- ✅ 최적화된 패딩 및 여백

### 개발자 도구로 테스트하기
1. Chrome 개발자 도구 열기 (F12)
2. 디바이스 툴바 토글 (Ctrl+Shift+M / Cmd+Shift+M)
3. "iPhone SE" 또는 커스텀 375px 선택

## 🛠️ 기술 스택

- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Language**: JavaScript
- **Deployment**: Vercel (권장)

## 📚 상세 가이드

- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Supabase 설정 및 사용법
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - 데이터베이스 스키마 및 SQL
- [MOBILE_RESPONSIVE.md](./MOBILE_RESPONSIVE.md) - 모바일 반응형 가이드
- [MOBILE_OPTIMIZATION.md](./MOBILE_OPTIMIZATION.md) - 모바일 최적화 체크리스트
- [RESPONSIVE_DESIGN_CHECKLIST.md](./RESPONSIVE_DESIGN_CHECKLIST.md) - 반응형 디자인 체크리스트

## 🔑 주요 페이지

- `/` - 랜딩 페이지 (로그인/회원가입)
- `/attendance` - 출석 체크 키오스크
- 대시보드 - 로그인 후 자동 리다이렉트

## 🐛 트러블슈팅

### npm 설치 오류
```bash
sudo chown -R 501:20 "/Users/$USER/.npm"
npm install
```

### Supabase 연결 오류
1. `.env.local` 파일이 존재하는지 확인
2. 환경 변수가 올바른지 확인
3. 개발 서버 재시작

### 데이터베이스 오류
1. Supabase SQL Editor에서 `DATABASE_SCHEMA.md`의 SQL 실행 확인
2. RLS 정책이 활성화되어 있는지 확인
3. 테이블 구조 확인

## 📝 라이선스

이 프로젝트는 비공개 프로젝트입니다.

## 👨‍💻 개발자

Sportition Development Team

## 🙏 기여

현재 비공개 프로젝트입니다.

## 📞 문의

프로젝트 관련 문의사항은 개발팀에 연락해주세요.

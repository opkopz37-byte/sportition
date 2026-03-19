# Supabase 연동 설정 가이드

이 문서는 Sportition 프로젝트에 Supabase를 연동하는 방법을 설명합니다.

## 1. 사전 준비

### 1.1 npm 캐시 권한 문제 해결 (필요한 경우)

```bash
sudo chown -R 501:20 "/Users/hojin814/.npm"
```

### 1.2 Supabase 클라이언트 설치

```bash
npm install @supabase/supabase-js
```

## 2. Supabase 프로젝트 설정

### 2.1 Supabase 프로젝트 생성

1. [https://supabase.com](https://supabase.com)에 접속
2. 새 프로젝트 생성
3. 프로젝트 이름, 데이터베이스 비밀번호 설정
4. Region 선택 (Northeast Asia (Seoul) 권장)

### 2.2 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```bash
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**값을 가져오는 방법:**
1. Supabase 대시보드에서 프로젝트 선택
2. Settings > API 메뉴로 이동
3. `Project URL`을 복사하여 `NEXT_PUBLIC_SUPABASE_URL`에 입력
4. `anon` `public` 키를 복사하여 `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 입력

## 3. 데이터베이스 스키마 설정

### 3.1 SQL Editor에서 스키마 실행

Supabase 대시보드에서 SQL Editor를 열고 `DATABASE_SCHEMA.md` 파일의 SQL 쿼리를 순서대로 실행하세요:

1. **profiles 테이블 생성**
2. **attendance 테이블 생성**
3. **categories 테이블 생성**
4. **user_sports 테이블 생성**
5. **함수 및 트리거 생성**
6. **초기 데이터 삽입**

### 3.2 Storage 버킷 생성

1. Storage 메뉴로 이동
2. 새 버킷 생성: `profile-images`
3. Public 설정: ✓ (체크)
4. SQL Editor에서 Storage 정책 실행

## 4. 프로젝트 실행

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 접속
http://localhost:3000
```

## 5. 기능 확인

### 5.1 회원가입

1. 메인 페이지에서 "회원가입" 클릭
2. 필수 정보 입력:
   - 이름
   - 이메일
   - 전화번호 (출석 체크용)
   - 생년월일
   - 비밀번호
   - 멤버십 타입 선택
   - 역할 선택 (선수/코치)
3. "계정 만들기" 클릭

### 5.2 로그인

1. 메인 페이지에서 "로그인" 클릭
2. 이메일과 비밀번호 입력
3. "로그인" 클릭

### 5.3 출석 체크

1. 브라우저에서 `/attendance` 페이지로 이동
   ```
   http://localhost:3000/attendance
   ```
2. 전화번호 마지막 4자리 입력
3. "체크인" 버튼 클릭
4. 성공 메시지 확인

## 6. 모바일 반응형

모든 페이지는 모바일 환경에 최적화되어 있습니다:

- 회원가입/로그인: 모든 화면 크기에서 동작
- 출석 체크: 태블릿/모바일에서 키오스크 모드 지원
- 대시보드: 반응형 레이아웃 적용

### 모바일에서 테스트

1. Chrome DevTools 열기 (F12)
2. 디바이스 툴바 토글 (Ctrl+Shift+M)
3. 원하는 기기 선택하여 테스트

## 7. 주요 파일 구조

```
sportition-mvp3/
├── app/
│   ├── layout.js              # AuthProvider 포함
│   ├── page.js                # 메인 페이지
│   └── attendance/
│       └── page.js            # 출석 체크 페이지
├── lib/
│   ├── supabase.js            # Supabase 클라이언트 및 API 함수
│   └── AuthContext.js         # 인증 컨텍스트
├── components/
│   └── views/
│       └── landing.js         # 로그인/회원가입 컴포넌트
├── .env.local                 # 환경 변수 (수동 생성 필요)
└── DATABASE_SCHEMA.md         # 데이터베이스 스키마

```

## 8. API 함수 사용 예시

### 8.1 회원가입

```javascript
import { signUp } from '@/lib/supabase';

const { data, error } = await signUp(email, password, {
  full_name: '홍길동',
  phone: '010-1234-5678',
  phone_last_four: '5678',
  birth_date: '1990-01-01',
  role: 'athlete',
  membership_type: 'standard',
});
```

### 8.2 로그인

```javascript
import { signIn } from '@/lib/supabase';

const { data, error } = await signIn(email, password);
```

### 8.3 출석 체크

```javascript
import { checkAttendance } from '@/lib/supabase';

const { data, error, message } = await checkAttendance(userId, membershipType);
```

### 8.4 전화번호로 사용자 검색

```javascript
import { searchUserByPhone } from '@/lib/supabase';

const { data, error } = await searchUserByPhone('5678'); // 마지막 4자리
```

## 9. 인증 컨텍스트 사용

```javascript
'use client';

import { useAuth } from '@/lib/AuthContext';

function MyComponent() {
  const { user, profile, loading, isAuthenticated, isAthlete, isCoach } = useAuth();

  if (loading) return <div>Loading...</div>;
  
  if (!isAuthenticated) return <div>로그인이 필요합니다</div>;

  return (
    <div>
      <h1>안녕하세요, {profile?.full_name}님</h1>
      {isAthlete && <p>선수 대시보드</p>}
      {isCoach && <p>코치 대시보드</p>}
    </div>
  );
}
```

## 10. 문제 해결

### 10.1 환경 변수가 인식되지 않을 때

```bash
# 개발 서버 재시작
npm run dev
```

### 10.2 RLS 정책 오류

Supabase 대시보드에서 Authentication > Policies를 확인하고, 
각 테이블의 RLS 정책이 제대로 설정되어 있는지 확인하세요.

### 10.3 출석 체크가 작동하지 않을 때

1. profiles 테이블에 `phone_last_four` 컬럼이 있는지 확인
2. 회원가입 시 전화번호가 올바르게 저장되었는지 확인
3. 브라우저 콘솔에서 에러 메시지 확인

## 11. 보안 고려사항

- `.env.local` 파일은 절대 Git에 커밋하지 마세요
- ANON KEY는 프론트엔드에서 사용해도 안전합니다 (RLS로 보호됨)
- 민감한 작업은 Row Level Security로 보호되어 있습니다
- 서버 사이드 작업이 필요한 경우 Next.js API Routes를 사용하세요

## 12. 추가 기능 개발

### 12.1 출석 통계 조회

```javascript
import { getUserAttendance } from '@/lib/supabase';

const startDate = '2024-01-01';
const endDate = '2024-12-31';
const { data, error } = await getUserAttendance(userId, startDate, endDate);
```

### 12.2 프로필 업데이트

```javascript
import { updateUserProfile } from '@/lib/supabase';

const { data, error } = await updateUserProfile(userId, {
  full_name: '새 이름',
  membership_type: 'premium',
});
```

### 12.3 카테고리 조회

```javascript
import { getCategories } from '@/lib/supabase';

// 모든 카테고리
const { data, error } = await getCategories();

// 특정 타입의 카테고리
const { data, error } = await getCategories('sport');
```

## 13. 배포

### 13.1 Vercel 배포

1. Vercel에 프로젝트 연결
2. Environment Variables 설정:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. 배포

### 13.2 다른 플랫폼

환경 변수만 올바르게 설정하면 어떤 플랫폼에서도 배포 가능합니다.

## 지원

문제가 발생하면 다음을 확인하세요:
- [Supabase 공식 문서](https://supabase.com/docs)
- [Next.js 공식 문서](https://nextjs.org/docs)
- 프로젝트의 `DATABASE_SCHEMA.md` 파일

# 문제 해결 가이드

## 로딩 화면에서 멈춤 문제

새로고침 후 "로딩 중..." 화면에서 멈추는 경우, 다음을 확인하세요:

### 1. Supabase 환경 변수 확인

`.env.local` 파일의 Supabase 키가 올바른지 확인하세요:

```bash
# 올바른 형식 예시
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZGxvaHlteG9ncXhxY3FrcXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODU1MzY4NjksImV4cCI6MjAwMTExMjg2OX0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**중요:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 `eyJ`로 시작하는 긴 JWT 토큰이어야 합니다.

### 2. Supabase 키 가져오기

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. Settings > API 메뉴로 이동
4. **Project URL**과 **anon public** 키 복사
5. `.env.local` 파일에 붙여넣기

### 3. 개발 서버 재시작

환경 변수를 수정한 후에는 반드시 개발 서버를 재시작해야 합니다:

```bash
# 현재 실행 중인 서버 중지 (Ctrl + C)
# 그 다음 다시 시작
npm run dev
```

### 4. 브라우저 캐시 초기화

문제가 지속되면 브라우저 캐시를 초기화하세요:

1. 개발자 도구 열기 (F12 또는 Cmd+Option+I)
2. 네트워크 탭 선택
3. "Disable cache" 체크
4. 페이지 새로고침 (Cmd+Shift+R 또는 Ctrl+Shift+R)

또는:

1. 개발자 도구에서 Application > Storage 탭
2. "Clear site data" 클릭
3. 페이지 새로고침

### 5. 콘솔 로그 확인

개발자 도구의 콘솔 탭에서 에러 메시지를 확인하세요:

- `[AuthContext]`로 시작하는 로그 확인
- 빨간색 에러 메시지 확인
- Supabase 연결 에러 확인

### 6. 데이터베이스 연결 확인

Supabase 대시보드에서:

1. Table Editor로 이동
2. `users` 테이블이 존재하는지 확인
3. RLS (Row Level Security) 정책이 올바르게 설정되어 있는지 확인

## 일반적인 에러

### "Supabase 환경 변수가 없습니다"

→ `.env.local` 파일이 없거나 키가 비어있습니다. 위의 1-3번 단계를 따르세요.

### "Invalid API key"

→ ANON_KEY가 잘못되었습니다. Supabase Dashboard에서 올바른 키를 다시 복사하세요.

### "Failed to load user profile"

→ `users` 테이블에 사용자 데이터가 없거나 RLS 정책 문제일 수 있습니다.

## 추가 도움이 필요한 경우

1. 브라우저 콘솔의 에러 메시지 스크린샷
2. `.env.local` 파일 내용 (키는 가리고)
3. Supabase 프로젝트 설정 확인

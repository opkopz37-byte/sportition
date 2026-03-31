# 🔧 Supabase 수정 가이드 (초보자용)

이 가이드를 **순서대로** 따라하시면 됩니다. 천천히 하나씩 진행하세요!

---

## 📍 **1단계: Supabase 대시보드 접속**

### 1-1. 웹사이트 열기
- 브라우저에서 https://app.supabase.com 접속
- 로그인

### 1-2. 프로젝트 선택
- 본인의 프로젝트 클릭
- 프로젝트 이름: **okdlohymxogqxqcqkqpl** (URL에서 확인 가능)

---

## 🔑 **2단계: 올바른 API 키 복사하기**

### 2-1. Settings 메뉴로 이동
1. 왼쪽 사이드바 하단의 **⚙️ Settings** 클릭
2. **API** 메뉴 클릭

### 2-2. API 키 복사
찾아야 할 것:
- **Project URL**: `https://okdlohymxogqxqcqkqpl.supabase.co` (이건 맞음 ✅)
- **anon public**: 이것이 중요합니다! ⚠️

**올바른 anon public 키 특징:**
- `eyJ`로 시작
- 매우 긺 (200자 이상)
- 점(`.`)으로 3부분으로 나뉨
- 예시: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJz...`

### 2-3. 키 복사
1. **anon public** 옆의 복사 아이콘 클릭
2. 전체가 복사되었는지 확인

---

## 💻 **3단계: .env.local 파일 수정하기**

### 3-1. VSCode(또는 커서)에서 파일 열기
- 프로젝트 루트 폴더에서 `.env.local` 파일 열기

### 3-2. ANON_KEY 교체
**기존 (잘못된 키):**
```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Gu8vvLtw316C44imxeyQ-Q_pxetXKdT
```

**수정 후 (올바른 키):**
```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ로시작하는매우긴키를여기에붙여넣기
```

### 3-3. 파일 저장
- `Cmd + S` (Mac) 또는 `Ctrl + S` (Windows)로 저장

---

## 🗄️ **4단계: 데이터베이스 수정하기**

### 4-1. SQL Editor 열기
1. Supabase Dashboard 왼쪽 메뉴에서 **🛢️ SQL Editor** 클릭
2. **+ New query** 버튼 클릭

### 4-2. SQL 파일 내용 복사
1. 프로젝트 폴더의 `ADD_SKILL_POINTS.sql` 파일 열기
2. **전체 내용 복사** (Cmd+A 후 Cmd+C)

### 4-3. SQL 실행
1. SQL Editor에 **붙여넣기** (Cmd+V)
2. 오른쪽 하단의 **▶️ Run** 버튼 클릭
3. 실행 완료까지 대기 (약 5-10초)

### 4-4. 성공 확인
실행 후 하단에 다음 메시지가 보이면 성공:
```
✅ 스킬 포인트 시스템 설정 완료!
   - users.skill_points 컬럼 추가됨
   - attendance 테이블 확인/생성됨
   - 인덱스 및 RLS 정책 설정됨
   - 스킬 포인트 랭킹 뷰 생성됨
```

### 4-5. 에러가 발생하면?

#### 에러: "column already exists"
→ 이미 컬럼이 있다는 의미, 무시해도 됨 (정상)

#### 에러: "relation does not exist"
→ users 또는 attendance 테이블이 없음
→ 먼저 기본 테이블부터 생성 필요 (SUPABASE_SETUP.md 참고)

#### 에러: "permission denied"
→ RLS 정책 문제
→ Table Editor에서 RLS 확인 필요

---

## 🔍 **5단계: 결과 확인하기**

### 5-1. users 테이블 확인
1. 왼쪽 메뉴 **📊 Table Editor** 클릭
2. **users** 테이블 선택
3. 컬럼 목록에서 **skill_points** 컬럼이 있는지 확인
4. 기존 사용자의 skill_points 값이 0인지 확인

### 5-2. attendance 테이블 확인
1. Table Editor에서 **attendance** 테이블 선택
2. 컬럼 확인:
   - `id` (UUID)
   - `user_id` (UUID)
   - `check_in_time` (timestamp)
   - `attendance_date` (date) ← **중요!**
   - `location` (text)
   - `created_at` (timestamp)

### 5-3. 제약 조건 확인
1. attendance 테이블에서 **Constraints** 탭 클릭
2. `idx_attendance_user_date` UNIQUE 인덱스 확인
   - `(user_id, attendance_date)` 조합이 유일해야 함

---

## 🖥️ **6단계: 개발 서버 재시작**

### 6-1. 터미널에서 서버 중지
- 개발 서버가 실행 중인 터미널에서
- `Ctrl + C` (Mac/Windows 동일) 눌러서 중지

### 6-2. 서버 재시작
```bash
npm run dev
```

### 6-3. 브라우저 새로고침
- 브라우저에서 `Cmd + Shift + R` (Mac) 또는 `Ctrl + Shift + R` (Windows)
- 강력 새로고침으로 캐시 초기화

---

## ✅ **7단계: 테스트하기**

### 7-1. 회원가입 테스트
1. 새 계정으로 회원가입
2. Supabase Table Editor > users 테이블 확인
3. 새 사용자의 `skill_points`가 **0**인지 확인

### 7-2. 출석 체크 테스트
1. 로그인 후 **출석체크** 메뉴 클릭
2. **출석 체크** 버튼 클릭
3. "출석 체크 완료! 스킬 포인트 +1 획득!" 메시지 확인
4. 스킬트리 페이지에서 "사용 가능 포인트: 1" 확인

### 7-3. 중복 출석 방지 테스트
1. 같은 날 다시 출석 체크 시도
2. "이미 출석 체크되었습니다" 메시지 확인
3. 포인트가 중복으로 증가하지 않는지 확인

---

## 🆘 **문제 발생 시 체크리스트**

### ❌ "로딩 중..." 화면에서 멈춤
- [ ] ANON_KEY를 `eyJ`로 시작하는 긴 키로 교체했나요?
- [ ] `.env.local` 파일을 저장했나요?
- [ ] 개발 서버를 재시작했나요?
- [ ] 브라우저 캐시를 초기화했나요?

### ❌ 출석 체크 안 됨
- [ ] SQL 파일(`ADD_SKILL_POINTS.sql`)을 실행했나요?
- [ ] users 테이블에 `skill_points` 컬럼이 있나요?
- [ ] attendance 테이블이 존재하나요?
- [ ] 로그인은 정상적으로 되었나요?

### ❌ 스킬 포인트가 안 올라감
- [ ] Supabase Table Editor에서 값이 실제로 증가했나요?
- [ ] 브라우저를 새로고침했나요?
- [ ] 콘솔에 에러 메시지가 있나요? (F12 → Console 탭)

### ❌ 중복 출석이 됨
- [ ] `attendance_date` 컬럼이 있나요?
- [ ] UNIQUE 인덱스 `idx_attendance_user_date`가 있나요?
- [ ] 서버 시간대(타임존)가 올바른가요?

---

## 📞 **추가 도움이 필요하면?**

### 스크린샷 공유 필요 항목
1. Supabase Settings > API 페이지
2. Table Editor > users 테이블 구조
3. Table Editor > attendance 테이블 구조
4. 브라우저 콘솔의 에러 메시지
5. SQL Editor 실행 결과

---

## 🎉 **완료 확인**

모든 단계가 끝나면:
- ✅ 로그인이 정상 작동
- ✅ 대시보드가 빠르게 로드
- ✅ 출석 체크 메뉴 접근 가능
- ✅ 출석 시 스킬 포인트 +1
- ✅ 프로필 정보가 대시보드에 정확히 표시

---

## 📝 **요약: 꼭 해야 할 것 3가지**

### ⭐ 1. API 키 교체
```bash
.env.local 파일에서
NEXT_PUBLIC_SUPABASE_ANON_KEY를 
eyJ로 시작하는 긴 키로 교체
```

### ⭐ 2. SQL 실행
```bash
Supabase SQL Editor에서
ADD_SKILL_POINTS.sql 파일 내용 실행
```

### ⭐ 3. 서버 재시작
```bash
터미널에서 Ctrl+C 후
npm run dev 다시 실행
```

**이 3가지만 하면 모든 기능이 정상 작동합니다!** 🚀

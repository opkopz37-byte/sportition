# 🔧 Supabase 최종 수정 가이드

## 📌 개요
이 가이드는 역할 표시 및 대시보드 개선 업데이트 후 Supabase에서 확인하고 수정해야 할 사항을 정리한 것입니다.

---

## ✅ 1단계: 기존 데이터 확인

### 1-1. `auth.users` 테이블 확인
1. Supabase 대시보드 접속
2. 좌측 메뉴에서 **Authentication** 클릭
3. **Users** 탭 클릭
4. 등록된 사용자가 표시되는지 확인

### 1-2. `public.users` 테이블 확인
1. 좌측 메뉴에서 **Table Editor** 클릭
2. **users** 테이블 선택
3. 다음 컬럼들이 존재하는지 확인:
   - ✅ `id` (UUID, Primary Key)
   - ✅ `email` (TEXT)
   - ✅ `nickname` (TEXT)
   - ✅ `name` (TEXT, NULL 가능)
   - ✅ `role` (TEXT, 'athlete', 'coach', 'gym' 중 하나)
   - ✅ `phone_number` (TEXT)
   - ✅ `birth_date` (DATE)
   - ✅ `gender` (TEXT, 'male' 또는 'female')
   - ✅ `height` (INTEGER)
   - ✅ `weight` (INTEGER)
   - ✅ `boxing_style` (TEXT, NULL 가능)
   - ✅ `gym_name` (TEXT, NULL 가능)
   - ✅ `gym_location` (TEXT, NULL 가능)
   - ✅ `representative_phone` (TEXT, NULL 가능)
   - ✅ `skill_points` (INTEGER, DEFAULT 0)
   - ✅ `tier` (TEXT, DEFAULT 'Bronze III')
   - ✅ `tier_points` (INTEGER, DEFAULT 0)
   - ✅ `created_at` (TIMESTAMPTZ)
   - ✅ `updated_at` (TIMESTAMPTZ)

**❗ 만약 위 컬럼 중 없는 것이 있다면:**
- 아래 "2단계: 테이블 구조 업데이트" 섹션을 따라주세요.

---

## ✅ 2단계: 테이블 구조 업데이트 (필요한 경우만)

### 상황 1: `skill_points` 컬럼이 없는 경우

1. 좌측 메뉴에서 **SQL Editor** 클릭
2. 새 쿼리 작성
3. 아래 SQL을 **복사하여 붙여넣기**:

```sql
-- skill_points 컬럼 추가
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS skill_points INTEGER DEFAULT 0;

-- 기존 데이터 초기화
UPDATE public.users
SET skill_points = 0
WHERE skill_points IS NULL;

-- NOT NULL 제약 조건 추가
ALTER TABLE public.users
ALTER COLUMN skill_points SET NOT NULL;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_skill_points ON public.users(skill_points DESC);
```

4. **Run** 버튼 클릭
5. 성공 메시지 확인: `Success. No rows returned`

---

### 상황 2: `attendance` 테이블에 `attendance_date` 컬럼이 없는 경우

1. **SQL Editor**에서 새 쿼리 작성
2. 아래 SQL을 **복사하여 붙여넣기**:

```sql
-- attendance_date 컬럼 추가
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS attendance_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- 기존 데이터가 있다면 check_in_time 기준으로 attendance_date 업데이트
UPDATE public.attendance
SET attendance_date = DATE(check_in_time)
WHERE attendance_date IS NULL OR attendance_date = CURRENT_DATE;

-- 유니크 인덱스 생성 (하루에 한 번만 출석 가능)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_user_date 
ON public.attendance(user_id, attendance_date);
```

3. **Run** 버튼 클릭
4. 성공 메시지 확인

---

### 상황 3: `statistics` 테이블에 출석 관련 컬럼이 없는 경우

1. **SQL Editor**에서 새 쿼리 작성
2. 아래 SQL을 **복사하여 붙여넣기**:

```sql
-- statistics 테이블에 출석 통계 컬럼 추가
ALTER TABLE public.statistics
ADD COLUMN IF NOT EXISTS total_attendance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;

-- 기존 데이터 초기화
UPDATE public.statistics
SET 
  total_attendance = COALESCE(total_attendance, 0),
  current_streak = COALESCE(current_streak, 0),
  longest_streak = COALESCE(longest_streak, 0);
```

3. **Run** 버튼 클릭
4. 성공 메시지 확인

---

## ✅ 3단계: 데이터 정합성 확인

### 3-1. 역할(Role) 데이터 확인

1. **Table Editor** → **users** 테이블로 이동
2. 각 사용자의 `role` 컬럼 값 확인:
   - **일반회원**: `role = 'athlete'`
   - **선수**: `role = 'coach'`
   - **체육관**: `role = 'gym'`

**❗ 만약 역할이 잘못 표시되어 있다면:**

특정 사용자의 역할을 수정하려면:

```sql
-- 예시: 특정 이메일의 역할 변경
UPDATE public.users
SET role = 'athlete'  -- 'athlete', 'coach', 'gym' 중 선택
WHERE email = '사용자이메일@example.com';
```

---

### 3-2. 신체 정보 확인

1. **Table Editor** → **users** 테이블로 이동
2. 다음 컬럼들이 정상적으로 입력되어 있는지 확인:
   - `height` (키, cm 단위, 숫자)
   - `weight` (몸무게, kg 단위, 숫자)
   - `gender` ('male' 또는 'female')

**❗ 만약 NULL이거나 잘못된 값이 있다면:**

특정 사용자의 신체 정보를 수동으로 입력하려면:

```sql
-- 예시: 특정 이메일의 신체 정보 업데이트
UPDATE public.users
SET 
  height = 175,           -- cm 단위
  weight = 70,            -- kg 단위
  gender = 'male'         -- 'male' 또는 'female'
WHERE email = '사용자이메일@example.com';
```

---

## ✅ 4단계: 스킬 포인트 랭킹 뷰 생성 (선택 사항)

스킬 포인트 기반 랭킹을 쉽게 조회하기 위한 뷰를 생성합니다.

1. **SQL Editor**에서 새 쿼리 작성
2. 아래 SQL을 **복사하여 붙여넣기**:

```sql
-- 스킬 포인트 랭킹 뷰 생성
CREATE OR REPLACE VIEW skill_points_ranking AS
SELECT 
  id,
  nickname,
  name,
  role,
  skill_points,
  tier,
  tier_points,
  gym_name,
  ROW_NUMBER() OVER (ORDER BY skill_points DESC) AS rank
FROM public.users
WHERE role IN ('athlete', 'coach')
ORDER BY skill_points DESC;

-- 뷰 접근 권한 설정
GRANT SELECT ON skill_points_ranking TO authenticated;
GRANT SELECT ON skill_points_ranking TO anon;
```

3. **Run** 버튼 클릭
4. 성공 메시지 확인

---

## ✅ 5단계: Row Level Security (RLS) 정책 확인

RLS가 제대로 설정되어 있는지 확인합니다.

### 5-1. `users` 테이블 RLS 정책 확인

1. **Table Editor** → **users** 테이블 선택
2. 우측 상단 **View Policies** 버튼 클릭
3. 다음 정책들이 있는지 확인:
   - ✅ `Users can view own profile` (SELECT)
   - ✅ `Users can update own profile` (UPDATE)
   - ✅ `Anyone can view other users` (SELECT)

**❗ 만약 정책이 없거나 부족하다면:**

```sql
-- RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 본인 프로필 조회
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

-- 본인 프로필 수정
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
USING (auth.uid() = id);

-- 다른 사용자 프로필 조회 (공개 정보)
CREATE POLICY "Anyone can view other users"
ON public.users FOR SELECT
USING (true);

-- 신규 가입 시 프로필 생성
CREATE POLICY "Users can insert own profile"
ON public.users FOR INSERT
WITH CHECK (auth.uid() = id);
```

---

### 5-2. `attendance` 테이블 RLS 정책 확인

1. **Table Editor** → **attendance** 테이블 선택
2. 우측 상단 **View Policies** 버튼 클릭
3. 다음 정책들이 있는지 확인:
   - ✅ `Users can view own attendance` (SELECT)
   - ✅ `Users can create own attendance` (INSERT)

**❗ 만약 정책이 없다면:**

```sql
-- RLS 활성화
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 본인 출석 조회
CREATE POLICY "Users can view own attendance"
ON public.attendance FOR SELECT
USING (auth.uid() = user_id);

-- 본인 출석 생성
CREATE POLICY "Users can create own attendance"
ON public.attendance FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

---

## ✅ 6단계: 테스트 데이터 정리 (선택 사항)

테스트 중 잘못 입력된 데이터를 정리하려면:

### 6-1. 특정 사용자 데이터 삭제

```sql
-- 특정 이메일의 모든 데이터 삭제
-- 주의: 이 작업은 되돌릴 수 없습니다!

-- 1. attendance 삭제 (먼저)
DELETE FROM public.attendance
WHERE user_id IN (
  SELECT id FROM public.users WHERE email = '삭제할이메일@example.com'
);

-- 2. statistics 삭제
DELETE FROM public.statistics
WHERE user_id IN (
  SELECT id FROM public.users WHERE email = '삭제할이메일@example.com'
);

-- 3. tier_rankings 삭제
DELETE FROM public.tier_rankings
WHERE user_id IN (
  SELECT id FROM public.users WHERE email = '삭제할이메일@example.com'
);

-- 4. users 삭제
DELETE FROM public.users
WHERE email = '삭제할이메일@example.com';

-- 5. auth.users 삭제 (Authentication 메뉴에서 직접 삭제하는 것을 권장)
-- Authentication → Users → 해당 사용자 선택 → Delete user
```

---

## ✅ 7단계: 최종 검증

### 7-1. 회원가입 테스트

1. 웹사이트에서 **로그아웃** (이미 로그아웃 상태라면 생략)
2. **회원가입** 클릭
3. 각 역할별로 회원가입 테스트:
   - **일반회원 (athlete)**: 복싱 스타일 없음, 신체 정보 입력
   - **선수 (coach)**: 복싱 스타일 선택, 신체 정보 입력
   - **체육관 (gym)**: 체육관명, 위치, 대표 연락처 입력

4. 회원가입 후 자동 로그인 확인
5. 대시보드에서 다음 정보가 올바르게 표시되는지 확인:
   - ✅ 역할 배지 색상 (일반회원: 파란색, 선수: 빨간색, 체육관: 보라색)
   - ✅ 역할 텍스트 (일반회원, 선수, 체육관)
   - ✅ 신체 정보 섹션 (키, 몸무게, 성별)
   - ✅ 복싱 스타일 (선수만 표시)

### 7-2. Supabase 데이터 확인

1. **Table Editor** → **users** 테이블
2. 방금 가입한 사용자의 데이터가 정상적으로 입력되었는지 확인
3. 특히 다음 항목 확인:
   - `role`: 'athlete', 'coach', 'gym' 중 올바른 값
   - `skill_points`: 0으로 초기화
   - `height`, `weight`, `gender`: 입력한 값대로 저장
   - `boxing_style`: 선수는 값 있음, 일반회원은 NULL
   - `gym_name`, `gym_location`: 체육관은 값 있음, 다른 역할은 NULL

### 7-3. 출석 체크 테스트

1. 좌측 메뉴에서 **출석체크** 클릭
2. **출석하기** 버튼 클릭
3. "Skill Points +1" 메시지 표시 확인
4. Supabase **Table Editor** → **attendance** 테이블에서:
   - 새 출석 기록 생성 확인
   - `attendance_date`가 오늘 날짜로 저장되었는지 확인
5. **Table Editor** → **users** 테이블에서:
   - 해당 사용자의 `skill_points`가 1 증가했는지 확인

### 7-4. 프로필 수정 테스트

1. 우측 상단 프로필 아이콘 클릭
2. **회원정보** 클릭
3. **수정** 버튼 클릭
4. 정보 변경 (예: 닉네임, 키, 몸무게)
5. **저장** 버튼 클릭
6. 대시보드로 돌아가서 변경 사항이 즉시 반영되었는지 확인
7. Supabase **Table Editor** → **users** 테이블에서도 확인

---

## 🔍 문제 해결 (Troubleshooting)

### 문제 1: "일반회원"이 "선수"로 표시됨
**원인**: `translations.js` 파일의 역할 번역 오류  
**해결**: 이미 코드에서 수정 완료 ✅

### 문제 2: 신체 정보가 대시보드에 표시되지 않음
**원인**: 조건부 렌더링 로직 오류 (`boxing_style`이 없으면 전체 섹션 숨김)  
**해결**: 이미 코드에서 수정 완료 ✅ (신체 정보는 별도 섹션으로 분리)

### 문제 3: 출석 체크가 중복됨 (하루에 여러 번 가능)
**원인**: `attendance` 테이블에 유니크 제약이 없음  
**해결**: 위 "2단계 - 상황 2" SQL 실행

### 문제 4: 스킬 포인트가 증가하지 않음
**원인**: `skill_points` 컬럼이 없거나, `checkAttendance` 함수 오류  
**해결**:
1. 위 "2단계 - 상황 1" SQL 실행
2. 코드는 이미 수정 완료 ✅

### 문제 5: 프로필 수정 후 대시보드에 반영되지 않음
**원인**: 프로필 새로고침 로직 미호출  
**해결**: 이미 코드에서 수정 완료 ✅

---

## 📊 수정된 사항 요약

### 코드 수정 (자동 완료됨) ✅
1. **`lib/translations.js`**:
   - `athlete: '일반회원'`
   - `coach: '선수'`
   - `gym: '체육관'`

2. **`components/views/dashboard.js`**:
   - 신체 정보 섹션을 복싱 스타일 섹션과 분리
   - 역할 배지 색상 구분 (일반회원: 파란색, 선수: 빨간색, 체육관: 보라색)
   - 프로필 헤더에 더 많은 정보 표시 (키, 몸무게, 복싱 스타일 등)

3. **`components/views/mypage.js`**:
   - 역할 배지 색상 구분 적용

4. **`components/views/ranking.js`**:
   - 역할 배지 색상 구분 적용

5. **`lib/AuthContext.js`**:
   - 프로필 로드를 비동기로 실행하여 초기 로딩 속도 개선

6. **`components/views/attendance.js`**:
   - 데이터 로딩을 병렬로 실행하여 성능 개선

### Supabase 수정 (직접 실행 필요) ⚠️
위의 **2단계**에 따라 필요한 SQL을 실행해주세요.

---

## ✨ 개선된 기능

1. **역할 구분 명확화**:
   - 일반회원(파란색), 선수(빨간색), 체육관(보라색) 배지
   - 올바른 한국어 표시 (일반회원, 선수, 체육관)

2. **대시보드 개선**:
   - 신체 정보가 모든 역할에 표시됨 (키, 몸무게, 성별)
   - 복싱 스타일은 선수만 표시
   - 프로필 헤더에 핵심 정보 요약 표시

3. **성능 개선**:
   - 초기 로딩 속도 향상 (프로필 로드 비동기 처리)
   - 출석 페이지 로딩 속도 향상 (병렬 데이터 로드)

4. **데이터 무결성**:
   - 하루에 한 번만 출석 가능 (`attendance_date` 유니크 제약)
   - 스킬 포인트 자동 증가 및 추적

---

## 🚨 주의사항

1. **SQL 실행 전 백업**: 중요한 데이터가 있다면 백업을 먼저 해주세요.
2. **테스트 환경**: 가능하다면 테스트 Supabase 프로젝트에서 먼저 실행해보세요.
3. **기존 사용자**: 이미 가입한 사용자가 있다면, 역할과 신체 정보를 수동으로 확인하고 필요시 업데이트하세요.
4. **이메일 확인**: Supabase의 이메일 확인 설정을 확인하세요 (Settings → Authentication → Email Auth).

---

## 💬 문제가 발생하면?

1. 브라우저 콘솔 (F12) 열기
2. 에러 메시지 확인
3. Supabase 대시보드에서 **Logs** 확인
4. 위 가이드의 "문제 해결" 섹션 참고

---

## ✅ 완료 체크리스트

- [ ] Supabase `users` 테이블에 모든 필요한 컬럼 존재 확인
- [ ] `skill_points` 컬럼 추가 (필요시)
- [ ] `attendance_date` 컬럼 및 유니크 제약 추가 (필요시)
- [ ] `statistics` 테이블에 출석 통계 컬럼 추가 (필요시)
- [ ] RLS 정책 확인 및 설정
- [ ] 회원가입 테스트 (3가지 역할 모두)
- [ ] 대시보드에서 역할 및 정보 표시 확인
- [ ] 출석 체크 테스트
- [ ] 프로필 수정 테스트

모든 항목이 완료되면 ✅ 표시를 해주세요!

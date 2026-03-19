# 회원가입 "Failed to fetch" 에러 해결 방법

## 문제 원인
Supabase 데이터베이스에 필요한 테이블과 트리거가 생성되지 않아서 발생한 에러입니다.

## 해결 방법

### 1단계: Supabase 대시보드 접속
1. [https://supabase.com](https://supabase.com) 접속
2. 로그인
3. 프로젝트 선택: `okdlohymxogaxqcqkqpl`

### 2단계: SQL Editor 열기
1. 왼쪽 메뉴에서 **SQL Editor** 클릭
2. **New query** 클릭

### 3단계: 아래 SQL을 복사해서 실행

```sql
-- 1. profiles 테이블 생성
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  phone_last_four TEXT,
  birth_date DATE,
  profile_image_url TEXT,
  role TEXT DEFAULT 'athlete' CHECK (role IN ('athlete', 'coach', 'admin')),
  membership_type TEXT DEFAULT 'basic' CHECK (membership_type IN ('basic', 'standard', 'premium')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_profiles_phone_last_four ON profiles(phone_last_four);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 3. Row Level Security (RLS) 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
CREATE POLICY "Enable insert for authenticated users only"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 5. 자동 프로필 생성 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, phone_last_four, birth_date, role, membership_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_last_four', ''),
    COALESCE((NEW.raw_user_meta_data->>'birth_date')::date, NULL),
    COALESCE(NEW.raw_user_meta_data->>'role', 'athlete'),
    COALESCE(NEW.raw_user_meta_data->>'membership_type', 'basic')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 트리거 생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. attendance 테이블 생성 (출석 체크용)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  check_out_time TIMESTAMP WITH TIME ZONE,
  membership_type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 8. attendance 인덱스
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);

-- 9. attendance RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own attendance" ON attendance;
CREATE POLICY "Users can view their own attendance"
  ON attendance FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own attendance" ON attendance;
CREATE POLICY "Users can insert their own attendance"
  ON attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Coaches and admins can view all attendance" ON attendance;
CREATE POLICY "Coaches and admins can view all attendance"
  ON attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('coach', 'admin')
    )
  );
```

### 4단계: SQL 실행
1. 위의 SQL을 모두 선택 (Cmd+A)
2. 복사 (Cmd+C)
3. Supabase SQL Editor에 붙여넣기 (Cmd+V)
4. **Run** 버튼 클릭 (또는 Cmd+Enter)

### 5단계: 확인
1. 왼쪽 메뉴에서 **Table Editor** 클릭
2. `profiles` 테이블이 보이는지 확인
3. `attendance` 테이블이 보이는지 확인

### 6단계: 회원가입 다시 시도
1. 브라우저에서 `http://localhost:3000` 새로고침
2. 회원가입 페이지로 이동
3. 정보 입력 후 가입 시도

## 성공 확인
- 에러 없이 "회원가입이 완료되었습니다!" 메시지 표시
- Supabase 대시보드 > Authentication > Users에 새 사용자 추가됨
- Table Editor > profiles에 프로필 정보 저장됨

## 추가 문제 발생 시

### 이메일 확인 비활성화 (테스트용)
1. Supabase 대시보드 > Authentication > Settings
2. "Enable email confirmations" 끄기
3. Save

### 로컬호스트 허용
1. Supabase 대시보드 > Settings > API
2. "Site URL"에 `http://localhost:3000` 추가

## 도움말
- 자세한 내용은 `DATABASE_SCHEMA.md` 참고
- 전체 설정 가이드는 `SUPABASE_SETUP.md` 참고

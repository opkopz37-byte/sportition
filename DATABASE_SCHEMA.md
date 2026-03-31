# Sportition Database Schema

Supabase를 사용한 데이터베이스 스키마 설계

## 테이블 구조

### 1. profiles (사용자 프로필)
사용자의 기본 정보와 멤버십 정보를 저장합니다.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  phone_last_four TEXT, -- 출석 체크용 (전화번호 마지막 4자리)
  birth_date DATE,
  profile_image_url TEXT,
  role TEXT DEFAULT 'athlete' CHECK (role IN ('athlete', 'coach', 'admin')),
  membership_type TEXT DEFAULT 'basic' CHECK (membership_type IN ('basic', 'standard', 'premium')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_profiles_phone_last_four ON profiles(phone_last_four);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Row Level Security (RLS) 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 프로필만 조회 및 수정 가능
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 정책: 회원가입 시 프로필 생성 허용
CREATE POLICY "Enable insert for authenticated users only"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### 2. attendance (출석 기록)
사용자의 출석 체크 기록을 저장합니다.

```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  check_out_time TIMESTAMP WITH TIME ZONE,
  membership_type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date) -- 하루에 한 번만 출석 가능
);

-- 인덱스 생성
CREATE INDEX idx_attendance_user_id ON attendance(user_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date);

-- Row Level Security (RLS) 활성화
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 출석 기록만 조회 가능
CREATE POLICY "Users can view their own attendance"
  ON attendance FOR SELECT
  USING (auth.uid() = user_id);

-- 정책: 사용자는 자신의 출석 기록만 추가 가능
CREATE POLICY "Users can insert their own attendance"
  ON attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 정책: 코치와 관리자는 모든 출석 기록 조회 가능
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

### 3. categories (카테고리)
다양한 카테고리를 관리합니다 (스포츠 종목, 스킬 타입 등).

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'sport', 'skill', 'membership', 'tier' 등
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  icon TEXT, -- 아이콘 이름 또는 URL
  color TEXT, -- 색상 코드
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB, -- 추가 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_categories_type ON categories(type);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_is_active ON categories(is_active);

-- Row Level Security (RLS) 활성화
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 인증된 사용자는 카테고리 조회 가능
CREATE POLICY "Authenticated users can view categories"
  ON categories FOR SELECT
  USING (auth.role() = 'authenticated');

-- 정책: 관리자만 카테고리 수정 가능
CREATE POLICY "Only admins can modify categories"
  ON categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### 4. user_sports (사용자 스포츠 연결)
사용자가 참여하는 스포츠를 연결합니다.

```sql
CREATE TABLE user_sports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  skill_level TEXT, -- 'beginner', 'intermediate', 'advanced', 'expert'
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, sport_id)
);

-- 인덱스 생성
CREATE INDEX idx_user_sports_user_id ON user_sports(user_id);
CREATE INDEX idx_user_sports_sport_id ON user_sports(sport_id);

-- Row Level Security (RLS) 활성화
ALTER TABLE user_sports ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 스포츠만 조회 및 수정 가능
CREATE POLICY "Users can manage their own sports"
  ON user_sports FOR ALL
  USING (auth.uid() = user_id);
```

## 함수 및 트리거

### 1. 프로필 자동 생성 함수
새로운 사용자가 회원가입하면 자동으로 프로필을 생성합니다.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. updated_at 자동 업데이트 함수

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 초기 데이터 삽입

### 카테고리 초기 데이터

```sql
-- 멤버십 타입
INSERT INTO categories (name, type, description, color, sort_order) VALUES
  ('베이직', 'membership', '기본 멤버십', '#9CA3AF', 1),
  ('스탠다드', 'membership', '표준 멤버십', '#3B82F6', 2),
  ('프리미엄', 'membership', '프리미엄 멤버십', '#8B5CF6', 3);

-- 스포츠 종목
INSERT INTO categories (name, type, description, icon, sort_order) VALUES
  ('복싱', 'sport', '복싱 스포츠', '🥊', 1),
  ('킥복싱', 'sport', '킥복싱 스포츠', '🥋', 2),
  ('MMA', 'sport', '종합격투기', '🥊', 3),
  ('크로스핏', 'sport', '크로스핏 트레이닝', '💪', 4);

-- 스킬 레벨
INSERT INTO categories (name, type, description, color, sort_order) VALUES
  ('초보자', 'skill_level', '입문 단계', '#10B981', 1),
  ('중급자', 'skill_level', '중급 단계', '#3B82F6', 2),
  ('고급자', 'skill_level', '고급 단계', '#8B5CF6', 3),
  ('전문가', 'skill_level', '전문가 단계', '#F59E0B', 4);
```

## Storage 설정 (프로필 이미지)

```sql
-- Storage 버킷 생성 (Supabase 대시보드에서 수행)
-- 버킷 이름: profile-images
-- Public 설정: true

-- Storage 정책
CREATE POLICY "Anyone can view profile images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');

CREATE POLICY "Users can upload their own profile image"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own profile image"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'profile-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## 사용 방법

1. Supabase 프로젝트 생성
2. SQL Editor에서 위의 스키마 실행
3. `.env.local` 파일에 Supabase URL과 ANON KEY 설정
4. 애플리케이션에서 `lib/supabase.js`의 함수들 사용

## 주의사항

- Row Level Security (RLS)가 활성화되어 있어 사용자는 자신의 데이터만 접근 가능합니다.
- 관리자는 모든 데이터에 접근 가능합니다.
- 전화번호 마지막 4자리는 출석 체크 키오스크에서 사용됩니다.
- 프로필 이미지는 Supabase Storage에 저장됩니다.

---

## MVP3 Matches (현재 기준)

`sql/02_game_schema.sql` 기준으로 `matches`는 아래 구조를 사용합니다.

```sql
-- 핵심 컬럼
id UUID PRIMARY KEY
match_id UUID                      -- 같은 경기를 양쪽 행으로 묶는 식별자
user_id UUID NOT NULL              -- FK -> public.users(id)
opponent_id UUID                   -- FK -> public.users(id)
result TEXT CHECK (result IN ('win', 'loss', 'draw'))
score_for INTEGER                  -- optional
score_against INTEGER              -- optional
played_at TIMESTAMPTZ NOT NULL
```

### 인덱스

```sql
CREATE INDEX idx_matches_user_opponent_played_at
  ON public.matches(user_id, opponent_id, played_at DESC);

CREATE INDEX idx_matches_match_id
  ON public.matches(match_id);
```

### RLS 핵심 규칙

`sql/04_rls_policies.sql`에서 조회 정책은 다음을 따릅니다.

- 본인이 `user_id`인 경기 조회 가능
- 본인이 `opponent_id`인 경기 조회 가능

즉, **본인이 참가한 경기만 조회 가능**합니다.

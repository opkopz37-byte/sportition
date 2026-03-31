# 🔄 Database Schema 업데이트 가이드

회원가입 가이드라인 Ver 1.0 적용을 위한 데이터베이스 스키마 변경사항입니다.

## 📋 변경 사항 요약

### 1. users 테이블 컬럼 추가
기존 `profiles` 테이블 대신 `users` 테이블을 사용하고 있으므로, 아래 컬럼들을 추가해야 합니다.

### 2. 새로운 컬럼 목록

```sql
-- users 테이블에 추가할 컬럼들
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS height NUMERIC;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight NUMERIC;
ALTER TABLE users ADD COLUMN IF NOT EXISTS boxing_style TEXT CHECK (boxing_style IN ('outboxer', 'infighter', 'swarmer', 'counter_puncher'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS gym_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gym_location TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS representative_phone TEXT;
```

### 3. role enum 업데이트

```sql
-- 기존: 'athlete', 'coach', 'admin'
-- 추가: 'gym'

-- role 제약조건 수정
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('athlete', 'coach', 'gym', 'admin'));
```

## 🔨 전체 마이그레이션 SQL

Supabase SQL Editor에서 아래 코드를 한 번에 실행하세요:

```sql
-- ====================================
-- 1. 컬럼 추가
-- ====================================

-- 닉네임 (모든 역할)
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;

-- 성별 (모든 역할)
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

-- 신체 정보 (일반/선수/코치)
ALTER TABLE users ADD COLUMN IF NOT EXISTS height NUMERIC;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight NUMERIC;

-- 복싱 스타일 (선수만)
ALTER TABLE users ADD COLUMN IF NOT EXISTS boxing_style TEXT 
  CHECK (boxing_style IN ('outboxer', 'infighter', 'swarmer', 'counter_puncher'));

-- 소속 체육관 (일반/선수/코치)
ALTER TABLE users ADD COLUMN IF NOT EXISTS gym_name TEXT;

-- 체육관 위치 (체육관 역할만)
ALTER TABLE users ADD COLUMN IF NOT EXISTS gym_location TEXT;

-- 대표 연락처 (체육관 역할만)
ALTER TABLE users ADD COLUMN IF NOT EXISTS representative_phone TEXT;

-- ====================================
-- 2. role 제약조건 업데이트
-- ====================================

-- 기존 제약조건 제거
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 새로운 제약조건 추가 (gym 포함)
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('athlete', 'coach', 'gym', 'admin'));

-- ====================================
-- 3. 인덱스 추가 (선택사항, 성능 향상)
-- ====================================

CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
CREATE INDEX IF NOT EXISTS idx_users_gym_name ON users(gym_name);
CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);

-- ====================================
-- 4. 기존 데이터 마이그레이션 (필요시)
-- ====================================

-- 기존 사용자의 name을 nickname으로 복사 (nickname이 없는 경우)
UPDATE users 
SET nickname = name 
WHERE nickname IS NULL AND name IS NOT NULL;

-- ====================================
-- 5. 확인
-- ====================================

-- 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

## 📊 업데이트 후 users 테이블 구조

```
users 테이블 (최종)
├── id (UUID, PK)
├── email (TEXT, UNIQUE, NOT NULL)
├── name (TEXT, NOT NULL)                    -- 기존 (실제 이름)
├── nickname (TEXT)                          -- ⭐ 새로 추가 (닉네임)
├── phone (TEXT)                             -- 기존
├── birth_date (DATE)                        -- 기존
├── gender (TEXT)                            -- ⭐ 새로 추가
├── height (NUMERIC)                         -- ⭐ 새로 추가
├── weight (NUMERIC)                         -- ⭐ 새로 추가
├── boxing_style (TEXT)                      -- ⭐ 새로 추가 (선수만)
├── gym_name (TEXT)                          -- ⭐ 새로 추가
├── gym_location (TEXT)                      -- ⭐ 새로 추가 (체육관만)
├── representative_phone (TEXT)              -- ⭐ 새로 추가 (체육관만)
├── role (TEXT, DEFAULT 'athlete')           -- 업데이트 ('gym' 추가)
├── gender (TEXT)                            -- 기존
├── tier (TEXT)                              -- 기존
├── tier_points (INTEGER)                    -- 기존
├── membership_type (TEXT)                   -- 기존
├── created_at (TIMESTAMP)                   -- 기존
└── updated_at (TIMESTAMP)                   -- 기존
```

## 🎯 역할별 필수/선택 필드 정리

### 공통 필수 필드
- email ✅
- password ✅ (auth.users)
- nickname ✅
- phone ✅
- birth_date ✅
- gender ✅
- role ✅

### 일반 회원 (athlete)
- height (선택)
- weight (선택)
- gym_name (선택)
- membership_type ✅

### 선수 (coach)
- height (선택)
- weight (선택)
- boxing_style (선택)
- gym_name (선택)
- membership_type ✅

### 체육관 (gym)
- gym_name ✅
- gym_location ✅
- representative_phone ✅

## ⚠️ 주의사항

1. **기존 데이터 백업**
   ```sql
   -- 백업 테이블 생성
   CREATE TABLE users_backup AS SELECT * FROM users;
   ```

2. **NULL 허용**
   - 모든 새 컬럼은 NULL을 허용합니다
   - 기존 사용자 데이터에 영향 없음
   - 새 가입자부터 필수 정보 입력

3. **RLS 정책**
   - 기존 RLS 정책은 그대로 유지됩니다
   - 추가 정책이 필요하면 별도로 설정

4. **트리거 영향**
   - 기존 트리거는 영향을 받지 않습니다
   - `handle_new_user()` 함수는 수정 불필요

## 🧪 테스트 방법

### 1. 스키마 적용 확인

```sql
-- 컬럼 존재 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN (
    'nickname', 'gender', 'height', 'weight', 
    'boxing_style', 'gym_name', 'gym_location', 
    'representative_phone'
  );
```

### 2. 제약조건 확인

```sql
-- role 제약조건 확인
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'users_role_check';
```

### 3. 테스트 데이터 삽입

```sql
-- 일반 회원 테스트
INSERT INTO users (id, email, name, nickname, phone, birth_date, gender, role, membership_type)
VALUES (
  gen_random_uuid(),
  'test_athlete@example.com',
  '홍길동',
  '복싱왕',
  '010-1234-5678',
  '1990-01-01',
  'male',
  'athlete',
  'basic'
);

-- 체육관 테스트
INSERT INTO users (id, email, name, nickname, phone, birth_date, gender, role, gym_name, gym_location, representative_phone)
VALUES (
  gen_random_uuid(),
  'test_gym@example.com',
  '스포티션 복싱',
  '스포티션',
  '02-1234-5678',
  '2020-01-01',
  'male',
  'gym',
  '스포티션 복싱 체육관',
  '서울시 강남구 테헤란로 123',
  '02-1234-5678'
);
```

## 🔄 롤백 방법 (문제 발생 시)

```sql
-- 1. 새 컬럼 제거
ALTER TABLE users DROP COLUMN IF EXISTS nickname;
ALTER TABLE users DROP COLUMN IF EXISTS gender;
ALTER TABLE users DROP COLUMN IF EXISTS height;
ALTER TABLE users DROP COLUMN IF EXISTS weight;
ALTER TABLE users DROP COLUMN IF EXISTS boxing_style;
ALTER TABLE users DROP COLUMN IF EXISTS gym_name;
ALTER TABLE users DROP COLUMN IF EXISTS gym_location;
ALTER TABLE users DROP COLUMN IF EXISTS representative_phone;

-- 2. role 제약조건 복원
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('athlete', 'coach', 'admin'));

-- 3. 백업에서 복원 (필요시)
-- DELETE FROM users;
-- INSERT INTO users SELECT * FROM users_backup;
```

## ✅ 완료 체크리스트

- [ ] 백업 생성 완료
- [ ] SQL 실행 완료
- [ ] 컬럼 추가 확인
- [ ] role 제약조건 업데이트 확인
- [ ] 테스트 데이터 삽입 성공
- [ ] 기존 데이터 영향 없음 확인
- [ ] 회원가입 폼 테스트 완료

## 📝 다음 단계

1. ✅ 코드 수정 완료 (components/views/landing.js)
2. ⏳ **이 파일의 SQL 실행** (현재 단계)
3. ⏳ lib/supabase.js의 signUp 함수 업데이트
4. ⏳ 전체 테스트
5. ⏳ 프로덕션 배포

## 💡 추가 권장사항

### 1. 복싱 스타일 카테고리 테이블 (선택)

나중에 복싱 스타일을 동적으로 관리하려면:

```sql
CREATE TABLE boxing_styles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO boxing_styles (name, name_en, description) VALUES
  ('아웃복서', 'outboxer', '거리를 유지하며 싸우는 스타일'),
  ('인파이터', 'infighter', '근거리에서 강한 스타일'),
  ('스워머', 'swarmer', '압박과 물량 공세 스타일'),
  ('카운터 펀처', 'counter_puncher', '반격에 특화된 스타일');
```

### 2. 체육관 전용 테이블 (선택)

체육관 정보를 별도로 관리하려면:

```sql
CREATE TABLE gyms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  owner_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

하지만 **현재는 users 테이블에 통합하는 것이 더 간단합니다.**

---

**작성일:** 2026-03-21  
**버전:** 1.0  
**관련 문서:** DATABASE_SCHEMA.md, SUPABASE_SETUP.md

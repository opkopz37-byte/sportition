# 출석체크 & 스킬 포인트 시스템

## 개요

출석체크를 하면 스킬 포인트를 1개씩 획득하는 시스템입니다.

## 데이터베이스 설정

### 1. skill_points 컬럼 추가

`users` 테이블에 `skill_points` 컬럼을 추가해야 합니다.

```sql
-- users 테이블에 skill_points 컬럼 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS skill_points INTEGER DEFAULT 0;

-- 기존 사용자의 skill_points 초기화
UPDATE users 
SET skill_points = 0 
WHERE skill_points IS NULL;
```

### 2. 인덱스 생성 (선택사항)

```sql
-- skill_points 컬럼에 인덱스 추가 (랭킹 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_users_skill_points 
ON users(skill_points DESC);
```

## 출석체크 시스템

### 작동 방식

1. **출석 체크 버튼 클릭**
   - 오늘 이미 출석했는지 확인
   - 중복 출석 방지

2. **출석 기록 저장**
   - `attendance` 테이블에 기록 추가
   - `check_in_time` 자동 저장

3. **스킬 포인트 획득**
   - `users.skill_points` +1
   - 누적 포인트로 관리

4. **프로필 갱신**
   - AuthContext의 profile 자동 업데이트
   - 대시보드에 실시간 반영

### 출석 제한

- **하루 1회 제한**: 같은 날짜에 중복 출석 불가
- **자동 날짜 체크**: 서버 시간 기준 날짜 판단
- **타임존 처리**: UTC 기준 저장

## 스킬 포인트 사용처

### 현재 구현

- ✅ 출석 시 자동 획득
- ✅ 프로필에 누적 표시
- ✅ 스킬트리 페이지에서 확인 가능

### 향후 구현 예정

- 스킬 언락에 포인트 사용
- 특별 아이템 구매
- 프리미엄 기능 해제
- 포인트 기반 랭킹 시스템

## API 함수

### checkAttendance

출석 체크 및 스킬 포인트 획득

```javascript
import { checkAttendance } from '@/lib/supabase';

const result = await checkAttendance(userId);

// 결과 구조
{
  data: { 
    id: 'attendance-id',
    user_id: 'user-id',
    check_in_time: '2024-03-21T10:30:00Z',
    location: null
  },
  error: null,
  message: '출석 체크 완료!',
  skillPointsAdded: 1,
  totalSkillPoints: 15
}
```

### getUserAttendance

사용자의 출석 기록 조회

```javascript
import { getUserAttendance } from '@/lib/supabase';

// 최근 30일 출석 기록
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const { data } = await getUserAttendance(
  userId, 
  thirtyDaysAgo.toISOString()
);
```

## 출석체크 페이지 기능

### 메인 기능

1. **출석 체크 버튼**
   - 오늘 출석 여부 확인
   - 원터치 출석 처리
   - 스킬 포인트 획득 알림

2. **출석 통계**
   - 총 출석 일수
   - 연속 출석 일수
   - 최장 연속 기록
   - 이번 달 출석
   - 획득한 스킬 포인트

3. **최근 출석 기록**
   - 최근 30일 기록 표시
   - 날짜 및 시간 표시
   - 오늘 출석 강조 표시

### 연속 출석 계산 로직

```javascript
// 연속 출석 = 오늘 또는 어제부터 역순으로 연속된 날짜 카운트
const calculateStreak = (records) => {
  // 1. 날짜 정렬 (최신순)
  // 2. 오늘 또는 어제 출석이 있는지 확인
  // 3. 연속된 날짜만 카운트 (하루 차이만 허용)
  // 4. 연속이 끊기면 중단
}
```

## 사용자 경험 (UX)

### 출석 전

```
┌─────────────────────────┐
│   📅                    │
│   출석 체크하기           │
│   매일 출석하면           │
│   스킬 포인트 1개 획득    │
│   [출석 체크] 버튼       │
└─────────────────────────┘
```

### 출석 후

```
┌─────────────────────────┐
│   ✅                    │
│   오늘 출석 완료!        │
│   10:30 출석            │
│   ⭐ 스킬 포인트 +1    │
└─────────────────────────┘
```

## 메뉴 위치

### Athlete (선수/일반회원)
- Dashboard
- **✨ 출석체크** ← NEW
- Roadmap
- Ranking
- Statistics
- My Page

### Coach (코치)
- Insights
- **✨ 출석체크** ← NEW
- Members
- Match Room
- Management
- My Page

### Gym (체육관)
- Dashboard
- Members
- Management
- My Page

## 보상 시스템

### 출석 보상

| 조건 | 보상 |
|------|------|
| 매일 출석 | 스킬 포인트 +1 |
| 7일 연속 | (향후) 보너스 포인트 +5 |
| 30일 연속 | (향후) 특별 뱃지 |

### 포인트 활용 (향후)

| 항목 | 필요 포인트 |
|------|-------------|
| 기본 스킬 언락 | 10 |
| 고급 스킬 언락 | 50 |
| 특별 아이템 | 100 |
| 프리미엄 기능 | 500 |

## 문제 해결

### 출석이 안 될 때

1. **이미 출석함**: 하루에 한 번만 가능
2. **네트워크 에러**: 인터넷 연결 확인
3. **권한 에러**: 로그인 상태 확인
4. **데이터베이스 에러**: RLS 정책 확인

### 스킬 포인트가 안 올라갈 때

1. **users 테이블 확인**: `skill_points` 컬럼 존재 확인
2. **RLS 정책**: UPDATE 권한 확인
3. **브라우저 새로고침**: 캐시 문제일 수 있음
4. **프로필 재로드**: `refreshProfile()` 호출

## 모니터링

### 로그 확인

```javascript
// 출석 체크 로그
console.log('[checkAttendance] 출석 체크 시작:', userId);
console.log('[checkAttendance] 이미 출석함:', existingAttendance);
console.log('[checkAttendance] 출석 기록 추가 성공');
console.log('[checkAttendance] 스킬 포인트 업데이트:', current, '->', new);
```

### 데이터베이스 쿼리

```sql
-- 오늘 출석한 사용자 수
SELECT COUNT(*) 
FROM attendance 
WHERE DATE(check_in_time) = CURRENT_DATE;

-- 스킬 포인트 TOP 10
SELECT nickname, skill_points 
FROM users 
ORDER BY skill_points DESC 
LIMIT 10;

-- 연속 출석 중인 사용자
SELECT user_id, COUNT(*) as streak
FROM attendance
WHERE check_in_time >= NOW() - INTERVAL '7 days'
GROUP BY user_id
HAVING COUNT(*) = 7;
```

## 보안

### RLS 정책

```sql
-- 사용자는 자신의 출석만 기록 가능
CREATE POLICY "Users can insert own attendance"
  ON attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 스킬 포인트만 조회 가능
CREATE POLICY "Users can view own skill points"
  ON users FOR SELECT
  USING (auth.uid() = id);
```

### 부정 방지

- 서버 시간 기준 날짜 판단
- 중복 출석 방지 (UNIQUE 제약)
- 클라이언트 조작 불가능한 서버 로직

## 확장 가능성

### Phase 1 (현재)
- ✅ 기본 출석 체크
- ✅ 스킬 포인트 획득
- ✅ 출석 통계

### Phase 2 (다음 단계)
- ⏳ 연속 출석 보너스
- ⏳ 출석 뱃지 시스템
- ⏳ 출석 이벤트

### Phase 3 (미래)
- 📅 체육관 위치 기반 출석
- 📅 QR 코드 출석
- 📅 출석 리더보드
- 📅 친구와 출석 경쟁

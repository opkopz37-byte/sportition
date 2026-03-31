# 프로필 정보 데이터 흐름

## 개요

각 회원이 회원가입을 하면 입력한 정보가 Supabase 데이터베이스에 저장되고, 로그인 시 해당 정보가 대시보드에 실시간으로 반영됩니다.

## 1. 회원가입 시 저장되는 정보

### 공통 필드 (모든 역할)
- `email`: 이메일 (로그인 ID)
- `name`: 이름
- `nickname`: 닉네임
- `phone`: 전화번호
- `birth_date`: 생년월일
- `gender`: 성별 (male/female)
- `role`: 역할 (athlete/coach/gym)

### 일반 회원 & 선수 (athlete/coach)
- `tier`: 티어 (초기값: Bronze III)
- `tier_points`: 티어 포인트 (초기값: 0)
- `height`: 키 (cm)
- `weight`: 몸무게 (kg)
- `gym_name`: 소속 체육관
- `boxing_style`: 복싱 스타일 (선수만)

### 체육관 (gym)
- `gym_name`: 체육관 이름
- `gym_location`: 체육관 위치
- `representative_phone`: 대표 전화번호

## 2. 대시보드에 표시되는 프로필 정보

### 헤더 섹션
```javascript
{t('hi')}, {profile?.nickname || profile?.name} {t(profile.role)}!
```
- 닉네임 또는 이름
- 역할 (일반회원/선수/체육관)

### 프로필 카드
```javascript
<h3>{profile?.nickname || profile?.name}</h3>
<span>{profile?.role}</span>
<span>{profile?.tier}</span>
<span>{profile?.tier_points} 포인트</span>
<span>{profile?.gym_name}</span>
```
- 사용자 이니셜 (첫 글자)
- 닉네임/이름
- 역할
- 티어
- 티어 포인트
- 소속 체육관

### 통계 섹션
```javascript
<div>총 경기: {statistics?.total_matches || 0}</div>
<div>전적: {statistics?.wins}승 {statistics?.draws}무 {statistics?.losses}패</div>
<div>KO 승: {statistics?.ko_wins || 0}</div>
<div>연승: {statistics?.current_win_streak || 0}</div>
```
- 모든 통계는 실제 데이터베이스에서 로드
- 초기 회원은 모두 0으로 표시

### 복싱 스타일 & 체형 정보
```javascript
{profile?.boxing_style && <div>스타일: {profile.boxing_style}</div>}
{profile?.weight && <div>체급: {profile.weight}kg</div>}
{profile?.height && <div>키: {profile.height}cm</div>}
```
- 입력한 값만 표시 (조건부 렌더링)
- 값이 없으면 해당 섹션 숨김

### 티어 포인트 원형 그래프
```javascript
<circle
  strokeDashoffset={`${2 * Math.PI * 56 * (1 - ((profile?.tier_points || 0) / 1000))}`}
/>
<div>{profile?.tier_points || 0}</div>
<div>/ 1,000</div>
```
- 실시간으로 티어 포인트 반영
- 1,000점 만점 기준 진행률 표시

### 실시간 랭킹
```javascript
// 데이터베이스에서 실시간 조회
supabase
  .from('users')
  .select('id, nickname, name, tier, tier_points')
  .not('tier', 'is', null)
  .order('tier_points', { ascending: false })
  .limit(5)
```
- 티어 포인트 상위 5명 실시간 표시
- 자동으로 순위 계산
- 회원이 없으면 랭킹 섹션 숨김

## 3. 데이터 로드 흐름

### 로그인 시
1. `AuthContext` - 사용자 인증 확인
2. `loadUserProfile(userId)` - Supabase에서 프로필 로드
3. `profile` 상태 업데이트
4. 대시보드 자동 리렌더링

### 대시보드 렌더링 시
```javascript
useEffect(() => {
  const loadUserData = async () => {
    if (user?.id) {
      // 1. 통계 데이터 로드
      const stats = await getUserStatistics(user.id);
      
      // 2. 출석 데이터 로드
      const attendance = await getUserAttendance(user.id, thirtyDaysAgo);
      
      // 3. 실시간 랭킹 데이터 로드
      const ranking = await supabase
        .from('users')
        .select('...')
        .order('tier_points', { ascending: false });
      
      // 상태 업데이트
      setStatistics(stats);
      setAttendance(attendance);
      setRankingNews(ranking);
    }
  };
  
  loadUserData();
}, [user, profile]);
```

## 4. 역할별 표시 차이

### 일반 회원 (athlete)
- ✅ 티어 시스템 표시
- ✅ 티어 포인트 표시
- ✅ 통계 (경기 전적)
- ✅ 키, 몸무게 표시
- ❌ 복싱 스타일 없음

### 선수 (coach)
- ✅ 티어 시스템 표시
- ✅ 티어 포인트 표시
- ✅ 통계 (경기 전적)
- ✅ 키, 몸무게 표시
- ✅ 복싱 스타일 표시

### 체육관 (gym)
- ❌ 티어 시스템 없음
- ❌ 티어 포인트 없음
- ❌ 경기 통계 없음
- ✅ 체육관 정보 표시
- ✅ 위치, 대표 전화번호 표시

## 5. 초기 상태 (신규 회원)

### 회원가입 직후
- 티어: Bronze III
- 티어 포인트: 0
- 총 경기: 0
- 전적: 0승 0무 0패
- KO 승: 0
- 연승: 0
- 출석 일수: 0
- 스킬: 없음
- 경기 기록: 없음

### 점진적 데이터 축적
1. 출석 체크 → 캘린더에 표시
2. 경기 기록 → 전적 업데이트
3. 승리 → 티어 포인트 증가
4. 훈련 완료 → 스킬 포인트 획득

## 6. 프로필 수정 시

### 수정 가능한 정보
- 닉네임
- 전화번호
- 키, 몸무게
- 복싱 스타일
- 소속 체육관

### 수정 불가능한 정보
- 이메일 (로그인 ID)
- 역할
- 티어 (게임 시스템에서 자동 관리)
- 티어 포인트

### 수정 후 반영
```javascript
// EditProfileView에서 저장 시
await updateUserProfile(userId, updates);
await refreshProfile(); // AuthContext의 profile 재로드
// → 대시보드 자동 업데이트
```

## 7. 실시간 동기화

### AuthContext 역할
- 전역 상태 관리 (`user`, `profile`)
- 모든 컴포넌트에서 동일한 데이터 접근
- 프로필 변경 시 자동 전파

### useEffect 의존성
```javascript
useEffect(() => {
  // profile이 변경되면 자동 실행
  loadDashboardData();
}, [user, profile]);
```

## 8. 디버깅

### 콘솔 로그 확인
```javascript
console.log('[Dashboard] 프로필 데이터:', profile);
console.log('[Dashboard] 통계 데이터 로드:', statistics);
console.log('[Dashboard] 출석 데이터 로드:', attendance);
console.log('[Dashboard] 랭킹 데이터 로드:', ranking);
```

### 데이터 누락 시 확인 사항
1. Supabase `users` 테이블에 데이터가 있는지
2. RLS 정책이 올바르게 설정되어 있는지
3. `getUserProfile` 함수가 정상 작동하는지
4. 브라우저 콘솔의 에러 메시지 확인

## 결론

모든 프로필 정보는:
1. 회원가입 시 Supabase에 저장
2. 로그인 시 AuthContext로 로드
3. 각 페이지에서 `useAuth()`로 접근
4. 실시간으로 대시보드에 반영
5. 역할과 데이터 유무에 따라 조건부 표시

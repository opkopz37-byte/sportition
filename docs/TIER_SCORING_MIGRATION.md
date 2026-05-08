# 티어 점수 규칙 변경 - 실행 가이드

## 변경 사항

| 결과 | 기존 | 새 규칙 |
|------|------|---------|
| 승리 | +60 | +60 (동일) |
| 무승부 | +50 | +20 |
| 패배 | +40 | **-40** |
| 최소값 | 없음 | **0점** |

---

## 실행 순서

### 1. 코드 배포

```bash
# 변경된 파일:
# - lib/tierLadder.js

# Git 상태 확인
git status

# 커밋 및 푸시
git add lib/tierLadder.js
git commit -m "Update tier scoring: draw +20, loss -40, min 0"
git push
```

### 2. 데이터베이스 백업 (중요!)

```bash
# 프로덕션 DB 백업
# Supabase 대시보드에서 또는 CLI로 백업
```

### 3. SQL 재계산 스크립트 실행

```bash
# Supabase SQL Editor 또는 psql로 실행
# 파일: sql/66_recalculate_tier_points.sql

# 또는 psql 사용:
psql -d sportition -f sql/66_recalculate_tier_points.sql
```

**이 스크립트가 하는 일:**
- 백업 테이블 생성 (`users_backup_20260508`, `statistics_backup_20260508`)
- 모든 유저의 `tier_points` 재계산
- 최소값 0 적용

### 4. 티어 라벨 업데이트

**방법 A: API 호출 (추천)**

```bash
# POST 요청
curl -X POST https://your-domain.com/api/admin/update-tiers

# 또는 브라우저에서:
# 개발자 도구 콘솔에서
fetch('/api/admin/update-tiers', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

**방법 B: SQL로 직접 (대안)**

```sql
-- lib/tierLadder.js의 getTierLabelFromMatchPoints 로직을 SQL로 구현
-- 복잡하므로 API 방법 권장
```

### 5. 결과 확인

```sql
-- 점수 분포 확인
SELECT 
  COUNT(*) as total_users,
  MIN(tier_points) as min_points,
  MAX(tier_points) as max_points,
  ROUND(AVG(tier_points), 2) as avg_points,
  COUNT(*) FILTER (WHERE tier_points = 0) as zero_point_users
FROM users
WHERE role IN ('player_common', 'player_athlete');

-- 티어 분포 확인
SELECT 
  tier,
  COUNT(*) as user_count
FROM users
WHERE role IN ('player_common', 'player_athlete')
GROUP BY tier
ORDER BY MIN(tier_points);
```

---

## 롤백 방법 (문제 발생 시)

### 1. 점수 복구

```sql
UPDATE users u
SET 
  tier = b.tier, 
  tier_points = b.tier_points
FROM users_backup_20260508 b
WHERE u.id = b.id;
```

### 2. 코드 롤백

```bash
git revert <commit_hash>
git push
```

---

## 예상 결과

### 점수 변화 예시

| 전적 | 기존 점수 | 새 점수 | 차이 |
|------|----------|---------|------|
| 10승 0무 0패 | 600 | 600 | 0 |
| 5승 5무 5패 | 750 | 200 | -550 |
| 3승 2무 1패 | 350 | 180 | -170 |
| 0승 10무 0패 | 500 | 200 | -300 |
| 0승 0무 10패 | 400 | 0 | -400 |

### 주의사항

- 대부분 유저의 점수가 하락합니다 (패배 보상 제거)
- 패배가 많았던 유저일수록 큰 폭으로 하락
- 일부 유저는 0점이 될 수 있습니다

---

## 파일 목록

### 수정된 파일
- `lib/tierLadder.js` - 점수 상수 및 계산 로직

### 새로 추가된 파일
- `sql/66_recalculate_tier_points.sql` - 재계산 스크립트
- `app/api/admin/update-tiers/route.js` - 티어 업데이트 API
- `docs/TIER_SCORING_MIGRATION.md` - 이 문서

---

## 체크리스트

실행 전:
- [ ] 백업 완료
- [ ] 스테이징 환경에서 테스트 (가능하면)
- [ ] 롤백 계획 숙지

실행:
- [ ] 코드 배포
- [ ] SQL 스크립트 실행
- [ ] API 호출로 티어 업데이트
- [ ] 결과 검증 쿼리 실행

실행 후:
- [ ] 점수 분포 확인
- [ ] 티어 분포 확인
- [ ] 사용자 피드백 모니터링
- [ ] 백업 테이블 보관 (최소 1주일)

---

## 문의

문제 발생 시 백업 테이블로 즉시 롤백하고 개발팀에 문의하세요.

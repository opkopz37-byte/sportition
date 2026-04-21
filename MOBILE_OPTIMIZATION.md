# 📱 모바일 최적화 가이드

## iPhone SE 최적화 완료 사항

### 1. 기본 설정
- ✅ Viewport 메타 태그 설정
- ✅ 반응형 폰트 크기 시스템
- ✅ Tailwind xs 브레이크포인트 추가 (375px)
- ✅ 터치 최적화 CSS

### 2. 레이아웃 조정
- ✅ 네비게이션 바 높이: 12px → 14px → 16px (모바일 → xs → sm)
- ✅ 메인 컨테이너 패딩 최적화
- ✅ 페이지 헤더 반응형 조정

### 3. 컴포넌트 최적화

#### 랜딩 페이지
- ✅ 메인 타이틀: 2xl → 3xl → 5xl → 7xl
- ✅ 카드 높이: 40 → 48 → 64 (모바일 → xs → sm)
- ✅ 아이콘 크기 조정
- ✅ 패딩 최적화

#### 로그인 모달
- ✅ 모달 패딩 조정
- ✅ Input 필드 크기 최적화
- ✅ 버튼 최소 높이 44px (터치 타겟)

#### 네비게이션
- ✅ 모바일 메뉴 최적화
- ✅ 검색 필드 반응형
- ✅ 언어 선택 버튼 크기 조정

### 4. 폰트 크기 시스템

```css
/* iPhone SE 및 작은 화면 (< 375px) */
html { font-size: 12px; }

/* 일반 모바일 (376px - 640px) */
html { font-size: 13px; }

/* 태블릿 이상 (> 641px) */
html { font-size: 16px; }
```

### 5. Tailwind 커스텀 클래스

```javascript
xs: '375px'  // iPhone SE
xxs: '0.625rem' // 10px for very small text
```

### 6. 터치 최적화
- 모든 버튼 최소 44x44px (Apple HIG 권장)
- `-webkit-tap-highlight-color: transparent`
- 스크롤 최적화: `-webkit-overflow-scrolling: touch`

## 테스트 방법

### Chrome DevTools
1. F12 또는 우클릭 > 검사
2. Ctrl+Shift+M (Windows) / Cmd+Shift+M (Mac)
3. 디바이스 선택: iPhone SE
4. 또는 커스텀: 375x667

### 실제 기기 테스트
1. 같은 Wi-Fi 네트워크 연결
2. 개발 서버 실행: `npm run dev`
3. 모바일에서 접속: `http://[PC-IP]:3000`

## 주요 브레이크포인트

| 화면 크기 | Tailwind 클래스 | 너비 |
|----------|----------------|------|
| iPhone SE | xs: | 375px |
| 일반 모바일 | sm: | 640px |
| 태블릿 | md: | 768px |
| 소형 노트북 | lg: | 1024px |
| 데스크톱 | xl: | 1280px |
| 대형 데스크톱 | 2xl: | 1536px |

## 권장 사항

### 디자인 원칙
1. **모바일 우선**: 작은 화면부터 디자인
2. **터치 타겟**: 최소 44x44px
3. **읽기 쉬운 폰트**: 최소 12px
4. **충분한 여백**: 최소 8px

### 성능 최적화
1. 이미지 지연 로딩
2. 코드 스플리팅
3. 번들 크기 최소화
4. 캐싱 전략

### 접근성
1. 시맨틱 HTML
2. 키보드 네비게이션
3. 색상 대비
4. 스크린 리더 지원

## ✅ 완료된 최적화 (2024-03-14)

### 모든 뷰 컴포넌트 모바일 최적화 완료
- ✅ **Dashboard**: 프로필 카드, 랭킹 헤드라인, 캘린더 모바일 최적화
- ✅ **Ranking (TierBoard)**: 카드 레이아웃으로 전환, 테이블 → 모바일 카드뷰
- ✅ **SkillTree**: 그리드 레이아웃, 카드 크기 최적화
- ✅ **Statistics**: 차트 바, 매치 기록 카드 최적화
- ✅ **Landing Page**: 타이틀, 카드, 로그인 모달 완전 최적화
- ✅ **Navigation**: 모바일 메뉴, 검색 필드 최적화

### 반응형 패턴
```css
/* 기본 (< 375px) */
text-xs, p-2, gap-1

/* iPhone SE (xs: 375px) */
xs:text-sm, xs:p-3, xs:gap-2

/* 일반 모바일 (sm: 640px) */
sm:text-base, sm:p-4, sm:gap-3

/* 태블릿 (md: 768px+) */
md:text-lg, md:p-6, md:gap-4
```

## 추가 개선 사항 (TODO)

- [ ] 이미지 최적화 (next/image 사용)
- [ ] 제스처 지원 (스와이프 등)
- [ ] PWA 지원
- [ ] 오프라인 모드
- [ ] 다크모드 개선
- [ ] 무한 스크롤
- [ ] 스켈레톤 로딩

# 모바일 반응형 가이드

Sportition 프로젝트의 모든 페이지는 모바일 환경에 최적화되어 있습니다.

## 반응형 브레이크포인트

Tailwind CSS를 사용한 반응형 디자인:

```javascript
// tailwind.config.js에 정의된 브레이크포인트
screens: {
  'xs': '375px',   // 소형 모바일
  'sm': '640px',   // 모바일
  'md': '768px',   // 태블릿
  'lg': '1024px',  // 작은 데스크톱
  'xl': '1280px',  // 데스크톱
  '2xl': '1536px', // 큰 데스크톱
}
```

## 페이지별 반응형 특징

### 1. 랜딩 페이지 (/)

**모바일 (< 768px)**
- 단일 컬럼 레이아웃
- 축소된 패딩 및 여백
- 터치 친화적인 버튼 크기 (최소 44px 높이)
- 축소된 텍스트 크기
- 언어 선택기 아이콘 표시 (KR/EN)

**태블릿 (768px - 1024px)**
- 2컬럼 그리드 (선수/코치 선택)
- 적절한 여백 및 패딩
- 중간 크기 텍스트

**데스크톱 (> 1024px)**
- 최대 폭 제한으로 가독성 확보
- 큰 텍스트 및 아이콘
- 넓은 여백

### 2. 로그인 모달

```javascript
// 모바일 최적화 클래스
className="px-3 py-2.5 xs:px-4 xs:py-3"  // 작은 화면에서 축소된 패딩
className="text-sm xs:text-base"          // 반응형 텍스트 크기
className="min-h-[44px]"                  // 터치 타겟 최소 크기
```

**특징:**
- 모든 화면에서 중앙 정렬
- 작은 화면에서 자동으로 패딩 조정
- 터치 친화적인 버튼 크기
- 키보드 자동 포커스

### 3. 회원가입 페이지

**모바일 최적화:**
- 스크롤 가능한 폼
- 축소된 입력 필드 높이
- 3컬럼 멤버십 선택 (모바일에서도 유지)
- 2컬럼 역할 선택
- 날짜 선택기 네이티브 UI 사용

**입력 필드:**
```javascript
// 반응형 입력 필드
className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg"
```

### 4. 출석 체크 페이지 (/attendance)

**모바일 (< 768px)**
- 단일 컬럼 레이아웃
- 상단에 브랜드 로고 표시
- 이미지 숨김
- 키패드 크기 자동 조정
- 입력 필드 크기 축소 (w-16 h-20)

**태블릿/데스크톱 (>= 768px)**
- 2컬럼 레이아웃 (이미지 + 입력 영역)
- 큰 키패드
- 입력 필드 크기 확대 (w-20 h-24)

```javascript
// 반응형 레이아웃 예시
<div className="w-full md:w-1/2"> // 모바일: 전체 폭, 데스크톱: 반쪽
  <div className="hidden md:block"> // 데스크톱에서만 표시
    <img src="..." />
  </div>
</div>

// 반응형 키패드
<div className="w-16 h-20 sm:w-20 sm:h-24"> // 작은 화면: 16x20, 큰 화면: 20x24
  {number}
</div>
```

### 5. 대시보드

**모바일:**
- 햄버거 메뉴
- 단일 컬럼 카드 레이아웃
- 축소된 차트 및 통계
- 스와이프 가능한 탭

**태블릿/데스크톱:**
- 사이드바 네비게이션
- 멀티 컬럼 그리드
- 전체 차트 및 통계
- 고정된 탭

## 터치 최적화

### 버튼 크기

```javascript
// 최소 터치 타겟 크기: 44x44px (Apple HIG 권장)
className="min-h-[44px]"  // 버튼 최소 높이

// 출석 체크 키패드
className="aspect-square"  // 정사각형 버튼
className="active:scale-95" // 터치 피드백
```

### 터치 제스처

- **탭**: 기본 상호작용
- **스크롤**: 긴 컨텐츠 탐색
- **드래그**: 없음 (현재)
- **핀치 줌**: 전체화면 모드에서 사용

## 텍스트 가독성

### 반응형 텍스트 크기

```javascript
// 제목
className="text-2xl xs:text-3xl sm:text-5xl md:text-7xl"

// 본문
className="text-xs xs:text-sm sm:text-lg"

// 버튼
className="text-sm xs:text-base"
```

### 최소 폰트 크기
- 본문: 최소 12px (xs)
- 버튼: 최소 14px
- 제목: 최소 18px

## 성능 최적화

### 이미지

```javascript
// 반응형 이미지
<img 
  src="https://images.unsplash.com/...?w=1200&q=80"
  alt="..."
  className="w-full h-full object-cover"
/>
```

**최적화 방법:**
- Unsplash에서 압축된 이미지 사용 (q=80)
- 적절한 크기 설정 (w=1200)
- lazy loading 적용 (Next.js Image 컴포넌트 사용 권장)

### CSS

- Tailwind CSS의 JIT 모드 사용
- 미사용 클래스 자동 제거
- 최소 CSS 번들 크기

## 테스트 가이드

### Chrome DevTools

1. F12로 DevTools 열기
2. Ctrl+Shift+M으로 디바이스 툴바 토글
3. 다음 기기에서 테스트:
   - iPhone SE (375x667)
   - iPhone 12 Pro (390x844)
   - Pixel 5 (393x851)
   - iPad Air (820x1180)
   - iPad Pro (1024x1366)

### 실제 기기 테스트

1. 같은 네트워크에 연결
2. 개발 서버의 로컬 IP 확인
   ```bash
   ipconfig getifaddr en0  # Mac
   ```
3. 모바일 브라우저에서 접속
   ```
   http://192.168.x.x:3000
   ```

### 테스트 체크리스트

- [ ] 모든 버튼이 터치 가능한가?
- [ ] 텍스트가 읽기 쉬운가?
- [ ] 스크롤이 부드러운가?
- [ ] 입력 필드가 올바르게 작동하는가?
- [ ] 키보드가 콘텐츠를 가리지 않는가?
- [ ] 가로/세로 모드 모두 지원하는가?
- [ ] 로딩 상태가 명확한가?
- [ ] 에러 메시지가 보이는가?

## 모바일 브라우저 호환성

### 지원 브라우저

- **iOS**: Safari 14+, Chrome 90+
- **Android**: Chrome 90+, Samsung Internet 14+

### 테스트된 기능

✅ Flexbox
✅ Grid
✅ CSS Variables
✅ Backdrop Filter
✅ Touch Events
✅ Viewport Units (vh, vw)
✅ Position Sticky

## 접근성 (Accessibility)

### 모바일 접근성 고려사항

- **터치 타겟**: 최소 44x44px
- **색상 대비**: WCAG AA 준수
- **포커스 표시**: 명확한 포커스 링
- **레이블**: 모든 입력 필드에 레이블
- **에러 메시지**: 명확하고 읽기 쉬운 메시지

### VoiceOver/TalkBack 지원

```javascript
// 스크린 리더를 위한 접근성 속성
<button
  aria-label="로그인"
  role="button"
  tabIndex={0}
>
  로그인
</button>
```

## PWA (Progressive Web App) 준비

향후 PWA 기능 추가 시 고려사항:

- [ ] manifest.json 생성
- [ ] Service Worker 등록
- [ ] 오프라인 지원
- [ ] 설치 프롬프트
- [ ] 푸시 알림

## 트러블슈팅

### 문제: 키보드가 콘텐츠를 가림

**해결책:**
```javascript
// iOS Safari에서 viewport 높이 조정
className="h-screen" // 대신
className="min-h-screen" // 사용
```

### 문제: 터치 제스처가 작동하지 않음

**해결책:**
```css
/* CSS에서 터치 액션 허용 */
-webkit-tap-highlight-color: transparent;
touch-action: manipulation;
```

### 문제: 폰트가 너무 작음

**해결책:**
```javascript
// 최소 폰트 크기 설정
className="text-sm sm:text-base" // 최소 14px
```

## 성능 모니터링

### Lighthouse 점수 목표

- **Performance**: 90+
- **Accessibility**: 95+
- **Best Practices**: 90+
- **SEO**: 90+

### 측정 방법

1. Chrome DevTools > Lighthouse
2. "Mobile" 선택
3. "Generate report"
4. 점수 확인 및 개선사항 적용

## 마무리

모든 새로운 기능 개발 시:
1. 모바일 우선으로 디자인
2. 반응형 클래스 사용
3. 실제 기기에서 테스트
4. 접근성 검증
5. 성능 측정

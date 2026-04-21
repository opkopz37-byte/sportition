# Cloudflare Workers 배포 가이드

OpenNext(`@opennextjs/cloudflare`) + Workers Builds(Git 연동) 기준입니다.

## 1. Workers Builds 대시보드 설정

**Workers & Pages → 해당 Worker → Settings → Build**

| 항목 | 권장 값 | 비고 |
|------|---------|------|
| **Build command** | `npm run build:cloudflare` | `npm run build`만 쓰면 `next build`만 돌고 `.open-next`가 없어 배포 실패 |
| **Deploy command** | `npx wrangler deploy` | 기본값 그대로 사용 가능 |
| **Root directory** | (비움) | 모노레포가 아니면 프로젝트 루트 |

[Workers Builds는 Wrangler 파일의 `build.command`를 따르지 않습니다.](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) 빌드 커맨드는 **반드시 대시보드**에서 위와 같이 맞춥니다.

### 미리보기(비프로덕션 브랜치)

[Build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)를 켠 경우, 기본 배포 명은 `npx wrangler versions upload` 입니다. 팀 규칙에 맞게 **Non-production branch deploy command**를 조정하세요.

## 2. 환경 변수

앱은 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 사용합니다 (`lib/supabase.js`).

| 위치 | 용도 |
|------|------|
| **Settings → Variables and Secrets** | 런타임(Worker 실행 시) |
| **Settings → Build → Build variables** | CI 빌드 시 `NEXT_*`가 번들에 필요하면 동일 키 추가 |

로컬 배포 전에는 `.env.local` 또는 셸에 export 해 두면 `next build` / OpenNext가 읽습니다.

## 3. 로컬에서 CI와 동일하게 검증

```bash
npm ci
npm run verify:cloudflare
```

`verify:cloudflare`는 `opennextjs-cloudflare build`와 동일합니다. 여기까지 성공하면 **“compiled Open Next config”** 류 오류는 대부분 해결된 상태입니다.

배포까지 확인(계정 로그인 필요):

```bash
npm run deploy
# 또는: npm run deploy:cloudflare
```

## 4. `wrangler.jsonc` 메모

- **`name`**: Cloudflare Workers Builds에 연결된 **Worker 이름과 동일**해야 합니다 (예: `sportition`). 대시보드 프로젝트명과 다르면 self-reference·배포 매칭 오류가 납니다.
- **`main`**: `.open-next/worker.js` — OpenNext 빌드 후에만 존재
- **`assets.directory`**: `.open-next/assets`
- **`WORKER_SELF_REFERENCE`**: `service` 값은 `name`과 동일해야 함
- **`images`**: Cloudflare Images 바인딩; 계정/플랜에 따라 추가 설정이 필요할 수 있음

## 5. 자주 나는 오류

| 메시지 | 원인 | 조치 |
|--------|------|------|
| Could not find compiled Open Next config | 빌드가 `next build`만 됨 | Build command를 `npm run build:cloudflare`로 변경 |
| OpenNext / wrangler 무한 로그 반복 | 예전에 `build` 스크립트가 `opennextjs-cloudflare build`였음 | `package.json`의 `build`는 `next build`만 유지 |

## 6. 참고 스크립트 (`package.json`)

| 스크립트 | 설명 |
|----------|------|
| `npm run build` | `next build` (OpenNext가 내부 호출) |
| `npm run build:cloudflare` | OpenNext 전체 빌드 |
| `npm run verify:cloudflare` | 위와 동일(배포 전 검증용 이름) |
| `npm run deploy` | `build:cloudflare` 후 `wrangler deploy` |

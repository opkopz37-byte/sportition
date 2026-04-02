#!/usr/bin/env bash
# Next.js 개발 서버 — macOS EMFILE(파일 감시 한도)로 번들 404가 날 때 완화
# 사용: npm run dev  (package.json에서 이 스크립트 호출)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "$(uname -s)" = "Darwin" ]; then
  ulimit -n 10240 2>/dev/null || ulimit -n 8192 2>/dev/null || ulimit -n 4096 2>/dev/null || true
fi

NEXT_BIN="$ROOT/node_modules/.bin/next"
if [ ! -x "$NEXT_BIN" ]; then
  echo "node_modules/.bin/next 가 없습니다. 먼저 npm install 을 실행하세요." >&2
  exit 1
fi
exec "$NEXT_BIN" dev -H 127.0.0.1 -p 3000

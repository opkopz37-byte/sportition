/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * macOS 등에서 Watchpack EMFILE(너무 많은 파일 감시)로 `next dev` 컴파일이 실패하면
   * HTML 500 · layout.css / main-app.js 등 /_next/* 404가 연쇄로 보일 수 있음.
   * - darwin: 기본 폴링(개발만, 약간 느릴 수 있음). 끄려면 NEXT_WEBPACK_POLLING=0
   * - 그 외: NEXT_WEBPACK_POLLING=1 로 동일
   * - 반복 시: `npm run dev:clean` 또는 터미널에서 `ulimit -n 10240` 후 `npm run dev` (scripts/dev.sh)
   *
   * ChunkLoadError: Loading chunk app/layout failed (timeout) — 첫 컴파일이 느리거나 .next가 꼬이면
   * 브라우저가 청크를 기다리다 타임아웃할 수 있음. dev에서 청크 로드 대기 시간을 넉넉히 둠.
   */
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      const usePolling =
        process.env.NEXT_WEBPACK_POLLING === '1' ||
        (process.platform === 'darwin' && process.env.NEXT_WEBPACK_POLLING !== '0');
      if (usePolling) {
        config.watchOptions = {
          ...config.watchOptions,
          poll: 1000,
          aggregateTimeout: 300,
        };
      }
      if (!isServer) {
        config.output = {
          ...config.output,
          chunkLoadTimeout: 300000,
        };
      }
    }
    return config;
  },
};

module.exports = nextConfig;

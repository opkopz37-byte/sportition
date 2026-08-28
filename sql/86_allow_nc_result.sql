-- ============================================================
-- NC(노 콘테스트) 무효 경기 허용 (2026-08-28)
--
-- 배경: 경기 강제 종료 모달의 종료 방식에 RSC/ABD/DSQ/TD/NC 가 추가됨.
--   NC(무효) 경기는 matches.result 에 'nc' 로 저장되는데,
--   02_game_schema.sql 이 result 를 ('win','loss','draw') 로 좁혀놔서
--   'nc' 삽입이 거절됨 → 제약을 다시 넓힘.
--
-- NC 경기 처리 원칙 (앱 코드에서 처리):
--   • 전적 목록에는 "무효" 로 표시됨 (이력은 남음)
--   • 승률·경기 수·연승·티어 점수 집계에서는 제외
--
-- 멱등 — 여러 번 실행해도 안전.
-- ⚠️ Supabase SQL Editor 에 실행.
-- ============================================================

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_result_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_result_check CHECK (result IN ('win', 'loss', 'draw', 'nc'));

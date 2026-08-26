-- ============================================================
-- statistics 전적 카운트를 matches 테이블 기준으로 재동기화
--
-- 배경: submitMatchResult()의 기존 statistics 갱신 로직이
--   "현재값 조회 → +1 → upsert" 증분 방식이라 원자성이 없어,
--   경기 저장 도중 재시도/중복 호출이 발생하면 wins/losses/draws가
--   실제 matches 행 수보다 부풀려질 수 있었음 (예: 김하준 — 실제 1승인데
--   statistics.wins=2 로 기록되어 티어 점수가 120점으로 표시된 사례).
--
--   앱 코드는 이제 매 경기 저장 시 matches 테이블을 다시 세어
--   statistics 를 덮어쓰는 방식으로 수정됨 (재호출해도 항상 같은 값으로 수렴).
--   이 스크립트는 이미 어긋나 있는 기존 statistics 값을 matches 기준으로
--   한 번 바로잡는 백필.
--
-- 멱등 — 여러 번 실행해도 항상 matches 기준 정확한 값으로 수렴.
-- ⚠️ Supabase SQL Editor 에 실행.
-- ============================================================

WITH recomputed AS (
  SELECT
    m.user_id,
    COUNT(*)::int AS total_matches,
    COUNT(*) FILTER (WHERE m.result = 'win')::int AS wins,
    COUNT(*) FILTER (WHERE m.result = 'loss')::int AS losses,
    COUNT(*) FILTER (WHERE m.result = 'draw')::int AS draws,
    COUNT(*) FILTER (WHERE m.result = 'win' AND m.method IN ('RSC', 'TKO', 'KO'))::int AS ko_wins
  FROM public.matches m
  GROUP BY m.user_id
)
UPDATE public.statistics s
SET
  total_matches = recomputed.total_matches,
  wins          = recomputed.wins,
  losses        = recomputed.losses,
  draws         = recomputed.draws,
  ko_wins       = recomputed.ko_wins,
  updated_at    = NOW()
FROM recomputed
WHERE s.user_id = recomputed.user_id
  AND (
    s.total_matches IS DISTINCT FROM recomputed.total_matches OR
    s.wins          IS DISTINCT FROM recomputed.wins OR
    s.losses        IS DISTINCT FROM recomputed.losses OR
    s.draws         IS DISTINCT FROM recomputed.draws OR
    s.ko_wins       IS DISTINCT FROM recomputed.ko_wins
  );

-- matches 가 하나도 없는데 statistics 에 잔여값이 남아있는 경우(경기 전부 삭제 등) 0으로 정리
UPDATE public.statistics s
SET total_matches = 0, wins = 0, losses = 0, draws = 0, ko_wins = 0, updated_at = NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.user_id = s.user_id)
  AND (s.total_matches != 0 OR s.wins != 0 OR s.losses != 0 OR s.draws != 0 OR s.ko_wins != 0);

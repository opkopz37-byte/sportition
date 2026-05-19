-- ============================================================
-- 전적 컷오프 초기화 — KST 2026-04-27 00:00 이전 기록 전면 삭제
--
-- ── 무엇을 하는가 ──
-- 1) public.matches 에서 played_at < 컷오프 인 행 전부 DELETE
-- 2) 남은 매치 기준으로 public.statistics 매치 카운터 재계산
--    (total_matches / wins / losses / draws / ko_wins / win_streak)
-- 3) public.tier_rankings 의 rank / previous_rank / rank_change 초기화
--
-- ── 절대 건드리지 않는 데이터 ──
--   - 4/27 KST 00:00 이후 매치 (모든 회원, 무조건 보존)
--   - 회원/체육관/스킬트리/스킬 진행도/스킬 승단 신청/카드/컬렉션
--   - 출석 데이터 (statistics.current_streak / total_attendance / longest_streak 보존)
--   - 매치 초기화 티켓 / 스킬 초기화 티켓
--   - sql/58 의 체육관 코드/이력 시스템
--
-- ── 컷오프 ──
--   KST 2026-04-27 00:00:00 == UTC 2026-04-26 15:00:00
--   played_at 은 TIMESTAMPTZ 라 timezone offset 명시로 안전하게 비교.
--
-- ── 안전 ──
--   - BEGIN / COMMIT 트랜잭션 — 중간 실패 시 자동 롤백
--   - DELETE 전후 행 수 RAISE NOTICE 출력
--   - 첫 실행은 마지막 줄을 ROLLBACK 으로 바꿔 드라이런 권장
--     ▶ 결과 RAISE NOTICE 확인 → COMMIT 으로 되돌려 재실행
--
-- ⚠️ 비가역 작업. Supabase SQL Editor 에서 실행 전 백업 스냅샷 필수.
-- ============================================================

BEGIN;

DO $$
DECLARE
  _cutoff       TIMESTAMPTZ := TIMESTAMPTZ '2026-04-27 00:00:00+09';
  _to_delete    BIGINT;
  _to_keep      BIGINT;
  _deleted      BIGINT;
  _stats_rows   BIGINT;
  _tier_rows    BIGINT;
BEGIN
  -- ── 사전 점검 ───────────────────────────────────────────
  SELECT count(*) INTO _to_delete
    FROM public.matches
   WHERE played_at < _cutoff;

  SELECT count(*) INTO _to_keep
    FROM public.matches
   WHERE played_at >= _cutoff;

  RAISE NOTICE '[sql/60] 컷오프 = % (KST 2026-04-27 00:00)', _cutoff;
  RAISE NOTICE '[sql/60] 삭제 예정 매치 수 = %', _to_delete;
  RAISE NOTICE '[sql/60] 보존 매치 수      = %', _to_keep;

  -- ── 1) matches DELETE ──────────────────────────────────
  WITH d AS (
    DELETE FROM public.matches
     WHERE played_at < _cutoff
    RETURNING 1
  )
  SELECT count(*) INTO _deleted FROM d;

  RAISE NOTICE '[sql/60] 실제 삭제된 매치 수 = %', _deleted;

  -- ── 2) statistics 재계산 ───────────────────────────────
  --    LEFT JOIN 으로 매치 0개 회원도 자동으로 0 처리.
  --    출석 컬럼 (current_streak / total_attendance / longest_streak) 은
  --    이 UPDATE 가 손대지 않음 — SET 절에 없음.
  WITH agg AS (
    SELECT
      s.user_id,
      count(m.id)                                                  AS cnt,
      count(m.id) FILTER (WHERE m.result IN ('win','ko_win'))      AS w,
      count(m.id) FILTER (WHERE m.result IN ('loss','ko_loss'))    AS l,
      count(m.id) FILTER (WHERE m.result = 'draw')                 AS d,
      count(m.id) FILTER (WHERE m.result = 'ko_win')               AS kw
      FROM public.statistics s
      LEFT JOIN public.matches m ON m.user_id = s.user_id
     GROUP BY s.user_id
  )
  UPDATE public.statistics s
     SET total_matches = a.cnt,
         wins          = a.w,
         losses        = a.l,
         draws         = a.d,
         ko_wins       = a.kw,
         win_streak    = 0,
         updated_at    = NOW()
    FROM agg a
   WHERE a.user_id = s.user_id;

  GET DIAGNOSTICS _stats_rows = ROW_COUNT;
  RAISE NOTICE '[sql/60] statistics 재계산 회원 수 = %', _stats_rows;

  -- ── 3) tier_rankings 초기화 ────────────────────────────
  UPDATE public.tier_rankings
     SET rank          = NULL,
         previous_rank = NULL,
         rank_change   = 0,
         updated_at    = NOW();

  GET DIAGNOSTICS _tier_rows = ROW_COUNT;
  RAISE NOTICE '[sql/60] tier_rankings 초기화 회원 수 = %', _tier_rows;

  -- ── 사후 검증 ──────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM public.matches WHERE played_at < _cutoff) THEN
    RAISE EXCEPTION '[sql/60] 검증 실패 — 컷오프 이전 매치가 남음. ROLLBACK 됨.';
  END IF;

  RAISE NOTICE '[sql/60] 검증 통과 — 컷오프 이후 매치만 남음.';
END $$;

COMMIT;


-- ============================================================
-- ── 사후 확인 쿼리 (선택) ──
--
-- -- 가장 오래된 남은 매치 (반드시 4/27 KST 00:00 이후여야 함)
-- SELECT min(played_at) AS oldest_remaining_kst
--   FROM public.matches;
--
-- -- 회원별 매치 수 vs statistics 카운터 일치 여부
-- SELECT u.id,
--        s.total_matches AS stat_total,
--        count(m.id)     AS real_total,
--        s.wins          AS stat_wins,
--        count(*) FILTER (WHERE m.result IN ('win','ko_win')) AS real_wins
--   FROM public.users u
--   JOIN public.statistics s ON s.user_id = u.id
--   LEFT JOIN public.matches m ON m.user_id = u.id
--  GROUP BY u.id, s.total_matches, s.wins
--  HAVING s.total_matches <> count(m.id)
--      OR s.wins <> count(*) FILTER (WHERE m.result IN ('win','ko_win'));
-- -- ↑ 0 행이 정상.
--
-- -- tier_rankings 가 전부 초기화되었는지
-- SELECT count(*) AS not_reset
--   FROM public.tier_rankings
--  WHERE rank IS NOT NULL OR previous_rank IS NOT NULL OR rank_change <> 0;
-- -- ↑ 0 이 정상.
-- ============================================================

-- ============================================================
-- 전적 초기화권 (match_reset_tickets) 추가
--
-- - users.match_reset_tickets INTEGER DEFAULT 0
-- - reset_match_records_with_ticket() RPC:
--     티켓 1장 차감 + 본인 매치/통계/티어랭킹 초기화
--
-- ⚠️ Supabase SQL Editor 에 실행
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS match_reset_tickets INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.match_reset_tickets IS
  '전적 초기화권 보유 개수 — 1장 사용 시 본인 matches/statistics/tier_rankings 초기화';

-- ── RPC ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_match_records_with_ticket()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tickets integer;
  _deleted_count integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 티켓 보유 확인 + 잠금
  SELECT match_reset_tickets INTO _tickets
    FROM public.users
   WHERE id = _uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_user');
  END IF;
  IF COALESCE(_tickets, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_reset_ticket');
  END IF;

  -- 1) 본인이 참여한 matches 삭제
  --    (matches 테이블이 user_id / opponent_id 양쪽에 본인을 가질 수 있음)
  WITH deleted AS (
    DELETE FROM public.matches
     WHERE user_id = _uid
        OR opponent_id = _uid
    RETURNING 1
  )
  SELECT COUNT(*) INTO _deleted_count FROM deleted;

  -- 2) statistics 초기화 — 매치 관련 컬럼만 0, 출석 관련은 유지
  --    current_streak / total_attendance / longest_streak 은 출석 데이터라 보존
  UPDATE public.statistics
     SET total_matches = 0, wins = 0, losses = 0, draws = 0,
         ko_wins = 0, win_streak = 0
   WHERE user_id = _uid;

  -- 3) tier_rankings 초기화
  UPDATE public.tier_rankings
     SET rank = NULL, previous_rank = NULL, rank_change = 0
   WHERE user_id = _uid;

  -- 4) 티켓 1장 차감
  UPDATE public.users
     SET match_reset_tickets = match_reset_tickets - 1
   WHERE id = _uid;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_matches', _deleted_count,
    'tickets_remaining', _tickets - 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_match_records_with_ticket() TO authenticated;

-- ── 티켓 충전 예시 (테스트용) ───────────────────────────
-- UPDATE public.users SET match_reset_tickets = match_reset_tickets + 1
--  WHERE id = '<user-uuid>';

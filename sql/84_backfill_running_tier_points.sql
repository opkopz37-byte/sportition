-- ============================================================
-- users.tier_points 를 "잔고 방식"으로 재계산하는 1회성 백필
--
-- 배경: 기존 tier_points 는 화면에서 매번
--   wins*60 + draws*20 + losses*(-40) 을 계산해 마지막에 딱 한 번만
--   0으로 바닥을 씌우는 "집계 후 클램프" 방식이었음. 이 방식은
--   이력 중간에 0점에서 패배가 있었던 유저(예: 김정우, 신기철)의
--   점수를 실제보다 낮게 계산하는 오류가 있었음 — 이미 0인 상태에서
--   진 패배가 나중 승리 점수에서 몰래 깎이는 구조였기 때문.
--
--   앱 코드는 이제 매 경기 저장 시 users.tier_points 를
--   "0에서 시작해 경기 순서대로 재생하며 매번 0 밑을 막는" 잔고 방식으로
--   갱신하도록 수정됨 (lib/supabase.js submitMatchResult).
--   이 스크립트는 지금까지 쌓인 모든 유저의 tier_points 를
--   matches 기준으로 한 번에 올바르게 재계산하는 백필.
--
-- 멱등 — 여러 번 실행해도 항상 matches 기준 정확한 값으로 수렴.
-- ⚠️ Supabase SQL Editor 에 실행.
-- ============================================================

DO $$
DECLARE
  uid   UUID;
  ev    RECORD;
  running INT;
BEGIN
  FOR uid IN SELECT DISTINCT user_id FROM public.matches LOOP
    running := 0;
    FOR ev IN
      SELECT result FROM public.matches
      WHERE user_id = uid
      ORDER BY played_at ASC
    LOOP
      running := GREATEST(
        0,
        running + CASE
          WHEN ev.result = 'win'  THEN 60
          WHEN ev.result = 'draw' THEN 20
          WHEN ev.result = 'loss' THEN -40
          ELSE 0
        END
      );
    END LOOP;

    UPDATE public.users
    SET tier_points = running
    WHERE id = uid
      AND role NOT IN ('gym', 'admin')
      AND tier_points IS DISTINCT FROM running;
  END LOOP;
END $$;

-- 경기 기록이 하나도 없는 선수는 0점으로 정리 (신규 가입 등)
UPDATE public.users
SET tier_points = 0
WHERE role NOT IN ('gym', 'admin')
  AND id NOT IN (SELECT DISTINCT user_id FROM public.matches)
  AND tier_points IS DISTINCT FROM 0;

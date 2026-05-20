-- ============================================================
-- sql/72 — Legacy SP 백업 + 잔액 리셋 + 진행 노드 unlock 백필 (D단계)
--
-- 처리:
--   1. legacy_skill_points_backup 테이블 신설 (혹시 모를 복구용 보존)
--   2. 회원의 기존 skill_points 잔액을 백업 테이블에 저장 (1회)
--   3. users.skill_points 를 0 으로 리셋
--   4. 기존에 진행 중 (exp > 0 < 5) 인 노드를 user_skill_unlocks 에 백필
--      → 새 모델에서 "활성 스킬" 로 인식되어 출석 자동 적립이 정상 동작
--
-- ── 사용자 결정 반영 ──
-- • "기존 회원의 미사용 SP는 0으로 만들자. 다만 혹시 모르니 기록은 해두자.
--    추후 없앨 예정이지만 별도 처리." → 위 1~3
-- • "기존 스킬이 찍힌 것들은 모두 유지. 절대 리셋 X" → 위 4 (진행 보존)
--
-- 멱등 (CREATE TABLE IF NOT EXISTS, INSERT ON CONFLICT DO NOTHING).
-- ⚠️ Supabase SQL Editor 에서 실행 — sql/69 적용 후에 실행 (unlock_source 컬럼 필요).
-- ============================================================

BEGIN;


-- ════════════════════════════════════════════════════════════
-- 1) 백업 테이블
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.legacy_skill_points_backup (
  user_id      UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  skill_points INTEGER NOT NULL,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.legacy_skill_points_backup IS
  '새 모델 전환 시점의 회원 SP 잔액 백업 (sql/72). 추후 정리 예정.';


-- ════════════════════════════════════════════════════════════
-- 2) 기존 잔액 백업 — 멱등 (이미 백업된 회원은 건너뜀)
-- ════════════════════════════════════════════════════════════
INSERT INTO public.legacy_skill_points_backup (user_id, skill_points)
SELECT id, COALESCE(skill_points, 0)
  FROM public.users
 WHERE role IN ('player_common', 'player_athlete')
ON CONFLICT (user_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 3) users.skill_points = 0 으로 리셋
--    출석 자동 적립 (sql/70) 이후엔 단순 누적 카운터로 다시 증가
-- ════════════════════════════════════════════════════════════
UPDATE public.users
   SET skill_points = 0,
       updated_at = NOW()
 WHERE role IN ('player_common', 'player_athlete')
   AND COALESCE(skill_points, 0) > 0;


-- ════════════════════════════════════════════════════════════
-- 4) 진행 중(exp > 0 < 5) 노드를 user_skill_unlocks 에 백필
--    이유: 새 모델에서 활성 스킬 = user_skill_unlocks ∩ exp_level<5.
--    기존 회원은 자신이 찍던 진행 중 노드의 unlocks 행이 없을 수 있음
--    → 백필하지 않으면 출석 시 "활성 스킬 없음" 으로 차단됨
-- ════════════════════════════════════════════════════════════
INSERT INTO public.user_skill_unlocks (user_id, node_id, unlock_source, unlocked_by, unlocked_at)
SELECT
  p.user_id,
  p.node_id,
  'self',
  NULL,                              -- 회원 본인이 옛 시스템에서 찍은 것
  COALESCE(p.updated_at, NOW())
FROM public.user_skill_node_progress p
WHERE p.exp_level > 0
  AND p.exp_level < 5
ON CONFLICT (user_id, node_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 5) 검증
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  _backup_count   INTEGER;
  _sp_remaining   INTEGER;
  _backfilled_in_progress INTEGER;
BEGIN
  SELECT count(*) INTO _backup_count
    FROM public.legacy_skill_points_backup;

  SELECT count(*) INTO _sp_remaining
    FROM public.users
   WHERE role IN ('player_common', 'player_athlete')
     AND COALESCE(skill_points, 0) > 0;

  SELECT count(DISTINCT (p.user_id, p.node_id)) INTO _backfilled_in_progress
    FROM public.user_skill_node_progress p
    JOIN public.user_skill_unlocks u
      ON u.user_id = p.user_id AND u.node_id = p.node_id
   WHERE p.exp_level > 0 AND p.exp_level < 5;

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/72] 백업 테이블 행            : %', _backup_count;
  RAISE NOTICE '[sql/72] SP > 0 남은 회원 (0 권장) : %', _sp_remaining;
  RAISE NOTICE '[sql/72] 진행 중 노드 unlock 행    : %', _backfilled_in_progress;
  RAISE NOTICE '────────────────────────────────────────';

  IF _sp_remaining = 0 THEN
    RAISE NOTICE '[sql/72] ✅ legacy SP 백업/리셋 + 진행 노드 unlock 백필 완료';
  ELSE
    RAISE WARNING '[sql/72] SP 리셋 누락 — 확인 필요';
  END IF;
END $$;

COMMIT;


-- ============================================================
-- 롤백 (필요시 — 베타 사용자 영향 없을 때만):
--   UPDATE public.users u
--      SET skill_points = b.skill_points,
--          updated_at = NOW()
--     FROM public.legacy_skill_points_backup b
--    WHERE u.id = b.user_id;
--
--   백필된 unlocks 는 unlocked_by IS NULL + unlock_source = 'self' 패턴.
--   필요 시 다음 쿼리로 식별/제거 가능:
--     DELETE FROM public.user_skill_unlocks u
--      USING public.user_skill_node_progress p
--      WHERE u.user_id = p.user_id
--        AND u.node_id = p.node_id
--        AND u.unlocked_by IS NULL
--        AND u.unlock_source = 'self'
--        AND p.exp_level > 0 AND p.exp_level < 5;
-- ============================================================

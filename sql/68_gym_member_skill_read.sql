-- ============================================================
-- sql/68 — 관장의 회원 스킬 진행 읽기 권한 (A단계: 읽기 전용)
--
-- 추가:
--   • user_skill_unlocks         → "Gym read members skill unlocks"
--   • user_skill_node_progress   → "Gym read members skill progress"
--
-- 동작:
--   • gym 역할: 자기 체육관(gym_user_id 또는 gym_name 매칭) 회원만 SELECT 가능
--   • admin 역할: 전체 회원 SELECT 가능
--   • 기존 회원 본인 SELECT 정책("Users read own ...")은 그대로 유지
--
-- ── 베타 안전성 ──
-- SELECT 정책 추가만이므로 어떤 데이터도 변하지 않음. 기존 동작 영향 0.
-- DB 컬럼/함수/트리거에는 손대지 않음.
--
-- 멱등 (DROP POLICY IF EXISTS).
-- ⚠️ Supabase SQL Editor 에서 실행.
-- ============================================================

BEGIN;

-- 1) user_skill_unlocks — 관장의 회원 해금 현황 읽기
DROP POLICY IF EXISTS "Gym read members skill unlocks" ON public.user_skill_unlocks;
CREATE POLICY "Gym read members skill unlocks"
  ON public.user_skill_unlocks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.users caller
        JOIN public.users target ON target.id = user_skill_unlocks.user_id
       WHERE caller.id = auth.uid()
         AND caller.role IN ('gym', 'admin')
         AND (
              caller.role = 'admin'
           OR target.gym_user_id = caller.id
           OR (target.gym_user_id IS NULL AND target.gym_name = caller.gym_name)
         )
    )
  );

-- 2) user_skill_node_progress — 관장의 회원 EXP/승단 진행 읽기
DROP POLICY IF EXISTS "Gym read members skill progress" ON public.user_skill_node_progress;
CREATE POLICY "Gym read members skill progress"
  ON public.user_skill_node_progress FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.users caller
        JOIN public.users target ON target.id = user_skill_node_progress.user_id
       WHERE caller.id = auth.uid()
         AND caller.role IN ('gym', 'admin')
         AND (
              caller.role = 'admin'
           OR target.gym_user_id = caller.id
           OR (target.gym_user_id IS NULL AND target.gym_name = caller.gym_name)
         )
    )
  );


-- ============================================================
-- 검증 — 두 정책이 모두 존재해야 함
-- ============================================================
DO $$
DECLARE
  _policy_count INTEGER;
BEGIN
  SELECT count(*) INTO _policy_count
    FROM pg_policies
   WHERE policyname IN (
     'Gym read members skill unlocks',
     'Gym read members skill progress'
   );

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/68] 추가된 관장 SELECT 정책: % / 2', _policy_count;
  RAISE NOTICE '────────────────────────────────────────';

  IF _policy_count = 2 THEN
    RAISE NOTICE '[sql/68] ✅ 관장 회원 스킬 읽기 권한 추가 완료';
  ELSE
    RAISE WARNING '[sql/68] 정책 누락 — 확인 필요';
  END IF;
END $$;

COMMIT;


-- ============================================================
-- 롤백 (필요시):
--   DROP POLICY IF EXISTS "Gym read members skill unlocks"
--     ON public.user_skill_unlocks;
--   DROP POLICY IF EXISTS "Gym read members skill progress"
--     ON public.user_skill_node_progress;
-- ============================================================

-- ============================================================
-- sql/77 — sql/75 적용 전에 이미 5/5 마스터된 노드 backfill
--
-- 이슈:
--   sql/75 의 자동 승단 신청 트리거는 "지금부터 4→5 전환되는" 케이스만 잡음.
--   sql/75 적용 전부터 이미 5/5 였던 노드는 영원히 신청 없는 상태로 남음
--   → 회원이 셀프 해금 못함, 관장이 다음 노드 unlock 도 'promotion_required' 차단됨.
--
-- 처리:
--   기존 5/5 노드 중 promotion_request 없는 행 전체를 한 번에 INSERT.
--   - is_skipped=TRUE  → 'approved' (sql/75 의 gym_skip 자동 처리 정책과 동일)
--                        resolved_at, reviewer_id 도 user_skill_unlocks.unlocked_by 에서 복원
--   - is_skipped=FALSE → 'pending'  (회원/관장이 검토할 수 있게)
--
-- 멱등: NOT EXISTS 체크로 중복 INSERT 차단. 여러 번 실행해도 안전.
--       gym_name 이 비어있는 회원은 skip (그 회원은 프로필에 체육관 등록 후 재실행 필요).
-- ⚠️ Supabase SQL Editor 에서 한 번만 실행.
-- ============================================================

BEGIN;

WITH backfill_rows AS (
  INSERT INTO public.skill_promotion_requests
    (user_id, fork_node_id, gym_name, status, resolved_at, reviewer_id, notes)
  SELECT
    p.user_id,
    p.node_id,
    btrim(u.gym_name)                                                                          AS gym_name,
    CASE WHEN p.is_skipped THEN 'approved' ELSE 'pending' END                                  AS status,
    CASE WHEN p.is_skipped THEN COALESCE(p.updated_at, NOW()) ELSE NULL END                    AS resolved_at,
    CASE WHEN p.is_skipped THEN us.unlocked_by ELSE NULL END                                   AS reviewer_id,
    CASE WHEN p.is_skipped
         THEN '[backfill] 관장 스킵으로 자동 승인 (sql/77)'
         ELSE '[backfill] sql/75 이전 마스터 보정 — pending 으로 검토 필요 (sql/77)'
    END                                                                                        AS notes
  FROM public.user_skill_node_progress p
  JOIN public.user_skill_unlocks      us ON us.user_id = p.user_id AND us.node_id = p.node_id
  JOIN public.users                   u  ON u.id = p.user_id
  WHERE p.exp_level >= 5
    AND btrim(COALESCE(u.gym_name, '')) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.skill_promotion_requests r
       WHERE r.user_id = p.user_id AND r.fork_node_id = p.node_id
    )
  RETURNING user_id, fork_node_id, status
)
SELECT
  COUNT(*)                                          AS inserted_total,
  COUNT(*) FILTER (WHERE status = 'pending')        AS inserted_pending,
  COUNT(*) FILTER (WHERE status = 'approved')       AS inserted_approved
FROM backfill_rows;


-- 검증
DO $$
DECLARE
  _missing_total      INTEGER;
  _missing_no_gym     INTEGER;
BEGIN
  SELECT COUNT(*) INTO _missing_total
    FROM public.user_skill_node_progress p
   WHERE p.exp_level >= 5
     AND NOT EXISTS (
       SELECT 1 FROM public.skill_promotion_requests r
        WHERE r.user_id = p.user_id AND r.fork_node_id = p.node_id
     );

  SELECT COUNT(*) INTO _missing_no_gym
    FROM public.user_skill_node_progress p
    JOIN public.users u ON u.id = p.user_id
   WHERE p.exp_level >= 5
     AND btrim(COALESCE(u.gym_name, '')) = ''
     AND NOT EXISTS (
       SELECT 1 FROM public.skill_promotion_requests r
        WHERE r.user_id = p.user_id AND r.fork_node_id = p.node_id
     );

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/77] backfill 완료';
  RAISE NOTICE '  남은 누락 노드: %', _missing_total;
  RAISE NOTICE '    └─ gym_name 비어 skip 된 회원 노드: %', _missing_no_gym;
  IF _missing_total - _missing_no_gym > 0 THEN
    RAISE WARNING '  ⚠️ gym_name 있는데도 누락된 노드가 % 건 — 확인 필요',
                  _missing_total - _missing_no_gym;
  END IF;
  RAISE NOTICE '────────────────────────────────────────';
END $$;

COMMIT;

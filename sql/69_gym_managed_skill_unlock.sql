-- ============================================================
-- sql/69 — 관장 주도 해금/스킵 시스템 (B단계)
--
-- 추가:
--   1. 컬럼 3개
--      • user_skill_node_progress.is_skipped   BOOLEAN
--      • user_skill_unlocks.unlocked_by        UUID
--      • user_skill_unlocks.unlock_source      TEXT ('self'|'gym'|'skip')
--   2. 백필: 기존 user_skill_unlocks 행에 unlock_source = 'self'
--   3. 신규 테이블 skill_unlock_logs (관장 액션 이력)
--   4. RPC 2개
--      • gym_unlock_skill_node(member_id, node_id)
--      • gym_skip_skill_node(member_id, node_id)
--   5. RLS 정책 (관장/admin 의 로그 SELECT)
--
-- 동작 규칙 (사용자 확정 기획):
--   • 회원당 "마스터 안 된 해금 노드" 는 항상 0 또는 1개 (활성 스킬)
--   • 마스터 = exp_level = 5 (자연 누적이든 스킵이든)
--   • 다음 해금 조건:
--       (1) 활성 스킬이 없어야 함 (이미 진행중이면 차단)
--       (2) 가장 최근 마스터 노드에 승단 신청(pending/reviewing/approved) 이 있어야 함
--           — 마스터 노드가 없으면 (신규 회원 첫 해금) 검사 통과
--   • 부모/자식 자동 해금 없음. 관장이 노드 하나씩 명시적으로 선택
--   • 스킵 = 노드를 즉시 마스터 처리 (exp_level=5 + is_skipped=true)
--     승단 신청은 별개 트랙 (스킵해도 회원이 따로 신청해야 다음 해금)
--   • 권한: gym (자기 회원만) + admin (전체)
--
-- ── 베타 안전성 ──
-- • 새 컬럼은 NOT NULL DEFAULT FALSE 또는 NULL 허용 → 기존 행에 영향 없음
-- • 새 테이블/RPC/정책 추가만이므로 기존 동작 영향 0
-- • 클라이언트가 새 RPC 를 호출하기 전까지는 어떤 변화도 일어나지 않음
--
-- 멱등 (IF NOT EXISTS, DROP POLICY IF EXISTS, CREATE OR REPLACE).
-- ⚠️ Supabase SQL Editor 에서 실행.
-- ============================================================

BEGIN;


-- ════════════════════════════════════════════════════════════
-- 1) 새 컬럼 추가 (멱등)
-- ════════════════════════════════════════════════════════════

-- 1.1) user_skill_node_progress.is_skipped
ALTER TABLE public.user_skill_node_progress
  ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN NOT NULL DEFAULT FALSE;

-- 1.2) user_skill_unlocks.unlocked_by  (누가 해금했나)
ALTER TABLE public.user_skill_unlocks
  ADD COLUMN IF NOT EXISTS unlocked_by UUID
    REFERENCES public.users(id) ON DELETE SET NULL;

-- 1.3) user_skill_unlocks.unlock_source  ('self' | 'gym' | 'skip')
ALTER TABLE public.user_skill_unlocks
  ADD COLUMN IF NOT EXISTS unlock_source TEXT
    CHECK (unlock_source IS NULL OR unlock_source IN ('self', 'gym', 'skip'));


-- ════════════════════════════════════════════════════════════
-- 2) 백필 — 기존 해금은 모두 회원 셀프 해금으로 분류
-- ════════════════════════════════════════════════════════════
UPDATE public.user_skill_unlocks
   SET unlock_source = 'self'
 WHERE unlock_source IS NULL;


-- ════════════════════════════════════════════════════════════
-- 3) skill_unlock_logs 신규 테이블 (해금/스킵 이력)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.skill_unlock_logs (
  id              BIGSERIAL PRIMARY KEY,
  target_user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gym_user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  node_id         INTEGER NOT NULL REFERENCES public.skill_tree_nodes(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('unlock', 'skip', 'revoke')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS skill_unlock_logs_target_idx
  ON public.skill_unlock_logs (target_user_id, created_at DESC);

ALTER TABLE public.skill_unlock_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin all skill unlock logs" ON public.skill_unlock_logs;
CREATE POLICY "Admin all skill unlock logs" ON public.skill_unlock_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Gym read skill unlock logs" ON public.skill_unlock_logs;
CREATE POLICY "Gym read skill unlock logs" ON public.skill_unlock_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.users caller
        JOIN public.users target ON target.id = skill_unlock_logs.target_user_id
       WHERE caller.id = auth.uid()
         AND caller.role = 'gym'
         AND (
              target.gym_user_id = caller.id
           OR (target.gym_user_id IS NULL AND target.gym_name = caller.gym_name)
         )
    )
  );


-- ════════════════════════════════════════════════════════════
-- 4) RPC: gym_unlock_skill_node
--    관장(또는 admin)이 회원에게 노드 1개 해금
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.gym_unlock_skill_node(
  p_member_id UUID,
  p_node_id   INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _caller_id      UUID := auth.uid();
  _caller         RECORD;
  _target         RECORD;
  _latest_node_id INTEGER;
BEGIN
  -- 1) 인증
  IF _caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 2) 호출자 권한 (gym 또는 admin)
  SELECT id, role, gym_name INTO _caller
    FROM public.users WHERE id = _caller_id;
  IF NOT FOUND OR _caller.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- 3) 대상 회원 조회 + 플레이어 여부
  SELECT id, role, gym_user_id, gym_name INTO _target
    FROM public.users WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member_not_found');
  END IF;
  IF _target.role NOT IN ('player_common', 'player_athlete') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_not_player');
  END IF;

  -- 4) gym 인 경우 자기 체육관 회원만
  IF _caller.role = 'gym' THEN
    IF NOT (
      _target.gym_user_id = _caller_id
      OR (_target.gym_user_id IS NULL AND _target.gym_name = _caller.gym_name)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_same_gym');
    END IF;
  END IF;

  -- 5) 노드 존재 확인
  IF NOT EXISTS (SELECT 1 FROM public.skill_tree_nodes WHERE id = p_node_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  -- 6) 이미 해금된 노드인지
  IF EXISTS (
    SELECT 1 FROM public.user_skill_unlocks
     WHERE user_id = p_member_id AND node_id = p_node_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_unlocked');
  END IF;

  -- 7) 활성 스킬 (마스터 안 된 해금 노드) 존재 시 차단
  IF EXISTS (
    SELECT 1
      FROM public.user_skill_unlocks u
      LEFT JOIN public.user_skill_node_progress p
        ON p.user_id = u.user_id AND p.node_id = u.node_id
     WHERE u.user_id = p_member_id
       AND COALESCE(p.exp_level, 0) < 5
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'active_skill_in_progress',
      'message', '회원이 진행 중인 스킬을 먼저 마스터해야 합니다.'
    );
  END IF;

  -- 8) 가장 최근 마스터 노드 찾기
  SELECT u.node_id INTO _latest_node_id
    FROM public.user_skill_unlocks u
   WHERE u.user_id = p_member_id
   ORDER BY u.unlocked_at DESC NULLS LAST
   LIMIT 1;

  -- 9) 마스터 노드가 있으면 그 노드의 승단 신청 확인 (pending/reviewing/approved 모두 OK)
  IF _latest_node_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.skill_promotion_requests r
       WHERE r.user_id = p_member_id
         AND r.fork_node_id = _latest_node_id
         AND r.status IN ('pending', 'reviewing', 'approved')
    ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'promotion_required',
        'message', '승단 신청이 진행되어야 합니다.'
      );
    END IF;
  END IF;

  -- 10) 해금 처리
  INSERT INTO public.user_skill_unlocks (user_id, node_id, unlocked_by, unlock_source)
  VALUES (p_member_id, p_node_id, _caller_id, 'gym');

  -- promotion_status 컬럼은 sql/33 에서 제거됨 — INSERT 컬럼 명시 X
  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (p_member_id, p_node_id, 0)
  ON CONFLICT (user_id, node_id) DO UPDATE
    SET exp_level = COALESCE(user_skill_node_progress.exp_level, 0);

  -- 11) 로그 기록
  INSERT INTO public.skill_unlock_logs (target_user_id, gym_user_id, node_id, action)
  VALUES (p_member_id, _caller_id, p_node_id, 'unlock');

  RETURN jsonb_build_object('ok', true, 'node_id', p_node_id, 'action', 'unlock');
END;
$$;

GRANT EXECUTE ON FUNCTION public.gym_unlock_skill_node(UUID, INTEGER) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 5) RPC: gym_skip_skill_node
--    관장이 노드를 즉시 마스터 처리 (출석으로 EXP 쌓을 필요 없음)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.gym_skip_skill_node(
  p_member_id UUID,
  p_node_id   INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _caller_id      UUID := auth.uid();
  _caller         RECORD;
  _target         RECORD;
  _already_unlocked BOOLEAN;
  _latest_node_id INTEGER;
BEGIN
  -- 1~5) 인증/권한/대상/체육관 매칭/노드 검증 (gym_unlock_skill_node 와 동일)
  IF _caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT id, role, gym_name INTO _caller
    FROM public.users WHERE id = _caller_id;
  IF NOT FOUND OR _caller.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT id, role, gym_user_id, gym_name INTO _target
    FROM public.users WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member_not_found');
  END IF;
  IF _target.role NOT IN ('player_common', 'player_athlete') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_not_player');
  END IF;

  IF _caller.role = 'gym' THEN
    IF NOT (
      _target.gym_user_id = _caller_id
      OR (_target.gym_user_id IS NULL AND _target.gym_name = _caller.gym_name)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_same_gym');
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.skill_tree_nodes WHERE id = p_node_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  -- 6) 이미 마스터됐는지
  IF EXISTS (
    SELECT 1 FROM public.user_skill_node_progress
     WHERE user_id = p_member_id AND node_id = p_node_id AND exp_level >= 5
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_mastered');
  END IF;

  -- 7) 스킵 대상이 이미 해금됐는지 확인
  SELECT EXISTS (
    SELECT 1 FROM public.user_skill_unlocks
     WHERE user_id = p_member_id AND node_id = p_node_id
  ) INTO _already_unlocked;

  -- 8) 활성 스킬 (스킵 대상 자체는 제외) 존재 시 차단
  IF EXISTS (
    SELECT 1
      FROM public.user_skill_unlocks u
      LEFT JOIN public.user_skill_node_progress p
        ON p.user_id = u.user_id AND p.node_id = u.node_id
     WHERE u.user_id = p_member_id
       AND u.node_id <> p_node_id
       AND COALESCE(p.exp_level, 0) < 5
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'active_skill_in_progress',
      'message', '회원이 진행 중인 다른 스킬을 먼저 마스터해야 합니다.'
    );
  END IF;

  -- 9) 미해금 노드인 경우 → 해금 RPC 와 동일하게 승단 신청 검증
  IF NOT _already_unlocked THEN
    SELECT u.node_id INTO _latest_node_id
      FROM public.user_skill_unlocks u
     WHERE u.user_id = p_member_id
     ORDER BY u.unlocked_at DESC NULLS LAST
     LIMIT 1;

    IF _latest_node_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.skill_promotion_requests r
         WHERE r.user_id = p_member_id
           AND r.fork_node_id = _latest_node_id
           AND r.status IN ('pending', 'reviewing', 'approved')
      ) THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'promotion_required',
          'message', '승단 신청이 진행되어야 합니다.'
        );
      END IF;
    END IF;

    -- 자동 해금 + 마스터 처리
    INSERT INTO public.user_skill_unlocks (user_id, node_id, unlocked_by, unlock_source)
    VALUES (p_member_id, p_node_id, _caller_id, 'skip');
  END IF;

  -- 10) 마스터 처리 (exp_level=5 + is_skipped=true)
  --     promotion_status 컬럼은 sql/33 에서 제거됨 — 명시 X
  INSERT INTO public.user_skill_node_progress
    (user_id, node_id, exp_level, is_skipped)
  VALUES
    (p_member_id, p_node_id, 5, TRUE)
  ON CONFLICT (user_id, node_id) DO UPDATE
    SET exp_level  = 5,
        is_skipped = TRUE,
        updated_at = NOW();

  -- 11) 로그
  INSERT INTO public.skill_unlock_logs (target_user_id, gym_user_id, node_id, action)
  VALUES (p_member_id, _caller_id, p_node_id, 'skip');

  RETURN jsonb_build_object('ok', true, 'node_id', p_node_id, 'action', 'skip');
END;
$$;

GRANT EXECUTE ON FUNCTION public.gym_skip_skill_node(UUID, INTEGER) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 6) 검증 — 모두 OK 여야 함
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  _col_count    INTEGER;
  _table_count  INTEGER;
  _func_count   INTEGER;
  _policy_count INTEGER;
  _backfilled   INTEGER;
BEGIN
  SELECT count(*) INTO _col_count
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND (
          (table_name = 'user_skill_node_progress' AND column_name = 'is_skipped')
       OR (table_name = 'user_skill_unlocks'       AND column_name IN ('unlocked_by', 'unlock_source'))
     );

  SELECT count(*) INTO _table_count
    FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'skill_unlock_logs';

  SELECT count(*) INTO _func_count
    FROM pg_proc
   WHERE proname IN ('gym_unlock_skill_node', 'gym_skip_skill_node');

  SELECT count(*) INTO _policy_count
    FROM pg_policies
   WHERE policyname IN ('Admin all skill unlock logs', 'Gym read skill unlock logs');

  SELECT count(*) INTO _backfilled
    FROM public.user_skill_unlocks
   WHERE unlock_source IS NULL;

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/69] 추가된 컬럼         : % / 3', _col_count;
  RAISE NOTICE '[sql/69] 추가된 테이블       : % / 1', _table_count;
  RAISE NOTICE '[sql/69] 추가된 RPC          : % / 2', _func_count;
  RAISE NOTICE '[sql/69] 추가된 RLS 정책     : % / 2', _policy_count;
  RAISE NOTICE '[sql/69] 백필 누락 행 (0)    : %',     _backfilled;
  RAISE NOTICE '────────────────────────────────────────';

  IF _col_count = 3 AND _table_count = 1 AND _func_count = 2 AND _policy_count = 2 AND _backfilled = 0 THEN
    RAISE NOTICE '[sql/69] ✅ B단계 SQL 적용 완료';
  ELSE
    RAISE WARNING '[sql/69] 일부 누락 — 확인 필요';
  END IF;
END $$;

COMMIT;


-- ============================================================
-- 롤백 (필요시):
--   DROP FUNCTION IF EXISTS public.gym_unlock_skill_node(UUID, INTEGER);
--   DROP FUNCTION IF EXISTS public.gym_skip_skill_node(UUID, INTEGER);
--   DROP POLICY  IF EXISTS "Admin all skill unlock logs" ON public.skill_unlock_logs;
--   DROP POLICY  IF EXISTS "Gym read skill unlock logs" ON public.skill_unlock_logs;
--   DROP TABLE   IF EXISTS public.skill_unlock_logs;
--   ALTER TABLE  public.user_skill_unlocks DROP COLUMN IF EXISTS unlock_source;
--   ALTER TABLE  public.user_skill_unlocks DROP COLUMN IF EXISTS unlocked_by;
--   ALTER TABLE  public.user_skill_node_progress DROP COLUMN IF EXISTS is_skipped;
-- ============================================================

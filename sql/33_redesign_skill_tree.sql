-- ============================================================
-- 스킬 트리 재설계 — 게임 스타일 가로 트리 + EXP 시스템
--
-- 변경 요약
--  1) skill_tree_nodes 컬럼 정리 (불필요한 것 제거 + tier 추가)
--  2) user_skill_node_progress 단순화 (exp_level 0~5)
--  3) 전설(legendary) 존 노드 제거
--  4) Fork/승단 시스템 폐지
--
-- Supabase SQL Editor 에서 한 번 실행하세요.
-- ============================================================

-- ============================================================
-- 0) 안전장치: 의존 뷰가 있다면 임시 제거
-- ============================================================
DROP VIEW IF EXISTS public.skill_tree_view CASCADE;

-- ============================================================
-- 1) 전설 노드 제거 (UI 표시 폐지)
-- ============================================================
DELETE FROM public.user_skill_unlocks
 WHERE node_id IN (SELECT id FROM public.skill_tree_nodes WHERE zone = 'legendary');

DELETE FROM public.user_skill_node_progress
 WHERE node_id IN (SELECT id FROM public.skill_tree_nodes WHERE zone = 'legendary');

DELETE FROM public.skill_tree_nodes WHERE zone = 'legendary';

-- ============================================================
-- 2) 불필요한 컬럼 제거
--    - 설명/내러티브 계열: description, training_intent, flow_summary, source_name
--    - 맵 시각화 메타: map_subtitle, map_lane, is_milestone
--    - Fork/승단 시스템: is_fork, fork_branch_node_numbers
-- ============================================================
ALTER TABLE public.skill_tree_nodes
  DROP COLUMN IF EXISTS map_subtitle,
  DROP COLUMN IF EXISTS is_milestone,
  DROP COLUMN IF EXISTS map_lane,
  DROP COLUMN IF EXISTS flow_summary,
  DROP COLUMN IF EXISTS training_intent,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS source_name,
  DROP COLUMN IF EXISTS fork_branch_node_numbers,
  DROP COLUMN IF EXISTS is_fork;

-- zone 체크 제약(기존)에 legendary 가 포함돼 있을 수 있으므로 재정의
ALTER TABLE public.skill_tree_nodes
  DROP CONSTRAINT IF EXISTS skill_tree_nodes_zone_check;
ALTER TABLE public.skill_tree_nodes
  ADD CONSTRAINT skill_tree_nodes_zone_check
  CHECK (zone IN ('tutorial', 'infighter', 'outboxer'));

-- ============================================================
-- 3) tier 컬럼 추가 (1: 기초 / 2: 기본기 / 3: 심화)
-- ============================================================
ALTER TABLE public.skill_tree_nodes
  ADD COLUMN IF NOT EXISTS tier INTEGER NOT NULL DEFAULT 1
  CHECK (tier BETWEEN 1 AND 5);

COMMENT ON COLUMN public.skill_tree_nodes.tier IS
  '진행 단계: 1=기초, 2=기본기, 3=심화 (인파이터/아웃복서 전문화 포함)';

-- 기존 노드에 tier 값 자동 매핑 (node_number 기준)
UPDATE public.skill_tree_nodes SET tier = 1
 WHERE zone = 'tutorial' AND node_number BETWEEN 1 AND 8;

UPDATE public.skill_tree_nodes SET tier = 2
 WHERE zone = 'tutorial' AND node_number BETWEEN 9 AND 20;

UPDATE public.skill_tree_nodes SET tier = 3
 WHERE zone = 'tutorial' AND (node_number BETWEEN 21 AND 26 OR node_number IN (421, 422, 423));

UPDATE public.skill_tree_nodes SET tier = 3
 WHERE zone IN ('infighter', 'outboxer');

CREATE INDEX IF NOT EXISTS idx_skill_tree_nodes_tier
  ON public.skill_tree_nodes (tier);

-- ============================================================
-- 4) user_skill_node_progress 단순화 → EXP 시스템 (0~5)
--    - 기존: investment_count, promotion_status 등 복합 필드
--    - 신규: exp_level (0~5), 5 도달 시 마스터
-- ============================================================
ALTER TABLE public.user_skill_node_progress
  ADD COLUMN IF NOT EXISTS exp_level INTEGER NOT NULL DEFAULT 0
  CHECK (exp_level BETWEEN 0 AND 5);

-- 기존 데이터 마이그레이션: investment_count 또는 unlock 여부로 exp_level 산정
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'user_skill_node_progress'
       AND column_name = 'investment_count'
  ) THEN
    UPDATE public.user_skill_node_progress
       SET exp_level = LEAST(5, GREATEST(exp_level, COALESCE(investment_count, 0)));
  END IF;
END $$;

-- 기존 user_skill_unlocks 에 있는 노드는 최소 1단계로 반영
INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
SELECT u.user_id, u.node_id, 1
  FROM public.user_skill_unlocks u
 WHERE NOT EXISTS (
   SELECT 1 FROM public.user_skill_node_progress p
    WHERE p.user_id = u.user_id AND p.node_id = u.node_id
 )
ON CONFLICT (user_id, node_id) DO NOTHING;

UPDATE public.user_skill_node_progress p
   SET exp_level = GREATEST(p.exp_level, 1)
  FROM public.user_skill_unlocks u
 WHERE p.user_id = u.user_id AND p.node_id = u.node_id;

-- 더 이상 쓰지 않는 컬럼 제거
ALTER TABLE public.user_skill_node_progress
  DROP COLUMN IF EXISTS investment_count,
  DROP COLUMN IF EXISTS chosen_branch_node_number,
  DROP COLUMN IF EXISTS promotion_status,
  DROP COLUMN IF EXISTS fail_count,
  DROP COLUMN IF EXISTS required_investments_for_fork;

-- updated_at 트리거 보장
CREATE OR REPLACE FUNCTION public.touch_updated_at_skill_progress()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_skill_progress ON public.user_skill_node_progress;
CREATE TRIGGER trg_touch_updated_at_skill_progress
  BEFORE UPDATE ON public.user_skill_node_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_skill_progress();

-- ============================================================
-- 5) EXP 적립 RPC — 1회 호출 시 +1 (최대 5)
--    - point_cost 만큼 SP 차감
--    - 부모 노드(있다면) 중 최소 1개 이상 exp_level >= 1 여야 함
--    - 5단계 도달 시 user_skill_unlocks 에도 자동 반영
-- ============================================================
DROP FUNCTION IF EXISTS public.add_skill_exp(INTEGER);

CREATE OR REPLACE FUNCTION public.add_skill_exp(p_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_cost INTEGER;
  v_parents INTEGER[];
  v_parents_ok BOOLEAN := TRUE;
  v_current INTEGER := 0;
  v_new INTEGER;
  v_sp INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT n.point_cost, n.parent_nodes
    INTO v_cost, v_parents
    FROM public.skill_tree_nodes n
   WHERE n.id = p_node_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 노드입니다.';
  END IF;

  IF v_parents IS NOT NULL AND array_length(v_parents, 1) > 0 THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.skill_tree_nodes pn
        JOIN public.user_skill_node_progress up
          ON up.node_id = pn.id AND up.user_id = v_user_id
       WHERE pn.node_number = ANY (v_parents)
         AND up.exp_level >= 1
    ) INTO v_parents_ok;

    IF NOT v_parents_ok THEN
      RAISE EXCEPTION '선행 스킬을 먼저 1단계 이상 찍어야 합니다.';
    END IF;
  END IF;

  SELECT COALESCE(u.skill_points, 0) INTO v_sp
    FROM public.users u
   WHERE u.id = v_user_id
   FOR UPDATE;

  IF v_sp IS NULL THEN
    v_sp := 0;
  END IF;

  IF v_sp < COALESCE(v_cost, 1) THEN
    RAISE EXCEPTION 'SP가 부족합니다. (보유 %, 필요 %)', v_sp, v_cost;
  END IF;

  SELECT COALESCE(p.exp_level, 0) INTO v_current
    FROM public.user_skill_node_progress p
   WHERE p.user_id = v_user_id AND p.node_id = p_node_id
   FOR UPDATE;

  IF v_current >= 5 THEN
    RAISE EXCEPTION '이미 마스터한 스킬입니다.';
  END IF;

  v_new := v_current + 1;

  INSERT INTO public.user_skill_node_progress AS p (user_id, node_id, exp_level)
  VALUES (v_user_id, p_node_id, v_new)
  ON CONFLICT (user_id, node_id)
    DO UPDATE SET exp_level = EXCLUDED.exp_level, updated_at = NOW();

  IF v_new = 5 THEN
    INSERT INTO public.user_skill_unlocks (user_id, node_id)
    VALUES (v_user_id, p_node_id)
    ON CONFLICT (user_id, node_id) DO NOTHING;
  END IF;

  UPDATE public.users u
     SET skill_points = COALESCE(u.skill_points, 0) - COALESCE(v_cost, 1)
   WHERE u.id = v_user_id;

  RETURN jsonb_build_object(
    'node_id',      p_node_id,
    'exp_level',    v_new,
    'sp_remaining', v_sp - COALESCE(v_cost, 1)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.add_skill_exp(INTEGER) TO authenticated;

-- ============================================================
-- 6) RLS — 자기 진행은 본인만
-- ============================================================
ALTER TABLE public.user_skill_node_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS skill_progress_self_select ON public.user_skill_node_progress;
CREATE POLICY skill_progress_self_select
  ON public.user_skill_node_progress
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS skill_progress_self_modify ON public.user_skill_node_progress;
CREATE POLICY skill_progress_self_modify
  ON public.user_skill_node_progress
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 끝.
-- 이후 lib/supabase.js, components/views/skills.js 가 함께 갱신됩니다.
-- ============================================================

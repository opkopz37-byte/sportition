-- ============================================================
-- 마스터 스킬(5/5) 승단 심사 — 모든 노드 대상으로 확장
--
-- 기존 skill_promotion_requests 는 fork(갈림길) 노드만 지원했음.
-- 이번에 "모든 스킬을 5/5 마스터하면 그 스킬에 대해 승단 심사 신청 가능"
-- 으로 확장 — 회원이 신청 → 회원의 gym_name 으로 체육관에 표시.
--
-- 동일 테이블 재사용: fork_node_id 컬럼명은 misleading 이지만 그냥 node_id 로 사용.
--
-- ⚠️ Supabase SQL Editor 에 실행. sql/08_skill_promotion.sql 적용 후.
-- ============================================================

-- 1) 회원 → 마스터 스킬 승단 신청
CREATE OR REPLACE FUNCTION public.submit_master_exam_request(p_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _exp INTEGER;
  _gym TEXT;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 노드 존재 확인
  IF NOT EXISTS (SELECT 1 FROM public.skill_tree_nodes WHERE id = p_node_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  -- 마스터(exp_level >= 5) 확인
  SELECT exp_level INTO _exp
    FROM public.user_skill_node_progress
   WHERE user_id = _uid AND node_id = p_node_id;
  IF NOT FOUND OR COALESCE(_exp, 0) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_mastered');
  END IF;

  -- 이미 승인 (passed) 된 경우
  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = _uid AND fork_node_id = p_node_id AND status = 'approved'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_promoted');
  END IF;

  -- 이미 진행 중 (pending/reviewing)
  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = _uid AND fork_node_id = p_node_id AND status IN ('pending', 'reviewing')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_pending');
  END IF;

  -- gym_name 확인 (소속 체육관)
  SELECT gym_name INTO _gym FROM public.users WHERE id = _uid;
  IF _gym IS NULL OR btrim(_gym) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_gym');
  END IF;

  INSERT INTO public.skill_promotion_requests (user_id, fork_node_id, gym_name, status)
  VALUES (_uid, p_node_id, btrim(_gym), 'pending');

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_master_exam_request(INTEGER) TO authenticated;

-- 2) 체육관 → 일반 마스터 스킬 승단 심사 처리 (분기 선택 없음)
CREATE OR REPLACE FUNCTION public.gym_resolve_master_exam(
  p_request_id UUID,
  p_approved   BOOLEAN,
  p_notes      TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _r   public.skill_promotion_requests%ROWTYPE;
  _g   public.users%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _g FROM public.users WHERE id = _uid;
  IF NOT FOUND OR _g.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO _r FROM public.skill_promotion_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- 본인 체육관 행만 처리 (admin 은 전체)
  IF _g.role <> 'admin' AND (_g.gym_name IS DISTINCT FROM _r.gym_name) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_gym');
  END IF;

  IF _r.status NOT IN ('pending', 'reviewing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF p_approved THEN
    UPDATE public.skill_promotion_requests
       SET status = 'approved',
           resolved_at = NOW(),
           reviewer_id = _uid,
           notes = COALESCE(p_notes, notes)
     WHERE id = p_request_id;
  ELSE
    UPDATE public.skill_promotion_requests
       SET status = 'rejected',
           resolved_at = NOW(),
           reviewer_id = _uid,
           notes = p_notes
     WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gym_resolve_master_exam(UUID, BOOLEAN, TEXT) TO authenticated;

-- 3) 사용자 본인 승단 신청 목록 (skills 페이지 상태 표시용)
CREATE OR REPLACE FUNCTION public.get_my_promotion_requests()
RETURNS TABLE (
  id UUID,
  node_id INTEGER,
  status TEXT,
  requested_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notes TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, fork_node_id, status, requested_at, resolved_at, notes
    FROM public.skill_promotion_requests
   WHERE user_id = auth.uid()
   ORDER BY requested_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_promotion_requests() TO authenticated;

-- ── 테스트 ──
-- SELECT public.submit_master_exam_request(123);
-- SELECT * FROM public.get_my_promotion_requests();

-- ============================================================
-- 마스터 스킬 승단 — 거절 시 재심사 (최대 5회) + 초기화권 로그 정리
--
-- 요구사항:
--   1) 승단 거절 시 user_skill_node_progress.promotion_fail_count +1 (5 캡)
--      → 해당 스킬의 SP 맥스가 자동으로 +1 됩니다.
--   2) 동적 max = 5 + LEAST(promotion_fail_count, 5)
--      회원은 +1 SP 더 투자해 다시 마스터 → 재심사 신청.
--   3) fail_count 5 도달 후에는 SP 맥스가 더 늘어나지 않고, 같은 max 에서
--      재심사 신청만 무제한 가능.
--   4) 체육관 거절/승인 로그는 skill_promotion_requests 에 그대로 남아있음
--      (요청별 requested_at / resolved_at / notes / reviewer_id).
--   5) 스킬 초기화권 사용 시 해당 회원의 모든 skill_promotion_requests 삭제
--      → 거절·승인 로그가 전부 사라지고 처음부터 시작.
--
-- ⚠️ Supabase SQL Editor 에 실행. sql/36, sql/48 적용 후 실행.
-- ============================================================

-- ============================================================
-- 0) 컬럼/제약 보장
--    - sql/33 이 exp_level CHECK 를 0~5 로 잠가둠 → 재마스터(거절 후 +1) 시 6~10
--      값을 넣어야 하므로 제약을 0~10 으로 완화.
--    - sql/33 이 promotion_status 를 드롭했으므로 promotion_fail_count 만 사용.
--    - 혹시 promotion_fail_count 도 빠진 환경이 있다면 다시 추가.
-- ============================================================

-- exp_level CHECK 완화 (0~5 → 0~10) — 재마스터 5회까지 SP 맥스 +5
ALTER TABLE public.user_skill_node_progress
  DROP CONSTRAINT IF EXISTS user_skill_node_progress_exp_level_check;
ALTER TABLE public.user_skill_node_progress
  ADD CONSTRAINT user_skill_node_progress_exp_level_check
  CHECK (exp_level BETWEEN 0 AND 10);

-- promotion_fail_count 컬럼 보장
ALTER TABLE public.user_skill_node_progress
  ADD COLUMN IF NOT EXISTS promotion_fail_count INTEGER NOT NULL DEFAULT 0
    CHECK (promotion_fail_count >= 0 AND promotion_fail_count <= 5);

-- skill_tree_nodes 의 fork 메타 컬럼 보장 (sql/08 미적용 환경 대비)
ALTER TABLE public.skill_tree_nodes
  ADD COLUMN IF NOT EXISTS is_fork BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.skill_tree_nodes
  ADD COLUMN IF NOT EXISTS fork_branch_node_numbers INTEGER[];

-- ============================================================
-- 1) add_skill_exp — 동적 max (5 + LEAST(promotion_fail_count, 5))
-- ============================================================
DROP FUNCTION IF EXISTS public.add_skill_exp(INTEGER) CASCADE;

CREATE FUNCTION public.add_skill_exp(p_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _cost INTEGER;
  _parents INTEGER[];
  _parents_ok BOOLEAN := TRUE;
  _current INTEGER := 0;
  _fail INTEGER := 0;
  _max INTEGER;
  _new INTEGER;
  _sp INTEGER;
  _reject_cnt INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT n.point_cost, n.parent_nodes
    INTO _cost, _parents
    FROM public.skill_tree_nodes AS n
   WHERE n.id = p_node_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 노드입니다.';
  END IF;

  -- ⛔ 승단 심사 대기/진행 중이면 모든 스킬 투자 차단 (한 번에 한 노드만 심사)
  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = _uid AND status IN ('pending', 'reviewing')
  ) THEN
    RAISE EXCEPTION '승단 심사 대기 중에는 다른 스킬을 찍을 수 없습니다.';
  END IF;

  -- 부모 검증 (있으면 1개 이상 exp_level >= 1)
  IF _parents IS NOT NULL AND array_length(_parents, 1) > 0 THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.skill_tree_nodes AS pn
        INNER JOIN public.user_skill_node_progress AS up
          ON up.node_id = pn.id
       WHERE up.user_id = _uid
         AND pn.node_number = ANY (_parents)
         AND up.exp_level >= 1
    ) INTO _parents_ok;

    IF NOT _parents_ok THEN
      RAISE EXCEPTION '선행 스킬을 먼저 1단계 이상 찍어야 합니다.';
    END IF;
  END IF;

  -- SP 잔액
  SELECT COALESCE(u.skill_points, 0) INTO _sp
    FROM public.users AS u
   WHERE u.id = _uid
   FOR UPDATE;
  _sp := COALESCE(_sp, 0);
  IF _sp < COALESCE(_cost, 1) THEN
    RAISE EXCEPTION 'SP가 부족합니다. (보유 %, 필요 %)', _sp, _cost;
  END IF;

  -- 현재 EXP + 실패 카운트
  SELECT COALESCE(usnp.exp_level, 0), COALESCE(usnp.promotion_fail_count, 0)
    INTO _current, _fail
    FROM public.user_skill_node_progress AS usnp
   WHERE usnp.user_id = _uid AND usnp.node_id = p_node_id
   FOR UPDATE;
  _current := COALESCE(_current, 0);
  _fail    := COALESCE(_fail, 0);

  -- ⭐ Self-heal: promotion_fail_count 가 실제 거절 기록 수보다 작으면 동기화.
  --   sql/48 의 옛 gym_resolve_master_exam (fail_count 미증가) 로 거절된 케이스 보정.
  SELECT COUNT(*)::INTEGER INTO _reject_cnt
    FROM public.skill_promotion_requests
   WHERE user_id = _uid AND fork_node_id = p_node_id AND status = 'rejected';
  IF COALESCE(_reject_cnt, 0) > _fail THEN
    _fail := LEAST(5, _reject_cnt);
    UPDATE public.user_skill_node_progress
       SET promotion_fail_count = _fail,
           updated_at = NOW()
     WHERE user_id = _uid AND node_id = p_node_id;
  END IF;

  -- 동적 max: 기본 5, 거절 1회당 +1, 최대 +5 (총 10)
  _max := 5 + LEAST(_fail, 5);

  IF _current >= _max THEN
    RAISE EXCEPTION '이미 마스터한 스킬입니다.';
  END IF;

  _new := _current + 1;

  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (_uid, p_node_id, _new)
  ON CONFLICT (user_id, node_id)
  DO UPDATE SET exp_level = EXCLUDED.exp_level;

  -- max 도달 → unlocks 등록 (재마스터 포함)
  IF _new >= _max THEN
    INSERT INTO public.user_skill_unlocks (user_id, node_id)
    VALUES (_uid, p_node_id)
    ON CONFLICT (user_id, node_id) DO NOTHING;
  END IF;

  -- SP 차감
  UPDATE public.users
     SET skill_points = COALESCE(skill_points, 0) - COALESCE(_cost, 1)
   WHERE id = _uid;

  RETURN jsonb_build_object(
    'node_id',      p_node_id,
    'exp_level',    _new,
    'max_exp',      _max,
    'fail_count',   _fail,
    'sp_remaining', _sp - COALESCE(_cost, 1)
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.add_skill_exp(INTEGER) TO authenticated;


-- ============================================================
-- 2) submit_master_exam_request — 동적 max 검사
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_master_exam_request(p_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _exp  INTEGER;
  _fail INTEGER;
  _max  INTEGER;
  _gym  TEXT;
  _reject_cnt INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.skill_tree_nodes WHERE id = p_node_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  SELECT COALESCE(exp_level, 0), COALESCE(promotion_fail_count, 0)
    INTO _exp, _fail
    FROM public.user_skill_node_progress
   WHERE user_id = _uid AND node_id = p_node_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_mastered');
  END IF;

  _exp  := COALESCE(_exp, 0);
  _fail := COALESCE(_fail, 0);

  -- Self-heal: 거절 기록 수와 promotion_fail_count 동기화
  SELECT COUNT(*)::INTEGER INTO _reject_cnt
    FROM public.skill_promotion_requests
   WHERE user_id = _uid AND fork_node_id = p_node_id AND status = 'rejected';
  IF COALESCE(_reject_cnt, 0) > _fail THEN
    _fail := LEAST(5, _reject_cnt);
    UPDATE public.user_skill_node_progress
       SET promotion_fail_count = _fail,
           updated_at = NOW()
     WHERE user_id = _uid AND node_id = p_node_id;
  END IF;

  _max  := 5 + LEAST(_fail, 5);

  IF _exp < _max THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_mastered');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = _uid AND fork_node_id = p_node_id AND status = 'approved'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_promoted');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = _uid AND fork_node_id = p_node_id AND status IN ('pending', 'reviewing')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_pending');
  END IF;

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


-- ============================================================
-- 3) gym_resolve_master_exam — 거절 시 promotion_fail_count +1 (5 캡)
-- ============================================================
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
    -- 재심사 차단은 skill_promotion_requests.status='approved' 검사로 충분.
  ELSE
    UPDATE public.skill_promotion_requests
       SET status = 'rejected',
           resolved_at = NOW(),
           reviewer_id = _uid,
           notes = p_notes
     WHERE id = p_request_id;

    -- 거절 → fail_count +1 (5 캡). 진행 행이 없으면 새로 만들지 않음 (있어야 정상).
    UPDATE public.user_skill_node_progress
       SET promotion_fail_count = LEAST(5, COALESCE(promotion_fail_count, 0) + 1),
           updated_at = NOW()
     WHERE user_id = _r.user_id AND node_id = _r.fork_node_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gym_resolve_master_exam(UUID, BOOLEAN, TEXT) TO authenticated;


-- ============================================================
-- 4) reset_skill_tree_with_ticket — 본인 promotion 로그 함께 정리
-- ============================================================
DROP FUNCTION IF EXISTS public.reset_skill_tree_with_ticket() CASCADE;

CREATE FUNCTION public.reset_skill_tree_with_ticket()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _tickets INTEGER;
  _refund INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT COALESCE(u.skill_reset_tickets, 0)
    INTO _tickets
    FROM public.users AS u
   WHERE u.id = _uid
   FOR UPDATE;

  _tickets := COALESCE(_tickets, 0);
  IF _tickets < 1 THEN
    RAISE EXCEPTION '스킬 초기화권이 없습니다.';
  END IF;

  -- 환급 SP = 합(노드별 exp_level × point_cost)
  SELECT COALESCE(SUM(usnp.exp_level * COALESCE(stn.point_cost, 1)), 0)
    INTO _refund
    FROM public.user_skill_node_progress AS usnp
    INNER JOIN public.skill_tree_nodes AS stn ON stn.id = usnp.node_id
   WHERE usnp.user_id = _uid;

  -- 진행/언락 + 승단 신청 로그 모두 삭제
  DELETE FROM public.user_skill_node_progress  WHERE user_id = _uid;
  DELETE FROM public.user_skill_unlocks        WHERE user_id = _uid;
  DELETE FROM public.skill_promotion_requests  WHERE user_id = _uid;

  UPDATE public.users
     SET skill_reset_tickets = COALESCE(skill_reset_tickets, 0) - 1,
         skill_points        = COALESCE(skill_points, 0) + _refund
   WHERE id = _uid;

  RETURN jsonb_build_object(
    'ok',           true,
    'refunded_sp',  _refund,
    'tickets_left', _tickets - 1
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.reset_skill_tree_with_ticket() TO authenticated;


-- ============================================================
-- 5) 체육관용: 회원의 거절 로그 (최근 N개) — 회원·노드 메타 포함
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_gym_promotion_logs(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  fork_node_id INTEGER,
  status TEXT,
  requested_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  member_name TEXT,
  member_nickname TEXT,
  member_avatar_url TEXT,
  skill_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.user_id,
    r.fork_node_id,
    r.status,
    r.requested_at,
    r.resolved_at,
    r.notes,
    p.name,
    p.nickname,
    p.avatar_url,
    n.name
  FROM public.skill_promotion_requests r
  LEFT JOIN public.public_player_profiles p ON p.id = r.user_id
  LEFT JOIN public.skill_tree_nodes n        ON n.id = r.fork_node_id
  WHERE r.status = 'rejected'
    AND EXISTS (
      SELECT 1 FROM public.users gu
       WHERE gu.id = auth.uid()
         AND gu.role IN ('gym', 'admin')
         AND (gu.role = 'admin' OR gu.gym_name IS NOT DISTINCT FROM r.gym_name)
    )
  ORDER BY r.resolved_at DESC NULLS LAST, r.requested_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;
GRANT EXECUTE ON FUNCTION public.get_gym_promotion_logs(INTEGER) TO authenticated;


-- ============================================================
-- 5b) 체육관 승단 심사 큐 — 모든 상태 (skill 이름 포함, 회원 메타 포함)
--     RLS·컬럼 누락 등에 영향 받지 않도록 SECURITY DEFINER 로 묶어서 반환.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_gym_promotion_queue(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  fork_node_id INTEGER,
  status TEXT,
  requested_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  reviewer_id UUID,
  notes TEXT,
  gym_name TEXT,
  member_name TEXT,
  member_nickname TEXT,
  member_display_name TEXT,
  member_tier TEXT,
  member_avatar_url TEXT,
  skill_name TEXT,
  skill_node_number INTEGER,
  skill_is_fork BOOLEAN,
  skill_fork_branch_node_numbers INTEGER[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.user_id,
    r.fork_node_id,
    r.status,
    r.requested_at,
    r.resolved_at,
    r.reviewer_id,
    r.notes,
    r.gym_name,
    p.name,
    p.nickname,
    p.display_name,
    p.tier,
    p.avatar_url,
    n.name,
    n.node_number,
    COALESCE(n.is_fork, FALSE),
    n.fork_branch_node_numbers
  FROM public.skill_promotion_requests r
  LEFT JOIN public.public_player_profiles p ON p.id = r.user_id
  LEFT JOIN public.skill_tree_nodes n        ON n.id = r.fork_node_id
  WHERE (p_status IS NULL OR r.status = p_status)
    AND EXISTS (
      SELECT 1 FROM public.users gu
       WHERE gu.id = auth.uid()
         AND gu.role IN ('gym', 'admin')
         AND (gu.role = 'admin' OR gu.gym_name IS NOT DISTINCT FROM r.gym_name)
    )
  ORDER BY r.requested_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_gym_promotion_queue(TEXT) TO authenticated;


-- ============================================================
-- 6) 백필 — 기존 거절된 요청 수만큼 promotion_fail_count 동기화 (one-time)
--    sql/48 의 옛 gym_resolve_master_exam 으로 거절된 케이스 (fail_count 미증가) 보정.
--    이미 fail_count 가 더 높으면 그대로 유지 (GREATEST).
-- ============================================================
UPDATE public.user_skill_node_progress p
SET promotion_fail_count = LEAST(5, GREATEST(p.promotion_fail_count, c.cnt)),
    updated_at = NOW()
FROM (
  SELECT user_id, fork_node_id AS node_id, COUNT(*)::INTEGER AS cnt
    FROM public.skill_promotion_requests
   WHERE status = 'rejected'
   GROUP BY user_id, fork_node_id
) c
WHERE p.user_id = c.user_id
  AND p.node_id = c.node_id
  AND p.promotion_fail_count < c.cnt;


-- ── 테스트 ──
-- SELECT public.add_skill_exp(123);
-- SELECT public.submit_master_exam_request(123);
-- SELECT public.gym_resolve_master_exam('uuid'::uuid, false, '거절 사유');
-- SELECT * FROM public.get_gym_promotion_logs(50);
-- 백필 결과 확인:
-- SELECT user_id, node_id, exp_level, promotion_fail_count
--   FROM public.user_skill_node_progress
--  WHERE promotion_fail_count > 0
--  ORDER BY promotion_fail_count DESC;

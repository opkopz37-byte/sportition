-- ============================================================
-- 5/5 마스터 + 미승인 노드 1개라도 있으면 모든 다른 스킬 투자 차단
--
-- 정책:
--   · 회원이 어떤 스킬이든 5/5 찍는 순간 즉시 락
--   · 락 해제 조건: 그 스킬이 승단 승인 (status='approved') 받을 때
--   · 기존 "심사 대기/진행 중" 차단은 자동으로 포함됨 (pending/reviewing 도 미승인)
--   · 미신청 / pending / reviewing / rejected 모두 차단
--
-- ⚠️ Supabase SQL Editor 에 실행. sql/52 적용 후.
-- 멱등 (CREATE OR REPLACE).
-- ============================================================

DROP FUNCTION IF EXISTS public.add_skill_exp(INTEGER) CASCADE;

CREATE FUNCTION public.add_skill_exp(p_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _cost INTEGER;
  _parents INTEGER[];
  _parents_ok BOOLEAN := TRUE;
  _current INTEGER := 0;
  _new INTEGER;
  _sp INTEGER;
  _block_node_id INTEGER;
  _block_node_name TEXT;
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

  -- 최소 비용 1 SP — DB 가 NULL/0 이라도 차감 보장
  _cost := GREATEST(1, COALESCE(_cost, 1));

  -- ⛔ 5/5 마스터 + 미승인 노드 1개라도 있으면 다른 스킬 투자 차단
  --   (본인 노드 자기 자신은 제외 — 어차피 5 이상은 못 찍게 아래에서 막힘.
  --    목적은 "다른 스킬 못 찍게" 이므로 p_node_id 와 다른 노드만 검사)
  SELECT p.node_id, n.name
    INTO _block_node_id, _block_node_name
    FROM public.user_skill_node_progress p
    JOIN public.skill_tree_nodes n ON n.id = p.node_id
   WHERE p.user_id = _uid
     AND p.exp_level >= 5
     AND p.node_id <> p_node_id
     AND NOT EXISTS (
       SELECT 1 FROM public.skill_promotion_requests r
        WHERE r.user_id = p.user_id
          AND r.fork_node_id = p.node_id
          AND r.status = 'approved'
     )
   ORDER BY p.updated_at DESC NULLS LAST
   LIMIT 1;

  IF _block_node_id IS NOT NULL THEN
    RAISE EXCEPTION
      '''%'' 스킬 마스터 후 승단 승인 받기 전에는 다른 스킬을 찍을 수 없습니다.',
      COALESCE(_block_node_name, '마스터 스킬');
  END IF;

  -- 부모 검증 (있으면 1개 이상 exp_level >= 1)
  IF _parents IS NOT NULL AND array_length(_parents, 1) > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.skill_tree_nodes AS pn
        INNER JOIN public.user_skill_node_progress AS up ON up.node_id = pn.id
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
  IF _sp < _cost THEN
    RAISE EXCEPTION 'SP가 부족합니다. (보유 %, 필요 %)', _sp, _cost;
  END IF;

  -- 현재 EXP
  SELECT COALESCE(usnp.exp_level, 0) INTO _current
    FROM public.user_skill_node_progress AS usnp
   WHERE usnp.user_id = _uid AND usnp.node_id = p_node_id
   FOR UPDATE;
  _current := COALESCE(_current, 0);

  IF _current >= 5 THEN
    RAISE EXCEPTION '이미 마스터한 스킬입니다.';
  END IF;

  _new := _current + 1;

  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (_uid, p_node_id, _new)
  ON CONFLICT (user_id, node_id)
  DO UPDATE SET exp_level = EXCLUDED.exp_level;

  IF _new = 5 THEN
    INSERT INTO public.user_skill_unlocks (user_id, node_id)
    VALUES (_uid, p_node_id)
    ON CONFLICT (user_id, node_id) DO NOTHING;
  END IF;

  UPDATE public.users
     SET skill_points = COALESCE(skill_points, 0) - _cost
   WHERE id = _uid;

  RETURN jsonb_build_object(
    'node_id',      p_node_id,
    'exp_level',    _new,
    'max_exp',      5,
    'sp_remaining', _sp - _cost
  );
END
$function$;
GRANT EXECUTE ON FUNCTION public.add_skill_exp(INTEGER) TO authenticated;

-- ============================================================
-- ── 테스트 ──
-- 시나리오: 회원이 노드 X 5/5 마스터 (미승인) 후 노드 Y +1 시도
-- SELECT public.add_skill_exp(<Y_node_id>);
-- → ERROR: '<X_skill_name>' 스킬 마스터 후 승단 승인 받기 전에는...
-- ============================================================

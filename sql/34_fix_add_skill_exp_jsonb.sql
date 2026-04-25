-- ============================================================
-- add_skill_exp 함수 — JSONB 반환, 무모호 변수명, 견고 버전
--
-- ⚠️ Supabase SQL Editor 에 이 파일을 통째로 실행하세요.
--    이전 함수가 강제로 DROP 되고 재생성됩니다.
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
  _new INTEGER;
  _sp INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  -- 1) 노드 정보
  SELECT n.point_cost, n.parent_nodes
    INTO _cost, _parents
    FROM public.skill_tree_nodes AS n
   WHERE n.id = p_node_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 노드입니다.';
  END IF;

  -- 2) 부모 검증 (있으면 1개 이상 exp_level >= 1 필요)
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

  -- 3) SP 잔액 확인
  SELECT COALESCE(u.skill_points, 0) INTO _sp
    FROM public.users AS u
   WHERE u.id = _uid
   FOR UPDATE;

  IF _sp IS NULL THEN
    _sp := 0;
  END IF;

  IF _sp < COALESCE(_cost, 1) THEN
    RAISE EXCEPTION 'SP가 부족합니다. (보유 %, 필요 %)', _sp, _cost;
  END IF;

  -- 4) 현재 EXP
  SELECT COALESCE(usnp.exp_level, 0) INTO _current
    FROM public.user_skill_node_progress AS usnp
   WHERE usnp.user_id = _uid AND usnp.node_id = p_node_id
   FOR UPDATE;

  IF _current >= 5 THEN
    RAISE EXCEPTION '이미 마스터한 스킬입니다.';
  END IF;

  _new := _current + 1;

  -- 5) INSERT or UPDATE (updated_at 은 트리거가 처리)
  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (_uid, p_node_id, _new)
  ON CONFLICT (user_id, node_id)
  DO UPDATE SET exp_level = EXCLUDED.exp_level;

  -- 6) 5단계 도달 시 unlocks 등록
  IF _new = 5 THEN
    INSERT INTO public.user_skill_unlocks (user_id, node_id)
    VALUES (_uid, p_node_id)
    ON CONFLICT (user_id, node_id) DO NOTHING;
  END IF;

  -- 7) SP 차감
  UPDATE public.users
     SET skill_points = COALESCE(skill_points, 0) - COALESCE(_cost, 1)
   WHERE id = _uid;

  -- 8) JSON 반환
  RETURN jsonb_build_object(
    'node_id',      p_node_id,
    'exp_level',    _new,
    'sp_remaining', _sp - COALESCE(_cost, 1)
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.add_skill_exp(INTEGER) TO authenticated;

-- ============================================================
-- 검증: 아래 쿼리로 함수가 잘 등록됐는지 확인
-- SELECT pg_get_functiondef('public.add_skill_exp(INTEGER)'::regprocedure);
-- ============================================================

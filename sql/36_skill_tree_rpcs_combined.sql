-- ============================================================
-- 스킬 트리 RPC 합본 (sql/34 + sql/35 통합) + NULL 버그 수정
--
-- 포함:
--   1) add_skill_exp           — 스킬 +1 EXP (1회당)
--   2) reset_skill_tree_with_ticket — 트리 초기화 (티켓 1장 사용)
--
-- 수정:
--   - add_skill_exp 의 NULL exp_level 버그
--     → 진행 행이 없을 때 SELECT INTO 가 _current 를 NULL 로 덮어써서
--       _new = NULL + 1 = NULL → INSERT 실패하던 문제
--     → COALESCE 한 번 더 적용
--
-- ⚠️ Supabase SQL Editor 에 이 파일 1개만 실행하세요.
--    이전 sql/34, sql/35 는 중복 실행 불필요.
-- ============================================================

-- ============================================================
-- 1) add_skill_exp — JSONB 반환
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

  -- 2) 부모 검증 (있으면 1개 이상 exp_level >= 1)
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

  _sp := COALESCE(_sp, 0);

  IF _sp < COALESCE(_cost, 1) THEN
    RAISE EXCEPTION 'SP가 부족합니다. (보유 %, 필요 %)', _sp, _cost;
  END IF;

  -- 4) 현재 EXP — 진행 행 없으면 0 으로 강제
  SELECT COALESCE(usnp.exp_level, 0) INTO _current
    FROM public.user_skill_node_progress AS usnp
   WHERE usnp.user_id = _uid AND usnp.node_id = p_node_id
   FOR UPDATE;

  -- ★ 핵심 수정: 행이 없으면 _current 가 NULL 이 되므로 다시 0 으로
  _current := COALESCE(_current, 0);

  IF _current >= 5 THEN
    RAISE EXCEPTION '이미 마스터한 스킬입니다.';
  END IF;

  _new := _current + 1;

  -- 5) INSERT or UPDATE
  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (_uid, p_node_id, _new)
  ON CONFLICT (user_id, node_id)
  DO UPDATE SET exp_level = EXCLUDED.exp_level;

  -- 6) 5단계 도달 → unlocks 등록
  IF _new = 5 THEN
    INSERT INTO public.user_skill_unlocks (user_id, node_id)
    VALUES (_uid, p_node_id)
    ON CONFLICT (user_id, node_id) DO NOTHING;
  END IF;

  -- 7) SP 차감
  UPDATE public.users
     SET skill_points = COALESCE(skill_points, 0) - COALESCE(_cost, 1)
   WHERE id = _uid;

  RETURN jsonb_build_object(
    'node_id',      p_node_id,
    'exp_level',    _new,
    'sp_remaining', _sp - COALESCE(_cost, 1)
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.add_skill_exp(INTEGER) TO authenticated;


-- ============================================================
-- 2) reset_skill_tree_with_ticket — 트리 초기화
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

  -- 티켓 잔량 확인
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

  -- 진행/언락 모두 삭제
  DELETE FROM public.user_skill_node_progress WHERE user_id = _uid;
  DELETE FROM public.user_skill_unlocks       WHERE user_id = _uid;

  -- 티켓 차감 + SP 환급
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
-- 검증
--   SELECT pg_get_functiondef('public.add_skill_exp(INTEGER)'::regprocedure);
--   SELECT pg_get_functiondef('public.reset_skill_tree_with_ticket()'::regprocedure);
-- ============================================================

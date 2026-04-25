-- ============================================================
-- reset_skill_tree_with_ticket — 스킬 트리 초기화 RPC 재작성
--
-- 문제: 기존 함수가 user_skill_node_progress.investment_count 컬럼을 참조 중.
--       sql/33 에서 그 컬럼을 제거 → "column p.investment_count does not exist" 에러.
-- 해결: 새 스키마(exp_level) 기반으로 재작성.
--       모든 노드 진행/언락 삭제 + 사용한 SP 환급 + 티켓 1장 차감.
--
-- ⚠️ Supabase SQL Editor 에 실행하세요.
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

  -- 1) 티켓 잔량 확인 (FOR UPDATE 로 동시성 보호)
  SELECT COALESCE(u.skill_reset_tickets, 0)
    INTO _tickets
    FROM public.users AS u
   WHERE u.id = _uid
   FOR UPDATE;

  IF _tickets IS NULL OR _tickets < 1 THEN
    RAISE EXCEPTION '스킬 초기화권이 없습니다.';
  END IF;

  -- 2) 환급할 SP 계산 = 합(노드별 exp_level × point_cost)
  SELECT COALESCE(SUM(usnp.exp_level * COALESCE(stn.point_cost, 1)), 0)
    INTO _refund
    FROM public.user_skill_node_progress AS usnp
    INNER JOIN public.skill_tree_nodes AS stn ON stn.id = usnp.node_id
   WHERE usnp.user_id = _uid;

  -- 3) 진행/언락 모두 삭제
  DELETE FROM public.user_skill_node_progress WHERE user_id = _uid;
  DELETE FROM public.user_skill_unlocks       WHERE user_id = _uid;

  -- 4) 티켓 1장 차감 + SP 환급
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
--   SELECT pg_get_functiondef('public.reset_skill_tree_with_ticket()'::regprocedure);
-- ============================================================

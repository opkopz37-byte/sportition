-- ============================================================
-- sql/71 — 회원이 직접 부르던 폐기 함수 4개 no-op 교체 (D단계)
--
-- 대상 함수:
--   1. claim_daily_skill_point()             — 회원의 모달 [SP 적립]
--   2. add_skill_exp(p_node_id)              — 회원의 노드 +1 EXP
--   3. invest_skill_node(target_node_id)     — 회원의 노드 투자 (포크 포함)
--   4. unlock_skill_node(target_node_id)     — 회원의 직접 해금
--
-- 처리: 시그니처 유지하되 본문을 deprecated 응답으로 교체 (no-op).
--   → 구버전 클라이언트가 호출해도 에러 없이 안내 메시지 반환
--   → 어떤 데이터도 변경되지 않음
--
-- 1~2주 후 sql/73 에서 함수 자체 DROP.
--
-- ⚠️ Supabase SQL Editor 에서 실행.
-- ============================================================

BEGIN;


-- 1) claim_daily_skill_point — 모달 [SP 적립] 버튼 호출자
CREATE OR REPLACE FUNCTION public.claim_daily_skill_point()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', false,
    'error', 'deprecated',
    'message', '이 기능은 더 이상 사용되지 않습니다. 출석 시 활성 스킬의 EXP 가 자동으로 적립됩니다.'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_daily_skill_point() TO authenticated;


-- 2) add_skill_exp — 회원의 스킬 +1 EXP
CREATE OR REPLACE FUNCTION public.add_skill_exp(p_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', false,
    'error', 'deprecated',
    'message', '스킬 해금은 관장이 진행합니다. 출석 시 활성 스킬의 EXP 가 자동으로 적립됩니다.'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_skill_exp(INTEGER) TO authenticated;


-- 3) invest_skill_node — 회원의 노드 투자 (포크/비포크)
CREATE OR REPLACE FUNCTION public.invest_skill_node(target_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', false,
    'error', 'deprecated',
    'message', '스킬 투자는 더 이상 사용되지 않습니다. 관장이 해금/스킵을 처리합니다.'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.invest_skill_node(INTEGER) TO authenticated;


-- 4) unlock_skill_node — 회원의 직접 해금
CREATE OR REPLACE FUNCTION public.unlock_skill_node(target_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', false,
    'error', 'deprecated',
    'message', '회원의 직접 해금은 폐지되었습니다. 관장이 해금을 처리합니다.'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.unlock_skill_node(INTEGER) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 검증
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  _names TEXT[] := ARRAY[
    'claim_daily_skill_point',
    'add_skill_exp',
    'invest_skill_node',
    'unlock_skill_node'
  ];
  _name  TEXT;
  _missing INTEGER := 0;
BEGIN
  FOREACH _name IN ARRAY _names LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = _name) THEN
      _missing := _missing + 1;
      RAISE WARNING '[sql/71] % 함수 누락', _name;
    END IF;
  END LOOP;

  RAISE NOTICE '────────────────────────────────────────';
  IF _missing = 0 THEN
    RAISE NOTICE '[sql/71] ✅ 폐기 함수 4개 모두 no-op 교체 완료';
  ELSE
    RAISE WARNING '[sql/71] 누락 함수 % 개', _missing;
  END IF;
END $$;

COMMIT;


-- ============================================================
-- 롤백 (필요시): sql/52, sql/07, sql/08 의 원본 함수 정의 다시 적용
-- ============================================================

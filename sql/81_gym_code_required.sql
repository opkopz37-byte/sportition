-- ============================================================
-- sql/81 — 회원/선수 가입 시 체육관 코드 필수화
--
-- 기획 의도:
--   회원(player_common) / 선수(player_athlete) 가입 시 gym_code 가
--   비어있거나 잘못된 값이어도 가입이 진행되는 문제 차단.
--   "코드 입력 안되있거나 잘못된 기입이면 절대 회원가입 안됨" 룰 강제.
--
-- 변경:
--   • handle_new_user_gym_code 트리거 함수 강화 (sql/65 위에 덮어쓰기)
--     - player_common / player_athlete:
--         gym_code NULL/empty       → RAISE EXCEPTION (가입 차단)
--         gym_code 매칭 안됨         → RAISE EXCEPTION (가입 차단)
--     - gym 역할은 기존 동작 그대로 (region → 코드 자동 발급)
--
--   • 트리거는 public.users AFTER INSERT — 트리거 안에서 EXCEPTION 던지면
--     auth.users INSERT 까지 같은 트랜잭션에서 롤백되어 signUp 자체 실패.
--
-- 시그니처 동일 → CREATE OR REPLACE.
-- ⚠️ Supabase SQL Editor 에서 실행. sql/65 의 함수 본체를 덮어씀.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user_gym_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _meta                JSONB;
  _region              TEXT;
  _gym_code            TEXT;
  _resolved_gym_id     UUID;
  _resolved_gym_name   TEXT;
BEGIN
  SELECT raw_user_meta_data INTO _meta
    FROM auth.users
   WHERE id = NEW.id;

  IF _meta IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.gym_change_via_rpc', 'on', true);

  -- (a) 체육관 신규 가입 — region 처리 (변경 없음)
  IF NEW.role = 'gym' THEN
    _region := NULLIF(btrim(_meta->>'region'), '');
    IF _region IS NOT NULL
       AND _region IN ('seoul','gyeonggi','gangwon','chungcheong','jeolla','gyeongsang','jeju')
       AND NEW.region IS NULL
    THEN
      UPDATE public.users
         SET region = _region
       WHERE id = NEW.id;
      RAISE NOTICE '[handle_new_user_gym_code] gym % region=% 설정 완료', NEW.id, _region;
    ELSIF _region IS NOT NULL THEN
      RAISE WARNING '[handle_new_user_gym_code] gym % 의 region=% 이 화이트리스트 외 — 코드 미발급', NEW.id, _region;
    END IF;
  END IF;

  -- (b) 회원/선수 신규 가입 — gym_code 필수 + 존재 검증
  IF NEW.role IN ('player_common', 'player_athlete') THEN
    _gym_code := lower(btrim(NULLIF(_meta->>'gym_code', '')));

    -- ★ 필수: gym_code 가 비어있으면 가입 차단
    IF _gym_code IS NULL THEN
      RAISE EXCEPTION 'gym_code_required: 체육관 코드는 필수 입력 항목입니다.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- gym_user_id 가 이미 채워져 있으면 (수동 지정 등) skip
    IF NEW.gym_user_id IS NULL THEN
      SELECT g.id, g.gym_name
        INTO _resolved_gym_id, _resolved_gym_name
        FROM public.users g
       WHERE g.role = 'gym' AND g.gym_code = _gym_code
       LIMIT 1;

      -- ★ 존재 검증: 매칭되는 체육관 없으면 가입 차단
      IF _resolved_gym_id IS NULL THEN
        RAISE EXCEPTION 'gym_code_not_found: 존재하지 않는 체육관 코드입니다 (%).', _gym_code
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      UPDATE public.users
         SET gym_user_id = _resolved_gym_id,
             gym_name    = _resolved_gym_name
       WHERE id = NEW.id;
      RAISE NOTICE '[handle_new_user_gym_code] member % → gym_code=% (gym=%)', NEW.id, _gym_code, _resolved_gym_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


DO $$
BEGIN
  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/81] ✅ handle_new_user_gym_code 강화';
  RAISE NOTICE '  - player_common/player_athlete: gym_code 누락/오류 시 가입 차단';
  RAISE NOTICE '  - 에러 코드: gym_code_required / gym_code_not_found';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

COMMIT;

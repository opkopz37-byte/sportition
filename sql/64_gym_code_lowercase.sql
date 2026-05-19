-- ============================================================
-- 체육관 코드 소문자화 — 일회성 + 함수 영구 교체
-- 사전 조건: sql/58 + sql/61 + sql/62 적용 완료
--
-- ── 배경 ──
-- 회원이 코드 입력할 때 대문자 자동 변환이 불편하다는 피드백.
-- 코드 형식을 GG0001 → gg0001 처럼 소문자로 통일.
--
-- ── 무엇을 하는가 ──
-- A) 사전 점검 — 필수 객체 존재 확인.
-- B) gen_gym_code()       — 발급 prefix 를 'gg','se' 등 소문자로 교체.
-- C) handle_new_user_gym_code() — upper() → lower() 로 입력 정규화 변경.
-- D) change_my_gym_by_code()    — upper() → lower(), 정규식도 소문자로.
-- E) lookup_gym_by_code()       — upper() → lower().
-- F) 기존 데이터 일괄 lower()
--    - users.gym_code
--    - user_gym_history.gym_code
-- G) 사후 검증.
--
-- ── 안전 ──
--   - 함수는 모두 CREATE OR REPLACE — 시그니처 동일, 기존 호출자 영향 없음.
--   - 데이터 변환은 lower(x) 동등 변환 — 정보 손실 없음.
--   - 입력 정규화에 lower() 사용 → 사용자가 'GG0001' 으로 입력해도 'gg0001' 로 매칭.
--     (대소문자 양방향 호환 — 옛날 캐시된 클라이언트도 동작)
--   - BEGIN/COMMIT 트랜잭션 — 중간 실패 시 자동 롤백.
--
-- ── 멱등성 ──
--   - 두 번째 실행 시: 함수는 같은 내용으로 재정의, 데이터는 이미 소문자라 no-op.
--
-- ⚠️ Supabase SQL Editor 에서 실행. 클라이언트 배포 직후 실행 권장.
-- ============================================================

BEGIN;


-- ============================================================
-- A) 사전 점검
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'gen_gym_code'
  ) THEN
    RAISE EXCEPTION '[sql/64-A] gen_gym_code 함수 없음. sql/58 먼저 적용 필요.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user_gym_code'
  ) THEN
    RAISE EXCEPTION '[sql/64-A] handle_new_user_gym_code 함수 없음. sql/61 먼저 적용 필요.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'change_my_gym_by_code'
  ) THEN
    RAISE EXCEPTION '[sql/64-A] change_my_gym_by_code 함수 없음. sql/62 먼저 적용 필요.';
  END IF;

  RAISE NOTICE '[sql/64-A] 사전 점검 통과';
END $$;


-- ============================================================
-- B) gen_gym_code() — 소문자 prefix 로 교체
-- ============================================================
CREATE OR REPLACE FUNCTION public.gen_gym_code(p_region TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix TEXT;
  _seq    BIGINT;
BEGIN
  CASE p_region
    WHEN 'seoul'       THEN _prefix := 'se'; _seq := nextval('public.gym_seq_se');
    WHEN 'gyeonggi'    THEN _prefix := 'gg'; _seq := nextval('public.gym_seq_gg');
    WHEN 'gangwon'     THEN _prefix := 'gw'; _seq := nextval('public.gym_seq_gw');
    WHEN 'chungcheong' THEN _prefix := 'cc'; _seq := nextval('public.gym_seq_cc');
    WHEN 'jeolla'      THEN _prefix := 'jl'; _seq := nextval('public.gym_seq_jl');
    WHEN 'gyeongsang'  THEN _prefix := 'gs'; _seq := nextval('public.gym_seq_gs');
    WHEN 'jeju'        THEN _prefix := 'jj'; _seq := nextval('public.gym_seq_jj');
    ELSE
      RAISE EXCEPTION 'gen_gym_code: unknown region %', p_region;
  END CASE;

  IF _seq > 9999 THEN
    RAISE EXCEPTION 'gen_gym_code: region % capacity exceeded (>9999)', p_region;
  END IF;

  RETURN _prefix || lpad(_seq::TEXT, 4, '0');
END;
$$;


-- ============================================================
-- C) handle_new_user_gym_code() — 입력 정규화 lower()
--    (사용자가 'GG0001'/'gg0001' 어느 쪽으로 보내도 'gg0001' 로 lookup)
-- ============================================================
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

  -- (a) 체육관 신규 가입 — region 처리
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

  -- (b) 회원 신규 가입 — gym_code → gym_user_id resolve
  IF NEW.role IN ('player_common', 'player_athlete') THEN
    _gym_code := lower(btrim(NULLIF(_meta->>'gym_code', '')));

    IF _gym_code IS NOT NULL AND NEW.gym_user_id IS NULL THEN
      SELECT g.id, g.gym_name
        INTO _resolved_gym_id, _resolved_gym_name
        FROM public.users g
       WHERE g.role = 'gym' AND g.gym_code = _gym_code
       LIMIT 1;

      IF _resolved_gym_id IS NOT NULL THEN
        UPDATE public.users
           SET gym_user_id = _resolved_gym_id,
               gym_name    = _resolved_gym_name
         WHERE id = NEW.id;
        RAISE NOTICE '[handle_new_user_gym_code] member % → gym_code=% (gym=%)', NEW.id, _gym_code, _resolved_gym_id;
      ELSE
        RAISE WARNING '[handle_new_user_gym_code] member % 의 gym_code=% 를 찾을 수 없음', NEW.id, _gym_code;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- D) change_my_gym_by_code() — lower() + 소문자 정규식
-- ============================================================
CREATE OR REPLACE FUNCTION public.change_my_gym_by_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id        UUID;
  _user_role      TEXT;
  _normalized     TEXT;
  _gym_id         UUID;
  _gym_name       TEXT;
  _old_gym_id     UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT role, gym_user_id INTO _user_role, _old_gym_id
    FROM public.users
   WHERE id = _user_id;

  IF _user_role NOT IN ('player_common', 'player_athlete') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
  END IF;

  _normalized := lower(btrim(COALESCE(p_code, '')));

  -- 빈 코드 → 체육관 비움
  IF _normalized = '' THEN
    UPDATE public.users
       SET gym_user_id = NULL,
           gym_name    = NULL
     WHERE id = _user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'left_gym', true,
      'old_gym_user_id', _old_gym_id
    );
  END IF;

  -- 코드 형식 검증 (소문자)
  IF _normalized !~ '^(se|gg|gw|cc|jl|gs|jj)\d{4}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code_format');
  END IF;

  -- 코드로 체육관 찾기
  SELECT g.id, g.gym_name INTO _gym_id, _gym_name
    FROM public.users g
   WHERE g.role = 'gym' AND g.gym_code = _normalized
   LIMIT 1;

  IF _gym_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_not_found');
  END IF;

  -- 같은 체육관이면 noop
  IF _gym_id = _old_gym_id THEN
    RETURN jsonb_build_object(
      'ok', true,
      'no_change', true,
      'gym_user_id', _gym_id,
      'gym_name', _gym_name,
      'gym_code', _normalized
    );
  END IF;

  -- 변경
  UPDATE public.users
     SET gym_user_id = _gym_id,
         gym_name    = _gym_name
   WHERE id = _user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'old_gym_user_id', _old_gym_id,
    'gym_user_id', _gym_id,
    'gym_name', _gym_name,
    'gym_code', _normalized
  );
END;
$$;


-- ============================================================
-- E) lookup_gym_by_code() — upper() → lower()
-- ============================================================
CREATE OR REPLACE FUNCTION public.lookup_gym_by_code(p_code TEXT)
RETURNS TABLE (gym_user_id UUID, gym_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.gym_name
    FROM public.users g
   WHERE g.role = 'gym'
     AND g.gym_code = lower(btrim(p_code))
   LIMIT 1;
END;
$$;


-- ============================================================
-- F) 기존 데이터 일괄 변환
-- ============================================================
DO $$
DECLARE
  _users_updated      INTEGER;
  _history_updated    INTEGER;
BEGIN
  -- F1) users.gym_code 소문자화
  UPDATE public.users
     SET gym_code = lower(gym_code)
   WHERE gym_code IS NOT NULL
     AND gym_code <> lower(gym_code);

  GET DIAGNOSTICS _users_updated = ROW_COUNT;

  -- F2) user_gym_history.gym_code 소문자화
  UPDATE public.user_gym_history
     SET gym_code = lower(gym_code)
   WHERE gym_code IS NOT NULL
     AND gym_code <> lower(gym_code);

  GET DIAGNOSTICS _history_updated = ROW_COUNT;

  RAISE NOTICE '[sql/64-F] users.gym_code 변환: % rows', _users_updated;
  RAISE NOTICE '[sql/64-F] user_gym_history.gym_code 변환: % rows', _history_updated;
END $$;


-- ============================================================
-- G) 사후 검증
-- ============================================================
DO $$
DECLARE
  _users_uppercase    INTEGER;
  _history_uppercase  INTEGER;
BEGIN
  SELECT count(*) INTO _users_uppercase
    FROM public.users
   WHERE gym_code IS NOT NULL
     AND gym_code <> lower(gym_code);

  SELECT count(*) INTO _history_uppercase
    FROM public.user_gym_history
   WHERE gym_code IS NOT NULL
     AND gym_code <> lower(gym_code);

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/64-G] 사후 검증 (모두 0 이어야 정상):';
  RAISE NOTICE '  users 에 남은 대문자 코드        : %', _users_uppercase;
  RAISE NOTICE '  user_gym_history 에 남은 대문자  : %', _history_uppercase;
  RAISE NOTICE '────────────────────────────────────────';

  IF _users_uppercase > 0 OR _history_uppercase > 0 THEN
    RAISE WARNING '[sql/64-G] 검증 실패 — 대문자 코드 남아있음.';
  ELSE
    RAISE NOTICE '[sql/64-G] ✅ 모든 코드 소문자 변환 완료';
  END IF;
END $$;


COMMIT;


-- ============================================================
-- ── 사후 확인 쿼리 (선택, 주석 해제 후 실행) ──
--
-- -- 1) 체육관 코드 현황
-- SELECT id, gym_name, region, gym_code
--   FROM public.users
--  WHERE role = 'gym'
--  ORDER BY gym_code;
--
-- -- 2) 다음 발급될 코드 시뮬레이션 (실행 시 sequence 증가하니 주의)
-- -- SELECT public.gen_gym_code('gyeonggi');
-- ============================================================

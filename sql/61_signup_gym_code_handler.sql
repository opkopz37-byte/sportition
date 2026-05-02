-- ============================================================
-- 신규 가입 시 region/gym_code 자동 처리 — Phase 3+5 백엔드
-- 사전 조건: sql/58 적용 완료
--
-- ── 무엇을 하는가 ──
-- 회원가입 → handle_new_user 가 public.users INSERT.
-- 그 직후 AFTER INSERT 트리거가 발화해서:
--   (a) role='gym' + raw_user_meta_data 에 region 있음
--       → users.region UPDATE → BEFORE UPDATE OF region 트리거가 gym_code 자동 발급
--   (b) role='player_*' + raw_user_meta_data 에 gym_code 있음
--       → 코드를 gym_user_id 로 resolve → users 의 gym_user_id, gym_name UPDATE
--       → AFTER UPDATE OF gym_user_id 트리거가 user_gym_history row 자동 생성
--
-- ── 왜 handle_new_user 를 직접 안 고치나 ──
-- sql/13 의 handle_new_user 는 100 줄 넘는 큰 함수. 직접 수정 시 회귀 위험 큼.
-- 작은 AFTER INSERT 트리거로 추가 동작만 부착 — 기존 트리거는 그대로.
--
-- ── 절대 건드리지 않는 데이터 ──
--   - 기존 회원·체육관 행 (이 트리거는 신규 INSERT 에만 발화)
--   - handle_new_user 함수 자체 (DROP/REPLACE 안 함)
--   - sql/57, sql/58 의 트리거들 (그대로 유지)
--
-- ── 안전성 ──
--   - SECURITY DEFINER + search_path 고정
--   - 트리거가 자기 자신을 재발화시킬 가능성 없음 (UPDATE 가 일어나지만 다른 트리거들이 처리)
--   - 잘못된 코드 입력 시 RAISE WARNING + gym_user_id NULL 유지 (회원은 가입은 됨)
--
-- ── 멱등성 ──
--   - DROP TRIGGER IF EXISTS + CREATE — 여러 번 실행 안전
--
-- ⚠️ Supabase SQL Editor 에서 실행. sql/58 적용 후.
-- ============================================================

BEGIN;

-- ============================================================
-- 사전 점검 — sql/58 객체 존재 확인
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users' AND column_name='region'
  ) THEN
    RAISE EXCEPTION '[sql/61] sql/58 미적용. users.region 컬럼 없음.';
  END IF;
END $$;


-- ============================================================
-- 트리거 함수 — auth.users 의 raw_user_meta_data 를 읽어
-- region/gym_code 처리
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
  -- auth.users 에서 raw_user_meta_data 가져오기
  SELECT raw_user_meta_data INTO _meta
    FROM auth.users
   WHERE id = NEW.id;

  IF _meta IS NULL THEN
    RETURN NEW;
  END IF;

  -- ── (a) 체육관 신규 가입 — region 처리 ──
  IF NEW.role = 'gym' THEN
    _region := NULLIF(btrim(_meta->>'region'), '');
    -- 7 가지 region 화이트리스트 검증
    IF _region IS NOT NULL
       AND _region IN ('seoul','gyeonggi','gangwon','chungcheong','jeolla','gyeongsang','jeju')
       AND NEW.region IS NULL
    THEN
      -- region UPDATE → BEFORE UPDATE OF region 트리거가 gym_code 자동 발급
      UPDATE public.users
         SET region = _region
       WHERE id = NEW.id;
      RAISE NOTICE '[handle_new_user_gym_code] gym % region=% 설정 완료', NEW.id, _region;
    ELSIF _region IS NOT NULL THEN
      RAISE WARNING '[handle_new_user_gym_code] gym % 의 region=% 이 화이트리스트 외 — 코드 미발급', NEW.id, _region;
    END IF;
  END IF;

  -- ── (b) 회원 신규 가입 — gym_code → gym_user_id resolve ──
  IF NEW.role IN ('player_common', 'player_athlete') THEN
    _gym_code := upper(btrim(NULLIF(_meta->>'gym_code', '')));

    IF _gym_code IS NOT NULL AND NEW.gym_user_id IS NULL THEN
      SELECT g.id, g.gym_name
        INTO _resolved_gym_id, _resolved_gym_name
        FROM public.users g
       WHERE g.role = 'gym' AND g.gym_code = _gym_code
       LIMIT 1;

      IF _resolved_gym_id IS NOT NULL THEN
        -- gym_user_id UPDATE → AFTER UPDATE 트리거가 user_gym_history row 자동 생성
        UPDATE public.users
           SET gym_user_id = _resolved_gym_id,
               gym_name    = _resolved_gym_name
         WHERE id = NEW.id;
        RAISE NOTICE '[handle_new_user_gym_code] member % → gym_code=% (gym=%)', NEW.id, _gym_code, _resolved_gym_id;
      ELSE
        -- 코드 입력했는데 못 찾음. 가입은 진행 (gym_user_id NULL 로). 나중에 마이페이지에서 재시도 가능.
        RAISE WARNING '[handle_new_user_gym_code] member % 의 gym_code=% 를 찾을 수 없음', NEW.id, _gym_code;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 트리거 부착 — public.users AFTER INSERT
-- (handle_new_user 의 INSERT 직후 발화)
-- ============================================================
DROP TRIGGER IF EXISTS trg_handle_new_user_gym_code ON public.users;

CREATE TRIGGER trg_handle_new_user_gym_code
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_gym_code();


-- ============================================================
-- 사후 보고
-- ============================================================
DO $$
DECLARE
  _trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
     WHERE trigger_schema='public'
       AND trigger_name='trg_handle_new_user_gym_code'
  ) INTO _trigger_exists;

  RAISE NOTICE '[sql/61] trg_handle_new_user_gym_code 부착: %', _trigger_exists;
END $$;

COMMIT;


-- ============================================================
-- ── 테스트 시나리오 (운영 환경에선 실행 금지) ──
--
-- -- 1) 체육관 신규 가입 시뮬레이션:
-- --    Supabase Auth 로 신규 가입 → raw_user_meta_data 에
-- --    { "role": "gym", "region": "seoul", "gym_name": "테스트체육관", ... } 들어옴
-- --    → public.users INSERT 직후 트리거가 region='seoul' 채움
-- --    → BEFORE UPDATE 트리거가 gym_code='SE0001' 발급
--
-- -- 2) 회원 신규 가입 시뮬레이션:
-- --    raw_user_meta_data 에
-- --    { "role": "player_common", "gym_code": "GG0001", "name": "홍길동", ... } 들어옴
-- --    → public.users INSERT 직후 트리거가 GG0001 → gym_user_id resolve
-- --    → AFTER UPDATE 트리거가 user_gym_history row 생성
-- ============================================================

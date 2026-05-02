-- ============================================================
-- 체육관 코드 시스템 — 스키마 도입 (Phase 1 / 7)
--
-- ── 배경 ──
-- 지금까지 회원-체육관 연결은 `users.gym_name` (자유 텍스트) 매칭에 의존.
-- 같은 이름·비슷한 이름이 많아 sql/53, sql/57 같은 보정 패치가 계속 필요했음.
-- → 체육관마다 고유 코드를 발급해 회원이 코드로 가입·이동하도록 변경.
--
-- ── 식별자 분리 (Single Source of Truth) ──
--   - gym_user_id (uuid)  : 진짜 연결고리. 모든 join, RLS, 쿼리는 이걸로.
--   - gym_code (text)     : 사람이 입력하는 lookup key (가입·변경 시에만).
--   - gym_name (text)     : 표시용 캐시. 시스템 로직 분기 금지.
--
-- ── 코드 형식 ──
-- 6자: 2글자 지역 prefix + 4자리 0패딩 숫자.
-- 지역 매핑: 서울 SE / 경기 GG / 강원 GW / 충청 CC / 전라 JL / 경상 GS / 제주 JJ
-- 예: GG0001, SE0042, JJ9999 (지역당 9,999개 capacity)
--
-- ── 이번 파일에서 하는 일 ──
-- A) users 에 region, gym_code 컬럼 추가
-- B) 지역별 sequence 7개 생성
-- C) 코드 발급 함수 gen_gym_code(region)
-- D) role='gym' INSERT 시 자동 코드 발급 트리거
-- E) user_gym_history 테이블 신설 — 회원 체육관 이력 (이력서식)
-- F) user_gym_history 자동 기록 트리거 — 회원 가입·이동 시 자동 INSERT/마감
-- G) matches.gym_user_id_at_match 컬럼 추가 — 매치 시점의 체육관 스냅샷
-- H) matches INSERT 시 user_id 의 현재 gym_user_id 자동 스냅샷 트리거
-- I) gym_code 노출 RPC — 본인 + 그 체육관 회원 + admin 만 조회 가능
--
-- ── 절대 건드리지 않는 데이터 (안전 보장) ──
--   - 회원의 gym_user_id, gym_name 등 모든 기존 데이터 (그대로)
--   - 출석·매치·랭킹·스킬 진행도 (그대로)
--   - 승단 신청 (sql/57 트리거가 계속 동작 — 이번 파일은 거기 손 안 댐)
--   - sql/57 의 트리거·함수 (그대로 유지. Phase 7 에서나 검토)
--
-- ── 본 파일이 만드는 행 변경 ──
--   - users 에 region, gym_code 컬럼만 ADD (모든 기존 행 NULL 로 시작)
--   - matches 에 gym_user_id_at_match 컬럼만 ADD (기존 행 NULL — Phase 2 에서 백필)
--   - user_gym_history 테이블 신설 (빈 테이블)
--   - 기존 회원 이력 백필은 Phase 2 (sql/59) 에서 처리
--
-- ── 멱등성 / 안전 ──
--   - ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE
--   - DROP TRIGGER IF EXISTS 후 CREATE — 여러 번 실행해도 안전
--   - BEGIN/COMMIT 트랜잭션 — 중간 실패 시 자동 롤백
--   - RAISE NOTICE 로 변경 행 수 출력
--
-- ⚠️ Supabase SQL Editor 에서 실행. 실행 전 백업 스냅샷 권장.
--    이 파일 (sql/58) 을 적용한 뒤 → 결과 확인 → sql/59 (마이그레이션) 진행.
-- ============================================================

BEGIN;


-- ============================================================
-- A) users 테이블 — region, gym_code 컬럼 추가
-- ============================================================

-- 지역 코드 enum-like (TEXT + CHECK, 기존 role/gender 패턴 따름)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS region TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS gym_code TEXT;

-- region CHECK 제약 (재실행 안전)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'users_region_check'
       AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_region_check
      CHECK (region IS NULL OR region IN
        ('seoul','gyeonggi','gangwon','chungcheong','jeolla','gyeongsang','jeju'));
  END IF;
END $$;

-- gym_code UNIQUE (NULL 허용. 회원 행은 NULL, 체육관 행만 값 가짐)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'users_gym_code_key'
       AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_gym_code_key UNIQUE (gym_code);
  END IF;
END $$;

-- 코드 lookup 빠르게 (회원가입 시 코드 → gym_user_id 찾을 때)
CREATE INDEX IF NOT EXISTS idx_users_gym_code
  ON public.users (gym_code)
  WHERE gym_code IS NOT NULL;


-- ============================================================
-- B) 지역별 sequence 7개 — 순차 번호 발급용
--    동시에 두 체육관이 가입해도 sequence + UNIQUE 로 충돌 자동 방지
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.gym_seq_se START WITH 1 MINVALUE 1 MAXVALUE 9999;
CREATE SEQUENCE IF NOT EXISTS public.gym_seq_gg START WITH 1 MINVALUE 1 MAXVALUE 9999;
CREATE SEQUENCE IF NOT EXISTS public.gym_seq_gw START WITH 1 MINVALUE 1 MAXVALUE 9999;
CREATE SEQUENCE IF NOT EXISTS public.gym_seq_cc START WITH 1 MINVALUE 1 MAXVALUE 9999;
CREATE SEQUENCE IF NOT EXISTS public.gym_seq_jl START WITH 1 MINVALUE 1 MAXVALUE 9999;
CREATE SEQUENCE IF NOT EXISTS public.gym_seq_gs START WITH 1 MINVALUE 1 MAXVALUE 9999;
CREATE SEQUENCE IF NOT EXISTS public.gym_seq_jj START WITH 1 MINVALUE 1 MAXVALUE 9999;


-- ============================================================
-- C) 코드 발급 함수 — region 받아 다음 코드 반환
--    예: gen_gym_code('gyeonggi') → 'GG0001'
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
    WHEN 'seoul'       THEN _prefix := 'SE'; _seq := nextval('public.gym_seq_se');
    WHEN 'gyeonggi'    THEN _prefix := 'GG'; _seq := nextval('public.gym_seq_gg');
    WHEN 'gangwon'     THEN _prefix := 'GW'; _seq := nextval('public.gym_seq_gw');
    WHEN 'chungcheong' THEN _prefix := 'CC'; _seq := nextval('public.gym_seq_cc');
    WHEN 'jeolla'      THEN _prefix := 'JL'; _seq := nextval('public.gym_seq_jl');
    WHEN 'gyeongsang'  THEN _prefix := 'GS'; _seq := nextval('public.gym_seq_gs');
    WHEN 'jeju'        THEN _prefix := 'JJ'; _seq := nextval('public.gym_seq_jj');
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
-- D) 체육관(role='gym') INSERT 트리거 — region 있으면 코드 자동 발급
--    회원·admin 행은 건드리지 않음.
-- ============================================================
CREATE OR REPLACE FUNCTION public.users_gym_code_autoset()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 체육관 행만 처리
  IF NEW.role <> 'gym' THEN
    RETURN NEW;
  END IF;

  -- 이미 코드가 있으면 (마이그레이션·관리자 직접 부여) 건드리지 않음
  IF NEW.gym_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- region 이 없으면 코드 부여 보류 (관리자가 region 채워줄 때 발급)
  IF NEW.region IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.gym_code := public.gen_gym_code(NEW.region);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_gym_code_autoset ON public.users;

CREATE TRIGGER trg_users_gym_code_autoset
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_gym_code_autoset();


-- ============================================================
-- D') 체육관 region 사후 채움 시도 시에도 코드 발급 (UPDATE)
--      가입 당시 region 비어있던 체육관에 운영자가 region 을 채우면 코드 부여.
--      이미 코드가 있는 체육관은 region 을 바꿔도 코드는 변하지 않음 (불변 보장).
-- ============================================================
CREATE OR REPLACE FUNCTION public.users_gym_code_autoset_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role <> 'gym' THEN
    RETURN NEW;
  END IF;

  -- 이미 코드 있음 → 절대 변경하지 않음 (불변성)
  IF OLD.gym_code IS NOT NULL THEN
    NEW.gym_code := OLD.gym_code;
    RETURN NEW;
  END IF;

  -- 코드 없는데 region 새로 채워짐 → 발급
  IF NEW.region IS NOT NULL AND NEW.gym_code IS NULL THEN
    NEW.gym_code := public.gen_gym_code(NEW.region);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_gym_code_autoset_upd ON public.users;

CREATE TRIGGER trg_users_gym_code_autoset_upd
  BEFORE UPDATE OF region, gym_code ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_gym_code_autoset_on_update();


-- ============================================================
-- E) user_gym_history 테이블 — 회원 체육관 이력 (이력서식)
--    회원 1명이 N개의 row 를 가질 수 있음.
--    현재 소속은 left_at IS NULL 인 row.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_gym_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gym_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  gym_name     TEXT,
  gym_code     TEXT,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ugh_user_id
  ON public.user_gym_history (user_id);

-- 현재 소속만 빠르게 (left_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_ugh_user_current
  ON public.user_gym_history (user_id)
  WHERE left_at IS NULL;

-- 한 회원에게 "현재 소속" row 는 최대 1개여야 함
CREATE UNIQUE INDEX IF NOT EXISTS uq_ugh_one_current_per_user
  ON public.user_gym_history (user_id)
  WHERE left_at IS NULL;

-- RLS: 본인 + 소속 체육관 + admin 이 자기 이력 조회 가능
ALTER TABLE public.user_gym_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own gym history"          ON public.user_gym_history;
DROP POLICY IF EXISTS "Gym reads member gym history"        ON public.user_gym_history;
DROP POLICY IF EXISTS "Admin reads all gym history"         ON public.user_gym_history;

CREATE POLICY "Users read own gym history"
  ON public.user_gym_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Gym reads member gym history"
  ON public.user_gym_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users gym
       WHERE gym.id = auth.uid()
         AND gym.role = 'gym'
         AND gym.id = user_gym_history.gym_user_id
    )
  );

CREATE POLICY "Admin reads all gym history"
  ON public.user_gym_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users a
       WHERE a.id = auth.uid()
         AND a.role = 'admin'
    )
  );


-- ============================================================
-- F) user_gym_history 자동 기록 트리거
--    - 회원이 처음 가입하며 gym_user_id 가 채워짐 → row INSERT
--    - 회원의 gym_user_id 가 변경됨 → 옛 row left_at 채움 + 새 row INSERT
--    - 회원이 체육관 비움 (NULL) → 옛 row left_at 채움 (새 row 없음)
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_gym_history_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _gym_name TEXT;
  _gym_code TEXT;
BEGIN
  -- 회원(player) 만 추적. 체육관·admin 행은 추적 안 함.
  IF NEW.role NOT IN ('player_common', 'player_athlete') THEN
    RETURN NEW;
  END IF;

  -- INSERT 케이스 — 처음 가입하며 gym_user_id 가 채워졌을 때만
  IF TG_OP = 'INSERT' THEN
    IF NEW.gym_user_id IS NOT NULL THEN
      SELECT g.gym_name, g.gym_code INTO _gym_name, _gym_code
        FROM public.users g WHERE g.id = NEW.gym_user_id;
      INSERT INTO public.user_gym_history
        (user_id, gym_user_id, gym_name, gym_code, joined_at, left_at)
      VALUES
        (NEW.id, NEW.gym_user_id, _gym_name, _gym_code, NOW(), NULL);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE 케이스 — gym_user_id 가 실제로 변경되었을 때만
  IF NEW.gym_user_id IS NOT DISTINCT FROM OLD.gym_user_id THEN
    RETURN NEW;
  END IF;

  -- 옛 소속 row 닫기 (가장 최근 열린 row 의 left_at 채움)
  IF OLD.gym_user_id IS NOT NULL THEN
    UPDATE public.user_gym_history
       SET left_at = NOW()
     WHERE user_id = NEW.id
       AND gym_user_id = OLD.gym_user_id
       AND left_at IS NULL;
  END IF;

  -- 새 소속 row 열기 (NULL 로 바뀐 게 아니면)
  IF NEW.gym_user_id IS NOT NULL THEN
    SELECT g.gym_name, g.gym_code INTO _gym_name, _gym_code
      FROM public.users g WHERE g.id = NEW.gym_user_id;
    INSERT INTO public.user_gym_history
      (user_id, gym_user_id, gym_name, gym_code, joined_at, left_at)
    VALUES
      (NEW.id, NEW.gym_user_id, _gym_name, _gym_code, NOW(), NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_gym_history_ins ON public.users;
DROP TRIGGER IF EXISTS trg_user_gym_history_upd ON public.users;

CREATE TRIGGER trg_user_gym_history_ins
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.user_gym_history_record();

CREATE TRIGGER trg_user_gym_history_upd
  AFTER UPDATE OF gym_user_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.user_gym_history_record();


-- ============================================================
-- G) matches.gym_user_id_at_match — 매치 시점의 체육관 스냅샷
--    회원이 나중에 체육관을 옮겨도 매치 기록의 체육관은 변하지 않음.
--    기존 매치 행은 NULL 로 시작 → Phase 2 에서 백필.
-- ============================================================
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS gym_user_id_at_match UUID
    REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matches_gym_user_id_at_match
  ON public.matches (gym_user_id_at_match)
  WHERE gym_user_id_at_match IS NOT NULL;


-- ============================================================
-- H) matches INSERT 트리거 — user_id 의 현재 gym_user_id 자동 스냅샷
--    명시적으로 값을 넣어도 (테스트·마이그레이션) 그 값을 존중.
-- ============================================================
CREATE OR REPLACE FUNCTION public.matches_snapshot_gym()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.gym_user_id_at_match IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT u.gym_user_id INTO NEW.gym_user_id_at_match
      FROM public.users u WHERE u.id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matches_snapshot_gym ON public.matches;

CREATE TRIGGER trg_matches_snapshot_gym
  BEFORE INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.matches_snapshot_gym();


-- ============================================================
-- I) gym_code 노출 RPC — 본인이 자기 정보 조회 시에만 코드 반환
--    (외부 노출 방지. RLS 컬럼 단위 제한이 까다로워 RPC 로 우회.)
--
-- 호출 예 (클라이언트):
--   체육관 본인:  rpc('get_my_gym_code')        → 자기 코드
--   회원 본인:    rpc('get_my_current_gym_code') → 자기 소속 체육관 코드
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_gym_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _code TEXT;
BEGIN
  SELECT gym_code INTO _code
    FROM public.users
   WHERE id = auth.uid()
     AND role = 'gym';
  RETURN _code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_current_gym_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _code TEXT;
BEGIN
  SELECT g.gym_code INTO _code
    FROM public.users me
    JOIN public.users g ON g.id = me.gym_user_id
   WHERE me.id = auth.uid()
     AND me.role IN ('player_common', 'player_athlete')
     AND g.role = 'gym';
  RETURN _code;
END;
$$;

-- 코드 → 체육관 미리보기 (회원가입 폼에서 코드 입력 시 "✓ ○○체육관" 표시용)
-- 코드 자체는 안 노출. 체육관 이름과 존재 여부만 반환.
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
     AND g.gym_code = upper(btrim(p_code))
   LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_gym_code()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_current_gym_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_gym_by_code(TEXT)  TO authenticated, anon;


-- ============================================================
-- 사후 보고 — 이번 실행으로 생긴 객체 한눈에
-- ============================================================
DO $$
DECLARE
  _users_cols   INTEGER;
  _matches_cols INTEGER;
  _ugh_exists   BOOLEAN;
  _seq_count    INTEGER;
BEGIN
  SELECT count(*) INTO _users_cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='users'
     AND column_name IN ('region','gym_code');

  SELECT count(*) INTO _matches_cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='matches'
     AND column_name='gym_user_id_at_match';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='user_gym_history'
  ) INTO _ugh_exists;

  SELECT count(*) INTO _seq_count
    FROM pg_sequences
   WHERE schemaname='public' AND sequencename LIKE 'gym_seq_%';

  RAISE NOTICE '[sql/58] users 추가 컬럼: %/2', _users_cols;
  RAISE NOTICE '[sql/58] matches 추가 컬럼: %/1', _matches_cols;
  RAISE NOTICE '[sql/58] user_gym_history 테이블: %', _ugh_exists;
  RAISE NOTICE '[sql/58] 지역 sequence: %/7', _seq_count;
END $$;

COMMIT;


-- ============================================================
-- ── 사후 검증 (선택, 주석 해제 후 실행) ──
--
-- -- 1) 새 컬럼 정상 추가
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='users'
--    AND column_name IN ('region','gym_code');
--
-- -- 2) 지역 sequence 7개 모두 생성
-- SELECT sequencename, last_value FROM pg_sequences
--  WHERE schemaname='public' AND sequencename LIKE 'gym_seq_%'
--  ORDER BY sequencename;
--
-- -- 3) 트리거 부착 확인
-- SELECT trigger_name, event_manipulation, event_object_table
--   FROM information_schema.triggers
--  WHERE trigger_schema='public'
--    AND trigger_name IN (
--      'trg_users_gym_code_autoset',
--      'trg_users_gym_code_autoset_upd',
--      'trg_user_gym_history_ins',
--      'trg_user_gym_history_upd',
--      'trg_matches_snapshot_gym'
--    );
--
-- -- 4) RPC 함수 호출 가능 여부 (본인 로그인 상태에서)
-- -- SELECT public.get_my_gym_code();
-- -- SELECT public.get_my_current_gym_code();
-- -- SELECT * FROM public.lookup_gym_by_code('GG0001');
--
-- -- 5) 테스트 발급 (롤백할 거니 안전) — 실제 환경에선 실행 금지
-- -- BEGIN;
-- --   SELECT public.gen_gym_code('gyeonggi') AS code1,
-- --          public.gen_gym_code('gyeonggi') AS code2,
-- --          public.gen_gym_code('seoul')    AS code3;
-- -- ROLLBACK;
-- ============================================================

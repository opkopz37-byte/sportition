-- ============================================================
-- 닉네임 중복 확인 RPC
--
-- - 회원가입 / 프로필 편집에서 사용
-- - users 테이블 RLS 우회 (SECURITY DEFINER) — 본인 외 닉네임 존재 여부만 boolean 으로 반환
-- - 자기 자신은 제외 (프로필 편집 시 본인 닉네임 그대로 두면 사용 가능)
--
-- ⚠️ Supabase SQL Editor 에 실행
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_nickname_available(p_nickname TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _trim TEXT := NULLIF(BTRIM(p_nickname), '');
  _self UUID := auth.uid();
  _exists BOOLEAN;
BEGIN
  -- 빈 문자열 / NULL 은 사용 불가
  IF _trim IS NULL THEN
    RETURN FALSE;
  END IF;
  -- 길이 가드 (1~30자)
  IF char_length(_trim) < 1 OR char_length(_trim) > 30 THEN
    RETURN FALSE;
  END IF;

  -- 본인 외 같은 닉네임을 가진 사용자가 있는지 (대소문자/공백 무시)
  SELECT EXISTS (
    SELECT 1
      FROM public.users
     WHERE LOWER(BTRIM(nickname)) = LOWER(_trim)
       AND (_self IS NULL OR id <> _self)
  ) INTO _exists;

  RETURN NOT _exists;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_nickname_available(TEXT) TO authenticated, anon;

-- ── 인덱스 (선택) — 닉네임 검색 빠르게 ─────────────────
CREATE INDEX IF NOT EXISTS idx_users_nickname_lower
  ON public.users (LOWER(BTRIM(nickname)));

-- ── 확인 쿼리 ─────────────────────────────────────────
-- SELECT public.is_nickname_available('테스트닉');

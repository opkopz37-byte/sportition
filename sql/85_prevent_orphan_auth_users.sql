-- ============================================================
-- 고아 auth 계정 재발 방지 (2026-08-27)
--
-- 배경: 테이블 에디터에서 public.users 행만 삭제하면 auth.users 의
--   로그인 계정이 남아 "고아 계정"이 됨. 이 상태에서 같은 이메일로
--   재가입하면:
--     • 중복 확인 API(public.users 기준)는 "사용 가능" 이라고 답하지만
--     • 실제 가입(auth.users 기준)은 "이미 가입된 이메일" 로 거절됨.
--   → 가입이 조용히 실패한 것처럼 보이는 혼란 발생 (test1/test2 사건).
--   2026-08-27 에 고아 28개를 admin API 로 일괄 삭제했고,
--   이 스크립트는 같은 일이 다시 생기지 않게 하는 방지 장치.
--
-- 방지책 1 — 삭제 동기화 트리거:
--   public.users 행이 삭제되면 auth.users 의 같은 계정도 자동 삭제.
--   테이블 에디터에서 지워도 로그인 계정까지 함께 정리됨.
--   (반대 방향인 auth → public 은 이미 FK ON DELETE CASCADE 로 동작)
--
-- 방지책 2 — email_taken() RPC:
--   이메일 중복 확인이 auth.users 까지 함께 보도록 하는 함수.
--   app/api/check-email 이 이 함수를 호출하도록 코드도 함께 수정됨.
--
-- 멱등 — 여러 번 실행해도 안전.
-- ⚠️ Supabase SQL Editor 에 실행.
-- ============================================================

-- ── 방지책 1: public.users 삭제 시 auth.users 도 삭제 ──────────────
CREATE OR REPLACE FUNCTION public.delete_auth_user_on_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth 쪽 삭제가 원인(FK CASCADE)인 경우엔 이미 지워져 있어 0건 — 무해.
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_auth_user_on_profile_delete ON public.users;
CREATE TRIGGER trg_delete_auth_user_on_profile_delete
  AFTER DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_auth_user_on_profile_delete();

-- ── 방지책 2: 이메일 중복 확인용 RPC (auth.users + public.users 모두 확인) ──
CREATE OR REPLACE FUNCTION public.email_taken(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(btrim(check_email))
  ) OR EXISTS (
    SELECT 1 FROM public.users WHERE lower(email) = lower(btrim(check_email))
  );
$$;

-- 서버(service role) 전용 — 브라우저에서 직접 호출해 이메일을 캐내지 못하게 차단.
REVOKE ALL ON FUNCTION public.email_taken(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_taken(TEXT) TO service_role;

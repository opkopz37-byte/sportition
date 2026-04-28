-- ============================================================
-- 닉네임 유니크 제약 (race condition 방지)
--
-- 기존: is_nickname_available RPC 가 중복확인을 해주지만, 두 회원이 같은 시간에
--       동시 가입하면 race condition 으로 중복 발생 가능.
-- 추가: case-insensitive UNIQUE INDEX 로 DB-level 보장.
--
-- ⚠️ Supabase SQL Editor 에 실행. sql/45 적용된 환경.
-- ============================================================

-- 옛 인덱스 (sql/45 의 비-unique) 가 있으면 제거 후 재생성
DROP INDEX IF EXISTS public.idx_users_nickname_lower;

-- 케이스 무시 UNIQUE — 'Player' 와 'player' 가 같은 닉네임으로 취급
-- 빈 문자열 / NULL 은 인덱스에서 제외 (옛 데이터 보호)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_nickname_lower
  ON public.users (LOWER(BTRIM(nickname)))
 WHERE nickname IS NOT NULL AND BTRIM(nickname) <> '';

-- ── 점검 ──
-- 중복 닉네임이 이미 존재하는지 확인 (있으면 UNIQUE 생성 실패):
--   SELECT LOWER(BTRIM(nickname)) AS lower_nick, COUNT(*) AS cnt
--     FROM public.users
--    WHERE nickname IS NOT NULL AND BTRIM(nickname) <> ''
--    GROUP BY LOWER(BTRIM(nickname)) HAVING COUNT(*) > 1;
-- → 0 행이어야 정상. 결과 있으면 수동 정리 후 재실행.

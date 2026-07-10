-- ============================================================
-- 경기 이벤트 타임라인 — match_events 테이블
--
-- 복싱 경기 중 다운/파울 등 이벤트를 기록하는 신규 독립 테이블.
-- 기존 matches, statistics, users 테이블 구조 무변경.
--
-- 연결 구조:
--   match_id_blue → matches.id (청코너 선수의 match row)
--   match_id_red  → matches.id (홍코너 선수의 match row)
--   ON DELETE CASCADE — matches 삭제(초기화권, 컷오프 등) 시 자동 정리
--
-- ⚠️ Supabase SQL Editor 에 실행. 멱등 (CREATE TABLE IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.match_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id_blue UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  match_id_red  UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  round_number  INTEGER NOT NULL,
  elapsed_sec   INTEGER,           -- 라운드 시작부터 경과 초. 경기 후 추가된 기록은 NULL (시간 미상)
  event_type    TEXT NOT NULL,     -- 값 목록 하단 참고
  actor_corner  TEXT,              -- 'blue' | 'red' (다운시킨 / 파울한 코너)
  recv_corner   TEXT               -- 'blue' | 'red' (다운된 / 파울당한 코너)
);

-- event_type 허용 값:
--   다운 계열:  down | standing | knockdown
--   파울 계열:  foul_butting | foul_low_head | foul_elbow | foul_open |
--               foul_low_blow | foul_kidney | foul_pushing | foul_turning |
--               foul_passivity | foul_clinch
--   특수 종료:  rsc | abd | dsq | nc | td

CREATE INDEX IF NOT EXISTS idx_mev_blue ON public.match_events(match_id_blue);
CREATE INDEX IF NOT EXISTS idx_mev_red  ON public.match_events(match_id_red);

-- 재실행 보정: 구버전으로 이미 생성된 테이블의 NOT NULL 해제 (멱등)
ALTER TABLE public.match_events ALTER COLUMN elapsed_sec DROP NOT NULL;

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mev_insert" ON public.match_events;
DROP POLICY IF EXISTS "mev_select" ON public.match_events;
DROP POLICY IF EXISTS "mev_delete" ON public.match_events;

-- 삽입: 인증된 유저 (코치 앱에서 경기 종료 시 일괄 저장)
CREATE POLICY "mev_insert" ON public.match_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 삭제: 체육관/관리자만 — 결과 화면에서 기록 수정 시 덮어쓰기(삭제 후 재삽입)용
CREATE POLICY "mev_delete" ON public.match_events
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('gym', 'admin')
    )
  );

-- 조회: 공개 — 랭킹/상대 프로필/공개 전적에서 누구나 타임라인 열람.
--   전적 자체가 get_public_player_matches RPC 로 공개되는 것과 동일한 수준의 정보.
CREATE POLICY "mev_select" ON public.match_events
  FOR SELECT TO authenticated, anon
  USING (true);

-- ============================================================
-- 체육관(gym) / 관리자(admin): 매치룸에서 선수 간 경기 기록·통계 반영
-- 기존 정책과 OR로 동작합니다. Supabase SQL Editor에서 한 번 실행하세요.
-- ============================================================

-- matches: 전체 조회 (일일 집계·검증용)
DROP POLICY IF EXISTS "Staff can view all matches" ON public.matches;
CREATE POLICY "Staff can view all matches"
  ON public.matches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('gym', 'admin')
    )
  );

-- matches: user_id가 선수인 행을 체육관이 대신 insert
DROP POLICY IF EXISTS "Staff can insert matches for members" ON public.matches;
CREATE POLICY "Staff can insert matches for members"
  ON public.matches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('gym', 'admin')
    )
  );

-- statistics: 선수 통계 upsert 시 체육관이 타인 user_id 행 갱신
DROP POLICY IF EXISTS "Staff can view all statistics" ON public.statistics;
CREATE POLICY "Staff can view all statistics"
  ON public.statistics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('gym', 'admin')
    )
  );

DROP POLICY IF EXISTS "Staff can insert statistics for members" ON public.statistics;
CREATE POLICY "Staff can insert statistics for members"
  ON public.statistics FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('gym', 'admin')
    )
  );

DROP POLICY IF EXISTS "Staff can update statistics for members" ON public.statistics;
CREATE POLICY "Staff can update statistics for members"
  ON public.statistics FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('gym', 'admin')
    )
  );

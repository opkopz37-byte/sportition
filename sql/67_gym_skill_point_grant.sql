-- =============================================================
-- Migration 67: 체육관 스킬 포인트 지급
-- 체육관 담당자가 소속 회원에게 직접 스킬 포인트를 부여/차감할 수 있는
-- skill_point_logs 테이블과 gym_grant_skill_points RPC 추가
-- =============================================================

-- ── 1. 이력 테이블 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skill_point_logs (
  id            BIGSERIAL PRIMARY KEY,
  target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL CHECK (amount <> 0),
  balance_after INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 (회원별 이력 조회용)
CREATE INDEX IF NOT EXISTS skill_point_logs_target_idx
  ON public.skill_point_logs (target_user_id, created_at DESC);

-- RLS 설정 — 직접 쿼리는 service role 또는 admin만 읽을 수 있도록
ALTER TABLE public.skill_point_logs ENABLE ROW LEVEL SECURITY;

-- admin은 전체 조회, gym/admin은 자기 gym 회원만 조회
CREATE POLICY "admin_all_skill_logs" ON public.skill_point_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
  );

CREATE POLICY "gym_own_skill_logs" ON public.skill_point_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users caller
      JOIN public.users target ON target.id = skill_point_logs.target_user_id
      WHERE caller.id = auth.uid()
        AND caller.role = 'gym'
        AND (
          target.gym_user_id = caller.id
          OR (target.gym_user_id IS NULL AND target.gym_name = caller.gym_name)
        )
    )
  );

-- ── 2. RPC ───────────────────────────────────────────────────
-- gym_grant_skill_points(target_user_id, amount)
--   호출자: 인증된 gym 또는 admin
--   보안: 호출자가 해당 회원의 소속 체육관인지 검증
--   반환: { ok, skill_points, sp_added }
CREATE OR REPLACE FUNCTION public.gym_grant_skill_points(
  p_target_user_id UUID,
  p_amount         INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id   UUID  := auth.uid();
  _caller      RECORD;
  _target      RECORD;
  _new_sp      INTEGER;
BEGIN
  -- 1) amount 검증
  IF p_amount = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_cannot_be_zero');
  END IF;

  -- 2) 호출자 조회
  SELECT id, role, gym_name INTO _caller
  FROM public.users
  WHERE id = _caller_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'caller_not_found');
  END IF;

  IF _caller.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- 3) 대상 회원 조회
  SELECT id, role, gym_user_id, gym_name, skill_points INTO _target
  FROM public.users
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member_not_found');
  END IF;

  IF _target.role NOT IN ('player_common', 'player_athlete') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_not_player');
  END IF;

  -- 4) 권한 검증 (admin은 통과, gym은 소속 회원만)
  IF _caller.role = 'gym' THEN
    IF NOT (
      _target.gym_user_id = _caller_id
      OR (_target.gym_user_id IS NULL AND _target.gym_name = _caller.gym_name)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_same_gym');
    END IF;
  END IF;

  -- 5) skill_points 업데이트 (음수는 0 미만으로 내려가지 않도록 보호)
  UPDATE public.users
  SET
    skill_points = GREATEST(0, COALESCE(skill_points, 0) + p_amount),
    updated_at   = NOW()
  WHERE id = p_target_user_id
  RETURNING skill_points INTO _new_sp;

  -- 6) 이력 기록
  INSERT INTO public.skill_point_logs (target_user_id, granted_by, amount, balance_after)
  VALUES (p_target_user_id, _caller_id, p_amount, _new_sp);

  RETURN jsonb_build_object(
    'ok',           true,
    'skill_points', _new_sp,
    'sp_added',     p_amount
  );
END;
$$;

-- 인증된 사용자가 RPC 호출 가능하도록 EXECUTE 권한 부여
GRANT EXECUTE ON FUNCTION public.gym_grant_skill_points(UUID, INTEGER)
  TO authenticated;

-- ============================================================
-- 출석 / SP 적립 분리 + 마스터 SP 맥스 +1 시스템 롤백
--
-- 변경:
--   1) 출석체크 → 모달 표시 (SP 자동 지급 없음)
--   2) 모달에서 [스킬 포인트 적립] 클릭 시만 +1 SP
--   3) 심사 대기/진행 중에는 SP 적립 차단
--   4) 마스터는 5/5 고정 (sql/49 의 동적 max 롤백)
--
-- ⚠️ Supabase SQL Editor 에 실행. sql/49 적용 후.
-- ============================================================

-- ============================================================
-- 0) 데이터 정리
--    - 이전 동적 max 시스템으로 exp_level > 5 인 행이 있으면 5 로 캡
--    - skill_tree_nodes.point_cost <= 0 은 1 로 강제 (튜토리얼 잡 포함 모두 SP 차감)
-- ============================================================
UPDATE public.user_skill_node_progress
   SET exp_level = 5
 WHERE exp_level > 5;

-- 0 비용 노드는 SP 차감 없이 찍히는 버그 — 모든 노드 최소 1 SP 강제
UPDATE public.skill_tree_nodes
   SET point_cost = 1
 WHERE point_cost IS NULL OR point_cost < 1;

-- ============================================================
-- 1) exp_level CHECK 다시 0~5 로 잠금 (sql/49 의 0~10 롤백)
-- ============================================================
ALTER TABLE public.user_skill_node_progress
  DROP CONSTRAINT IF EXISTS user_skill_node_progress_exp_level_check;
ALTER TABLE public.user_skill_node_progress
  ADD CONSTRAINT user_skill_node_progress_exp_level_check
  CHECK (exp_level BETWEEN 0 AND 5);

-- ============================================================
-- 2) attendance.sp_claimed — 출석일에 SP 적립 했는지 플래그
-- ============================================================
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS sp_claimed BOOLEAN NOT NULL DEFAULT FALSE;

-- 기존 출석 기록은 이미 SP 받은 것으로 간주 (소급 지급 X)
UPDATE public.attendance SET sp_claimed = TRUE WHERE sp_claimed = FALSE;

-- ============================================================
-- 2-1) ⛔ 옛 트리거 제거 — sql/03 의 handle_attendance_recorded
--    이 트리거는 attendance INSERT 시 자동으로 SP +1 을 부여하고 있어서
--    새 분리 시스템 (record_daily_attendance + claim_daily_skill_point) 과 충돌:
--      · 자동 SP 지급 (모달 [적립] 안 눌러도 SP 들어감)
--      · statistics 이중 업데이트 (RPC 와 트리거 둘 다 +1)
--    → 트리거 자체를 DROP 하고 함수도 제거.
-- ============================================================
DROP TRIGGER IF EXISTS on_attendance_recorded_update_stats ON public.attendance;
DROP FUNCTION IF EXISTS public.handle_attendance_recorded() CASCADE;

-- ============================================================
-- 3) record_daily_attendance — SP 안 줌, 출석 기록만
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_daily_attendance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  _yesterday DATE := _today - INTERVAL '1 day';
  _already BOOLEAN;
  _y_attended BOOLEAN;
  _new_streak INTEGER;
  _new_total INTEGER;
  _sp_claimed BOOLEAN := FALSE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 1) 이미 오늘 출석했는지
  SELECT EXISTS (
    SELECT 1 FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _today
  ) INTO _already;

  IF _already THEN
    -- 멱등 — 같은 날 여러 번 호출해도 안전. sp_claimed 도 함께 반환.
    SELECT current_streak, total_attendance
      INTO _new_streak, _new_total
      FROM public.statistics WHERE user_id = _uid;
    SELECT sp_claimed INTO _sp_claimed
      FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _today;
    RETURN jsonb_build_object(
      'ok', true,
      'already_checked', true,
      'attendance_date', _today,
      'sp_claimed', COALESCE(_sp_claimed, FALSE),
      'current_streak', COALESCE(_new_streak, 0),
      'total_attendance', COALESCE(_new_total, 0)
    );
  END IF;

  -- 2) 어제 출석 여부 (streak 계산용)
  SELECT EXISTS (
    SELECT 1 FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _yesterday
  ) INTO _y_attended;

  -- 3) attendance INSERT — sp_claimed FALSE 로 시작 (별도 RPC 로 적립)
  INSERT INTO public.attendance (user_id, attendance_date, check_in_time, sp_claimed)
  VALUES (_uid, _today, NOW(), FALSE);

  -- 4) statistics 갱신 (없으면 생성)
  INSERT INTO public.statistics (
    user_id, total_attendance, current_streak, longest_streak,
    total_matches, wins, losses, draws, ko_wins, win_streak
  )
  VALUES (_uid, 1, 1, 1, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    total_attendance = COALESCE(public.statistics.total_attendance, 0) + 1,
    current_streak = CASE
      WHEN _y_attended THEN COALESCE(public.statistics.current_streak, 0) + 1
      ELSE 1
    END,
    longest_streak = GREATEST(
      COALESCE(public.statistics.longest_streak, 0),
      CASE
        WHEN _y_attended THEN COALESCE(public.statistics.current_streak, 0) + 1
        ELSE 1
      END
    );

  SELECT current_streak, total_attendance
    INTO _new_streak, _new_total
    FROM public.statistics WHERE user_id = _uid;

  RETURN jsonb_build_object(
    'ok', true,
    'already_checked', false,
    'attendance_date', _today,
    'sp_claimed', FALSE,
    'current_streak', COALESCE(_new_streak, 0),
    'total_attendance', COALESCE(_new_total, 0)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_daily_attendance() TO authenticated;


-- ============================================================
-- 4) claim_daily_skill_point — 모달 [스킬 포인트 적립] 버튼이 호출
--    - 오늘 출석이 있어야 함
--    - 오늘 sp_claimed = FALSE 여야 함
--    - 승단 심사 대기/진행 중이면 차단
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_daily_skill_point()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  _claimed BOOLEAN;
  _found BOOLEAN := FALSE;
  _new_sp INTEGER;
  _unfinished_count INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- ⛔ "처리 안 된 마스터 스킬" 이 1개라도 있으면 SP 적립 차단
  -- 처리 안 된 마스터 = exp_level >= 5 인 노드 중에서, 그 노드에 대해 'approved' 된
  -- promotion 기록이 없는 경우 (미신청 / pending / reviewing / rejected 모두 차단).
  SELECT COUNT(*) INTO _unfinished_count
    FROM public.user_skill_node_progress p
   WHERE p.user_id = _uid
     AND p.exp_level >= 5
     AND NOT EXISTS (
       SELECT 1 FROM public.skill_promotion_requests r
        WHERE r.user_id = p.user_id
          AND r.fork_node_id = p.node_id
          AND r.status = 'approved'
     );

  IF _unfinished_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'mastery_unresolved');
  END IF;

  -- 오늘 출석 행 조회 + lock (id 타입 환경에 의존하지 않게 user_id+date 조합으로 식별)
  SELECT sp_claimed INTO _claimed
    FROM public.attendance
   WHERE user_id = _uid AND attendance_date = _today
   FOR UPDATE;
  _found := FOUND;

  IF NOT _found THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_attendance');
  END IF;

  IF COALESCE(_claimed, FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  -- 적립
  UPDATE public.attendance
     SET sp_claimed = TRUE
   WHERE user_id = _uid AND attendance_date = _today;
  UPDATE public.users
     SET skill_points = COALESCE(skill_points, 0) + 1,
         updated_at = NOW()
   WHERE id = _uid
   RETURNING skill_points INTO _new_sp;

  RETURN jsonb_build_object(
    'ok', true,
    'skill_points', COALESCE(_new_sp, 0),
    'sp_added', 1
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_daily_skill_point() TO authenticated;


-- ============================================================
-- 5) add_skill_exp — 동적 max 롤백 (5 고정), self-heal 제거
-- ============================================================
DROP FUNCTION IF EXISTS public.add_skill_exp(INTEGER) CASCADE;

CREATE FUNCTION public.add_skill_exp(p_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _cost INTEGER;
  _parents INTEGER[];
  _parents_ok BOOLEAN := TRUE;
  _current INTEGER := 0;
  _new INTEGER;
  _sp INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT n.point_cost, n.parent_nodes
    INTO _cost, _parents
    FROM public.skill_tree_nodes AS n
   WHERE n.id = p_node_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 노드입니다.';
  END IF;

  -- ⛔ 최소 비용 1 SP — DB 가 NULL/0 으로 잘못 설정돼도 SP 차감 보장
  _cost := GREATEST(1, COALESCE(_cost, 1));

  -- ⛔ 승단 심사 대기/진행 중이면 모든 스킬 투자 차단
  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = _uid AND status IN ('pending', 'reviewing')
  ) THEN
    RAISE EXCEPTION '승단 심사 대기 중에는 다른 스킬을 찍을 수 없습니다.';
  END IF;

  -- 부모 검증 (있으면 1개 이상 exp_level >= 1)
  IF _parents IS NOT NULL AND array_length(_parents, 1) > 0 THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.skill_tree_nodes AS pn
        INNER JOIN public.user_skill_node_progress AS up
          ON up.node_id = pn.id
       WHERE up.user_id = _uid
         AND pn.node_number = ANY (_parents)
         AND up.exp_level >= 1
    ) INTO _parents_ok;
    IF NOT _parents_ok THEN
      RAISE EXCEPTION '선행 스킬을 먼저 1단계 이상 찍어야 합니다.';
    END IF;
  END IF;

  -- SP 잔액
  SELECT COALESCE(u.skill_points, 0) INTO _sp
    FROM public.users AS u
   WHERE u.id = _uid
   FOR UPDATE;
  _sp := COALESCE(_sp, 0);
  IF _sp < COALESCE(_cost, 1) THEN
    RAISE EXCEPTION 'SP가 부족합니다. (보유 %, 필요 %)', _sp, _cost;
  END IF;

  -- 현재 EXP
  SELECT COALESCE(usnp.exp_level, 0) INTO _current
    FROM public.user_skill_node_progress AS usnp
   WHERE usnp.user_id = _uid AND usnp.node_id = p_node_id
   FOR UPDATE;
  _current := COALESCE(_current, 0);

  -- 마스터는 5 고정
  IF _current >= 5 THEN
    RAISE EXCEPTION '이미 마스터한 스킬입니다.';
  END IF;

  _new := _current + 1;

  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (_uid, p_node_id, _new)
  ON CONFLICT (user_id, node_id)
  DO UPDATE SET exp_level = EXCLUDED.exp_level;

  IF _new = 5 THEN
    INSERT INTO public.user_skill_unlocks (user_id, node_id)
    VALUES (_uid, p_node_id)
    ON CONFLICT (user_id, node_id) DO NOTHING;
  END IF;

  UPDATE public.users
     SET skill_points = COALESCE(skill_points, 0) - COALESCE(_cost, 1)
   WHERE id = _uid;

  RETURN jsonb_build_object(
    'node_id',      p_node_id,
    'exp_level',    _new,
    'max_exp',      5,
    'sp_remaining', _sp - COALESCE(_cost, 1)
  );
END
$function$;
GRANT EXECUTE ON FUNCTION public.add_skill_exp(INTEGER) TO authenticated;


-- ============================================================
-- 6) submit_master_exam_request — 동적 max 롤백 (5 고정)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_master_exam_request(p_node_id INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _exp  INTEGER;
  _gym  TEXT;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.skill_tree_nodes WHERE id = p_node_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  SELECT COALESCE(exp_level, 0) INTO _exp
    FROM public.user_skill_node_progress
   WHERE user_id = _uid AND node_id = p_node_id;
  IF NOT FOUND OR COALESCE(_exp, 0) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_mastered');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = _uid AND fork_node_id = p_node_id AND status = 'approved'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_promoted');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests
     WHERE user_id = _uid AND fork_node_id = p_node_id AND status IN ('pending', 'reviewing')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_pending');
  END IF;

  SELECT gym_name INTO _gym FROM public.users WHERE id = _uid;
  IF _gym IS NULL OR btrim(_gym) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_gym');
  END IF;

  INSERT INTO public.skill_promotion_requests (user_id, fork_node_id, gym_name, status)
  VALUES (_uid, p_node_id, btrim(_gym), 'pending');

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_master_exam_request(INTEGER) TO authenticated;


-- ============================================================
-- 7) gym_resolve_master_exam — 거절 시 promotion_fail_count 증가 제거
--    (마스터 SP 맥스 +1 시스템 폐기)
-- ============================================================
CREATE OR REPLACE FUNCTION public.gym_resolve_master_exam(
  p_request_id UUID,
  p_approved   BOOLEAN,
  p_notes      TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _r   public.skill_promotion_requests%ROWTYPE;
  _g   public.users%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _g FROM public.users WHERE id = _uid;
  IF NOT FOUND OR _g.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO _r FROM public.skill_promotion_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF _g.role <> 'admin' AND (_g.gym_name IS DISTINCT FROM _r.gym_name) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_gym');
  END IF;

  IF _r.status NOT IN ('pending', 'reviewing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF p_approved THEN
    UPDATE public.skill_promotion_requests
       SET status = 'approved',
           resolved_at = NOW(),
           reviewer_id = _uid,
           notes = COALESCE(p_notes, notes)
     WHERE id = p_request_id;
  ELSE
    UPDATE public.skill_promotion_requests
       SET status = 'rejected',
           resolved_at = NOW(),
           reviewer_id = _uid,
           notes = p_notes
     WHERE id = p_request_id;
    -- 거절되어도 마스터 5 고정 — fail_count 증가 없음
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gym_resolve_master_exam(UUID, BOOLEAN, TEXT) TO authenticated;

-- ============================================================
-- 8) kiosk_check_attendance — KST 기준 + statistics 갱신 + sp_claimed=FALSE 명시
--    옛 함수는 CURRENT_DATE (서버 TZ) 사용 + statistics 미갱신 (트리거 의존).
--    트리거가 제거됐으므로 이 함수가 직접 statistics 도 처리.
-- ============================================================
CREATE OR REPLACE FUNCTION public.kiosk_check_attendance(
  target_user_id UUID,
  location_text TEXT DEFAULT NULL
)
RETURNS TABLE (
  attendance_id UUID,
  attendance_date DATE,
  check_in_time TIMESTAMPTZ,
  total_skill_points INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  _yesterday DATE := _today - INTERVAL '1 day';
  _y_attended BOOLEAN;
  existing_record public.attendance%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
     WHERE id = target_user_id
       AND role IN ('player_common', 'player_athlete')
  ) THEN
    RAISE EXCEPTION 'Attendance is only available for player accounts.';
  END IF;

  -- 이미 오늘 출석한 경우 → 멱등 반환
  SELECT * INTO existing_record
    FROM public.attendance
   WHERE user_id = target_user_id AND attendance_date = _today;

  IF FOUND THEN
    RETURN QUERY
    SELECT existing_record.id, existing_record.attendance_date,
           existing_record.check_in_time, COALESCE(u.skill_points, 0),
           '이미 출석 체크되었습니다.'
      FROM public.users u WHERE u.id = target_user_id;
    RETURN;
  END IF;

  -- 어제 출석 여부 (streak 계산용)
  SELECT EXISTS (
    SELECT 1 FROM public.attendance
     WHERE user_id = target_user_id AND attendance_date = _yesterday
  ) INTO _y_attended;

  -- INSERT 출석 — sp_claimed FALSE (회원이 모달에서 별도 적립)
  INSERT INTO public.attendance (user_id, location, attendance_date, sp_claimed)
  VALUES (target_user_id, location_text, _today, FALSE);

  -- statistics 갱신
  INSERT INTO public.statistics (
    user_id, total_attendance, current_streak, longest_streak,
    total_matches, wins, losses, draws, ko_wins, win_streak
  )
  VALUES (target_user_id, 1, 1, 1, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    total_attendance = COALESCE(public.statistics.total_attendance, 0) + 1,
    current_streak = CASE
      WHEN _y_attended THEN COALESCE(public.statistics.current_streak, 0) + 1
      ELSE 1
    END,
    longest_streak = GREATEST(
      COALESCE(public.statistics.longest_streak, 0),
      CASE
        WHEN _y_attended THEN COALESCE(public.statistics.current_streak, 0) + 1
        ELSE 1
      END
    );

  RETURN QUERY
  SELECT a.id, a.attendance_date, a.check_in_time,
         COALESCE(u.skill_points, 0),
         '출석 체크 완료!'
    FROM public.attendance a
    JOIN public.users u ON u.id = a.user_id
   WHERE a.user_id = target_user_id AND a.attendance_date = _today;
END;
$$;
GRANT EXECUTE ON FUNCTION public.kiosk_check_attendance(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.kiosk_check_attendance(UUID, TEXT) TO authenticated;

-- ============================================================
-- ── 테스트 ──
-- SELECT public.record_daily_attendance();
-- SELECT public.claim_daily_skill_point();
-- SELECT public.add_skill_exp(1);
-- SELECT * FROM public.kiosk_check_attendance('uuid'::uuid);
-- ============================================================

-- ============================================================
-- 9) 데이터 무결성 점검 쿼리 (수동 실행 권장)
-- ============================================================
-- 음수 SP 가 있는 회원 (있으면 안됨):
--   SELECT id, email, skill_points FROM users WHERE skill_points < 0;
--
-- exp_level > 5 인 행 (sql/50 0번 단계가 캡 했지만 재확인):
--   SELECT user_id, node_id, exp_level FROM user_skill_node_progress WHERE exp_level > 5;
--
-- point_cost = 0 인 노드 (있으면 안됨):
--   SELECT id, node_number, name, point_cost FROM skill_tree_nodes WHERE point_cost < 1;
--
-- promotion_fail_count > 0 인 행 (옛 시스템 잔재 — 무해하지만 정리 가능):
--   SELECT user_id, node_id, promotion_fail_count FROM user_skill_node_progress WHERE promotion_fail_count > 0;
--
-- 처리 안 된 마스터 스킬이 있는 회원 (SP 적립 잠금 상태):
--   SELECT u.email, p.node_id, n.name, p.exp_level
--     FROM user_skill_node_progress p
--     JOIN users u ON u.id = p.user_id
--     JOIN skill_tree_nodes n ON n.id = p.node_id
--    WHERE p.exp_level >= 5
--      AND NOT EXISTS (
--        SELECT 1 FROM skill_promotion_requests r
--         WHERE r.user_id = p.user_id AND r.fork_node_id = p.node_id AND r.status = 'approved'
--      );

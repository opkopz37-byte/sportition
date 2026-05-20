-- ============================================================
-- sql/70 — 출석 시 활성 스킬 EXP 자동 적립 + 차단 (D단계 핵심)
--
-- 변경:
--   1. record_daily_attendance 본문 교체:
--      • 활성 스킬 (해금됐고 exp_level<5) 없으면 → 출석 INSERT 안 함, 차단 응답
--      • 활성 있으면 → attendance INSERT (sp_claimed=true) + statistics + SP +1 + EXP +1
--   2. attendance_open_modal 본문 교체:
--      • 출석 처리는 record_daily_attendance 에 위임 (단일 진입점)
--      • pending 마스터 노드 정보만 추가 반환 (모달 노출용)
--
-- ── 베타 안전성 ──
-- 트리거 사용 절대 X (sql/68 이전 사고 교훈).
-- 함수 본문 교체만 (DDL 변경 없음).
-- 활성 스킬 없는 회원은 출석 차단됨 — 다음 마이그레이션(sql/72)에서 백필로 처리.
--
-- 적용 순서:
--   sql/69 → sql/70 → sql/71 → sql/72 모두 한 번에 (사용자 결정 동시 배포)
--
-- ⚠️ Supabase SQL Editor 에서 실행.
-- ============================================================

BEGIN;


-- ════════════════════════════════════════════════════════════
-- 1) record_daily_attendance — 활성 스킬 검증 + 자동 적립
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.record_daily_attendance()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  _yesterday DATE := _today - INTERVAL '1 day';
  _already BOOLEAN;
  _y_attended BOOLEAN;
  _new_streak INTEGER;
  _new_total INTEGER;
  _new_sp INTEGER;
  _active_node_id INTEGER;
  _active_node_name TEXT;
  _new_exp INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 1) 이미 오늘 출석 — 멱등 (같은 날 두 번 호출해도 안전)
  SELECT EXISTS (
    SELECT 1 FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _today
  ) INTO _already;

  IF _already THEN
    SELECT current_streak, total_attendance
      INTO _new_streak, _new_total
      FROM public.statistics WHERE user_id = _uid;
    SELECT COALESCE(skill_points, 0) INTO _new_sp
      FROM public.users WHERE id = _uid;
    RETURN jsonb_build_object(
      'ok', true,
      'already_checked', true,
      'attendance_date', _today,
      'current_streak', COALESCE(_new_streak, 0),
      'total_attendance', COALESCE(_new_total, 0),
      'skill_points', _new_sp
    );
  END IF;

  -- 2) 활성 스킬 찾기 (해금됐고 exp_level < 5)
  SELECT u.node_id, n.name
    INTO _active_node_id, _active_node_name
    FROM public.user_skill_unlocks u
    JOIN public.skill_tree_nodes n ON n.id = u.node_id
    LEFT JOIN public.user_skill_node_progress p
      ON p.user_id = u.user_id AND p.node_id = u.node_id
   WHERE u.user_id = _uid
     AND COALESCE(p.exp_level, 0) < 5
   ORDER BY u.unlocked_at DESC NULLS LAST
   LIMIT 1;

  -- 3) 활성 스킬 없으면 출석 자체 차단 (사용자 결정 8번)
  IF _active_node_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'no_active_skill',
      'message', '진행 중인 활성 스킬이 없습니다.' || E'\n' ||
                 '관장님께 다음 스킬 해금을 요청하거나, 마스터한 스킬의 승단 심사 신청을 진행해 주세요.'
    );
  END IF;

  -- 4) 어제 출석 여부 (streak 계산)
  SELECT EXISTS (
    SELECT 1 FROM public.attendance
     WHERE user_id = _uid AND attendance_date = _yesterday
  ) INTO _y_attended;

  -- 5) attendance INSERT (sp_claimed=true — 자동 적립)
  INSERT INTO public.attendance (user_id, attendance_date, check_in_time, sp_claimed)
  VALUES (_uid, _today, NOW(), TRUE);

  -- 6) statistics 갱신
  INSERT INTO public.statistics (
    user_id, total_attendance, current_streak, longest_streak,
    total_matches, wins, losses, draws, ko_wins, win_streak
  )
  VALUES (_uid, 1, 1, 1, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    total_attendance = COALESCE(public.statistics.total_attendance, 0) + 1,
    current_streak = CASE WHEN _y_attended
      THEN COALESCE(public.statistics.current_streak, 0) + 1 ELSE 1 END,
    longest_streak = GREATEST(
      COALESCE(public.statistics.longest_streak, 0),
      CASE WHEN _y_attended
        THEN COALESCE(public.statistics.current_streak, 0) + 1 ELSE 1 END
    );

  -- 7) SP +1 (역사적 누적 카운터 — 0 리셋 후 단순 누적)
  UPDATE public.users
     SET skill_points = COALESCE(skill_points, 0) + 1,
         updated_at = NOW()
   WHERE id = _uid
   RETURNING skill_points INTO _new_sp;

  -- 8) 활성 노드 EXP +1 (5 도달 시 자동 비활성화 — LEAST 로 cap)
  --    promotion_status 컬럼은 sql/33 에서 제거됨 — 명시 X
  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (_uid, _active_node_id, 1)
  ON CONFLICT (user_id, node_id) DO UPDATE SET
    exp_level = LEAST(5, COALESCE(public.user_skill_node_progress.exp_level, 0) + 1),
    updated_at = NOW()
  RETURNING exp_level INTO _new_exp;

  -- 9) 최신 통계
  SELECT current_streak, total_attendance
    INTO _new_streak, _new_total
    FROM public.statistics WHERE user_id = _uid;

  RETURN jsonb_build_object(
    'ok', true,
    'already_checked', false,
    'attendance_date', _today,
    'current_streak', COALESCE(_new_streak, 0),
    'total_attendance', COALESCE(_new_total, 0),
    'skill_points', COALESCE(_new_sp, 0),
    'active_node_id', _active_node_id,
    'active_node_name', _active_node_name,
    'new_exp_level', COALESCE(_new_exp, 0),
    'mastered_now', COALESCE(_new_exp, 0) >= 5,
    'sp_added', 1
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_daily_attendance() TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 2) attendance_open_modal — record_daily_attendance 위에 모달 정보 추가
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.attendance_open_modal()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _attendance_result jsonb;
  _target_node_id INTEGER;
  _target_status TEXT;
  _target_skill_name TEXT;
  _unfinished JSONB := NULL;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 출석 처리는 record_daily_attendance 에 위임 (단일 진입점)
  _attendance_result := public.record_daily_attendance();

  -- 출석 실패 (활성 스킬 없음 등) 시 그대로 반환
  IF NOT COALESCE((_attendance_result->>'ok')::boolean, false) THEN
    RETURN _attendance_result;
  END IF;

  -- pending/reviewing/rejected/unsubmitted 마스터 노드 정보 (모달 노출용)
  SELECT p.node_id, COALESCE(latest.status, 'unsubmitted'), n.name
    INTO _target_node_id, _target_status, _target_skill_name
    FROM public.user_skill_node_progress p
    JOIN public.skill_tree_nodes n ON n.id = p.node_id
    LEFT JOIN LATERAL (
      SELECT status FROM public.skill_promotion_requests r
       WHERE r.user_id = p.user_id AND r.fork_node_id = p.node_id
       ORDER BY r.requested_at DESC LIMIT 1
    ) latest ON TRUE
   WHERE p.user_id = _uid AND p.exp_level >= 5
     AND COALESCE(latest.status, 'unsubmitted') <> 'approved'
   ORDER BY CASE COALESCE(latest.status, 'unsubmitted')
              WHEN 'pending'   THEN 4
              WHEN 'reviewing' THEN 3
              WHEN 'rejected'  THEN 2
              ELSE 1 END DESC
   LIMIT 1;

  IF _target_node_id IS NOT NULL THEN
    _unfinished := jsonb_build_object(
      'node_id', _target_node_id,
      'status', _target_status,
      'skill_name', COALESCE(_target_skill_name, '마스터 스킬')
    );
  END IF;

  RETURN _attendance_result || jsonb_build_object('unfinished', _unfinished);
END;
$$;
GRANT EXECUTE ON FUNCTION public.attendance_open_modal() TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 3) 검증
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  _has_record BOOLEAN;
  _has_modal  BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_daily_attendance') INTO _has_record;
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'attendance_open_modal')   INTO _has_modal;

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/70] record_daily_attendance 존재: %', _has_record;
  RAISE NOTICE '[sql/70] attendance_open_modal 존재   : %', _has_modal;
  RAISE NOTICE '────────────────────────────────────────';

  IF _has_record AND _has_modal THEN
    RAISE NOTICE '[sql/70] ✅ 출석 자동 적립 로직 적용 완료';
  ELSE
    RAISE WARNING '[sql/70] 일부 함수 누락 — 확인 필요';
  END IF;
END $$;

COMMIT;


-- ============================================================
-- 롤백 (필요시): sql/52 의 두 함수 정의를 다시 적용
-- ============================================================

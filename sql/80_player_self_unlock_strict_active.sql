-- ============================================================
-- sql/80 — player_unlock_skill_node 의 '활성 스킬' 판정 강화
--
-- 기획 의도:
--   회원이 스킬 A 를 클릭(셀프 해금) 만 해놓고 출석 0회 → exp_level=0 상태에서
--   다른 스킬 B 를 또 해금할 수 있는 구멍이 있었음.
--   "하나 시작했으면 마스터(5/5)할 때까지 다른 거 못 시작" 룰을 엄격히 적용.
--
--   관장 스킵 RPC (sql/79 gym_skip_skill_node) 는 이미 COALESCE(exp_level,0) < 5 로
--   exp=0 도 활성으로 침. 셀프 해금만 exp_level > 0 AND exp_level < 5 로 느슨했음.
--   → 일관성 맞춤.
--
-- 변경:
--   • sql/74 의 5번 검증 (활성 스킬 차단) 조건만 변경
--     - 이전: p.exp_level > 0 AND p.exp_level < 5
--     - 신규: COALESCE(p.exp_level, 0) < 5  (해금됐는데 5/5 안 된 노드 있으면 차단)
--   • 그 외 검증 (부모 마스터, 승단 미승인 등) 변화 없음
--
-- 시그니처 동일 → CREATE OR REPLACE.
-- ⚠️ Supabase SQL Editor 에서 실행. sql/74 위에 덮어쓰기.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.player_unlock_skill_node(
  p_node_id INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid           UUID := auth.uid();
  _role          TEXT;
  _parent_nums   INTEGER[];
  _missing_parent INTEGER;
  _blocking_promo RECORD;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT role INTO _role FROM public.users WHERE id = _uid;
  IF _role IS NULL OR _role NOT IN ('player_common', 'player_athlete') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT parent_nodes INTO _parent_nums
    FROM public.skill_tree_nodes WHERE id = p_node_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_skill_unlocks
     WHERE user_id = _uid AND node_id = p_node_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_unlocked');
  END IF;

  -- ★ 활성 스킬 차단 — exp=0 포함 (해금만 하고 출석 0회 인 노드도 활성으로 침)
  IF EXISTS (
    SELECT 1
      FROM public.user_skill_unlocks u
      LEFT JOIN public.user_skill_node_progress p
        ON p.user_id = u.user_id AND p.node_id = u.node_id
     WHERE u.user_id = _uid
       AND u.node_id <> p_node_id
       AND COALESCE(p.exp_level, 0) < 5
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'active_skill_in_progress',
      'message', '진행 중인 스킬을 먼저 마스터해 주세요.'
    );
  END IF;

  SELECT u.node_id, COALESCE(r.status, 'unsubmitted') AS status
    INTO _blocking_promo
    FROM public.user_skill_unlocks u
    JOIN public.user_skill_node_progress p
      ON p.user_id = u.user_id AND p.node_id = u.node_id
    LEFT JOIN LATERAL (
      SELECT status
        FROM public.skill_promotion_requests sr
       WHERE sr.user_id = u.user_id AND sr.fork_node_id = u.node_id
       ORDER BY sr.requested_at DESC NULLS LAST
       LIMIT 1
    ) r ON TRUE
   WHERE u.user_id = _uid
     AND p.exp_level >= 5
     AND COALESCE(r.status, 'unsubmitted') <> 'approved'
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'promotion_required',
      'message', '마스터한 스킬의 승단 심사가 통과되기 전에는 새 스킬을 진행할 수 없습니다.'
    );
  END IF;

  IF _parent_nums IS NOT NULL AND array_length(_parent_nums, 1) > 0 THEN
    SELECT pn INTO _missing_parent
      FROM unnest(_parent_nums) AS pn
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.skill_tree_nodes parent_n
         JOIN public.user_skill_node_progress pp
           ON pp.node_id = parent_n.id
        WHERE parent_n.node_number = pn
          AND pp.user_id = _uid
          AND pp.exp_level >= 5
     )
     LIMIT 1;

    IF _missing_parent IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'parent_not_mastered',
        'message', '부모 스킬을 먼저 마스터해 주세요.',
        'missing_parent_number', _missing_parent
      );
    END IF;
  END IF;

  INSERT INTO public.user_skill_unlocks (user_id, node_id, unlocked_by, unlock_source)
  VALUES (_uid, p_node_id, _uid, 'self');

  INSERT INTO public.user_skill_node_progress (user_id, node_id, exp_level)
  VALUES (_uid, p_node_id, 0)
  ON CONFLICT (user_id, node_id) DO UPDATE
    SET exp_level = COALESCE(user_skill_node_progress.exp_level, 0);

  RETURN jsonb_build_object('ok', true, 'node_id', p_node_id, 'action', 'self_unlock');
END;
$$;

GRANT EXECUTE ON FUNCTION public.player_unlock_skill_node(INTEGER) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/80] ✅ player_unlock_skill_node 활성 스킬 판정 강화';
  RAISE NOTICE '  - exp=0 (해금만 한 상태) 도 활성으로 침';
  RAISE NOTICE '  - 관장 스킵 RPC 와 일관성 맞춤';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

COMMIT;

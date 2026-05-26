-- ============================================================
-- sql/74 — 회원 셀프 해금 RPC
--
-- 회원이 본인 스킬트리에서 다음 노드를 직접 클릭해서 해금하는 흐름.
-- (관장 주도 해금 — sql/69 의 gym_unlock_skill_node — 과 별개)
--
-- 검증:
--   • 인증된 회원 (player_common | player_athlete) 만
--   • 노드 존재
--   • 이미 해금 안 됨
--   • 진행 중 활성 스킬 없음 (0 < exp < 5 인 노드 없음)
--   • 5/5 마스터인데 승단 승인 안 받은 노드 없음 (pending/reviewing/rejected/unsubmitted)
--   • 부모 노드 모두 마스터 (parent_nodes 의 각 node_number 에 해당하는 노드가 exp >= 5)
--   • 부모 없는 루트 노드는 누구나 해금 가능 (신규 회원 첫 진입)
--
-- 처리: user_skill_unlocks (source='self') + user_skill_node_progress(exp=0)
--
-- 멱등 (CREATE OR REPLACE).
-- ⚠️ Supabase SQL Editor 에서 실행.
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
  -- ── 1) 인증 ──────────────────────────────────────────────
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- ── 2) 권한 ──────────────────────────────────────────────
  SELECT role INTO _role FROM public.users WHERE id = _uid;
  IF _role IS NULL OR _role NOT IN ('player_common', 'player_athlete') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- ── 3) 노드 존재 + 부모 정보 조회 ────────────────────────
  SELECT parent_nodes INTO _parent_nums
    FROM public.skill_tree_nodes WHERE id = p_node_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_node');
  END IF;

  -- ── 4) 중복 해금 차단 ────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM public.user_skill_unlocks
     WHERE user_id = _uid AND node_id = p_node_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_unlocked');
  END IF;

  -- ── 5) 진행 중 활성 스킬 차단 (0 < exp < 5) ──────────────
  IF EXISTS (
    SELECT 1
      FROM public.user_skill_unlocks u
      JOIN public.user_skill_node_progress p
        ON p.user_id = u.user_id AND p.node_id = u.node_id
     WHERE u.user_id = _uid
       AND p.exp_level > 0
       AND p.exp_level < 5
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'active_skill_in_progress',
      'message', '진행 중인 스킬을 먼저 마스터해 주세요.'
    );
  END IF;

  -- ── 6) 마스터(5/5) 했는데 승단 미승인 — 차단 ─────────────
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

  -- ── 7) 부모 노드 검증 ────────────────────────────────────
  -- 부모 없으면 루트 — 누구나 해금 가능
  IF _parent_nums IS NOT NULL AND array_length(_parent_nums, 1) > 0 THEN
    -- 부모 중 하나라도 "마스터 안 됨" 이면 차단
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

  -- ── 8) 해금 ──────────────────────────────────────────────
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


-- 검증
DO $$
BEGIN
  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE '[sql/74] ✅ player_unlock_skill_node 신설';
  RAISE NOTICE '  검증: 부모 마스터 + 활성 스킬 없음 + 승단 미승인 없음';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

COMMIT;

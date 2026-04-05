-- ============================================================
-- 체육관 계정(users.id)과 소속 회원 연동: gym_user_id
-- gym_name(표시) + gym_user_id(체육관 DB id)로 승인·회원관리 일치
-- Supabase SQL Editor에서 한 번 실행 (12_gym_members_rls.sql 이후 권장)
-- ============================================================

-- 1) 회원(선수) 행에 소속 체육관 계정 id
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS gym_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.gym_user_id IS '소속 체육관 계정 public.users.id (role=gym). gym_name과 함께 조회·RLS에 사용';

CREATE INDEX IF NOT EXISTS idx_users_gym_user_id ON public.users(gym_user_id)
  WHERE gym_user_id IS NOT NULL;

-- 2) 기존 데이터: 동일 gym_name인 체육관 계정으로 백필
UPDATE public.users m
SET gym_user_id = g.id
FROM public.users g
WHERE m.role IN ('player_common', 'player_athlete')
  AND m.gym_name IS NOT NULL
  AND btrim(m.gym_name) <> ''
  AND g.role = 'gym'
  AND g.gym_name IS NOT NULL
  AND btrim(g.gym_name) = btrim(m.gym_name)
  AND m.gym_user_id IS NULL;

-- 3) 승단 신청 행에 체육관 id (회원의 gym_user_id 또는 이름 매칭)
ALTER TABLE public.skill_promotion_requests
  ADD COLUMN IF NOT EXISTS gym_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_skill_promotion_gym_user ON public.skill_promotion_requests(gym_user_id);

UPDATE public.skill_promotion_requests r
SET gym_user_id = COALESCE(
  (SELECT u.gym_user_id FROM public.users u WHERE u.id = r.user_id),
  (SELECT g.id FROM public.users g WHERE g.role = 'gym' AND g.gym_name IS NOT NULL AND btrim(g.gym_name) = btrim(r.gym_name) LIMIT 1)
)
WHERE r.gym_user_id IS NULL;

-- 4) 승단 INSERT RPC: gym_user_id 저장
CREATE OR REPLACE FUNCTION public.submit_skill_promotion_request(fork_node_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  n public.skill_tree_nodes%ROWTYPE;
  prog public.user_skill_node_progress%ROWTYPE;
  req int;
  gname text;
  guid uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO n FROM public.skill_tree_nodes WHERE id = fork_node_id;
  IF NOT FOUND OR NOT COALESCE(n.is_fork, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_fork_node');
  END IF;

  SELECT * INTO prog FROM public.user_skill_node_progress WHERE user_id = uid AND node_id = n.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_progress');
  END IF;

  IF prog.promotion_status = 'passed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_passed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.skill_promotion_requests r
    WHERE r.user_id = uid AND r.fork_node_id = n.id AND r.status IN ('pending', 'reviewing')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_pending');
  END IF;

  req := public.required_investments_for_fork(COALESCE(prog.promotion_fail_count, 0));
  IF prog.promotion_fail_count < 5 THEN
    IF COALESCE(prog.investment_count, 0) < req THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_investment', 'required', req, 'current', COALESCE(prog.investment_count, 0));
    END IF;
  END IF;

  SELECT u.gym_name, u.gym_user_id INTO gname, guid FROM public.users u WHERE u.id = uid;
  IF gname IS NULL OR btrim(gname) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_gym_assigned');
  END IF;

  IF guid IS NULL THEN
    SELECT g.id INTO guid FROM public.users g
    WHERE g.role = 'gym' AND g.gym_name IS NOT NULL AND btrim(g.gym_name) = btrim(gname)
    LIMIT 1;
  END IF;

  INSERT INTO public.skill_promotion_requests (user_id, fork_node_id, gym_name, gym_user_id, status)
  VALUES (uid, n.id, btrim(gname), guid, 'pending');

  UPDATE public.user_skill_node_progress SET promotion_status = 'pending', updated_at = NOW()
  WHERE user_id = uid AND node_id = n.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_skill_promotion_request(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_skill_promotion_request(integer) TO authenticated;

-- 5) 체육관 심사 RPC: gym_user_id 우선 매칭
CREATE OR REPLACE FUNCTION public.gym_start_promotion_review(request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.skill_promotion_requests%ROWTYPE;
  gu public.users%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  SELECT * INTO gu FROM public.users WHERE id = uid;
  IF NOT FOUND OR gu.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO r FROM public.skill_promotion_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF gu.role <> 'admin' THEN
    IF r.gym_user_id IS NOT NULL THEN
      IF r.gym_user_id IS DISTINCT FROM gu.id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'wrong_gym');
      END IF;
    ELSE
      IF gu.gym_name IS DISTINCT FROM r.gym_name THEN
        RETURN jsonb_build_object('ok', false, 'error', 'wrong_gym');
      END IF;
    END IF;
  END IF;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  UPDATE public.skill_promotion_requests
  SET status = 'reviewing', review_started_at = NOW(), reviewer_id = uid
  WHERE id = request_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gym_start_promotion_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gym_start_promotion_review(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.gym_resolve_promotion_request(request_id uuid, approved boolean, chosen_child_node_id integer, p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.skill_promotion_requests%ROWTYPE;
  gu public.users%ROWTYPE;
  fn public.skill_tree_nodes%ROWTYPE;
  ch public.skill_tree_nodes%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  SELECT * INTO gu FROM public.users WHERE id = uid;
  IF NOT FOUND OR gu.role NOT IN ('gym', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO r FROM public.skill_promotion_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF gu.role <> 'admin' THEN
    IF r.gym_user_id IS NOT NULL THEN
      IF r.gym_user_id IS DISTINCT FROM gu.id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'wrong_gym');
      END IF;
    ELSE
      IF gu.gym_name IS DISTINCT FROM r.gym_name THEN
        RETURN jsonb_build_object('ok', false, 'error', 'wrong_gym');
      END IF;
    END IF;
  END IF;
  IF r.status NOT IN ('pending', 'reviewing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT * INTO fn FROM public.skill_tree_nodes WHERE id = r.fork_node_id;

  IF approved THEN
    IF chosen_child_node_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'branch_required');
    END IF;
    SELECT * INTO ch FROM public.skill_tree_nodes WHERE id = chosen_child_node_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_branch');
    END IF;
    IF fn.fork_branch_node_numbers IS NULL OR NOT (ch.node_number = ANY(fn.fork_branch_node_numbers)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'branch_not_in_fork');
    END IF;

    INSERT INTO public.user_skill_unlocks (user_id, node_id) VALUES (r.user_id, ch.id)
    ON CONFLICT DO NOTHING;

    UPDATE public.user_skill_node_progress SET
      promotion_status = 'passed',
      chosen_branch_node_number = ch.node_number,
      updated_at = NOW()
    WHERE user_id = r.user_id AND node_id = fn.id;

    UPDATE public.skill_promotion_requests SET
      status = 'approved',
      resolved_at = NOW(),
      reviewer_id = uid,
      chosen_child_node_id = ch.id,
      notes = COALESCE(p_notes, notes)
    WHERE id = request_id;
  ELSE
    UPDATE public.user_skill_node_progress SET
      promotion_fail_count = LEAST(5, COALESCE(promotion_fail_count, 0) + 1),
      promotion_status = 'none',
      updated_at = NOW()
    WHERE user_id = r.user_id AND node_id = r.fork_node_id;

    UPDATE public.skill_promotion_requests SET
      status = 'rejected',
      resolved_at = NOW(),
      reviewer_id = uid,
      notes = p_notes
    WHERE id = request_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gym_resolve_promotion_request(uuid, boolean, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gym_resolve_promotion_request(uuid, boolean, integer, text) TO authenticated;

-- 6) RLS: 체육관 조회 — EXISTS(users) 금지(무한 재귀). SECURITY DEFINER 함수 사용.
CREATE OR REPLACE FUNCTION public.gym_can_view_member(member_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  viewer uuid := auth.uid();
  vrole text;
  vgname text;
  mrole text;
  mgname text;
  mg_user uuid;
BEGIN
  IF viewer IS NULL OR member_uuid IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, gym_name INTO vrole, vgname
  FROM public.users WHERE id = viewer;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF vrole = 'admin' THEN
    RETURN true;
  END IF;

  IF vrole <> 'gym' THEN
    RETURN false;
  END IF;

  IF vgname IS NULL OR btrim(vgname) = '' THEN
    RETURN false;
  END IF;

  SELECT role, gym_name, gym_user_id INTO mrole, mgname, mg_user
  FROM public.users WHERE id = member_uuid;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF mrole NOT IN ('player_common', 'player_athlete') THEN
    RETURN false;
  END IF;

  IF mg_user IS NOT NULL AND mg_user = viewer THEN
    RETURN true;
  END IF;

  IF mg_user IS NULL AND mgname IS NOT DISTINCT FROM vgname THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.gym_can_read_promotion_row(
  p_gym_user_id uuid,
  p_gym_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  viewer uuid := auth.uid();
  vrole text;
  vgname text;
BEGIN
  IF viewer IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, gym_name INTO vrole, vgname
  FROM public.users WHERE id = viewer;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF vrole = 'admin' THEN
    RETURN true;
  END IF;

  IF vrole <> 'gym' THEN
    RETURN false;
  END IF;

  IF p_gym_user_id IS NOT NULL AND p_gym_user_id = viewer THEN
    RETURN true;
  END IF;

  IF vgname IS NOT NULL AND btrim(vgname) <> '' AND p_gym_name IS NOT NULL
     AND btrim(p_gym_name) = btrim(vgname) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.gym_can_view_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gym_can_view_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.gym_can_read_promotion_row(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gym_can_read_promotion_row(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Gym reads gym promotion requests" ON public.skill_promotion_requests;
CREATE POLICY "Gym reads gym promotion requests"
  ON public.skill_promotion_requests FOR SELECT TO authenticated
  USING (
    public.gym_can_read_promotion_row(
      skill_promotion_requests.gym_user_id,
      skill_promotion_requests.gym_name
    )
  );

DROP POLICY IF EXISTS "Gym staff can view same-gym players" ON public.users;
CREATE POLICY "Gym staff can view same-gym players"
  ON public.users FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.gym_can_view_member(id)
  );

DROP POLICY IF EXISTS "Gym staff can view same-gym member private profiles" ON public.user_private_profiles;
CREATE POLICY "Gym staff can view same-gym member private profiles"
  ON public.user_private_profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.gym_can_view_member(user_id)
  );

-- 7) 승인 대기 뷰: 신청자 소속 체육관 id·이름 (관장 화면 필터용)
DROP VIEW IF EXISTS public.approval_queue_detailed;
CREATE OR REPLACE VIEW public.approval_queue_detailed
WITH (security_invoker = true)
AS
SELECT
  saq.id,
  saq.user_id,
  saq.card_id,
  saq.node_id,
  saq.status,
  saq.requested_at,
  saq.approved_by,
  saq.approved_at,
  saq.rejection_reason,
  saq.notes,
  u.nickname AS user_nickname,
  u.name AS user_name,
  u.gym_name AS applicant_gym_name,
  u.gym_user_id AS applicant_gym_user_id,
  sc.name AS card_name,
  sc.rarity,
  stn.name AS node_name
FROM public.skill_approval_queue saq
JOIN public.users u ON saq.user_id = u.id
JOIN public.skill_cards sc ON saq.card_id = sc.id
LEFT JOIN public.skill_tree_nodes stn ON saq.node_id = stn.id
ORDER BY saq.requested_at DESC;

GRANT SELECT ON public.approval_queue_detailed TO authenticated;
REVOKE ALL ON public.approval_queue_detailed FROM anon;

-- 8) 신규 가입 트리거: raw_user_meta_data.gym_user_id → users.gym_user_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_name TEXT;
BEGIN
  user_role := CASE COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'player_common')
    WHEN 'athlete' THEN 'player_common'
    WHEN 'coach' THEN 'player_athlete'
    WHEN 'player_common' THEN 'player_common'
    WHEN 'player_athlete' THEN 'player_athlete'
    WHEN 'gym' THEN 'gym'
    WHEN 'admin' THEN 'admin'
    ELSE 'player_common'
  END;
  user_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'nickname', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    '사용자'
  );

  INSERT INTO public.users (
    id,
    email,
    name,
    nickname,
    gender,
    role,
    membership_type,
    height,
    weight,
    boxing_style,
    gym_name,
    gym_location,
    gym_user_id,
    tier,
    tier_points,
    skill_points
  ) VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_name,
    CASE
      WHEN NULLIF(NEW.raw_user_meta_data->>'gender', '') IN ('male', 'female')
        THEN NEW.raw_user_meta_data->>'gender'
      ELSE NULL
    END,
    user_role,
    CASE
      WHEN user_role IN ('player_common', 'player_athlete') THEN
        CASE COALESCE(NULLIF(NEW.raw_user_meta_data->>'membership_type', ''), 'basic')
          WHEN 'basic' THEN 'basic'
          WHEN 'standard' THEN 'standard'
          WHEN 'premium' THEN 'premium'
          ELSE 'basic'
        END
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'height', '') ~ '^[0-9]+$'
      THEN (NEW.raw_user_meta_data->>'height')::INTEGER
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'weight', '') ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN (NEW.raw_user_meta_data->>'weight')::NUMERIC(5,1)
      ELSE NULL
    END,
    NULLIF(NEW.raw_user_meta_data->>'boxing_style', ''),
    NULLIF(NEW.raw_user_meta_data->>'gym_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'gym_location', ''),
    CASE
      WHEN NULLIF(NEW.raw_user_meta_data->>'gym_user_id', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN (NEW.raw_user_meta_data->>'gym_user_id')::uuid
      ELSE NULL
    END,
    CASE WHEN user_role IN ('player_common', 'player_athlete') THEN 'Bronze III' ELSE NULL END,
    CASE WHEN user_role IN ('player_common', 'player_athlete') THEN 0 ELSE NULL END,
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    nickname = EXCLUDED.nickname,
    gender = EXCLUDED.gender,
    role = EXCLUDED.role,
    membership_type = EXCLUDED.membership_type,
    height = EXCLUDED.height,
    weight = EXCLUDED.weight,
    boxing_style = EXCLUDED.boxing_style,
    gym_name = EXCLUDED.gym_name,
    gym_location = EXCLUDED.gym_location,
    gym_user_id = EXCLUDED.gym_user_id;

  INSERT INTO public.user_private_profiles (
    user_id,
    phone,
    birth_date,
    representative_phone
  ) VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'birth_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN (NEW.raw_user_meta_data->>'birth_date')::DATE
      ELSE NULL
    END,
    NULLIF(NEW.raw_user_meta_data->>'representative_phone', '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, public.user_private_profiles.phone),
    birth_date = COALESCE(EXCLUDED.birth_date, public.user_private_profiles.birth_date),
    representative_phone = COALESCE(EXCLUDED.representative_phone, public.user_private_profiles.representative_phone);

  RETURN NEW;
END;
$$;

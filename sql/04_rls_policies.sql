-- ============================================================
-- SPORTITION MVP3 RLS
-- Base tables are private by default.
-- Public player discovery should go through views or RPC only.
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id);

ALTER TABLE public.user_private_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own private profile" ON public.user_private_profiles;
DROP POLICY IF EXISTS "Users can insert own private profile" ON public.user_private_profiles;
DROP POLICY IF EXISTS "Users can update own private profile" ON public.user_private_profiles;
CREATE POLICY "Users can view own private profile"
  ON public.user_private_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own private profile"
  ON public.user_private_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own private profile"
  ON public.user_private_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;
CREATE POLICY "Users can view own attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.statistics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view all statistics" ON public.statistics;
DROP POLICY IF EXISTS "Users can view own statistics" ON public.statistics;
DROP POLICY IF EXISTS "Users can insert own statistics" ON public.statistics;
DROP POLICY IF EXISTS "Users can update own statistics" ON public.statistics;
CREATE POLICY "Users can view own statistics"
  ON public.statistics FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own statistics"
  ON public.statistics FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own statistics"
  ON public.statistics FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.tier_rankings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view tier rankings" ON public.tier_rankings;
DROP POLICY IF EXISTS "Users can insert own ranking" ON public.tier_rankings;
DROP POLICY IF EXISTS "Users can update own ranking" ON public.tier_rankings;
CREATE POLICY "Anyone can view tier rankings"
  ON public.tier_rankings FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Users can insert own ranking"
  ON public.tier_rankings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ranking"
  ON public.tier_rankings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own skills" ON public.skills;
DROP POLICY IF EXISTS "Users can insert own skills" ON public.skills;
DROP POLICY IF EXISTS "Staff can view all skills" ON public.skills;
DROP POLICY IF EXISTS "Staff can update skills" ON public.skills;
CREATE POLICY "Users can view own skills"
  ON public.skills FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own skills"
  ON public.skills FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can view all skills"
  ON public.skills FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('gym', 'admin')
    )
  );
CREATE POLICY "Staff can update skills"
  ON public.skills FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('gym', 'admin')
    )
  );

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;
DROP POLICY IF EXISTS "Users can insert own matches" ON public.matches;
DROP POLICY IF EXISTS "Users can update own matches" ON public.matches;
DROP POLICY IF EXISTS "Users can delete own matches" ON public.matches;
CREATE POLICY "Users can view own matches"
  ON public.matches FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own matches"
  ON public.matches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own matches"
  ON public.matches FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own matches"
  ON public.matches FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own workouts" ON public.workouts;
CREATE POLICY "Users can manage own workouts"
  ON public.workouts FOR ALL TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own workout exercises" ON public.workout_exercises;
CREATE POLICY "Users can manage own workout exercises"
  ON public.workout_exercises FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workouts w
      WHERE w.id = workout_exercises.workout_id
        AND w.user_id = auth.uid()
    )
  );

ALTER TABLE public.skill_masters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view skill masters" ON public.skill_masters;
CREATE POLICY "Anyone can view skill masters"
  ON public.skill_masters FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.skill_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view skill cards" ON public.skill_cards;
CREATE POLICY "Anyone can view skill cards"
  ON public.skill_cards FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.skill_tree_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view skill tree nodes" ON public.skill_tree_nodes;
CREATE POLICY "Anyone can view skill tree nodes"
  ON public.skill_tree_nodes FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own inventory" ON public.user_inventory;
DROP POLICY IF EXISTS "Users can insert own inventory" ON public.user_inventory;
DROP POLICY IF EXISTS "Users can update own inventory" ON public.user_inventory;
CREATE POLICY "Users can view own inventory"
  ON public.user_inventory FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inventory"
  ON public.user_inventory FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inventory"
  ON public.user_inventory FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own cards" ON public.user_cards;
CREATE POLICY "Users can manage own cards"
  ON public.user_cards FOR ALL TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.user_card_fragments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own fragments" ON public.user_card_fragments;
CREATE POLICY "Users can manage own fragments"
  ON public.user_card_fragments FOR ALL TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.gacha_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own gacha history" ON public.gacha_history;
DROP POLICY IF EXISTS "Users can insert own gacha history" ON public.gacha_history;
CREATE POLICY "Users can view own gacha history"
  ON public.gacha_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gacha history"
  ON public.gacha_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.skill_approval_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own approval requests" ON public.skill_approval_queue;
DROP POLICY IF EXISTS "Staff can view all approval requests" ON public.skill_approval_queue;
DROP POLICY IF EXISTS "Users can create approval requests" ON public.skill_approval_queue;
DROP POLICY IF EXISTS "Staff can update approval status" ON public.skill_approval_queue;
CREATE POLICY "Users can view own approval requests"
  ON public.skill_approval_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Staff can view all approval requests"
  ON public.skill_approval_queue FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('gym', 'admin')
    )
  );
CREATE POLICY "Users can create approval requests"
  ON public.skill_approval_queue FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can update approval status"
  ON public.skill_approval_queue FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('gym', 'admin')
    )
  );

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view collections" ON public.collections;
CREATE POLICY "Anyone can view collections"
  ON public.collections FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.user_collection_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own collection progress" ON public.user_collection_progress;
CREATE POLICY "Users can manage own collection progress"
  ON public.user_collection_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id);

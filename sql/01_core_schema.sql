-- ============================================================
-- SPORTITION MVP3 CORE SCHEMA
-- Public identity, private profile, activity, stats, and legacy tables.
-- ============================================================

CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT,
  nickname        TEXT,
  gender          TEXT,
  role            TEXT NOT NULL DEFAULT 'player_common',
  membership_type TEXT,
  height          INTEGER,
  weight          NUMERIC(5,1),
  boxing_style    TEXT,
  gym_name        TEXT,
  gym_location    TEXT,
  gym_user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  skill_points    INTEGER NOT NULL DEFAULT 0,
  tier            TEXT DEFAULT 'Bronze III',
  tier_points     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_gender_check CHECK (gender IN ('male', 'female')),
  CONSTRAINT users_role_check CHECK (role IN ('player_common', 'player_athlete', 'gym', 'admin')),
  CONSTRAINT users_membership_type_check CHECK (membership_type IN ('basic', 'standard', 'premium'))
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_skill_points ON public.users(skill_points DESC);
CREATE INDEX idx_users_tier_points ON public.users(tier_points DESC);

CREATE TABLE public.user_private_profiles (
  user_id               UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  phone                 TEXT,
  birth_date            DATE,
  representative_phone  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_private_profiles_phone ON public.user_private_profiles(phone);

CREATE TABLE public.attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  check_in_time   TIMESTAMPTZ DEFAULT NOW(),
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, attendance_date)
);

CREATE INDEX idx_attendance_user ON public.attendance(user_id);
CREATE INDEX idx_attendance_date ON public.attendance(attendance_date DESC);

CREATE TABLE public.statistics (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  total_matches      INTEGER DEFAULT 0,
  wins               INTEGER DEFAULT 0,
  losses             INTEGER DEFAULT 0,
  draws              INTEGER DEFAULT 0,
  ko_wins            INTEGER DEFAULT 0,
  win_streak         INTEGER DEFAULT 0,
  current_win_streak INTEGER GENERATED ALWAYS AS (win_streak) STORED,
  total_attendance   INTEGER DEFAULT 0,
  current_streak     INTEGER DEFAULT 0,
  longest_streak     INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_statistics_user ON public.statistics(user_id);

CREATE TABLE public.tier_rankings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  rank          INTEGER,
  previous_rank INTEGER,
  rank_change   INTEGER DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tier_rankings_rank ON public.tier_rankings(rank ASC NULLS LAST);

CREATE TABLE public.skills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  skill_name   TEXT NOT NULL,
  skill_type   TEXT,
  tier         TEXT,
  description  TEXT,
  status       TEXT DEFAULT 'pending',
  approved_at  TIMESTAMPTZ,
  approved_by  UUID REFERENCES public.users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT skills_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX idx_skills_user ON public.skills(user_id);
CREATE INDEX idx_skills_status ON public.skills(status);

CREATE TABLE public.matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  opponent_name TEXT,
  result        TEXT,
  round         INTEGER,
  event_name    TEXT,
  location      TEXT,
  weight_class  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT matches_result_check CHECK (result IN ('win', 'loss', 'draw', 'ko_win', 'ko_loss', 'nc'))
);

CREATE INDEX idx_matches_user ON public.matches(user_id);
CREATE INDEX idx_matches_date ON public.matches(match_date DESC);

CREATE TABLE public.workouts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workout_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  workout_type     TEXT,
  duration_minutes INTEGER,
  intensity        TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT workouts_intensity_check CHECK (intensity IN ('low', 'medium', 'high'))
);

CREATE INDEX idx_workouts_user ON public.workouts(user_id);
CREATE INDEX idx_workouts_date ON public.workouts(workout_date DESC);

CREATE TABLE public.workout_exercises (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id       UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise_name    TEXT NOT NULL,
  sets             INTEGER,
  reps             INTEGER,
  duration_seconds INTEGER,
  weight           NUMERIC(5,1),
  notes            TEXT,
  sort_order       INTEGER DEFAULT 0
);

CREATE INDEX idx_workout_exercises_workout ON public.workout_exercises(workout_id);

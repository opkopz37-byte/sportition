-- ============================================================
-- SPORTITION MVP3 GAME SCHEMA
-- Gacha, cards, collections, and approval system.
-- ============================================================

CREATE TABLE public.skill_masters (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  name_en            TEXT,
  nickname           TEXT,
  description        TEXT,
  animal_motif       TEXT,
  style_type         TEXT,
  legendary_skill_id UUID,
  image_url          TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT skill_masters_style_type_check CHECK (style_type IN ('infighter', 'outboxer'))
);

CREATE INDEX idx_masters_style ON public.skill_masters(style_type);

CREATE TABLE public.skill_cards (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id             UUID REFERENCES public.skill_masters(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  name_en               TEXT,
  description           TEXT,
  description_en        TEXT,
  rarity                TEXT NOT NULL,
  card_type             TEXT,
  max_level             INTEGER DEFAULT 5,
  base_effect_value     NUMERIC,
  fragments_for_upgrade INTEGER DEFAULT 5,
  image_url             TEXT,
  silhouette_style      TEXT,
  glow_color            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT skill_cards_rarity_check CHECK (rarity IN ('normal', 'rare', 'epic', 'legendary')),
  CONSTRAINT skill_cards_card_type_check CHECK (card_type IN ('infighter', 'outboxer', 'neutral'))
);

CREATE INDEX idx_cards_rarity ON public.skill_cards(rarity);
CREATE INDEX idx_cards_master ON public.skill_cards(master_id);
CREATE INDEX idx_cards_type ON public.skill_cards(card_type);

CREATE TABLE public.skill_tree_nodes (
  id             SERIAL PRIMARY KEY,
  node_number    INTEGER UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  name_en        TEXT,
  zone           TEXT,
  position_x     NUMERIC NOT NULL,
  position_y     NUMERIC NOT NULL,
  node_type      TEXT,
  required_cards INTEGER DEFAULT 1,
  parent_nodes   INTEGER[],
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT skill_tree_nodes_zone_check CHECK (zone IN ('tutorial', 'infighter', 'outboxer', 'legendary')),
  CONSTRAINT skill_tree_nodes_type_check CHECK (node_type IN ('basic', 'socket', 'legendary_socket'))
);

CREATE INDEX idx_nodes_zone ON public.skill_tree_nodes(zone);
CREATE INDEX idx_nodes_type ON public.skill_tree_nodes(node_type);

CREATE TABLE public.user_inventory (
  user_id           UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  coins             INTEGER DEFAULT 0 CHECK (coins >= 0),
  free_pulls        INTEGER DEFAULT 0 CHECK (free_pulls >= 0),
  total_coins_spent INTEGER DEFAULT 0,
  total_pulls       INTEGER DEFAULT 0,
  pity_counter      INTEGER DEFAULT 0,
  last_updated      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_user ON public.user_inventory(user_id);

CREATE TABLE public.user_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  card_id          UUID NOT NULL REFERENCES public.skill_cards(id) ON DELETE CASCADE,
  level            INTEGER DEFAULT 1 CHECK (level >= 0 AND level <= 5),
  fragment_count   INTEGER DEFAULT 0 CHECK (fragment_count >= 0),
  is_equipped      BOOLEAN DEFAULT false,
  equipped_node_id INTEGER REFERENCES public.skill_tree_nodes(id),
  obtained_at      TIMESTAMPTZ DEFAULT NOW(),
  upgraded_at      TIMESTAMPTZ,
  UNIQUE (user_id, card_id)
);

CREATE INDEX idx_user_cards_user ON public.user_cards(user_id);
CREATE INDEX idx_user_cards_card ON public.user_cards(card_id);
CREATE INDEX idx_user_cards_equipped ON public.user_cards(user_id, is_equipped);

CREATE TABLE public.user_card_fragments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  card_id        UUID NOT NULL REFERENCES public.skill_cards(id) ON DELETE CASCADE,
  fragment_count INTEGER DEFAULT 0 CHECK (fragment_count >= 0),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, card_id)
);

CREATE INDEX idx_fragments_user ON public.user_card_fragments(user_id);

CREATE TABLE public.gacha_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pull_count     INTEGER NOT NULL CHECK (pull_count IN (1, 10, 30)),
  cost_coins     INTEGER NOT NULL,
  cards_obtained JSONB NOT NULL,
  pity_before    INTEGER,
  pity_after     INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gacha_user ON public.gacha_history(user_id);
CREATE INDEX idx_gacha_created ON public.gacha_history(created_at DESC);

CREATE TABLE public.skill_approval_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  card_id          UUID NOT NULL REFERENCES public.skill_cards(id) ON DELETE CASCADE,
  node_id          INTEGER NOT NULL REFERENCES public.skill_tree_nodes(id),
  status           TEXT DEFAULT 'pending',
  requested_at     TIMESTAMPTZ DEFAULT NOW(),
  approved_by      UUID REFERENCES public.users(id),
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  notes            TEXT,
  CONSTRAINT skill_approval_queue_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX idx_approval_status ON public.skill_approval_queue(status, requested_at);
CREATE INDEX idx_approval_user ON public.skill_approval_queue(user_id);

CREATE TABLE public.collections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  name_en           TEXT,
  description       TEXT,
  description_en    TEXT,
  required_card_ids UUID[] NOT NULL,
  reward_type       TEXT,
  reward_data       JSONB,
  display_order     INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT collections_reward_type_check CHECK (reward_type IN ('profile_border', 'ui_theme', 'coupon', 'special_item'))
);

CREATE TABLE public.user_collection_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  collection_id  UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  cards_obtained UUID[],
  is_completed   BOOLEAN DEFAULT false,
  completed_at   TIMESTAMPTZ,
  reward_claimed BOOLEAN DEFAULT false,
  UNIQUE (user_id, collection_id)
);

CREATE INDEX idx_user_collection ON public.user_collection_progress(user_id, is_completed);

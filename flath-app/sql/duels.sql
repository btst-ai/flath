-- ============================================================================
-- Duel feature schema (Iteration 3)
-- ----------------------------------------------------------------------------
-- Run once against your Supabase project:
--   Supabase Dashboard -> SQL Editor -> New query -> paste this file -> Run.
-- Idempotent: safe to re-run.
-- ============================================================================

-- Enums ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE duel_data_source AS ENUM ('p1', 'p2', 'avg');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE duel_card_mode AS ENUM ('prod', 'rec', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE duel_winner AS ENUM ('p1', 'p2', 'tie');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS duels (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  p1_user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  p2_user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL when P2 is guest
  p2_is_guest      BOOLEAN NOT NULL DEFAULT FALSE,
  p1_display_name  TEXT NOT NULL DEFAULT 'Baptiste',
  p2_display_name  TEXT NOT NULL DEFAULT 'Efi',
  p1_flag          TEXT NOT NULL DEFAULT '🇫🇷',
  p2_flag          TEXT NOT NULL DEFAULT '🇬🇷',
  pack_id          UUID REFERENCES word_packs(id) ON DELETE SET NULL,
  data_source      duel_data_source NOT NULL DEFAULT 'avg',
  card_mode        duel_card_mode   NOT NULL DEFAULT 'mixed',
  p1_final_score   NUMERIC(6,1) NOT NULL,
  p2_final_score   NUMERIC(6,1) NOT NULL,
  winner           duel_winner  NOT NULL,
  total_cards      INT NOT NULL,
  duration_ms      INT NOT NULL,
  ts_started       TIMESTAMPTZ NOT NULL,
  ts_finished      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT duels_distinct_players CHECK (p2_user_id IS NULL OR p1_user_id <> p2_user_id)
);

-- Indexes -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_duels_p1 ON duels(p1_user_id, ts_finished DESC);
CREATE INDEX IF NOT EXISTS idx_duels_p2 ON duels(p2_user_id, ts_finished DESC)
  WHERE p2_user_id IS NOT NULL;

-- Row Level Security --------------------------------------------------------
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Duel participants can read their duels" ON duels;
CREATE POLICY "Duel participants can read their duels"
  ON duels FOR SELECT
  USING (auth.uid() = p1_user_id OR auth.uid() = p2_user_id);

DROP POLICY IF EXISTS "P1 can insert" ON duels;
CREATE POLICY "P1 can insert"
  ON duels FOR INSERT
  WITH CHECK (auth.uid() = p1_user_id);

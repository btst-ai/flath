-- ============================================================================
-- schema.sql — RECONSTRUCTED BASELINE (no pg_dump available)
-- ============================================================================
-- STATUS: This file was reconstructed from:
--   • verified pg_policies output captured during security review
--   • existing sql/ migration files (duels.sql, phase2_rbac.sql, phase2_pos.sql,
--     add_added_at.sql, add_last_correct_mistake.sql)
--   • application queries (session.ts, vault/page.tsx, packs/page.tsx, useAddWord.ts)
--
-- It MUST be reconciled against a real `pg_dump --schema-only` before being
-- treated as authoritative.  Column types/defaults for tables that have no
-- checked-in CREATE TABLE (user_word_settings, attempts_history, word_packs,
-- word_pack_items) are best-effort inferences — verify them.
--
-- COVERAGE:
--   Tables: words_dim, user_word_settings, attempts_history,
--           word_packs, word_pack_items, duels, user_roles
--   RLS:    one clean, non-redundant policy set per table (role=authenticated)
--           standardised per N2/N3 review findings
--
-- IDEMPOTENT: safe to run against an existing Supabase database.
--   CREATE TABLE uses IF NOT EXISTS — will not clobber existing data.
--   Each policy block does DROP POLICY IF EXISTS then CREATE POLICY.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- Do NOT run this against production without first diffing it against the live
-- schema (see flath-app/sql/README.md for instructions).
-- ============================================================================


-- ============================================================================
-- PREREQUISITES
-- ============================================================================

-- uuid_generate_v4() is provided by the uuid-ossp extension (pre-enabled on Supabase).
-- If running against a fresh project: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- HELPER: is_admin()
-- ============================================================================
-- Source: phase2_rbac.sql — reproduced verbatim.
-- SECURITY DEFINER so it can read user_roles without RLS recursion.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;


-- ============================================================================
-- ENUMS (for duels table — source: duels.sql)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE duel_data_source AS ENUM ('p1', 'p2', 'avg', 'random');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE duel_data_source ADD VALUE IF NOT EXISTS 'random';

DO $$ BEGIN
  CREATE TYPE duel_card_mode AS ENUM ('prod', 'rec', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE duel_winner AS ENUM ('p1', 'p2', 'tie');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- TABLE: words_dim
-- ============================================================================
-- Vocabulary master table.  System words have created_by_user_id IS NULL;
-- user-created words carry the author's UUID.

CREATE TABLE IF NOT EXISTS public.words_dim (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  greek_text          TEXT,
  french_text         TEXT,
  part_of_speech      TEXT        NOT NULL DEFAULT 'Autre'
                                  CONSTRAINT part_of_speech_domain CHECK (
                                    part_of_speech IN (
                                      'Adjectif','Adverbe','Conjonction','Interjection',
                                      'Nom','Phrase','Preposition','Verbe','Pronom','Autre'
                                    )
                                  ),
  theme               TEXT,
  frequency_rank      INT,
  created_by_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS -------------------------------------------------------------------------
ALTER TABLE public.words_dim ENABLE ROW LEVEL SECURITY;

-- Everyone (including anonymous reads via the public anon key) can read words.
DROP POLICY IF EXISTS "read all words" ON public.words_dim;
CREATE POLICY "read all words"
  ON public.words_dim
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert: authenticated user must be the owner, or an admin.
DROP POLICY IF EXISTS "insert own words" ON public.words_dim;
CREATE POLICY "insert own words"
  ON public.words_dim
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id OR public.is_admin());

-- Update: owner or admin (system words — NULL created_by_user_id — require admin).
DROP POLICY IF EXISTS "owner or admin updates" ON public.words_dim;
CREATE POLICY "owner or admin updates"
  ON public.words_dim
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id OR public.is_admin());

-- Delete: owner or admin.
DROP POLICY IF EXISTS "owner or admin deletes" ON public.words_dim;
CREATE POLICY "owner or admin deletes"
  ON public.words_dim
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_user_id OR public.is_admin());


-- ============================================================================
-- TABLE: user_word_settings
-- ============================================================================
-- Per-user learning state for each word.  One row per (user_id, word_id).
-- Columns accumulated over multiple migrations; verify defaults/types against pg_dump.

CREATE TABLE IF NOT EXISTS public.user_word_settings (
  user_id                UUID        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  word_id                UUID        NOT NULL REFERENCES public.words_dim(id)  ON DELETE CASCADE,
  is_fav                 BOOLEAN     NOT NULL DEFAULT false,
  is_archived            BOOLEAN     NOT NULL DEFAULT false,
  avg_success_rate_prod  NUMERIC,
  avg_success_rate_rec   NUMERIC,
  interest_score         INT         NOT NULL DEFAULT 0,
  review_count           INT         NOT NULL DEFAULT 0,
  last_reviewed          TIMESTAMPTZ,
  last_correct_at        TIMESTAMPTZ,                    -- added by add_last_correct_mistake.sql
  last_mistake_at        TIMESTAMPTZ,                    -- added by add_last_correct_mistake.sql
  added_at               TIMESTAMPTZ NOT NULL DEFAULT now(), -- added by add_added_at.sql; NOT NULL enforced after backfill
  PRIMARY KEY (user_id, word_id)
);

-- RLS -------------------------------------------------------------------------
ALTER TABLE public.user_word_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own settings" ON public.user_word_settings;
CREATE POLICY "users read own settings"
  ON public.user_word_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own settings" ON public.user_word_settings;
CREATE POLICY "users insert own settings"
  ON public.user_word_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own settings" ON public.user_word_settings;
CREATE POLICY "users update own settings"
  ON public.user_word_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users delete own settings" ON public.user_word_settings;
CREATE POLICY "users delete own settings"
  ON public.user_word_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- TABLE: attempts_history
-- ============================================================================
-- Append-only log of every practice/review card attempt.

CREATE TABLE IF NOT EXISTS public.attempts_history (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  word_id               UUID        NOT NULL REFERENCES public.words_dim(id)  ON DELETE CASCADE,
  mode                  TEXT        NOT NULL CHECK (mode IN ('prod', 'rec')),
  outcome               TEXT        NOT NULL CHECK (outcome IN ('know', 'meh', 'forgot')),
  interest_interaction  TEXT        CHECK (interest_interaction IN ('fav','up','down','archive','none')),
  ts                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS -------------------------------------------------------------------------
ALTER TABLE public.attempts_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own attempts" ON public.attempts_history;
CREATE POLICY "users read own attempts"
  ON public.attempts_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own attempts" ON public.attempts_history;
CREATE POLICY "users insert own attempts"
  ON public.attempts_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE policies: attempts_history is append-only by design.
-- Omitting those policies means authenticated users cannot update or delete
-- their own rows either (RLS denies by default when no policy matches).


-- ============================================================================
-- TABLE: word_packs
-- ============================================================================
-- User-defined (or smart) collections of words.

CREATE TABLE IF NOT EXISTS public.word_packs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  is_smart        BOOLEAN     NOT NULL DEFAULT false,
  filter_criteria JSONB,
  ts_created      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_played_ts  TIMESTAMPTZ  -- read by packs/page.tsx; confirm presence/type during pg_dump reconciliation
);

-- RLS -------------------------------------------------------------------------
ALTER TABLE public.word_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read own packs" ON public.word_packs;
CREATE POLICY "owners read own packs"
  ON public.word_packs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "owners insert own packs" ON public.word_packs;
CREATE POLICY "owners insert own packs"
  ON public.word_packs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Source: word_packs_rename_policy.sql (reproduced idempotently here).
DROP POLICY IF EXISTS "owner can update own pack" ON public.word_packs;
CREATE POLICY "owner can update own pack"
  ON public.word_packs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "owners delete own packs" ON public.word_packs;
CREATE POLICY "owners delete own packs"
  ON public.word_packs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);


-- ============================================================================
-- TABLE: word_pack_items
-- ============================================================================
-- Join table between word_packs and words_dim.
-- Access is tied to owning the parent pack.

CREATE TABLE IF NOT EXISTS public.word_pack_items (
  pack_id  UUID NOT NULL REFERENCES public.word_packs(id)  ON DELETE CASCADE,
  word_id  UUID NOT NULL REFERENCES public.words_dim(id)   ON DELETE CASCADE,
  PRIMARY KEY (pack_id, word_id)
);

-- RLS -------------------------------------------------------------------------
ALTER TABLE public.word_pack_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pack owners read items" ON public.word_pack_items;
CREATE POLICY "pack owners read items"
  ON public.word_pack_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.word_packs
      WHERE word_packs.id = word_pack_items.pack_id
        AND word_packs.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pack owners insert items" ON public.word_pack_items;
CREATE POLICY "pack owners insert items"
  ON public.word_pack_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.word_packs
      WHERE word_packs.id = word_pack_items.pack_id
        AND word_packs.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pack owners delete items" ON public.word_pack_items;
CREATE POLICY "pack owners delete items"
  ON public.word_pack_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.word_packs
      WHERE word_packs.id = word_pack_items.pack_id
        AND word_packs.author_id = auth.uid()
    )
  );


-- ============================================================================
-- TABLE: duels
-- ============================================================================
-- Source: duels.sql — reproduced verbatim (enums declared above).

CREATE TABLE IF NOT EXISTS duels (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  p1_user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  p2_user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL when P2 is guest
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

-- Indexes ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_duels_p1 ON duels(p1_user_id, ts_finished DESC);
CREATE INDEX IF NOT EXISTS idx_duels_p2 ON duels(p2_user_id, ts_finished DESC)
  WHERE p2_user_id IS NOT NULL;

-- RLS -------------------------------------------------------------------------
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;

-- Participants (p1 or p2) can read duels they are part of.
DROP POLICY IF EXISTS "Duel participants can read their duels" ON duels;
CREATE POLICY "Duel participants can read their duels"
  ON duels FOR SELECT
  TO authenticated
  USING (auth.uid() = p1_user_id OR auth.uid() = p2_user_id);

-- Only p1 (the duel initiator) can insert.
DROP POLICY IF EXISTS "P1 can insert" ON duels;
CREATE POLICY "P1 can insert"
  ON duels FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = p1_user_id);


-- ============================================================================
-- TABLE: user_roles
-- ============================================================================
-- Source: phase2_rbac.sql — reproduced idempotently.
-- Maps users to application roles (currently only 'admin').

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('admin')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO service_role;

-- RLS -------------------------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role row (used by client-side useIsAdmin hook).
DROP POLICY IF EXISTS "users read own role" ON public.user_roles;
CREATE POLICY "users read own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- FUNCTION: add_word_for_user (atomic new-word creation)
-- ============================================================================
-- Inserts a words_dim row and the author's user_word_settings row in one
-- transaction. SECURITY DEFINER, but forces created_by_user_id/user_id to
-- auth.uid() and raises if unauthenticated. See sql/add_word_rpc.sql.

CREATE OR REPLACE FUNCTION public.add_word_for_user(
  p_greek          TEXT,
  p_french         TEXT,
  p_pos            TEXT,
  p_theme          TEXT,
  p_frequency_rank INT
)
RETURNS public.words_dim
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_row  public.words_dim;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'add_word_for_user: not authenticated';
  END IF;

  INSERT INTO public.words_dim (
    greek_text, french_text, part_of_speech, theme, frequency_rank, created_by_user_id
  )
  VALUES (p_greek, p_french, p_pos, p_theme, p_frequency_rank, v_uid)
  RETURNING * INTO v_row;

  INSERT INTO public.user_word_settings (
    user_id, word_id, avg_success_rate_prod, avg_success_rate_rec, added_at
  )
  VALUES (v_uid, v_row.id, 50, 50, now())
  ON CONFLICT (user_id, word_id) DO NOTHING;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_word_for_user(TEXT, TEXT, TEXT, TEXT, INT) TO authenticated;

-- Streak dates RPC — returns distinct calendar dates with any attempt, for
-- the authenticated user, over the last p_days days in the given IANA timezone.
-- Returns O(days) rows; immune to the PostgREST 1000-row default cap.
-- See sql/add_streak_rpc.sql for the full annotated migration.
CREATE OR REPLACE FUNCTION public.streak_dates(
  p_days INT    DEFAULT 90,
  p_tz   TEXT   DEFAULT 'Europe/Athens'
)
RETURNS TABLE(day DATE)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT (ts AT TIME ZONE p_tz)::date AS day
  FROM public.attempts_history
  WHERE user_id = auth.uid()
    AND ts >= now() - make_interval(days => p_days)
  ORDER BY day;
$$;

GRANT EXECUTE ON FUNCTION public.streak_dates(INT, TEXT) TO authenticated;


-- ============================================================================
-- END OF BASELINE
-- ============================================================================
-- Next step: diff this file against `pg_dump --schema-only` output (or the
-- Supabase Dashboard schema export) and reconcile any differences found.
-- See flath-app/sql/README.md for the full reconciliation procedure.
-- ============================================================================

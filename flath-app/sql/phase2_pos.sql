-- Phase 2: Part of Speech strict enforcement
-- Run in Supabase SQL editor AFTER running the preview script (scripts/preview_pos_migration.mjs)
--
-- Preview showed 2 rows with part_of_speech = 'Expression' (both phrase-type words).
-- Uncomment the line below to map them to 'Phrase' instead of 'Autre', or leave to fall through:
--   UPDATE public.words_dim SET part_of_speech = 'Phrase' WHERE part_of_speech = 'Expression';
--
-- Add other targeted renames here if needed, e.g.:
--   UPDATE public.words_dim SET part_of_speech = 'Verbe' WHERE part_of_speech IN ('Verb','verb');
--   UPDATE public.words_dim SET part_of_speech = 'Nom'   WHERE part_of_speech IN ('Noun','noun');
--
-- Then run the block below.

-- Backfill: anything not in the allowed set becomes 'Autre'
UPDATE public.words_dim
SET part_of_speech = 'Autre'
WHERE part_of_speech IS NULL
   OR part_of_speech NOT IN ('Adjectif','Adverbe','Conjonction','Interjection',
                              'Nom','Phrase','Preposition','Verbe','Pronom','Autre');

-- Set column to NOT NULL with default
ALTER TABLE public.words_dim
  ALTER COLUMN part_of_speech SET DEFAULT 'Autre',
  ALTER COLUMN part_of_speech SET NOT NULL;

-- Add CHECK constraint
ALTER TABLE public.words_dim
  ADD CONSTRAINT part_of_speech_domain CHECK (
    part_of_speech IN ('Adjectif','Adverbe','Conjonction','Interjection',
                       'Nom','Phrase','Preposition','Verbe','Pronom','Autre')
  );

-- Rollback (if needed):
--   ALTER TABLE public.words_dim DROP CONSTRAINT IF EXISTS part_of_speech_domain;
--   ALTER TABLE public.words_dim ALTER COLUMN part_of_speech DROP NOT NULL;
--   ALTER TABLE public.words_dim ALTER COLUMN part_of_speech DROP DEFAULT;

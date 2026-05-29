-- Add last_correct_at and last_mistake_at to user_word_settings
-- Run once in Supabase SQL Editor. Idempotent.

ALTER TABLE public.user_word_settings
  ADD COLUMN IF NOT EXISTS last_correct_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_mistake_at TIMESTAMPTZ;

-- Backfill from attempts_history: most recent 'know' and most recent 'forgot' per user+word
UPDATE public.user_word_settings uws
SET
  last_correct_at = sub.last_correct,
  last_mistake_at = sub.last_mistake
FROM (
  SELECT
    user_id,
    word_id,
    MAX(ts) FILTER (WHERE outcome = 'know')   AS last_correct,
    MAX(ts) FILTER (WHERE outcome = 'forgot') AS last_mistake
  FROM public.attempts_history
  GROUP BY user_id, word_id
) sub
WHERE uws.user_id = sub.user_id
  AND uws.word_id = sub.word_id;

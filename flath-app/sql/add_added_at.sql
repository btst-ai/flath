-- Add added_at to user_word_settings for per-user "Added last X days" filtering.
-- Run once in Supabase SQL Editor. Idempotent (IF NOT EXISTS + WHERE added_at IS NULL).

ALTER TABLE public.user_word_settings
  ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT now();

-- Backfill: use the earliest attempts_history timestamp per user+word as a
-- proxy for when the word was added; fall back to now() for words with no history.
UPDATE public.user_word_settings uws
SET added_at = COALESCE(sub.first_ts, now())
FROM (
  SELECT user_id, word_id, MIN(ts) AS first_ts
  FROM public.attempts_history
  GROUP BY user_id, word_id
) sub
WHERE uws.user_id = sub.user_id
  AND uws.word_id = sub.word_id
  AND uws.added_at IS NULL;

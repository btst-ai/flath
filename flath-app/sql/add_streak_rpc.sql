-- Streak dates RPC for progress tracker.
-- Run once in Supabase SQL Editor. Idempotent (CREATE OR REPLACE FUNCTION).
--
-- Why: fetching raw attempts_history rows for streak computation hits PostgREST's
-- default 1000-row cap. At ~189 cards/day, 90 days of history exceeds 1000 rows.
-- Today's rows (most recent) can be silently truncated, causing studiedToday=false
-- and the streak to show "No streak yet" even after active study.
-- This RPC returns only distinct calendar dates — O(days) not O(attempts) — and
-- is immune to the row cap.
--
-- Security: SECURITY INVOKER — RLS on attempts_history already scopes to auth.uid().
-- The WHERE clause is belt-and-suspenders.

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

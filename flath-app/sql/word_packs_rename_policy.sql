-- Allow pack owners to update (rename) their own packs.
-- Run once in Supabase SQL Editor. Idempotent (DROP IF EXISTS before CREATE).
--
-- Ownership column: author_id (matches the INSERT pattern in app/packs/page.tsx).

DROP POLICY IF EXISTS "owner can update own pack" ON public.word_packs;
CREATE POLICY "owner can update own pack"
  ON public.word_packs
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

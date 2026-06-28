-- Atomic new-word creation.
-- Run once in Supabase SQL Editor. Idempotent (CREATE OR REPLACE FUNCTION).
--
-- Why: adding a brand-new word writes two rows — the shared words_dim row and
-- the author's user_word_settings row. The Supabase JS client cannot wrap those
-- in a transaction, so a failure on the second write previously left an orphaned
-- words_dim row with no settings. This function performs both inserts in one
-- transaction (PL/pgSQL functions are atomic: any exception rolls back both).
--
-- Security: SECURITY DEFINER so it may satisfy both tables' RLS, but it forces
-- created_by_user_id / user_id to auth.uid() and raises if unauthenticated, so
-- the elevated rights cannot be used to write on another user's behalf.
-- search_path is pinned to public (SECURITY DEFINER hardening).

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

## 1. Author the RPC

- [x] 1.1 Create `flath-app/sql/add_word_rpc.sql`: a `SECURITY DEFINER` PL/pgSQL function
  `public.add_word_for_user(p_greek text, p_french text, p_pos text, p_theme text,
  p_frequency_rank int) RETURNS public.words_dim`. Body: resolve `auth.uid()` (raise if null);
  insert the `words_dim` row with `created_by_user_id = auth.uid()` RETURNING into a row var; insert
  the `user_word_settings` row (prod/rec = 50, `added_at = now()`) with `ON CONFLICT (user_id,
  word_id) DO NOTHING`; return the word row. Pin `SET search_path = public`. `GRANT EXECUTE TO
  authenticated`. Idempotent via `CREATE OR REPLACE FUNCTION`.
- [x] 1.2 Add the same function definition to `flath-app/sql/schema.sql` (in a "Functions" section).

## 2. Wire up the client

- [x] 2.1 In `hooks/useAddWord.ts`, replace the new-word branch's two writes (`words_dim` insert +
  `user_word_settings` upsert) with a single `supabase.rpc("add_word_for_user", { p_greek, p_french,
  p_pos, p_theme, p_frequency_rank })`. Use the returned row as `finalWordData`. On error: toast +
  `continue` (mirroring the current insert-error handling). Preserve the existing duplicate-check and
  conflict/overwrite path unchanged (RPC is only for brand-new words). Keep the success-stats push.

## 3. Verify

- [x] 3.1 `cd flath-app && npx tsc --noEmit` passes.
- [x] 3.2 Lint on `hooks/useAddWord.ts`: no new violations.

## 4. Apply + smoke-test (manual — user)

- [ ] 4.1 Run `flath-app/sql/add_word_rpc.sql` in the Supabase SQL Editor.
- [ ] 4.2 Add a brand-new word in the vault → it appears in My Library; add a duplicate → the
  conflict prompt still works.

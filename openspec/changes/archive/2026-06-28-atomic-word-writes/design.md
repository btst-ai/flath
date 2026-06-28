## Context

`useAddWord` new-word path (hooks/useAddWord.ts ~119-152):
1. `INSERT INTO words_dim (...) RETURNING *` with `created_by_user_id = userId`.
2. `UPSERT user_word_settings (user_id, word_id, avg_success_rate_prod=50, avg_success_rate_rec=50,
   added_at=now)` with `onConflict: user_id,word_id, ignoreDuplicates: true`.

No transaction wraps the two. Supabase's JS client cannot do multi-statement transactions, so the
canonical fix is a Postgres function invoked via `supabase.rpc()`.

RLS context: `words_dim` INSERT policy requires `auth.uid() = created_by_user_id OR is_admin()`;
`user_word_settings` is own-rows. A `SECURITY DEFINER` function runs as its owner and can perform
both, but MUST itself enforce that it only writes rows for the calling user.

## Goals / Non-Goals

**Goals:** atomic new-word creation; client calls one RPC; ownership enforced inside the function.

**Non-Goals:** changing the conflict/overwrite path (single update, interactive decision); wrapping
`markWordAsMistake`; batch-insert optimization.

## Decisions

**D1. `SECURITY DEFINER` function `add_word_for_user`.**
Signature: `(p_greek text, p_french text, p_pos text, p_theme text, p_frequency_rank int)
RETURNS words_dim`. Body, in one implicit transaction:
- `v_uid := auth.uid();` — if NULL, `RAISE EXCEPTION` (no anonymous writes).
- `INSERT INTO public.words_dim (greek_text, french_text, part_of_speech, theme, frequency_rank,
  created_by_user_id) VALUES (..., v_uid) RETURNING * INTO v_row;`
- `INSERT INTO public.user_word_settings (user_id, word_id, avg_success_rate_prod,
  avg_success_rate_rec, added_at) VALUES (v_uid, v_row.id, 50, 50, now())
  ON CONFLICT (user_id, word_id) DO NOTHING;`
- `RETURN v_row;`
A PL/pgSQL function is atomic by default — any exception rolls back both inserts. `created_by_user_id`
is forced to `auth.uid()`, so the definer rights can't be used to write as someone else.
`set search_path = public` is pinned to avoid search-path hijacking (a `SECURITY DEFINER` best
practice). `GRANT EXECUTE ... TO authenticated`.

**D2. Client calls `supabase.rpc("add_word_for_user", { p_greek, p_french, p_pos, p_theme,
p_frequency_rank })`** in place of the two writes. The returned row replaces `newWordData`. Error
handling mirrors the current insert-error branch (toast + `continue`). The settings `ignoreDuplicates`
semantics are preserved by `ON CONFLICT DO NOTHING`.

**D3. Keep the existing duplicate-check + conflict UX before the RPC.** The RPC is only invoked on the
`else` (brand-new word) branch — the existing `maybeSingle()` lookup and keep/overwrite prompt are
unchanged. So the RPC never has to handle the "word already exists" case.

## Risks / Trade-offs

- **[Risk] `SECURITY DEFINER` privilege escalation.** → Mitigation: function forces
  `created_by_user_id = auth.uid()`, only writes the caller's settings row, pins `search_path`,
  raises if unauthenticated, and is granted only to `authenticated`.
- **[Risk] Client deployed before the function exists in prod → RPC 404.** → Mitigation: tasks
  require running `add_word_rpc.sql` in Supabase before/with the deploy; called out explicitly.
- **[Trade-off] Logic moves into SQL.** Accepted: atomicity is impossible client-side; the function
  is small and checked in.

## Migration Plan

1. Commit `add_word_rpc.sql` + the `useAddWord` change + `schema.sql` update.
2. **(User)** Run `add_word_rpc.sql` in the Supabase SQL Editor (creates the function + grant).
3. **(User)** Smoke-test: add a brand-new word in the vault → appears in My Library; add a duplicate
   → conflict prompt still works.

**Rollback:** revert the `useAddWord` change to the two-write version; `DROP FUNCTION
add_word_for_user`. The two-write path still functions (just non-atomic).

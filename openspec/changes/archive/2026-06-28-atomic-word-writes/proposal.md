## Why

When a brand-new word is added, `useAddWord` performs two sequential writes with no transaction:
`INSERT` into `words_dim`, then `UPSERT` into `user_word_settings` (`hooks/useAddWord.ts` ~119-152).
If the second write fails, the `words_dim` row persists but the user has no settings row for it — an
orphaned word that shows up for everyone (read-all) yet is absent from the author's library. The two
writes should be atomic.

## What Changes

- Add a `SECURITY DEFINER` Postgres function `add_word_for_user(...)` that, in a single transaction,
  inserts the new `words_dim` row and inserts the matching `user_word_settings` row, returning the
  created word. Checked in as `flath-app/sql/add_word_rpc.sql` and folded into `schema.sql`.
- Update the **new-word path** of `hooks/useAddWord.ts` to call this RPC (`supabase.rpc(...)`)
  instead of the two separate `.insert()`/`.upsert()` calls.
- **Out of scope:** the conflict/overwrite path (updating an existing `words_dim` row) stays as-is —
  it is a single update, not a multi-step write, and its interactive keep/overwrite decision cannot
  live inside one RPC. `markWordAsMistake` (insert attempt → recompute) is also left as-is: the
  insert is the source of truth and aggregates self-heal; wrapping it is lower-value and handled by
  the error propagation already added in the prior change.

## Capabilities

### New Capabilities
- `word-creation-integrity`: creating a new word for a user MUST be atomic — either both the shared
  `words_dim` row and the user's `user_word_settings` row are created, or neither is.

## Impact

- **Database:** new `add_word_for_user` function (`SECURITY DEFINER`, owner-checked). New file
  `flath-app/sql/add_word_rpc.sql`; also added to `flath-app/sql/schema.sql`.
- **Code:** `hooks/useAddWord.ts` new-word branch calls `supabase.rpc("add_word_for_user", {...})`.
- **Manual step:** the function must be created in the live DB via the Supabase SQL Editor before the
  client change works in production.
- **Risk:** medium — touches the add-word happy path. Mitigated by keeping the conflict path
  unchanged, `tsc`/lint, and a manual add-word smoke test.

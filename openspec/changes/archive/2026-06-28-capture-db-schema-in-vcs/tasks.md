## 1. Author the baseline schema

- [x] 1.1 Create `flath-app/sql/schema.sql` with a header comment flagging it as a reconstructed
  baseline (to be reconciled against `pg_dump`), then `CREATE TABLE IF NOT EXISTS` DDL for every
  `public` table: `words_dim`, `user_word_settings`, `attempts_history`, `word_packs`,
  `word_pack_items`, `duels`, `user_roles`. Reuse known columns from existing `sql/` migrations and
  app queries.
- [x] 1.2 In the same file, add a policy block: `ALTER TABLE … ENABLE ROW LEVEL SECURITY` plus a
  clean, non-redundant RLS policy set per table, scoped to the `authenticated` role with
  `auth.uid() = <owner_col>` (N2/N3). Preserve special cases: `words_dim` read-all + owner/admin
  write, `word_pack_items` EXISTS-subquery, `duels` OR-policy.

## 2. Document conventions

- [x] 2.1 Create `flath-app/sql/README.md` describing: `schema.sql` is the reproducible baseline;
  dated files are incremental migrations; all SQL is applied manually via the Supabase SQL Editor.

## 3. Validate fidelity (manual — user)

- [ ] 3.1 Export the real schema from Supabase (dashboard schema export or `pg_dump --schema-only`)
  and diff against `schema.sql`; reconcile any column/type/default/constraint differences.
- [ ] 3.2 (Optional) To enact the N2/N3 standardization in production, run the policy block of
  `schema.sql` in the Supabase SQL Editor; re-verify with `pg_policies`.

## 4. Commit

- [ ] 4.1 Commit `flath-app/sql/schema.sql` and `flath-app/sql/README.md` on the
  `fix/security-hardening` branch.

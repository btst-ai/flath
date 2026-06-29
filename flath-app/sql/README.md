# flath-app/sql — Database Schema and Migrations

## Convention

All SQL for the Flath database is applied **manually** in the Supabase SQL Editor
(Dashboard → SQL Editor → New query → paste → Run).
There is no Supabase CLI, no migration runner, and no automated deployment pipeline.

## Files

| File | Type | Description |
|---|---|---|
| `schema.sql` | Baseline (reconstructed) | Full `public` schema: all table DDL and a clean, standardised RLS policy set for every table. See below. |
| `phase2_rbac.sql` | Migration | Adds `user_roles` table, `is_admin()` helper function, and initial RLS policies on `words_dim`. |
| `phase2_pos.sql` | Migration | Backfills and enforces the `part_of_speech` CHECK constraint on `words_dim`. |
| `add_added_at.sql` | Migration | Adds `added_at TIMESTAMPTZ` to `user_word_settings` for temporal filtering; backfills from `attempts_history`. |
| `add_last_correct_mistake.sql` | Migration | Adds `last_correct_at` and `last_mistake_at` to `user_word_settings`; backfills from `attempts_history`. |
| `word_packs_rename_policy.sql` | Migration | Adds the `owner can update own pack` RLS policy on `word_packs` (enables pack rename). |
| `lock_down_vocabulary.sql` | Migration | Drops the legacy `public.vocabulary` table that had a permissive public-access policy. |
| `duels.sql` | Migration | Creates the `duels` table, its custom enums, indexes, and RLS policies. |

## schema.sql — the reproducible baseline

`schema.sql` is intended to be a single, readable document that answers the question
"what does the database look like?". It contains:

- The `is_admin()` helper function.
- `CREATE TABLE IF NOT EXISTS` DDL for every `public` table.
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for every table.
- A clean, non-redundant RLS policy set per table:
  - Role standardised to `authenticated` (N2 fix — makes intent explicit; the
    `auth.uid() = ...` quals already make `anon` a no-op).
  - One policy per command (SELECT, INSERT, UPDATE, DELETE) rather than
    a redundant `FOR ALL` plus per-command duplicates (N3 fix).
  - Special cases preserved: `words_dim` has read-all + owner/admin write;
    `word_pack_items` uses an EXISTS subquery scoped to the parent pack owner;
    `duels` uses an OR-policy for the two participants.

**Reconstruction notice:** this file was reconstructed (no `pg_dump` access),
so column types and defaults for tables without a checked-in `CREATE TABLE`
are best-effort inferences. Run the reconciliation step below before treating
it as authoritative.

## Reconciliation procedure (one-time)

1. In the Supabase Dashboard, open Database → run the following and export the result:

   ```sql
   -- Tables
   SELECT table_name, column_name, data_type, column_default, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public'
   ORDER BY table_name, ordinal_position;

   -- Policies
   SELECT tablename, policyname, cmd, roles, qual, with_check
   FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
   ```

2. Diff the output against `schema.sql`.
3. Update `schema.sql` with any corrections found (wrong type, missing default, extra column, etc.).
4. Commit the corrected file with a note that it has been reconciled.

## Adding a migration

When you need to change the schema or a policy:

1. Write a new `.sql` file in this directory (e.g. `add_<feature>.sql` or `<date>_<description>.sql`).
2. Make it idempotent: use `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS`, etc.
3. Run it in the Supabase SQL Editor.
4. Also update `schema.sql` to reflect the final desired state (it is a snapshot of the full schema,
   not just individual changes).
5. Commit both files.

## RLS policy quick reference

| Table | Owner column | Policy pattern |
|---|---|---|
| `words_dim` | `created_by_user_id` | Read-all; INSERT/UPDATE/DELETE to owner or admin |
| `user_word_settings` | `user_id` | Own rows only (SELECT/INSERT/UPDATE/DELETE) |
| `attempts_history` | `user_id` | Own rows; SELECT + INSERT only (append-only) |
| `word_packs` | `author_id` | Own rows only (SELECT/INSERT/UPDATE/DELETE) |
| `word_pack_items` | via `word_packs.author_id` | EXISTS subquery to parent pack owner |
| `duels` | `p1_user_id` / `p2_user_id` | Participants can read; p1 can insert |
| `user_roles` | `user_id` | Own row read-only |

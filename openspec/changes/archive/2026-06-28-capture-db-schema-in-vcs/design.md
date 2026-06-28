## Context

The repo cannot rebuild its database: schema and RLS live only in the live Supabase project.
Verified inputs available for reconstruction:
- A full `pg_policies` dump (table, policy name, cmd, roles, `qual`, `with_check`) captured during
  review, covering `attempts_history`, `user_word_settings`, `word_packs`, `word_pack_items`,
  `words_dim`, `duels`, (and the now-dropped `vocabulary`).
- Existing partial DDL in `sql/` for `duels`, `user_roles` (`phase2_rbac.sql`), `words_dim` POS
  constraint (`phase2_pos.sql`), and column additions (`add_added_at.sql`,
  `add_last_correct_mistake.sql`).
- Column names inferred from application queries (`session.ts`, `vault/page.tsx`, `packs/page.tsx`,
  `useAddWord.ts`).

No Supabase CLI or `pg_dump` in this environment, so the baseline is **reconstructed**, not
machine-exported.

## Goals / Non-Goals

**Goals:**
- A single `flath-app/sql/schema.sql` baseline: every `public` table's DDL + a clean RLS policy set.
- Standardize policy roles to `authenticated` (N2) and collapse redundant policies (N3) in the
  baseline.
- Document conventions in `flath-app/sql/README.md`.
- Provide a user-runnable `pg_dump` diff step to validate fidelity.

**Non-Goals:**
- Auto-applying the baseline to production or forcing the N2/N3 cleanup onto the live DB (offered as
  an optional follow-up — the live policies are already secure, just redundant).
- Introducing a migration-runner tool / Supabase CLI (future work).
- Capturing `auth.*` or other Supabase-managed schemas.

## Decisions

**D1. One baseline file rather than the Supabase CLI `migrations/` layout.**
Rationale: the repo already uses flat, manually-applied `sql/` files; a single readable baseline +
dated deltas matches that and avoids introducing CLI tooling mid-stream. The README documents it.

**D2. Reconstruct from verified `pg_policies` + code, and label it as reconstructed.**
The exact column types/defaults for some tables aren't fully knowable without `pg_dump`. The
baseline uses the known columns (from migrations + queries) and sensible types, and a header
comment states it is reconstructed and must be reconciled against a real `pg_dump --schema-only`
(task 3). This is honest about fidelity rather than presenting guesses as authoritative.

**D3. `schema.sql` uses `CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS` then `CREATE POLICY`.**
Makes it safe to run against an existing DB without clobbering data, and idempotent for policies.
Tables already exist in prod, so the table DDL is effectively documentation; the policy block is
what could be re-applied to enact the N2/N3 standardization if desired.

**D4. Baseline standardizes to `authenticated` and one policy set per table.**
Per-command policies (SELECT own, INSERT own, UPDATE own, DELETE own) with `auth.uid() = <owner_col>`
replace the redundant `FOR ALL` + duplicates. `words_dim` keeps read-all + owner/admin write.
`word_pack_items` keeps the `EXISTS (… word_packs owner …)` subquery. `duels` keeps the OR-policy.

## Risks / Trade-offs

- **[Risk] Reconstructed schema drifts from the real DB (wrong type/default/constraint).** →
  Mitigation: task 3 has the user run `pg_dump --schema-only` (or the Supabase dashboard's schema
  export) and diff; the header comment flags non-authoritative status until reconciled.
- **[Risk] Someone runs schema.sql against prod and the policy re-creation changes behavior.** →
  Mitigation: the policy set is semantically equivalent to the verified live quals (just
  deduplicated + role-narrowed to `authenticated`, which is a no-op given the quals). README warns
  it is a baseline, not an auto-migration.
- **[Trade-off] Manual fidelity check.** Accepted given no CLI; the diff step is cheap for the user.

## Migration Plan

1. Commit `schema.sql` + `README.md` (reference artifacts; no prod change required).
2. **(User, optional)** Export the real schema: Supabase Dashboard → Database → run
   `pg_dump`-equivalent, or `select` from `information_schema`/`pg_policies`, and diff against
   `schema.sql`; reconcile any differences found.
3. **(User, optional)** To enact N2/N3 standardization in prod, run the policy block of `schema.sql`
   (the `DROP POLICY IF EXISTS … / CREATE POLICY …` section). Safe and idempotent.

**Rollback:** committing reference SQL has no runtime effect; nothing to roll back. If the optional
policy re-application caused issues, re-apply the previously-captured policy definitions.

## Open Questions

- Exact column types/defaults for tables lacking a checked-in `CREATE TABLE` — resolved by the
  task-3 `pg_dump` reconciliation. Not blocking the baseline.

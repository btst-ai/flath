## Why

A full project review verified the live Supabase RLS policies and found that the
`public.vocabulary` table carries a policy named **"Public Access"** with `FOR ALL`, role
`public`, `USING (true)`, `WITH CHECK (true)`. Because Postgres ORs same-command policies,
this permissive policy overrides the table's narrower own-rows policies entirely. The net
effect: **anyone — including unauthenticated `anon` clients, since the anon key ships in the
public client bundle — can read, insert, update, and delete every row in `vocabulary`.**

The application code does not use `vocabulary` (it uses `words_dim`); this is a legacy table.
But an open table is reachable from the internet regardless of whether the app touches it, so
it must be locked down or removed.

## What Changes

- **DECISION (user-confirmed):** `public.vocabulary` is unused (verified: zero `.from("vocabulary")`
  references in source) and the user has authorized dropping it. The change is a straight
  **`DROP TABLE public.vocabulary CASCADE`**, which also removes its "Public Access" policy.
- Deliver the fix as **checked-in SQL** under `flath-app/sql/` so the remediation is auditable
  and reproducible (this also seeds the broader schema-in-VCS effort tracked separately).
- The non-destructive re-scope fallback is no longer needed and is dropped from scope.

## Capabilities

### New Capabilities
- `database-security`: Establishes the requirement that every `public` table has RLS policies
  scoped to row ownership (no `USING (true)` write access for the `public`/`anon` role), and
  that RLS changes are captured as checked-in SQL.

### Modified Capabilities
<!-- None: no existing OpenSpec capability covers database/RLS posture. -->

## Impact

- **Database:** `public.vocabulary` table and its RLS policies (dropped or re-scoped).
- **Code:** none — no application code references `vocabulary`. (To be re-confirmed in design via
  a repo-wide search before execution.)
- **Files:** new `flath-app/sql/lock_down_vocabulary.sql`.
- **Risk:** destructive if the table holds needed data; mitigated by an explicit verify-before-
  drop step and a non-destructive re-scope fallback.
- **Deployment:** SQL is run manually in the Supabase SQL Editor (no Supabase CLI in this repo);
  must be run against production to take effect.

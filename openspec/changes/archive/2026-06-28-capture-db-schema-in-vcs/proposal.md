## Why

The project's database schema and Row-Level Security policies live only inside the live Supabase
project — the repo's `sql/` folder holds a partial, ad-hoc set of one-off migrations, not a
source of truth. A review confirmed there is **no checked-in DDL or RLS** for `user_word_settings`,
`word_pack_items`, `attempts_history`, nor the SELECT/INSERT/DELETE policies for `word_packs`. This
is both a security-audit gap (RLS cannot be reviewed in version control) and a disaster-recovery
risk (the database cannot be rebuilt from this repo).

## What Changes

- Add a single baseline SQL file, `flath-app/sql/schema.sql`, that captures the full `public`
  schema: every table's DDL and every RLS policy, reconstructed from the verified live
  `pg_policies` output and the application's query patterns.
- The baseline standardizes the inconsistencies surfaced in review:
  - **N2:** policy roles standardized to `authenticated` (the `auth.uid() = …` quals already make
    `anon` a no-op; using `authenticated` makes intent explicit).
  - **N3:** the redundant `FOR ALL` + per-command duplicate policies collapsed to one clear set
    per table.
- Add a short `flath-app/sql/README.md` documenting the convention: schema.sql is the baseline,
  dated files are incremental migrations, all applied manually via the Supabase SQL Editor.
- **Non-destructive:** the committed `schema.sql` is a reference/reproduction artifact. It is NOT
  auto-applied to production. A verification step diffs it against a real `pg_dump --schema-only`
  to catch any drift the reconstruction missed.

## Capabilities

### Modified Capabilities
- `database-security`: extends the existing "RLS changes are captured as checked-in SQL"
  requirement to mandate a full baseline schema file, not just per-change deltas.

## Impact

- **Files:** new `flath-app/sql/schema.sql`, new `flath-app/sql/README.md`.
- **Code:** none.
- **Database:** none directly. The baseline is reference SQL; standardizing N2/N3 in production is
  optional and called out as a follow-up the user can apply via the dashboard.
- **Limitation:** no Supabase CLI / `pg_dump` access in this environment, so the baseline is
  reconstructed (from the verified `pg_policies` dump + code) rather than machine-exported; the
  tasks include a user-run `pg_dump` diff to validate fidelity.

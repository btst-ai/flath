# database-security Specification

## Purpose
Ensure every table in the `public` schema enforces ownership-scoped Row-Level Security with no
unconditional public/anon write access, and that all schema and RLS changes are captured as
checked-in SQL so the database's security posture is auditable and reproducible from version control.
## Requirements
### Requirement: No public-role write access to data tables

Every table in the `public` schema SHALL NOT grant write access (INSERT, UPDATE, or DELETE) to
the `public` or `anon` role via an unconditional policy (a policy whose `USING` / `WITH CHECK`
expression evaluates to `true` for those roles). Tables holding user data MUST restrict access to
rows owned by the authenticated user (e.g. `auth.uid() = user_id`). Tables that are unused legacy
artifacts SHALL be removed rather than left with permissive policies.

#### Scenario: Unauthenticated client cannot access an unused legacy table

- **WHEN** a client using only the public anon key queries `public.vocabulary`
- **THEN** the table no longer exists (it has been dropped), so the query returns a "relation does
  not exist" error rather than data
- **AND** `select to_regclass('public.vocabulary')` returns NULL
- **AND** `select count(*) from pg_policies where tablename = 'vocabulary'` returns 0

#### Scenario: Permissive public-access policy is treated as a defect

- **WHEN** a review finds a `public` table with a `FOR ALL` policy granting `USING (true)` /
  `WITH CHECK (true)` to the `public`/`anon` role
- **THEN** the table SHALL be either dropped (if unused) or have that policy replaced with
  owner-scoped policies before the change is considered complete

### Requirement: RLS changes are captured as checked-in SQL

The database's schema and Row-Level Security policies SHALL be reproducible from version control.
A baseline file `flath-app/sql/schema.sql` MUST capture the full `public`-schema DDL and every RLS
policy. Any subsequent change to schema or RLS SHALL additionally be recorded as a dated SQL file
under `flath-app/sql/`, so each change is auditable and the database can be rebuilt from the repo.

#### Scenario: Locking down the legacy table leaves an auditable record

- **WHEN** the `vocabulary` table is dropped to close its public-access exposure
- **THEN** a SQL file (`flath-app/sql/lock_down_vocabulary.sql`) containing the idempotent
  `DROP TABLE IF EXISTS public.vocabulary CASCADE` statement is committed to the repository

#### Scenario: Full schema baseline exists in version control

- **WHEN** a developer needs to recreate the database or audit its RLS posture
- **THEN** `flath-app/sql/schema.sql` contains the DDL for every `public` table
  (`words_dim`, `user_word_settings`, `attempts_history`, `word_packs`, `word_pack_items`,
  `duels`, `user_roles`) and an RLS policy set for each
- **AND** the policies use the `authenticated` role and a single non-redundant set per table
  (no duplicate `FOR ALL` + per-command policies)

### Requirement: SQL conventions are documented

The `flath-app/sql/` directory SHALL contain a README describing the file conventions: that
`schema.sql` is the reproducible baseline, dated files are incremental migrations, and all files
are applied manually via the Supabase SQL Editor (no CLI migration runner is in use).

#### Scenario: A contributor can understand how SQL is managed

- **WHEN** a contributor opens `flath-app/sql/`
- **THEN** a `README.md` explains the role of `schema.sql`, the migration-file naming, and that
  changes are applied manually in the Supabase SQL Editor


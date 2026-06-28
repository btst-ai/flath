## ADDED Requirements

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

Any change to database schema or Row-Level Security policies SHALL be recorded as a SQL file
committed under `flath-app/sql/`, so the change is auditable in version control and reproducible
against a fresh database.

#### Scenario: Locking down the legacy table leaves an auditable record

- **WHEN** the `vocabulary` table is dropped to close its public-access exposure
- **THEN** a SQL file (`flath-app/sql/lock_down_vocabulary.sql`) containing the idempotent
  `DROP TABLE IF EXISTS public.vocabulary CASCADE` statement is committed to the repository

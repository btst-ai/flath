## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: SQL conventions are documented

The `flath-app/sql/` directory SHALL contain a README describing the file conventions: that
`schema.sql` is the reproducible baseline, dated files are incremental migrations, and all files
are applied manually via the Supabase SQL Editor (no CLI migration runner is in use).

#### Scenario: A contributor can understand how SQL is managed

- **WHEN** a contributor opens `flath-app/sql/`
- **THEN** a `README.md` explains the role of `schema.sql`, the migration-file naming, and that
  changes are applied manually in the Supabase SQL Editor

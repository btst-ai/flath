## Context

A review verified live Supabase RLS and found `public.vocabulary` exposed via a `FOR ALL`,
role-`public`, `USING (true)` / `WITH CHECK (true)` policy ("Public Access"). Postgres ORs
same-command policies, so this overrides the table's narrower own-rows policies — making the
table fully readable and writable by anyone holding the (publicly shipped) anon key, including
unauthenticated clients.

The table is legacy: the app uses `words_dim`, and a repo-wide search found **zero**
`.from("vocabulary")` accesses in `flath-app/{app,lib,hooks,components}`. The user has confirmed
the table can be dropped.

Constraints:
- No Supabase CLI or `psql` in this environment; SQL is applied manually via the Supabase SQL
  Editor against production.
- This repo does not yet keep the schema in VCS (tracked separately as Change 0b). This change
  contributes one checked-in SQL file as a first step.

## Goals / Non-Goals

**Goals:**
- Eliminate the public read/write exposure of `public.vocabulary`.
- Leave an auditable, reproducible record of the fix as checked-in SQL.
- Make the SQL safe to run and safe to re-run (idempotent) and safe to run before/after the data
  check.

**Non-Goals:**
- Capturing the rest of the schema/RLS into VCS (Change 0b).
- Touching any application code (none references the table).
- Re-scoping the table's policies (the table is being dropped, not retained).

## Decisions

**D1. Drop the table rather than re-scope its policies.**
Rationale: it's unused by the app and the user authorized removal. Dropping the table removes the
attack surface entirely and is simpler than maintaining policies on a dead table. Alternative
(drop "Public Access" + add owner-scoped policies) was rejected as it keeps a table no one reads.

**D2. Use `DROP TABLE IF EXISTS public.vocabulary CASCADE;`**
- `IF EXISTS` → idempotent / safe to re-run.
- `CASCADE` → also drops the table's policies and any dependent objects (views, FKs). A repo
  search shows no app dependency; `CASCADE` covers any DB-side dependents (e.g. a legacy view).
Alternative `RESTRICT` (the default) was rejected because an unknown dependent would block the
drop; we'd rather see the cascade than fail — but the migration plan includes a dependency check
first so we *know* what cascades before running it.

**D3. Pre-flight inspection is advisory, not blocking, and lives in the SQL file as comments.**
Because the user already authorized the drop, the inspection queries (row count, dependents) are
included as commented-out "run these first if you want to confirm" lines, so the executable part
of the file is just the drop. This keeps the committed artifact a single clear statement while
still documenting how the decision was validated.

## Risks / Trade-offs

- **[Risk] The table holds data someone still needs out-of-band (e.g. an external script).** →
  Mitigation: the file documents an inspection query (`select count(*) from public.vocabulary;`)
  to run first; user has already confirmed it's unused. The drop is the last step, not blind.
- **[Risk] `CASCADE` silently removes a dependent object.** → Mitigation: migration plan runs a
  `pg_depend` / dependency query first to enumerate dependents before executing the drop.
- **[Risk] SQL never actually applied to prod (file committed but not run).** → Mitigation:
  tasks.md includes an explicit "run in Supabase SQL Editor and re-verify with `pg_policies`"
  step; the change is not complete until re-verification shows the table gone.
- **[Trade-off] Manual application (no CLI migration runner).** Accepted: matches current repo
  practice; Change 0b will address migration tooling.

## Migration Plan

1. **(Optional, advisory)** In Supabase SQL Editor, inspect before dropping:
   ```sql
   select count(*) from public.vocabulary;                 -- how much data
   select * from public.vocabulary limit 20;               -- what it looks like
   -- dependents that CASCADE would remove:
   select dependent_ns.nspname as dep_schema, dependent.relname as dep_object
   from pg_depend d
   join pg_rewrite r on r.oid = d.objid
   join pg_class dependent on dependent.oid = r.ev_class
   join pg_namespace dependent_ns on dependent_ns.oid = dependent.relnamespace
   join pg_class src on src.oid = d.refobjid
   where src.relname = 'vocabulary' and src.relnamespace = 'public'::regnamespace
     and dependent.relname <> 'vocabulary';
   ```
2. Run the committed `flath-app/sql/lock_down_vocabulary.sql` (the `DROP TABLE IF EXISTS ...
   CASCADE`) in the Supabase SQL Editor.
3. **Re-verify** the fix:
   ```sql
   select tablename, policyname from pg_policies where tablename = 'vocabulary';   -- expect 0 rows
   select to_regclass('public.vocabulary');                                        -- expect NULL
   ```
4. Commit the SQL file.

**Rollback:** none required — dropping an unused, internet-open table has no app impact. If the
table were unexpectedly needed, it would be recreated from a Supabase point-in-time backup; the
fix itself is not something we'd want to "roll back" since it closes a hole.

## Open Questions

- None blocking. (Row-count inspection is advisory; user has authorized the drop.)

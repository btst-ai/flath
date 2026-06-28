## 1. Author the lock-down SQL

- [x] 1.1 Create `flath-app/sql/lock_down_vocabulary.sql` containing an idempotent
  `DROP TABLE IF EXISTS public.vocabulary CASCADE;`, with a header comment explaining why
  (the "Public Access" RLS hole) and the advisory pre-flight inspection queries (row count,
  dependents) as commented-out lines.

## 2. Apply to production (manual — Supabase SQL Editor)

- [x] 2.1 (Advisory) Run the inspection queries to confirm the table is empty/disposable and to
  enumerate any objects `CASCADE` would remove.
- [x] 2.2 Run `lock_down_vocabulary.sql` against the production Supabase project.

## 3. Verify

- [x] 3.1 Confirm `select to_regclass('public.vocabulary')` returns NULL.
- [x] 3.2 Confirm `select count(*) from pg_policies where tablename = 'vocabulary'` returns 0.
- [x] 3.3 Smoke-test the app (practice, vault, packs, duel) still works — it does not reference
  the table, so no behavior should change.

## 4. Commit

- [x] 4.1 Commit `flath-app/sql/lock_down_vocabulary.sql` on a feature branch.

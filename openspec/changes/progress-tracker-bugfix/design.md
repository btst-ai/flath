## Context

Four bugs in the progress-tracker feature shipped in the previous iteration. Root causes confirmed against source:

1. `avg_success_rate_prod/rec` are stored 0-100 (session.ts multiplies `*100`; seeds are `50`). `app/progress/page.tsx` treats them as 0-1 and renders `Math.round(x * 100)%` — double-scaling to ~5670%. The `buildStrugglingPool`/`buildForgettingPool` helpers use `weight = (1 - blend) + 0.1` which goes negative at blend~50, corrupting the sampling wheel.
2. `fetchStreakDates`, `fetchDistinctWords7d`, `fetchAttemptsLast30d` have no `.order()` / `.limit()`. PostgREST caps at 1000 rows in arbitrary order. ~189 cards/day over 90 days exceeds 1000; today's rows are truncated → `studiedToday=false` → streak shows 0.
3. `buildStackedBarData` generates labels as `"MM-DD"` (dashes, via `.slice(5)`) but matches them as `"MM/DD"` (slashes) — every word skips → all-zero bars.
4. `fetchWordsAdded7d` uses `.gte("added_at", since)`; rows with NULL `added_at` (from before the backfill migration ran on live) are excluded by SQL NULL semantics. Vault's default list doesn't filter on `added_at`, so those words still appear there.

## Goals / Non-Goals

**Goals:**
- Display prod/rec rates as valid 0-100% percentages.
- Restore correct selection weights in struggling/forgetting pools.
- Streak and distinct-words count correctly at any attempt volume.
- Words-added stacked bar shows non-zero bars for real additions.
- Dashboard words-added count reflects actual data.
- Unit tests encode the true production scale (0-100) for rate fixtures.

**Non-Goals:**
- Storage scale change — 0-100 is the correct contract; no other consumer changes.
- Redesigning the progress page UI/UX.
- Adding new metrics or sections.

## Decisions

### D1: Keep storage at 0-100; fix render and weight math in /progress only

**Decision:** Do NOT boundary-normalise in `fetchUserWordSettings`. Fix only the two sites in `progress/page.tsx` (render) and two weight expressions in `progressStats.ts`.

**Rationale:** 0-100 is the enforced contract across 6 other consumers (vault, packs, practice, sessionQueue) and 4 write paths. Normalising in `fetchUserWordSettings` would create a same-named field with divergent semantics across the codebase — exactly the class of bug that produced this defect. The unit tests' 0-1 fixtures were the fiction; update them to match reality.

**Alternatives considered:** Boundary-normalise at `fetchUserWordSettings` — cleaner helper tests, but creates a `WordWithSettings` interface where `avg_success_rate_*` means different things depending on where you read it. Rejected.

### D2: RPC for streak dates; order+limit for raw-attempt queries

**Decision:** Replace `fetchStreakDates` with a Postgres RPC `streak_dates(p_days, p_tz)` returning distinct dates. Guard `fetchDistinctWords7d` and `fetchAttemptsLast30d` with `.order("ts", desc).limit(N)`.

**Rationale:** The streak query only needs ≤90 distinct dates from potentially 10,000+ rows. An RPC returns O(days) data and is inherently cap-immune. The two raw-attempt queries need actual rows (for bucketing) but can use `limit(20000)` / `limit(10000)` — at ~189 cards/day these are never approached in any realistic window.

The RPC uses `Europe/Athens` as the default timezone (handles DST via IANA zone, not a fixed offset). The client computes `nowDate` using the browser's local `Date` getters — for a Greece-based user on a Greek-TZ-configured browser, the two align. This is a personal single-user app; hardcoding the timezone is acceptable.

**Alternatives considered:** Larger `.limit()` only, no RPC — simpler but leaves the streak query fetching O(attempts) rows just to dedup them to O(days). Acceptable for small volumes but not O(days)-optimal. The RPC is a one-time SQL migration in line with the existing `add_word_rpc.sql` pattern.

### D3: Fix label format mismatch in code; fix NULL added_at as data migration

**Decision:** Change the slash in line 109 of `buildStackedBarData` to a dash (one character). For NULL `added_at`: provide a re-runnable SQL backfill + `SET NOT NULL` constraint. No client-side COALESCE fallback.

**Rationale:** The label mismatch is a pure code bug with a trivial fix. The NULL issue is a data state problem — a COALESCE-in-code fallback would require client-side filtering (can't `.gte` a COALESCE in PostgREST), adding complexity. Backfill + NOT NULL is cleaner, permanent, and follows the existing `sql/README.md` pattern.

## Risks / Trade-offs

- [RPC timezone mismatch] If the user's browser TZ diverges from `Europe/Athens`, a streak computed by the RPC and today's date computed in the browser could disagree on the boundary day. → Mitigation: acceptable for this personal, single-user, Greece-located app. The previous bug (truncation) was far more severe.
- [limit(20000) still silently caps] If attempts ever exceed 20k/30d or 10k/7d, the queries would under-count. → Mitigation: ~189/day peak → 5,670 for 30d. Limit of 20k is 3.5x headroom. Log a console warning in the query on future over-limit detection (not blocking).
- [NOT NULL migration failure] If the backfill left any NULLs, the `ALTER COLUMN SET NOT NULL` fails. → Mitigation: the instruction includes a `count(*) WHERE added_at IS NULL` check before the ALTER; a non-zero count is a useful diagnostic, not a silent failure.
- [Weight change to struggling/forgetting] Changing `(1-blend)` to `(1-blend/100)` alters which words surface. Users with corrupted (negative) weights currently see arbitrary/biased results; the fix restores the intended "worse recall → more likely to surface" semantics. No data is lost.

## Migration Plan

### SQL (manual, Supabase SQL Editor — per sql/README.md pattern)

1. Create and run `sql/add_streak_rpc.sql` (new file, idempotent `CREATE OR REPLACE`).
2. Re-run `sql/add_added_at.sql` (idempotent backfill).
3. Verify `SELECT count(*) FROM user_word_settings WHERE added_at IS NULL` returns 0.
4. Run `ALTER TABLE public.user_word_settings ALTER COLUMN added_at SET NOT NULL;`.
5. Mirror both changes into `sql/schema.sql`.

### Code changes

All in `flath-app/`:
- `lib/progressStats.ts` — weight `/100` fix (2 sites).
- `lib/progressStats.test.ts` — fixture scale update + regression test.
- `app/progress/page.tsx` — render math + gap math + label `-`.
- `app/progress/queries.ts` — RPC swap + order/limit guards.

### Rollback

SQL: the RPC is `CREATE OR REPLACE` — to remove it run `DROP FUNCTION IF EXISTS streak_dates(INT, TEXT)` and revert `fetchStreakDates` to the table query. The `NOT NULL` constraint can be dropped with `ALTER COLUMN added_at DROP NOT NULL` if unexpected rows arise. Code: git revert.

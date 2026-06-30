## Why

The progress-tracker feature shipped with four defects: prod/rec success rates display as thousands of percent, the streak always shows "No streak yet" despite daily activity, words-added counts show zero on the dashboard and /progress stacked bar, and the struggling/forgetting word lists silently produce corrupted sampling weights.

## What Changes

- Fix `avg_success_rate_prod/rec` render math in `/progress`: drop the erroneous `* 100` at display — rates are stored 0-100, but progress was treating them as 0-1 fractions then scaling again.
- Fix `buildStrugglingPool` and `buildForgettingPool` weight expressions: `(1 - blend/100) + 0.1` instead of `(1 - blend) + 0.1` to prevent negative weights when blend is on the 0-100 scale.
- Fix the PostgREST 1000-row cap on streak and attempt queries: replace `fetchStreakDates` with an RPC returning distinct dates (immune to the cap), add `.order+.limit` guards to the two raw-attempt queries.
- Fix the chart label format mismatch in `buildStackedBarData`: generated labels use `"MM-DD"` (dashes) but matching uses `"MM/DD"` (slashes), so every word is skipped.
- Fix NULL `added_at` on `user_word_settings`: provide a one-time SQL backfill and add a `NOT NULL` constraint to prevent recurrence.
- Update unit-test fixtures from 0-1 to 0-100 to match the true production scale.

## Capabilities

### New Capabilities

None. This is a bugfix-only change.

### Modified Capabilities

- `progress-tracker`: four implementation defects in the initial delivery; requirements are unchanged, correctness is not.

## Impact

- `flath-app/app/progress/page.tsx` — render math, gap math, chart label format
- `flath-app/app/progress/queries.ts` — RPC swap for streak dates, order+limit guards
- `flath-app/lib/progressStats.ts` — weight `/100` fix in two pool functions
- `flath-app/lib/progressStats.test.ts` — fixture scale update + regression test
- `flath-app/sql/add_streak_rpc.sql` (new), `flath-app/sql/schema.sql` (mirror RPC + NOT NULL)
- No changes to storage scale, no impact on vault/packs/practice/sessionQueue consumers

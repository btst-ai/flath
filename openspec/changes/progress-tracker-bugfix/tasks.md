## 1. SQL Migrations (manual — run in Supabase SQL Editor)

- [x] 1.1 Create `flath-app/sql/add_streak_rpc.sql` with `CREATE OR REPLACE FUNCTION public.streak_dates(p_days INT DEFAULT 90, p_tz TEXT DEFAULT 'Europe/Athens')` returning distinct local-day dates from `attempts_history` for `auth.uid()`, ordered ascending
- [x] 1.2 Update `flath-app/sql/schema.sql` to document the `streak_dates` RPC alongside existing RPCs
- [x] 1.3 Update `flath-app/sql/schema.sql` line 154 to mark `added_at TIMESTAMPTZ NOT NULL DEFAULT now()` (mirror live state after migration)

## 2. Fix prod/rec scale and pool weights

- [x] 2.1 In `flath-app/lib/progressStats.ts` `buildStrugglingPool` (line 96): change `weight: (1 - blend) + 0.1` to `weight: (1 - blend / 100) + 0.1`
- [x] 2.2 In `flath-app/lib/progressStats.ts` `buildForgettingPool` (line 123): apply the same `/100` fix
- [x] 2.3 Add a one-line doc comment above both pool functions noting they expect `avg_success_rate_*` on the 0-100 storage scale

## 3. Fix prod/rec display math in progress page

- [x] 3.1 In `flath-app/app/progress/page.tsx` line ~332: change `{Math.round(prodAvg * 100)}%` to `{Math.round(prodAvg)}%`
- [x] 3.2 In `flath-app/app/progress/page.tsx` line ~336: apply the same fix for `recAvg`
- [x] 3.3 In `flath-app/app/progress/page.tsx` gap block (lines ~339-345): change threshold `lineGap > 0.1` to `lineGap > 10` and drop `* 100` from `Math.round((recAvg - prodAvg) * 100)` expressions in both branches

## 4. Fix streak query (PostgREST cap)

- [x] 4.1 In `flath-app/app/progress/queries.ts` `fetchStreakDates` (lines 13-28): replace the `.from("attempts_history").select("ts")...` query with `supabase.rpc("streak_dates", { p_days: 90, p_tz: "Europe/Athens" })` and map results `(r: { day: string }) => r.day`; rename the `userId` param to `_userId`
- [x] 4.2 Remove the now-unused `toLocalDateString` helper function (lines 4-10) from `queries.ts`
- [x] 4.3 In `flath-app/app/progress/queries.ts` `fetchDistinctWords7d` (lines 30-45): add `.order("ts", { ascending: false }).limit(10000)` before the closing semicolon
- [x] 4.4 In `flath-app/app/progress/queries.ts` `fetchAttemptsLast30d` (lines 64-81): add `.order("ts", { ascending: false }).limit(20000)`

## 5. Fix words-added stacked bar label format

- [x] 5.1 In `flath-app/app/progress/page.tsx` `buildStackedBarData` line ~109: change the slash separator to a dash — `${MM}/${DD}` → `${MM}-${DD}` — so it matches the generated labels at line 92

## 6. Update unit tests to 0-100 scale

- [x] 6.1 In `flath-app/lib/progressStats.test.ts` `makeWord` fixture (lines 31-32): change `avg_success_rate_prod: 0.5, avg_success_rate_rec: 0.5` to `50, 50`
- [x] 6.2 Update any `buildStrugglingPool` weight assertion (if present) to reflect 0-100 inputs: rates 50/50 → blend 50 → `1 - 50/100 + 0.1` = 0.6; update the inline comment
- [x] 6.3 Add a regression test: word with rates 100/100 has struggling weight = 0.1; word with rates 0/0 has weight = 1.1
- [x] 6.4 Run `npm test` in `flath-app/` and confirm all tests pass

## 7. Verification

- [ ] 7.1 Open `/progress` in the running app and confirm prod vs rec shows 0-100% values (e.g. ~57%, not 5670%)
- [ ] 7.2 Confirm the gap sentence shows a sane `Npp` difference
- [ ] 7.3 Reveal struggling and forgetting lists — confirm they populate with plausible words (previously empty/broken due to negative weights)
- [ ] 7.4 Confirm the words-added stacked bar shows non-zero bars on days words were added
- [ ] 7.5 Do at least one card practice then reload dashboard — confirm streak shows "N day streak 🔥" (not "No streak yet") — requires the RPC to be deployed in Supabase first (run sql/add_streak_rpc.sql in Supabase SQL Editor)
- [ ] 7.6 Check dashboard "Added (7d)" count is non-zero (requires re-running sql/add_added_at.sql backfill in Supabase SQL Editor, then verifying 0 NULLs, then ALTER COLUMN SET NOT NULL)

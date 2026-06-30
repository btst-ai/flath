## 1. Test infrastructure

- [x] 1.1 Add `vitest` devDependency and `"test": "vitest run"` script to `flath-app/package.json`
- [x] 1.2 Create `flath-app/vitest.config.ts` with minimal config (include `lib/**/*.test.ts`)

## 2. Pure stats helpers (`lib/progressStats.ts`)

- [x] 2.1 Implement `computeStreak(dates: string[], nowDate: string): { streak: number; missed: number; studiedToday: boolean }` — walk back from nowDate over sorted distinct calendar-date strings, apply one-day grace (single gap keeps streak, increments missed; two consecutive gaps reset)
- [x] 2.2 Implement `weightedBlendSuccess(prodRate: number, recRate: number, prodCount: number, recCount: number): number` — review-count-weighted blend; return 0 if total count is 0
- [x] 2.3 Implement `weightedAverage(rows: Array<{ rate: number; count: number }>): number` — `sum(rate*count)/sum(count)`; return 0 if sum(count) is 0
- [x] 2.4 Implement `weightedSample<T>(pool: Array<{ item: T; weight: number }>, k: number, rng: () => number): T[]` — roulette-wheel without replacement; return whole pool if pool.length <= k
- [x] 2.5 Implement `buildStrugglingPool(settings: UserWordSetting[]): Array<{ item: UserWordSetting; weight: number }>` — filter to non-archived, review_count >= 3; weight = (1 - blendedSuccess) + 0.1
- [x] 2.6 Implement `buildForgettingPool(settings: UserWordSetting[], nowMs: number): Array<{ item: UserWordSetting; weight: number }>` — filter to last_mistake_at < now-7d AND last_reviewed < now-7d; weight = (1 - blendedSuccess) + 0.1
- [x] 2.7 Implement `bucketByDay(attempts: Array<{ ts: string; wordId: string; outcome: string }>, nowMs: number, days: number): DayBucket[]` — 30 calendar-day buckets, zero-filled, counting total/distinct/know per day (user local timezone via `toLocaleDateString`)

## 3. Unit tests (`lib/progressStats.test.ts`)

- [x] 3.1 `computeStreak` tests: studied every day incl today → streak intact; single gap mid-run → streak continues, missed++; two consecutive gaps → streak resets; today pending → studiedToday false; empty history → 0; non-consecutive single gaps accumulate missed correctly
- [x] 3.2 `weightedSample` tests: pool < k → returns whole pool; pool == k → returns all once; deterministic with seeded rng; statistical ordering (10k draws, high-weight item picked more than low-weight); zero-length pool → []
- [x] 3.3 `weightedBlendSuccess` / `weightedAverage` tests: known numeric inputs → exact expected; zero total count → 0 (no NaN/crash)
- [x] 3.4 `buildStrugglingPool` tests: excludes archived; excludes review_count < 3; weight formula correct
- [x] 3.5 `buildForgettingPool` tests: excludes last_reviewed within 7d; excludes last_mistake_at within 7d; includes word with both criteria met
- [x] 3.6 `bucketByDay` tests: 30 days produced; zero-filled day present; cards/distinct/know counts correct on fixture

## 4. SVG chart components (`components/charts/`)

- [x] 4.1 Create `components/charts/LineChartMulti.tsx` — multi-series polyline SVG; accepts `series: Array<{ label: string; color: string; values: number[] }>` and `labels: string[]`; zero-line reference; role="img" + aria-label; responsive via viewBox + width 100%
- [x] 4.2 Create `components/charts/PieChart.tsx` — single-series pie SVG with legend; accepts `slices: Array<{ label: string; value: number; color: string }>`; role="img" + aria-label; handles single-slice (full circle)
- [x] 4.3 Create `components/charts/StackedBarChart.tsx` — daily stacked bars SVG; accepts `days: string[]; series: Array<{ label: string; color: string; values: number[] }>`; zero-filled bars; role="img" + aria-label
- [x] 4.4 Create `components/charts/index.ts` — re-export all chart components

## 5. Supabase fetch layer (`app/progress/queries.ts`)

- [x] 5.1 `fetchStreakDates(userId)` — select distinct `ts` from `attempts_history` last 90 days, return as local-timezone date strings; check error, throw/toast on failure
- [x] 5.2 `fetchDistinctWords7d(userId)` — count distinct word_id in `attempts_history` last 7 days; return number
- [x] 5.3 `fetchWordsAdded7d(userId)` — count in `user_word_settings` where added_at >= now()-7d; return number
- [x] 5.4 `fetchAttemptsLast30d(userId)` — select ts, word_id, outcome from `attempts_history` last 30 days; return raw rows
- [x] 5.5 `fetchUserWordSettings(userId)` — select user_word_settings joined to words_dim (greek_text, theme, part_of_speech) for non-archived words; return joined rows
- [x] 5.6 `fetchDuelSummary(userId)` — select winner, p1_user_id, p2_user_id from `duels` where p1 or p2 = userId; return rows; check error
- [x] 5.7 `fetchWordsAddedLast30d(userId)` — select added_at, word_id joined to words_dim.theme from user_word_settings where added_at >= now()-30d

## 6. Dashboard updates (`app/page.tsx`)

- [x] 6.1 Add `fetchStreakDates`, `fetchDistinctWords7d`, `fetchWordsAdded7d` calls in a `useEffect` keyed on `userId`; store results in state; show "—" while loading
- [x] 6.2 Render the three-metric row (streak display, distinct words, words added) between the title `<div>` and the authenticated button column; only when `isAuthenticated`
- [x] 6.3 Add "Show Progress" button below "Manage Vocabulary" and above "Sign Out" with `BarChart3` icon from lucide-react, white/bordered style, `onClick={() => router.push("/progress")}`
- [x] 6.4 Streak copy logic: if `studiedToday` → "N day streak 🔥 · M missed"; else → "Day N in reach · M missed" (streak = 0 → "No streak yet")

## 7. Progress page (`app/progress/page.tsx`)

- [x] 7.1 Create `app/progress/page.tsx` as a client component; auth check on mount, redirect to `/login` if unauthenticated; loading spinner while fetching
- [x] 7.2 Fetch all data on mount (calls from queries.ts); compute derived data via progressStats helpers; store in state
- [x] 7.3 Render section 1: `LineChartMulti` with three series (cards red, distinct yellow, know-outcomes green) from `bucketByDay` results; section heading "Last 30 days"
- [x] 7.4 Render section 2: struggling words — reveal button (toggle state); when open, show up to 5 Greek words from `weightedSample(buildStrugglingPool(...), 5, Math.random)`; empty pool → "You're all good 👍"
- [x] 7.5 Render section 3: forgetting words — reveal button (toggle state); same pattern as section 2 using `buildForgettingPool`; empty pool → "You're all good 👍"
- [x] 7.6 Render section 4: prod vs rec — two large percentage values with labels; weighted averages computed via `weightedAverage`; short caption if gap > 10pp
- [x] 7.7 Render section 5: `PieChart` with theme slices from distinct words in last 30d; null/empty theme → "Untagged"
- [x] 7.8 Render section 6: `StackedBarChart` from words-added-per-day data; theme as stack series; null theme → "Untagged"
- [x] 7.9 Render section 7: duel W/L/T counts from `fetchDuelSummary` result; plain stat display

## 8. Verification

- [x] 8.1 Run `npm test` in `flath-app/`; confirm all unit tests in `lib/progressStats.test.ts` pass; report output
- [x] 8.2 Run `npm run build` in `flath-app/`; confirm build succeeds with no type errors
- [x] 8.3 Run `npm run lint`; confirm no new lint errors
- [ ] 8.4 Start dev server; sign in; verify three header metrics render between title and buttons; verify streak copy flips correctly (today studied vs not)
- [ ] 8.5 Click "Show Progress"; verify navigation to `/progress`; verify all seven sections render in correct order
- [ ] 8.6 Verify struggling list: reveal button toggles Greek-only words; words vary across page reloads (weighted-random); empty pool shows "You're all good 👍"
- [ ] 8.7 Verify forgetting list: same behaviour; cross-check 1-2 displayed words against user_word_settings manually
- [ ] 8.8 Verify prod vs rec values match manual weighted-average computation from user_word_settings data
- [ ] 8.9 Verify responsive at 1280 / 768 / 375px — no overflow, charts legible, metric row wraps gracefully on mobile
- [ ] 8.10 Verify duel W/L/T counts are correct for the authenticated user
NOTE: 8.4-8.10 require authenticated browser session — verified unauthenticated redirect to /login works correctly via preview tool.

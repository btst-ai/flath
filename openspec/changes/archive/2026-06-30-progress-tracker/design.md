## Context

The app is a Next.js 16 / React 19 vocabulary trainer backed by Supabase. Data access is direct `supabase.from(...)` client calls — no React Query or server-components data-fetching pattern. The codebase has zero test infrastructure (no vitest/jest, no test files). All relevant data already exists in `attempts_history`, `user_word_settings`, `words_dim`, and `duels`; no schema changes are required.

The existing custom SVG chart is `app/duel/EvolutionChart.tsx` — a pure-SVG polyline chart with no external library.

## Goals / Non-Goals

**Goals:**
- Three header metrics on the dashboard (streak, distinct words 7d, words added 7d).
- "Show Progress" button → new `/progress` page.
- `/progress` page with seven sections in specified order.
- Pure-function stats helpers that are unit-tested with vitest.
- All surfaces (desktop + mobile + PWA), no surface gate.

**Non-Goals:**
- Schema changes (`attempts_history` session-type column, cumulative mastery events).
- "One-tap practice" from the struggling/forgetting lists (phase 2).
- Best-time-of-day analysis.
- Server-side rendering of the progress page (client component is fine; matches the rest of the app).

## Decisions

### D1: Hand-rolled SVG charts, no new runtime dependency

**Decision:** Build all four chart types (multi-series line, pie, stacked bar, two-bar comparison) as pure SVG components following `EvolutionChart.tsx`'s pattern. No recharts or similar.

**Alternatives considered:**
- `recharts` (~100 KB gzip) would cut chart code by ~70%. Rejected because the app currently has zero runtime chart dependencies; adding one for four simple charts is disproportionate weight. The pie and stacked-bar shapes are well within what hand-rolled SVG handles cleanly, and the pattern is already established in the codebase.

**Trade-off:** More code (~300-400 lines of SVG math vs. ~80 lines of recharts). Accepted.

### D2: Pure-function stats layer with injected `now` and `rng`

**Decision:** All non-trivial logic lives in `lib/progressStats.ts` as pure functions. `now` (a `Date`) and `rng` (a `() => number` PRNG) are injected parameters so tests are deterministic.

Supabase fetching lives in a thin `app/progress/queries.ts` that calls the pure helpers with real `now` / `Math.random`.

**Why:** The streak grace logic and weighted sampler are the highest-risk pieces. They must be unit-testable without a running DB or real time.

### D3: Vitest as the test runner

**Decision:** Add `vitest` (devDep only, ~2 MB, zero runtime cost). Add `"test": "vitest run"` to `package.json`. Single config file `vitest.config.ts` pointing at `flath-app/`.

**Alternatives considered:**
- Jest: heavier config for a Next 16 project, needs babel or ts-jest shim. Vitest is native to Vite-based tooling and works out of the box with TypeScript.
- No runner (manual Node script): rejected — the streak/sampler edge cases (timezone boundary, two-miss reset, weighted frequency distribution) are exactly where eyeballing fails.

### D4: Streak computed client-side from a lookback window

**Decision:** Fetch distinct calendar dates (local timezone, user's browser) from `attempts_history` for the last 90 days. Walk back from today in the stats helper. 90-day cap is enough for any realistic streak while keeping the query cheap (one `select distinct date_trunc('day', ts)` equivalent via client-side grouping after fetching raw `ts` values).

**Why not a DB function:** The rest of the app never uses Postgres functions for client-side computation. Staying consistent avoids introducing a new pattern.

### D5: Weighted-random sampler with injected PRNG (roulette-wheel without replacement)

**Decision:** Implement roulette-wheel (fitness-proportionate) sampling without replacement. Weight = `(1 - blendedSuccess) + 0.1`. Floor of 0.1 ensures even a 90%-success word has a small non-zero chance of surfacing, preventing permanent staleness for "almost-good" words.

`blendedSuccess` for each word = `weightedBlendSuccess(prod_rate, rec_rate, prod_count, rec_count)` = `(prod_rate * prod_count + rec_rate * rec_count) / (prod_count + rec_count)`, with zero-count fallback to 0.

**Why roulette-wheel:** Simpler to implement and reason about than alternatives (tournament, rank-based). Produces the desired "worst words appear most, but not always" behaviour.

### D6: Chart component location — `components/charts/`

**Decision:** Place SVG chart components under `components/charts/` (e.g. `LineChartMulti.tsx`, `PieChart.tsx`, `StackedBarChart.tsx`, `TwoBarComparison.tsx`). This makes them reusable outside the progress page without a deep path import.

### D7: Pie window = 30 days (matches page window)

**Decision:** The "distinct words seen by theme" pie uses the same 30-day window as the line chart. Consistent framing for the reader.

### D8: Two-series prod-vs-rec visualised as a simple bar/stat pair, not a chart component

**Decision:** Two large percentage numbers with labels and a small caption ("you recognise more than you can produce" or similar). A full bar chart is overkill for two numbers. Implement as a styled div, not an SVG component.

## Risks / Trade-offs

- **SVG responsiveness:** Hand-rolled SVG needs explicit `viewBox` and `width="100%"` / `height="auto"` to scale. The stacked bar and pie at 375px must be verified. Mitigation: test at all three breakpoints before marking done.
- **`attempts_history` volume:** Fetching 90 days of raw `ts` values for the streak could be large for heavy users. Mitigation: select only the `ts` column (not `*`), and bucket client-side. If volume becomes a problem in future, move to a Postgres `generate_series` aggregate — not needed now.
- **Timezone boundary:** Streak date comparison must use the user's local timezone, not UTC. The `ts` column is `TIMESTAMPTZ` (UTC in DB). Client-side grouping using `new Date(ts).toLocaleDateString()` resolves in local tz. The streak test suite must include a boundary case.
- **Weighted sampler randomness in tests:** `Math.random()` is injected as `rng`, so tests pass a seeded alternative. Production passes `Math.random` directly. No issue, but the injection point must be threaded through to the stats helper signature.
- **RLS empty vs error:** Supabase RLS denials return `{data: [], error: null}`. The progress queries cannot distinguish "no data" from "access denied". Mitigation: check `data.length === 0` after a query that should always return something for an authenticated user (e.g. `user_word_settings`) and log a warning; surface a toast on any non-null error. Documented as a known limitation.

## Open Questions

*(none — all design decisions above are resolved)*

## Why

The dashboard currently shows only a title and action buttons with no feedback on study activity, giving the user no visible progress loop. Adding a streak, word-level danger signals, and a dedicated progress page closes that gap and creates a daily motivation mechanic tuned to the user's study patterns.

## What Changes

- Replace the "days active in last 7 days" header metric with a **streak counter** (consecutive days with one-day grace tolerance), showing copy that distinguishes "today done" from "today pending".
- Add two more header metrics: distinct words studied (last 7 days) and words added (last 7 days).
- Add a **"Show Progress"** button on the dashboard that routes to a new `/progress` page.
- New `/progress` page with seven sections:
  1. 30-day line chart — cards (red), distinct words seen (yellow), `know`-outcome attempts (green) per day.
  2. "Words you're struggling with" — button-revealed, Greek text only, weighted-random 5 from the lowest-success-rate pool (`review_count ≥ 3`).
  3. "Words you may be forgetting" — button-revealed, Greek text only, weighted-random 5 from words with a mistake >7 days ago not reviewed in the last 7 days.
  4. Prod vs rec average — review-count-weighted mean success rates, displayed as a two-bar comparison.
  5. Pie chart — distinct words seen by theme (30-day window).
  6. Stacked bar chart — words added per day by theme (30 days).
  7. Duels won / lost / tied.
- Add **vitest** as the first test infrastructure in the repo; pure stats helpers are extracted and unit-tested.

## Capabilities

### New Capabilities

- `progress-tracker`: Dashboard streak metric, all three header metrics, "Show Progress" button, the full `/progress` page with all seven sections, the `lib/progressStats.ts` pure-function helpers, and the `lib/progressStats.test.ts` unit test suite.

### Modified Capabilities

*(none — no existing spec-level requirements change)*

## Impact

- `app/page.tsx` — header metric row + Show Progress button added.
- `app/progress/page.tsx` — new Next.js route.
- `lib/progressStats.ts` — new pure-function stats helpers (no Supabase/React).
- `lib/progressStats.test.ts` — unit tests (vitest).
- `app/progress/queries.ts` — thin Supabase fetch layer.
- `app/progress/` chart components (SVG, no new runtime dependency).
- `package.json` + `vitest.config.ts` — vitest devDependency and `test` script added.
- No schema changes. No new runtime dependencies (vitest is devDep only).
- Reads `attempts_history`, `user_word_settings`, `words_dim`, `duels` — all already RLS-scoped per-user.

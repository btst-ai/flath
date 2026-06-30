## Why

The progress tracker shipped functional but visually rough: charts have bare numeric y-axis labels and dry `MM-DD` date formatting with no per-day hover, word lists are read-only with no way to act on them, theme sections are cluttered with long tails, and period labelling is inconsistent. These issues reduce the practical value of the page and make it harder to read at a glance.

## What Changes

- **Line chart (30-day)**: Remove y-axis numeric label; format x-axis dates as `"15 Jun"` (day + abbreviated month); add per-day hover tooltip showing date + Cards, Words seen, Know outcomes values.
- **Stacked bar chart (words added per day)**: Same three fixes as the line chart — y-axis label removal, friendly date format, per-day hover tooltip showing theme breakdown.
- **Struggling / forgetting word lists**: Add 👎 (left) and 👍 (right) tap buttons per row. Tapping records a real recognition (`rec`) review (`know` or `forgot` outcome) via `submitSessionAttempts`. Row stays visible; chosen thumb highlights. Toast feedback on success/failure.
- **Theme pie chart**: Group themes beyond top 6 into an "Others" (grey) slice.
- **Words-added stacked bar**: Group themes beyond top 6 into an "Others" (grey) series.
- **Section period labels**: Replace inline `(30d)` in section headings with a greyed italic subtitle line ("Last 30 days"). Add same subtitle to Duels section (truthful only if the query is bounded; otherwise "All time"). No `(TBD)` text anywhere.
- **Home dashboard counters**: Remove `(7d)` from "Words (7d)" and "Added (7d)" labels; add a "This week" header above the counter grid. When all three metrics are zero/null, show "Let's get started" header instead and display `0` in all counters.

## Capabilities

### New Capabilities

- `quick-word-review`: Inline know/forgot review action from the progress page word lists, recording to `attempts_history` via the existing `submitSessionAttempts` path without entering a practice session.

### Modified Capabilities

- `progress-tracker`: Chart presentation (labels, tooltips, grouping), section heading format, and home dashboard counter display changes.

## Impact

- `flath-app/components/charts/LineChartMulti.tsx` — y-axis, labels, hover state
- `flath-app/components/charts/StackedBarChart.tsx` — y-axis, labels, hover state; `days` prop interpretation (display labels vs matching keys)
- `flath-app/app/progress/page.tsx` — word list rows (thumb buttons + recording), `buildThemePieData` + `buildStackedBarData` grouping logic, section heading markup, `uid` state
- `flath-app/app/page.tsx` — counter labels, "This week"/"Let's get started" header, zero-activity detection
- `flath-app/app/actions/session.ts` — reused read-only (no changes)
- `flath-app/lib/progressStats.ts` — optionally add `topNWithOthers` helper if grouping is extracted (affects existing unit tests positively)
- No schema changes, no new Supabase tables, no new runtime dependencies

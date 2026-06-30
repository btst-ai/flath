## Context

The progress tracker (`/progress` page + home dashboard counters) is implemented across five files:
- `components/charts/LineChartMulti.tsx` — hand-rolled SVG, receives pre-formatted `labels: string[]`
- `components/charts/StackedBarChart.tsx` — hand-rolled SVG, receives `days: string[]`
- `components/charts/PieChart.tsx` — hand-rolled SVG, receives `slices: Slice[]`
- `app/progress/page.tsx` — orchestrates all data + renders all sections
- `app/page.tsx` — dashboard with 3-cell metric header

Reviews are recorded via `submitSessionAttempts` in `app/actions/session.ts` (insert to `attempts_history` + client-side `recomputeUserWordSettings` upsert). No DB triggers; no new schema. Zero runtime deps added.

## Goals / Non-Goals

**Goals:**
- Remove y-axis numeric labels from both charts
- Reformat x-axis dates to `"D Mon"` style in both charts
- Add hover/tap day tooltip to both charts
- Add 👍/👎 per-row review buttons to struggling and forgetting lists; record `rec` attempts on tap
- Group long-tail themes into "Others" in pie and stacked bar
- Replace `(30d)` heading inline qualifiers with greyed italic subtitles
- Remove `(7d)` from dashboard counter labels; add "This week"/"Let's get started" header

**Non-Goals:**
- One-tap "practice these words" flow from the word lists (requires `/practice` route to accept `word_ids` param — explicitly deferred to a later phase)
- Tooltip on PieChart slices
- Persisting the user's thumb verdicts between page loads (current session only)
- Any schema or DB function change

## Decisions

### D1: Date label format lives in the caller, not the chart component
Both `LineChartMulti` and `StackedBarChart` render whatever strings they receive via `labels`/`days` props. The format change (`MM-DD` → `D Mon`) is applied in `page.tsx` where the labels are built. This keeps the chart components format-agnostic.

**Important caveat for StackedBarChart**: `buildStackedBarData` uses the label string as a key to match `added_at` rows to day indices (line 110: `dayIndexMap.get(label)`). If the display label changes, matching breaks. Fix: build two parallel arrays — `dayKeys` (`MM-DD`, for matching) and `dayDisplayLabels` (`"15 Jun"`, for display). Pass `dayDisplayLabels` to `StackedBarChart`. The component only needs display strings; matching stays in the builder function.

Alternative considered: change the match key to full `YYYY-MM-DD`. Rejected — the builder already reconstructs `MM-DD` from `added_at`, changing both is more churn for no benefit.

### D2: Hover tooltip as HTML overlay, not SVG text
SVG `<text>` elements can't have rich layout, multiline wrap, or background boxes without significant complexity. An absolutely-positioned HTML `<div>` overlay over the SVG achieves the same result cleanly.

Implementation: wrap SVG + tooltip div in a `relative` container. Tooltip is absolutely positioned, pointer-events none. Show/hide via `hoverIdx` state. Compute left/top from `xFor(hoverIdx)` + fixed offset, clamped to avoid overflow.

Touch support: add `onTouchStart` handler on the hit-zone rects that sets `hoverIdx` and prevents the default scroll start. A tap elsewhere (document `touchstart`) clears it. This is the same pattern used for interactive SVG tooltips in plain React without a chart library.

### D3: Thumb buttons use shared `marks` state keyed by `word_id`
Track `marks: Record<string, "know" | "forgot">` at the page level (not per-list). This handles edge cases where the same word appears in both lists, and avoids duplicating state logic. Per-row pending guard (`pending: Record<string, boolean>`) prevents double-tap double-recording.

The signed-in `uid` is already available in the `loadAll(uid)` closure but not stored in state. Add `const [uid, setUid] = useState<string | null>(null)` set in the `init` effect before `loadAll`.

### D4: Top-N grouping in page.tsx builder functions, not in chart components
`buildThemePieData` and `buildStackedBarData` are already in `page.tsx`. Grouping logic is 3-4 lines each. Extracting a shared `topNWithOthers` helper to `progressStats.ts` would be cleaner for a future third caller, but with two call sites duplication is fine. Either approach is acceptable — implementer's call. If extracted, add a unit test in `progressStats.test.ts`.

The "Others" entry uses colour `#9ca3af` (neutral grey) hardcoded at the builder level, NOT pulled from `PIE_COLORS`, so it always renders grey regardless of sort position.

### D5: Row component extracted inline in page.tsx
The struggling and forgetting lists are near-identical. Extract a `WordReviewRow` function component at the top of the file (not a separate file) to avoid duplicating the thumb-button markup. It takes `word`, `mark`, `pending`, and `onMark` callback props.

### D6: Duels subtitle "All time" (not "Last 30 days")
`fetchDuelSummary` fetches all duels with no time filter. Rather than add a query filter just to make the subtitle truthful, use "All time" as the subtitle. Adding a time filter would change behaviour (users' total W/L would change) and requires checking the timestamp column name in `duels`. A separate change can do that if needed.

## Risks / Trade-offs

- **Touch tooltip conflict with scroll** → Mitigate: `onTouchStart` with `e.preventDefault()` on the hit-zone rects; test at 375px to confirm scroll still works when touching outside chart area.
- **StackedBarChart day-matching regression** → Mitigate: use separate `dayKeys` vs `dayDisplayLabels` arrays; add a spot-check scenario to the verification checklist.
- **Double-tap recording** → Mitigate: per-row `pending` boolean that disables both buttons until the request resolves.
- **`submitSessionAttempts` overhead** → Each tap triggers an insert + a full `recomputeUserWordSettings` pass (reads all attempts for that word, upserts aggregates). Acceptable for occasional taps; the function is already used this way in practice sessions.
- **`uid` not in state currently** → Small refactor: add one `useState` and one `setUid` call in the existing `init` effect. No structural change.

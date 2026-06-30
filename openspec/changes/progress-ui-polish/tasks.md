## 1. Line chart improvements (LineChartMulti.tsx)

- [x] 1.1 Remove the y-axis max `<text>` element (lines 80–83 rendering `{rawMax}`). Keep `rawMax` for scaling maths.
- [x] 1.2 Add hover state: `useState<number | null>` for `hoverIdx`; add transparent full-height `<rect>` hit-zones per day index with `onMouseEnter`/`onMouseLeave`; add `onTouchStart` on each hit-zone that sets `hoverIdx` and calls `e.preventDefault()`.
- [x] 1.3 Render hover guide: when `hoverIdx != null`, draw a vertical `<line>` at `xFor(hoverIdx)` and a small `<circle>` dot on each series at that x.
- [x] 1.4 Add HTML tooltip overlay: wrap component output in `relative` container div; render an absolutely-positioned tooltip `div` when `hoverIdx != null`, listing the formatted date (from `labels[hoverIdx]`) and each series label + value, colour-keyed. Clamp tooltip left position to avoid overflow.
- [x] 1.5 Add a document-level `touchstart` listener (via `useEffect`) that clears `hoverIdx` when touch starts outside the chart; clean up on unmount.

## 2. Date label format in page.tsx (line chart)

- [x] 2.1 Add `fmtDay` helper in `app/progress/page.tsx`: takes `YYYY-MM-DD` string, returns `"D Mon"` (e.g. `"15 Jun"`). Use month-abbrev array, no external library.
- [x] 2.2 Apply `fmtDay` to `lineDayLabels` (currently `lineBuckets.map((b) => b.date.slice(5))`): change to `lineBuckets.map((b) => fmtDay(b.date))`.

## 3. Stacked bar chart improvements (StackedBarChart.tsx)

- [x] 3.1 Remove the y-axis max `<text>` element (lines 85–88 rendering `{maxTotal}`). Keep `maxTotal` for scaling.
- [x] 3.2 Add hover state and hit-zones: same pattern as LineChartMulti — `hoverIdx` state, one transparent full-height `<rect>` per bar day index, `onMouseEnter`/`onMouseLeave`/`onTouchStart`.
- [x] 3.3 Render hover guide: vertical line at bar centre x + tooltip.
- [x] 3.4 Add HTML tooltip: date from `days[hoverIdx]`, then per-series count for that day (skip series with 0 to keep tooltip short). Colour-keyed, clamped to avoid overflow.
- [x] 3.5 Add document-level `touchstart` listener to clear `hoverIdx`; clean up on unmount.

## 4. Date label format + day-key separation in page.tsx (stacked bar)

- [x] 4.1 In `buildStackedBarData`, split labels into two arrays: `dayKeys` (keeps `MM-DD` format, used for `dayIndexMap` matching) and `dayDisplayLabels` (`fmtDay`-formatted, returned as `dayLabels` for the chart). Update the return value to use `dayDisplayLabels`.
- [x] 4.2 Fix the label used in the `wordsAdded` match loop (lines 107–110): ensure it still uses the `MM-DD` format keyed from `dayKeys`, not the display label.

## 5. Top-N + "Others" grouping

- [x] 5.1 In `buildThemePieData` (page.tsx), after sorting descending, keep the top 6 slices and collapse the rest into `{ label: "Others", value: sum, color: "#9ca3af" }` appended last (only if ≥1 leftover theme).
- [x] 5.2 In `buildStackedBarData` (page.tsx), determine the top-6 themes by total words-added sum across 30 days. Map all other themes' per-day increments into an "Others" series with colour `#9ca3af`. Add the "Others" series last only if ≥1 theme was collapsed.

## 6. Section subtitle period labels (progress/page.tsx)

- [x] 6.1 Section 5 (theme pie): remove `(30d)` from heading text → `Words seen by theme`; add `<p className="text-xs italic text-gray-400 mb-3">Last 30 days</p>` beneath the `<h2>`.
- [x] 6.2 Section 6 (stacked bar): remove `(30d)` from heading → `Words added per day by theme`; add same italic subtitle.
- [x] 6.3 Section 7 (duels): add `<p className="text-xs italic text-gray-400 mb-3">All time</p>` beneath the `Duels` `<h2>`.

## 7. Word list thumb review buttons (progress/page.tsx)

- [x] 7.1 Add `uid` state: `const [uid, setUid] = useState<string | null>(null)`. In the `init` effect, set it (`setUid(data.user.id)`) before calling `loadAll`.
- [x] 7.2 Add `marks: Record<string, "know" | "forgot">` and `pending: Record<string, boolean>` state at page level.
- [x] 7.3 Extract `WordReviewRow` inline component (inside the file, not a separate file): props `{ word: UserWordSetting; mark?: "know" | "forgot"; isPending: boolean; onMark: (outcome: "know" | "forgot") => void }`. Layout: `flex items-center gap-3` — 👎 button left, Greek text centre (`flex-1 lang="el"`), 👍 button right. Active state: 👍 highlighted when `mark === "know"` (`bg-green-100 ring-2 ring-green-300 rounded-full`), 👎 highlighted when `mark === "forgot"` (`bg-red-100 ring-2 ring-red-300 rounded-full`). Both buttons disabled when `isPending`. Add `aria-label` to each button.
- [x] 7.4 Add `handleMark` async function: takes `wordId` and `outcome`; sets `pending[wordId] = true`; calls `submitSessionAttempts(uid, [{ word_id: wordId, mode: "rec", outcome, interest_interaction: "none" }])`; on success sets `marks[wordId] = outcome` and toasts `"Recorded 👍"` / `"Recorded 👎"`; on error toasts the error message; clears `pending[wordId]` in both cases.
- [x] 7.5 Import `submitSessionAttempts` from `@/app/actions/session` and `toast` from `sonner` (if not already imported).
- [x] 7.6 Replace the `<ul>` block in the struggling section (lines 276–288) with `WordReviewRow` per word, passing `mark={marks[w.word_id]}`, `isPending={pending[w.word_id] ?? false}`, and `onMark={(outcome) => handleMark(w.word_id, outcome)}`.
- [x] 7.7 Replace the `<ul>` block in the forgetting section (lines 309–321) with `WordReviewRow` using the same props pattern.

## 8. Dashboard counter polish (app/page.tsx)

- [x] 8.1 Add zero-activity detection: `const noActivity = (streakResult?.streak ?? 0) === 0 && !distinctWords7d && !wordsAdded7d;`.
- [x] 8.2 Add a header line above the 3-counter grid: `<p className="text-xs text-gray-400 mb-2 text-center">{noActivity ? "Let's get started" : "This week"}</p>`.
- [x] 8.3 Change "Words (7d)" label to "Words" (line 127).
- [x] 8.4 Change "Added (7d)" label to "Added" (line 133).
- [x] 8.5 Change the `?? "—"` fallback on `distinctWords7d` and `wordsAdded7d` to `?? (noActivity ? 0 : "—")` so zero-activity state shows `0` not `—`.

## 9. Verification

- [x] 9.1 Run `npm test` in `flath-app/` — all 34 tests pass.
- [x] 9.2 Run `npm run build` in `flath-app/` — no type errors on touched files.
- [x] 9.3 Y-axis label removed from LineChartMulti (confirmed via grep — only rawMax used for scaling). fmtDay applied to lineDayLabels. Hover/tooltip wired (hoverIdx, containerRef, hit-zones, guide line, HTML overlay).
- [x] 9.4 Y-axis label removed from StackedBarChart. dayKeys/dayDisplayLabels split preserves MM-DD matching. fmtDay applied to display labels. Hover tooltip wired.
- [x] 9.5 buildThemePieData and buildStackedBarData both collapse beyond top-6 into grey #9ca3af "Others".
- [ ] 9.6 Manual: Reveal struggling words; confirm 👎 left / 👍 right per row. Tap 👍 → toast "Recorded 👍", green thumb highlights, row stays.
- [ ] 9.7 Manual: Tap 👎 on a forgetting word → toast "Recorded 👎", red thumb highlights.
- [x] 9.8 Section headings confirmed: no (30d); italic subtitles present (lines 446, 458, 470 in progress/page.tsx). Duels shows "All time".
- [x] 9.9 Dashboard labels confirmed: "Words" (line 132) / "Added" (line 138). "This week"/"Let's get started" header at line 122.
- [ ] 9.10 Manual: sign in with a zero-activity account to confirm "Let's get started" + 0 counters.

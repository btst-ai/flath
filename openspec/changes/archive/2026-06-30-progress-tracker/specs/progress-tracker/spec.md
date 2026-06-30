## ADDED Requirements

### Requirement: Dashboard displays streak metric
The dashboard SHALL show a streak counter as the first header metric, counting consecutive calendar days (in the user's local timezone) that have at least one attempt recorded in `attempts_history`. A single missed calendar day SHALL NOT break the streak but SHALL increment a `missed` counter; two consecutive missed calendar days SHALL reset the streak. Today SHALL be treated as pending (not a miss) until at least one attempt is recorded for today. The streak metric copy SHALL distinguish between "today done" and "today pending".

#### Scenario: Streak achieved today
- **WHEN** the authenticated user has studied today (at least one attempt with `ts` on today's date)
- **THEN** the dashboard shows "N day streak 🔥 · M missed" where N is the consecutive-day count and M is the single-gap-day count within that run

#### Scenario: Streak pending today
- **WHEN** the authenticated user has not yet studied today but has an active streak from prior days
- **THEN** the dashboard shows "Day N in reach · M missed" (forward-looking, no guilt)

#### Scenario: Single gap day preserved
- **WHEN** the user's `attempts_history` has a one-day gap within an otherwise consecutive run
- **THEN** the streak continues across that gap and `missed` increments by 1

#### Scenario: Two consecutive missed days reset streak
- **WHEN** the user's `attempts_history` has two consecutive calendar days with no attempts
- **THEN** the streak resets to the length of the run since the last break, and `missed` resets to 0

#### Scenario: No history
- **WHEN** the authenticated user has no rows in `attempts_history`
- **THEN** the streak shows 0 and no missed count

### Requirement: Dashboard displays distinct-words and words-added metrics
The dashboard SHALL show two additional header metrics between the title and the action buttons: the count of distinct words studied in the last 7 days and the count of words added in the last 7 days. Both metrics SHALL show "—" while loading and SHALL surface a Sonner toast on Supabase error.

#### Scenario: Metrics render for authenticated user
- **WHEN** an authenticated user loads the dashboard
- **THEN** the header area shows three metric cells (streak, distinct-words-7d, words-added-7d) between the title and the action buttons

#### Scenario: Unauthenticated user sees no metrics
- **WHEN** the user is not authenticated
- **THEN** no metric row is rendered

### Requirement: Dashboard has Show Progress button
The dashboard SHALL include a "Show Progress" button below the "Manage Vocabulary" button and above "Sign Out". Clicking it SHALL navigate to the `/progress` route.

#### Scenario: Button navigates to progress page
- **WHEN** the authenticated user clicks "Show Progress"
- **THEN** the app navigates to `/progress`

### Requirement: Progress page renders all seven sections in order
The `/progress` page SHALL render seven sections in the following order for authenticated users: (1) 30-day line chart, (2) struggling words list, (3) forgetting words list, (4) prod vs rec average, (5) theme pie chart, (6) words-added stacked bar, (7) duel W/L/T summary. Unauthenticated users SHALL be redirected to `/login`.

#### Scenario: All sections present in DOM order
- **WHEN** an authenticated user visits `/progress`
- **THEN** all seven sections render in the specified order with no sections missing

#### Scenario: Unauthenticated redirect
- **WHEN** a user visits `/progress` without being authenticated
- **THEN** the app redirects to `/login`

### Requirement: 30-day line chart shows three series
The line chart SHALL plot three series per calendar day over the last 30 days: total attempt count (red), distinct `word_id` count (yellow), and count of attempts with `outcome = 'know'` (green). Days with no attempts SHALL appear as zero-filled buckets (no gaps in the series).

#### Scenario: Three coloured series rendered
- **WHEN** an authenticated user visits `/progress` and has attempt data in the last 30 days
- **THEN** the chart renders three polylines (red, yellow, green) with a label/legend identifying each

#### Scenario: Zero-filled days
- **WHEN** there are calendar days within the 30-day window with no attempts
- **THEN** those days appear in the chart with value 0, not omitted

### Requirement: Struggling words list is button-revealed and weighted-random
The struggling words section SHALL show a reveal button. When clicked, it SHALL display up to 5 Greek words selected by weighted-random sampling (weight = `(1 - blendedSuccessRate) + 0.1`) from the pool of non-archived words with `review_count >= 3`. The list SHALL refresh (potentially show different words) on each page load. If the pool is empty, "You're all good 👍" SHALL be shown instead of a button.

#### Scenario: Reveal button toggles list
- **WHEN** the user clicks the struggling-words reveal button
- **THEN** up to 5 Greek-text words appear; clicking again hides them

#### Scenario: Empty pool shows all-good message
- **WHEN** no non-archived words have review_count >= 3
- **THEN** "You're all good 👍" is displayed with no reveal button

#### Scenario: Only review_count >= 3 words eligible
- **WHEN** a word has review_count < 3
- **THEN** it does not appear in the struggling words list

### Requirement: Forgetting words list is button-revealed and weighted-random
The forgetting words section SHALL show a reveal button. When clicked, it SHALL display up to 5 Greek words selected by weighted-random sampling from the pool of words where `last_mistake_at < now()-7d` AND `last_reviewed < now()-7d`. If the pool is empty, "You're all good 👍" SHALL be shown instead.

#### Scenario: Reveal button toggles forgetting list
- **WHEN** the user clicks the forgetting-words reveal button
- **THEN** up to 5 Greek-text words appear; only Greek text is shown (no French translation, no success rate)

#### Scenario: Word reviewed in last 7 days excluded
- **WHEN** a word has last_reviewed within the last 7 days
- **THEN** it does not appear in the forgetting words list regardless of last_mistake_at

#### Scenario: Empty pool shows all-good message
- **WHEN** no words meet the forgetting criteria
- **THEN** "You're all good 👍" is displayed with no reveal button

### Requirement: Prod vs rec average shows review-count-weighted means
The prod vs rec section SHALL display two values: the review-count-weighted mean of `avg_success_rate_prod` and the review-count-weighted mean of `avg_success_rate_rec`, computed over non-archived `user_word_settings` rows. Weighted mean = `sum(rate_i * review_count_i) / sum(review_count_i)`. A zero total count SHALL not produce NaN or a crash.

#### Scenario: Weighted averages displayed
- **WHEN** the user visits `/progress` and has non-archived words with review_count > 0
- **THEN** both prod and rec weighted average success rates are displayed as percentages

#### Scenario: Zero review count graceful
- **WHEN** all non-archived words have review_count = 0
- **THEN** the section shows a defined fallback (0% or "No data") rather than NaN or a crash

### Requirement: Theme pie shows distinct words seen by theme (30-day)
The theme pie SHALL plot the count of distinct `word_id` values in `attempts_history` over the last 30 days, grouped by `words_dim.theme`. Words with null or empty theme SHALL be bucketed as "Untagged". Each slice SHALL be labelled.

#### Scenario: Pie slices by theme
- **WHEN** the user has attempts across words from multiple themes in the last 30 days
- **THEN** the pie renders one slice per theme proportional to distinct word count

#### Scenario: Untagged bucket
- **WHEN** some words have a null or empty theme in words_dim
- **THEN** those words are grouped under an "Untagged" slice

### Requirement: Words-added stacked bar shows daily additions by theme (30-day)
The stacked bar chart SHALL plot the count of words added per calendar day over the last 30 days, stacked by `words_dim.theme`, derived from `user_word_settings.added_at`. Days with no additions SHALL be zero-filled.

#### Scenario: Bars stack by theme
- **WHEN** the user added words across multiple themes within the last 30 days
- **THEN** each day bar is stacked by theme with distinct colours

### Requirement: Duel summary shows win/loss/tie counts
The duel section SHALL display the user's total wins, losses, and ties across all duels in the `duels` table where the user is `p1_user_id` or `p2_user_id`. A win is `winner = 'p1' AND p1_user_id = me` or `winner = 'p2' AND p2_user_id = me`. Loss is the mirror. `winner = 'tie'` counts as a tie.

#### Scenario: Win/loss/tie counts correct
- **WHEN** the user has completed duels as both p1 and p2
- **THEN** wins, losses, and ties are counted correctly regardless of which player position the user occupied

### Requirement: Stats logic is pure and unit-tested via vitest
The project SHALL include vitest as a devDependency with a `test` script. All non-trivial stats logic SHALL reside in pure functions in `lib/progressStats.ts` that accept plain data and injected `now`/`rng` parameters. `lib/progressStats.test.ts` SHALL cover: streak computation (grace, two-miss reset, today-pending, empty history), weighted sampling (no-replacement, pool<k, deterministic with seeded rng, statistical ordering), weighted average (known inputs, zero-count graceful), pool filters (struggling eligibility, forgetting eligibility), and day-bucketing (zero-fill, correct series counts).

#### Scenario: npm test passes
- **WHEN** `npm test` is run in the `flath-app/` directory
- **THEN** all unit tests in `lib/progressStats.test.ts` pass with no failures

#### Scenario: Pure functions have no side effects
- **WHEN** the streak, sampler, and average helpers are called with identical inputs
- **THEN** deterministic helpers return identical results; the sampler returns the same result when given the same seeded rng

### Requirement: Progress page is responsive across all surfaces
The `/progress` page SHALL render correctly at 1280px, 768px, and 375px viewport widths. Charts SHALL not overflow their containers. The header metric row on the dashboard SHALL wrap or shrink gracefully on mobile.

#### Scenario: No horizontal overflow at 375px
- **WHEN** the `/progress` page is viewed at 375px viewport width
- **THEN** no element overflows its container and all sections are legible

### Requirement: All Supabase calls check error and toast on failure
Every Supabase query in the progress feature SHALL check the `error` field of the response. An error (including RLS-empty responses where `data = []` and `error = null` but the intent was a fetch failure) SHALL surface a Sonner toast rather than silently rendering a blank section.

#### Scenario: Supabase error surfaces toast
- **WHEN** a Supabase call in the progress feature returns an error
- **THEN** a Sonner error toast is shown and no crash occurs

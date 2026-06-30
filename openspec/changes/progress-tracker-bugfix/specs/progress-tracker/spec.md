## MODIFIED Requirements

### Requirement: Dashboard displays streak metric
The dashboard SHALL show a streak counter as the first header metric, counting consecutive calendar days (in the user's local timezone) that have at least one attempt recorded in `attempts_history`. A single missed calendar day SHALL NOT break the streak but SHALL increment a `missed` counter; two consecutive missed calendar days SHALL reset the streak. Today SHALL be treated as pending (not a miss) until at least one attempt is recorded for today. The streak metric copy SHALL distinguish between "today done" and "today pending".

The `fetchStreakDates` query SHALL use a Postgres RPC (`streak_dates`) that returns only distinct calendar dates, not raw attempt rows. This prevents the PostgREST 1000-row default cap from truncating today's rows out of a high-volume user's history, which causes `studiedToday = false` even when the user has studied today.

#### Scenario: Streak achieved today
- **WHEN** the authenticated user has studied today (at least one attempt with `ts` on today's date)
- **THEN** the dashboard shows "N day streak 🔥 · M missed" where N is the consecutive-day count and M is the single-gap-day count within that run

#### Scenario: Streak not lost due to high attempt volume
- **WHEN** the authenticated user has more than 1000 attempts in the last 90 days and has studied today
- **THEN** the streak still shows as "N day streak 🔥", not "No streak yet"

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

### Requirement: Struggling words list is button-revealed and weighted-random
The struggling words section SHALL show a reveal button. When clicked, it SHALL display up to 5 Greek words selected by weighted-random sampling (weight = `(1 - blendedSuccessRate/100) + 0.1`) from the pool of non-archived words with `review_count >= 3`. The `blendedSuccessRate` is on the 0-100 stored scale; the weight expression SHALL divide by 100 to produce a valid 0-1 probability range. The list SHALL refresh (potentially show different words) on each page load. If the pool is empty, "You're all good 👍" SHALL be shown instead of a button.

#### Scenario: Reveal button toggles list
- **WHEN** the user clicks the struggling-words reveal button
- **THEN** up to 5 Greek-text words appear; clicking again hides them

#### Scenario: Empty pool shows all-good message
- **WHEN** no non-archived words have review_count >= 3
- **THEN** "You're all good 👍" is displayed with no reveal button

#### Scenario: Only review_count >= 3 words eligible
- **WHEN** a word has review_count < 3
- **THEN** it does not appear in the struggling words list

#### Scenario: Weight never negative
- **WHEN** a word has `avg_success_rate_prod` or `avg_success_rate_rec` at maximum (100)
- **THEN** its sampling weight is at least 0.1 (never negative)

### Requirement: Forgetting words list is button-revealed and weighted-random
The forgetting words section SHALL show a reveal button. When clicked, it SHALL display up to 5 Greek words selected by weighted-random sampling (weight = `(1 - blendedSuccessRate/100) + 0.1`) from the pool of words where `last_mistake_at < now()-7d` AND `last_reviewed < now()-7d`. The weight expression SHALL use the 0-100 stored scale divided by 100. If the pool is empty, "You're all good 👍" SHALL be shown instead.

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
The prod vs rec section SHALL display two values: the review-count-weighted mean of `avg_success_rate_prod` and the review-count-weighted mean of `avg_success_rate_rec`, computed over non-archived `user_word_settings` rows. The stored values are on a 0-100 scale; the weighted mean SHALL be displayed directly as a percentage (e.g. 57%) without an additional `* 100` multiplication. A zero total count SHALL not produce NaN or a crash.

#### Scenario: Weighted averages displayed as valid percentages
- **WHEN** the user visits `/progress` and has non-archived words with review_count > 0
- **THEN** both prod and rec weighted average success rates are displayed as percentages between 0% and 100%

#### Scenario: Zero review count graceful
- **WHEN** all non-archived words have review_count = 0
- **THEN** the section shows a defined fallback (0% or "No data") rather than NaN or a crash

### Requirement: Words-added stacked bar shows daily additions by theme (30-day)
The stacked bar chart SHALL plot the count of words added per calendar day over the last 30 days, stacked by `words_dim.theme`, derived from `user_word_settings.added_at`. Days with no additions SHALL be zero-filled. Day label keys SHALL use the same `"MM-DD"` format for both label generation and word-to-bucket matching.

#### Scenario: Bars stack by theme
- **WHEN** the user added words across multiple themes within the last 30 days
- **THEN** each day bar is stacked by theme with distinct colours

#### Scenario: Bar chart reflects actual additions
- **WHEN** the user added words in the last 30 days
- **THEN** the stacked bar shows non-zero counts on those days (not all-zero)

### Requirement: Stats logic is pure and unit-tested via vitest
The project SHALL include vitest as a devDependency with a `test` script. All non-trivial stats logic SHALL reside in pure functions in `lib/progressStats.ts` that accept plain data and injected `now`/`rng` parameters. Unit test fixtures for `avg_success_rate_prod` and `avg_success_rate_rec` SHALL use the production 0-100 scale (e.g. `50`, not `0.5`) to match the true stored values. `lib/progressStats.test.ts` SHALL cover: streak computation (grace, two-miss reset, today-pending, empty history), weighted sampling (no-replacement, pool<k, deterministic with seeded rng, statistical ordering), weighted average (known inputs, zero-count graceful), pool filters (struggling eligibility with correct weight direction on 0-100 scale, forgetting eligibility), and day-bucketing (zero-fill, correct series counts).

#### Scenario: npm test passes
- **WHEN** `npm test` is run in the `flath-app/` directory
- **THEN** all unit tests in `lib/progressStats.test.ts` pass with no failures

#### Scenario: Pure functions have no side effects
- **WHEN** the streak, sampler, and average helpers are called with identical inputs
- **THEN** deterministic helpers return identical results; the sampler returns the same result when given the same seeded rng

#### Scenario: Weight direction correct on production scale
- **WHEN** a word has rates 100/100 (perfect recall)
- **THEN** its struggling weight is 0.1 (minimum, least likely to be sampled)
- **WHEN** a word has rates 0/0 (no recall)
- **THEN** its struggling weight is 1.1 (maximum, most likely to be sampled)

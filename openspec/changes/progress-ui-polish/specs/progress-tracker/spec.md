## MODIFIED Requirements

### Requirement: 30-day line chart shows three series
The line chart SHALL plot three series per calendar day over the last 30 days: total attempt count (red), distinct `word_id` count (yellow), and count of attempts with `outcome = 'know'` (green). Days with no attempts SHALL appear as zero-filled buckets (no gaps in the series). The chart SHALL NOT display a y-axis numeric label. X-axis date labels SHALL be formatted as `"D Mon"` (e.g. `"15 Jun"`) rather than `MM-DD`. The chart SHALL support a per-day hover/tap interaction that shows a tooltip with the date and the three series values for that day.

#### Scenario: Three coloured series rendered
- **WHEN** an authenticated user visits `/progress` and has attempt data in the last 30 days
- **THEN** the chart renders three polylines (red, yellow, green) with a label/legend identifying each

#### Scenario: Zero-filled days
- **WHEN** there are calendar days within the 30-day window with no attempts
- **THEN** those days appear in the chart with value 0, not omitted

#### Scenario: No y-axis numeric label
- **WHEN** the chart renders
- **THEN** no numeric value is shown on the y-axis

#### Scenario: Friendly x-axis date format
- **WHEN** the chart renders x-axis tick labels
- **THEN** they read as `"D Mon"` format (e.g. `"15 Jun"`, `"1 Jul"`) not `MM-DD`

#### Scenario: Hover tooltip shows day values
- **WHEN** the user hovers over (desktop) or taps (mobile) a day position on the chart
- **THEN** a tooltip appears showing the date and the Cards, Words seen, and Know outcomes values for that day

### Requirement: Words-added stacked bar shows daily additions by theme (30-day)
The stacked bar chart SHALL plot the count of words added per calendar day over the last 30 days, stacked by `words_dim.theme`, derived from `user_word_settings.added_at`. Days with no additions SHALL be zero-filled. Themes beyond the top 6 (by total words added over the period) SHALL be collapsed into a single "Others" series coloured grey (`#9ca3af`). The chart SHALL NOT display a y-axis numeric label. X-axis date labels SHALL be formatted as `"D Mon"`. The chart SHALL support a per-day hover/tap tooltip showing the date and per-theme counts.

#### Scenario: Bars stack by theme
- **WHEN** the user added words across multiple themes within the last 30 days
- **THEN** each day bar is stacked by theme with distinct colours

#### Scenario: Top-6 grouping
- **WHEN** words have been added across more than 6 themes
- **THEN** at most 7 series render: the 6 largest themes by total additions plus a grey "Others" series

#### Scenario: No y-axis numeric label
- **WHEN** the stacked bar chart renders
- **THEN** no numeric value is shown on the y-axis

#### Scenario: Friendly x-axis date format
- **WHEN** the stacked bar chart renders x-axis tick labels
- **THEN** they read as `"D Mon"` format, not `MM-DD`

#### Scenario: Hover tooltip shows day breakdown
- **WHEN** the user hovers over (desktop) or taps (mobile) a bar
- **THEN** a tooltip appears showing the date and per-theme word counts for that day (themes with 0 omitted)

### Requirement: Theme pie shows distinct words seen by theme (30-day)
The theme pie SHALL plot the count of distinct `word_id` values in `attempts_history` over the last 30 days, grouped by `words_dim.theme`. Words with null or empty theme SHALL be bucketed as "Untagged". Each slice SHALL be labelled. Themes beyond the top 6 (by distinct word count) SHALL be collapsed into a single grey "Others" slice.

#### Scenario: Pie slices by theme
- **WHEN** the user has attempts across words from multiple themes in the last 30 days
- **THEN** the pie renders one slice per theme proportional to distinct word count

#### Scenario: Untagged bucket
- **WHEN** some words have a null or empty theme in words_dim
- **THEN** those words are grouped under an "Untagged" slice

#### Scenario: Top-6 grouping
- **WHEN** words span more than 6 themes
- **THEN** at most 7 slices render: the 6 largest themes plus a grey "Others" slice

### Requirement: Section headings use subtitle pattern for period labels
Section headings for "Words seen by theme", "Words added per day by theme", and "Duels" SHALL NOT include inline period qualifiers (e.g. `(30d)`) in the heading text. Each SHALL display a greyed italic subtitle line beneath the heading reading "Last 30 days" (or "All time" for Duels if the query is not time-bounded).

#### Scenario: No (30d) in headings
- **WHEN** the user views `/progress`
- **THEN** section headings do not contain `(30d)` or similar inline qualifiers

#### Scenario: Greyed italic subtitle present
- **WHEN** the user views a section with a period qualifier
- **THEN** a greyed italic line appears beneath the heading (e.g. "Last 30 days")

### Requirement: Dashboard displays distinct-words and words-added metrics
The dashboard SHALL show two additional header metrics between the title and the action buttons: the count of distinct words studied in the last 7 days and the count of words added in the last 7 days. Both labels SHALL read "Words" and "Added" without a `(7d)` suffix. A "This week" header SHALL appear above the three-metric grid. When all three metrics are zero or null (no activity), the header SHALL read "Let's get started" and all counters SHALL display `0`.

#### Scenario: Metrics render for authenticated user
- **WHEN** an authenticated user loads the dashboard
- **THEN** the header area shows three metric cells (streak, Words, Added) with a "This week" label above

#### Scenario: Labels do not include (7d)
- **WHEN** the metrics render
- **THEN** the word-count label reads "Words" and the added-count label reads "Added", with no `(7d)` suffix

#### Scenario: Zero-activity empty state
- **WHEN** streak is 0, distinct words seen in 7 days is 0, and words added in 7 days is 0
- **THEN** the header reads "Let's get started" and all three counters display `0`

#### Scenario: Active user sees "This week"
- **WHEN** any of the three metrics is non-zero
- **THEN** the header reads "This week"

#### Scenario: Unauthenticated user sees no metrics
- **WHEN** the user is not authenticated
- **THEN** no metric row is rendered

## ADDED Requirements

### Requirement: Supabase read failures are surfaced
The system SHALL check the `error` field of every Supabase query whose failure would otherwise render as an empty or silently-incomplete UI. On error, the code MUST surface a user-visible Sonner toast, MUST log the error to the console, and MUST NOT proceed to compute derived state over partial or empty data as if the load had succeeded.

#### Scenario: Pack stats load fails

- **WHEN** the `user_word_settings` or `word_pack_items` fetch on the Packs page returns an error
- **THEN** a Sonner toast informs the user the packs failed to load
- **AND** the error is logged to the console
- **AND** the page does not render pack stats computed from missing data

#### Scenario: Adding a word fails at the settings step

- **WHEN** the `user_word_settings` upsert in `useAddWord` returns an error
- **THEN** a Sonner toast informs the user the word could not be saved to their library
- **AND** the error is logged to the console

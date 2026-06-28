## ADDED Requirements

### Requirement: "Added last X days" filter uses a per-user timestamp
The vault temporal filter for the "Added" field SHALL query a per-user `added_at` timestamp on `user_word_settings` representing when the user added the word to their library, not a global word-creation timestamp.

#### Scenario: Filter returns recently added words
- **WHEN** the user filters "Added" with "less than N days"
- **THEN** only words the user added within the last N days are shown

#### Scenario: Filter returns older words
- **WHEN** the user filters "Added" with "more than N days"
- **THEN** only words the user added more than N days ago are shown

#### Scenario: Newly added word has an added_at
- **WHEN** a user adds a word to their library
- **THEN** its `added_at` is set so it correctly appears in the "Added" filter window

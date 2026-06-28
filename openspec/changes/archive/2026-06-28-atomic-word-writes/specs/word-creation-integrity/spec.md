## ADDED Requirements

### Requirement: New word creation is atomic
The system SHALL create a new word and the author's per-word settings atomically. When a brand-new word is added, the `words_dim` row and the corresponding `user_word_settings` row MUST both be created within a single database transaction, so a failure in either step leaves neither row behind.

#### Scenario: Settings write fails during a new-word add

- **WHEN** the `user_word_settings` insert fails while adding a brand-new word
- **THEN** the `words_dim` row for that word is not persisted either (the transaction rolls back)
- **AND** the caller receives an error

#### Scenario: Successful new-word add

- **WHEN** a brand-new word is added and both writes succeed
- **THEN** the `words_dim` row exists with `created_by_user_id` set to the author
- **AND** a `user_word_settings` row exists linking the author to that word

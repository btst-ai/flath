## ADDED Requirements

### Requirement: Vault filter and sort logic is shared
The system SHALL apply the same filter and sort logic to the vault's library tab and archived ("removed") tab. The filtering (search, theme, part-of-speech, favourites, exclude-mastered, success-rate range, frequency range, review-count range, temporal, heat) and the sort comparator (smart, greek, french, theme, success, frequency, review count, heat) MUST be defined in a single shared function used by both tabs.

#### Scenario: Same filters applied to both tabs

- **WHEN** a user sets any filter or sort option in the vault
- **THEN** the library tab (non-archived rows) and the removed tab (archived rows) apply identical filter and sort logic, differing only in which rows they include (archived vs not)

#### Scenario: Behavior unchanged after extraction

- **WHEN** the shared function replaces the previously duplicated inline logic
- **THEN** the displayed order and membership of both tabs is identical to before the change for any combination of filters and sort options

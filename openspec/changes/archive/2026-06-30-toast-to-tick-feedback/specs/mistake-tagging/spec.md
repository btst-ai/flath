## MODIFIED Requirements

### Requirement: Mark a word as a mistake
The system SHALL provide a single action to mark any word as a mistake. Marking a word as a mistake SHALL record one attempt with outcome `forgot` and SHALL recompute that word's aggregates so it ranks down and becomes eligible for Mistake Fix remediation. The success feedback SHALL be delivered as an inline green tick on the triggering button; no top-right success toast SHALL appear. Error feedback SHALL still surface as a top-right error toast.

#### Scenario: Quick-action from a vault row
- **WHEN** the user taps "Add a Mistake" on a word row in the vault or in-session drawer
- **THEN** a `forgot` attempt is recorded for that word, its success rate drops, `last_mistake_at` is stamped, and the mistake button briefly shows a green tick

#### Scenario: Word becomes eligible for Mistake Fix
- **WHEN** a word has been marked as a mistake within the remediation window
- **THEN** it surfaces in the Mistake Fix queue

### Requirement: Mark as mistake on word creation
The AddWordModal SHALL include an "Add a mistake" checkbox that defaults to checked. When a word is saved with the checkbox checked, the system SHALL mark that word as a mistake immediately after creation. When unchecked, the word SHALL be created normally with no mistake attempt. Success feedback SHALL be an inline green tick on the Add button; no top-right success toast SHALL appear.

#### Scenario: Create with checkbox checked (default)
- **WHEN** the user adds a new word with "Add a mistake" left checked
- **THEN** the word is created, immediately recorded with a `forgot` attempt, the Add button shows a green tick, and no top-right success toast appears

#### Scenario: Create with checkbox unchecked
- **WHEN** the user unchecks "Add a mistake" and adds the word
- **THEN** the word is created with no mistake attempt recorded, the Add button shows a green tick, and no top-right success toast appears

## ADDED Requirements

### Requirement: No frequency field in word modals
The AddWordModal and EditWordModal SHALL NOT display a Frequency or Difficulty field. New words SHALL still receive an automatically derived frequency rank; editing a word SHALL NOT change its frequency rank.

#### Scenario: Add modal has no frequency field
- **WHEN** the user opens the add-word modal
- **THEN** no Frequency/Difficulty input is shown, and a saved new word still receives an auto-derived frequency rank

#### Scenario: Edit modal has no frequency field
- **WHEN** the user opens the edit-word modal and saves
- **THEN** no Frequency/Difficulty input is shown and the word's existing frequency rank is preserved

### Requirement: Rename existing word packs
The system SHALL allow the owner of a word pack to rename it, persisting the new name to the `word_packs` table.

#### Scenario: Rename a pack
- **WHEN** the owner renames one of their word packs and confirms
- **THEN** the new name is persisted and shown, with an error surfaced if the update fails

### Requirement: Inline archive from list rows
The system SHALL provide a per-row action to archive/remove a word directly from the "My Library" and "Added by others" lists, without opening the edit modal.

#### Scenario: Archive from My Library row
- **WHEN** the user triggers the inline archive action on a My Library row
- **THEN** the word is archived/removed from the active library view

#### Scenario: Remove from Added by others row
- **WHEN** the user triggers the inline remove action on an "Added by others" row
- **THEN** the word is moved to the user's removed/archived set

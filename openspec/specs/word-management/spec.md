# word-management Specification

## Purpose
Covers managing words and word packs: the add/edit modals expose no frequency field (rank stays auto-derived), word packs can be renamed by their owner, and words can be archived/removed inline from the My Library and "Added by others" lists.
## Requirements
### Requirement: No frequency field in word modals
The AddWordModal SHALL NOT display a Frequency or Difficulty field. New words SHALL still receive an automatically derived frequency rank. The EditWordModal SHALL display a Difficulty selector (easy / medium / hard / niche); saving a change to the selector SHALL update the word's `frequency_rank` to the corresponding bucket midpoint (easy=500, medium=2000, hard=4500, niche=8000).

#### Scenario: Add modal has no frequency field
- **WHEN** the user opens the add-word modal
- **THEN** no Frequency/Difficulty input is shown, and a saved new word still receives an auto-derived frequency rank

#### Scenario: Edit modal shows difficulty pre-filled
- **WHEN** the user opens the edit-word modal
- **THEN** a Difficulty dropdown is shown, pre-selected to the bucket matching the word's current frequency rank

#### Scenario: Edit modal saves new difficulty
- **WHEN** the user changes the Difficulty dropdown and saves
- **THEN** the word's frequency_rank is updated to the selected bucket's midpoint rank

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


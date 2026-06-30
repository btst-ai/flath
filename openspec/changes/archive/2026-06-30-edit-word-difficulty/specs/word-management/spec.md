## MODIFIED Requirements

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

# in-session-vault Specification

## Purpose
Provides a minimal vault drawer available during an active practice session so the user can look up, search, view, and edit words on the fly without disrupting the session queue, timer, or progress.
## Requirements
### Requirement: In-session vault drawer
The system SHALL provide a minimal vault drawer accessible from within an active practice session that lets the user search, view, and edit words, and that preserves the active session queue when opened or closed.

#### Scenario: Open drawer during practice
- **WHEN** the user opens the in-session vault drawer
- **THEN** the drawer shows a searchable list of the user's words and the underlying session queue, timer, and progress are unchanged

#### Scenario: Search and view words
- **WHEN** the user types a query in the drawer
- **THEN** the list filters to matching Greek/French words

#### Scenario: Edit a word from the drawer
- **WHEN** the user edits a word from the drawer and saves
- **THEN** the change persists and the drawer reflects it without disrupting the session

#### Scenario: Close drawer returns to the card
- **WHEN** the user closes the drawer
- **THEN** the same practice card and session state are restored exactly as before


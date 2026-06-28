## ADDED Requirements

### Requirement: Card transition hides the answer side
When advancing from one card to the next in solo practice and in duel mode, the system SHALL NOT display the answer/translation side of any card during the transition. The card SHALL be in its hidden/front state before, or simultaneously with, the next card's data becoming visible.

#### Scenario: Solo advance after a known card
- **WHEN** the user marks a card as known and the app loads the next card
- **THEN** the next card is shown front-side only and the previous card's answer text never flashes

#### Scenario: Solo advance after the 5s retention intercept
- **WHEN** a missed card's 5-second intercept clears and the queue advances
- **THEN** the card flips back to hidden before the next card's dataset is shown, with no answer flash

#### Scenario: Duel advance after countdown
- **WHEN** the duel countdown completes and the next round's card loads
- **THEN** the new card is shown front-side only and no prior or next answer text flashes during the flip animation

### Requirement: Editing a word from an active session does not error
The system SHALL allow opening the edit-word modal from within an active practice session without throwing a runtime or state error, and SHALL preserve the active session queue.

#### Scenario: Open edit modal mid-session
- **WHEN** the user opens the edit modal for the current card during practice
- **THEN** the modal opens, the edit can be saved, and the session queue and timer continue without error

### Requirement: Progress pill reflects the current review pass
The 4-emoji progress pill (🟢 Mastered / 🟡 Unsure / 🔴 Forgot / ⚫ Not seen yet) SHALL count cards by their status within the current review pass. When a new review cycle (Review #i) begins, cards carried into the new pass SHALL be counted under ⚫ Not seen yet rather than 🔴 Forgot or 🟡 Unsure.

#### Scenario: New review cycle resets recycled cards
- **WHEN** a pass completes and Review #(i+1) begins with recycled cards
- **THEN** those recycled cards are counted under ⚫ Not seen yet, and 🟢 Mastered count is unchanged

#### Scenario: Within a pass, statuses accumulate
- **WHEN** the user answers cards within a single pass
- **THEN** known-removed cards count 🟢, "unsure" cards count 🟡, missed-but-seen cards count 🔴, and unanswered cards count ⚫

### Requirement: Practice attempts save incrementally in the background
The system SHALL persist practice attempts to the database in background batches during the session (approximately every 5 answered cards) and SHALL flush any remaining un-saved attempts when the session ends, without inserting duplicate attempt records.

#### Scenario: Mid-session batch flush
- **WHEN** the user has answered a multiple-of-5 number of cards
- **THEN** the un-flushed attempts are written to attempts_history in the background and the user continues uninterrupted

#### Scenario: End of session flushes remainder only
- **WHEN** the session ends
- **THEN** only attempts not yet flushed are written, and no attempt appears twice in attempts_history

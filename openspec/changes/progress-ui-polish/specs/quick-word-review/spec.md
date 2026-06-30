## ADDED Requirements

### Requirement: Progress page word lists have inline know/forgot review buttons
Each row in the struggling-words and forgetting-words lists SHALL display a 👎 button on the left and a 👍 button on the right of the Greek word text. Tapping 👎 SHALL record a recognition (`rec`) attempt with `outcome: "forgot"`. Tapping 👍 SHALL record a recognition (`rec`) attempt with `outcome: "know"`. Recording SHALL use the existing `submitSessionAttempts` function (which also triggers `recomputeUserWordSettings`). After recording, the tapped button SHALL be highlighted to indicate the recorded verdict; the row SHALL remain visible. A Sonner toast SHALL confirm success or report an error.

#### Scenario: Thumbs up records know outcome
- **WHEN** the user taps the 👍 button on a word row
- **THEN** `submitSessionAttempts` is called with `{ word_id, mode: "rec", outcome: "know", interest_interaction: "none" }` and a success toast "Recorded 👍" is shown

#### Scenario: Thumbs down records forgot outcome
- **WHEN** the user taps the 👎 button on a word row
- **THEN** `submitSessionAttempts` is called with `{ word_id, mode: "rec", outcome: "forgot", interest_interaction: "none" }` and a success toast "Recorded 👎" is shown

#### Scenario: Button highlights after tap
- **WHEN** the user taps a thumb button on a word row
- **THEN** that button is visually highlighted (active state) and the row remains visible; the other thumb remains unhighlighted

#### Scenario: Double-tap prevented
- **WHEN** a thumb button is tapped while its request is in flight
- **THEN** the button is disabled until the request completes, preventing duplicate attempts from being recorded

#### Scenario: Error surfaced via toast
- **WHEN** `submitSessionAttempts` returns an error
- **THEN** a Sonner error toast is shown with the error message and no optimistic UI change is applied

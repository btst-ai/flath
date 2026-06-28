# attempt-aggregates Specification

## Purpose
Ensure operations that record practice/duel attempts and recompute per-word `user_word_settings`
aggregates report failures in the recompute step to the caller, so the UI never claims success while
aggregates have silently drifted from `attempts_history`.
## Requirements
### Requirement: Aggregate recompute failures are reported
The system SHALL report a failure in the per-word aggregate recompute step to the caller. Operations that insert attempt rows and then recompute `user_word_settings` aggregates MUST NOT report success when the recompute step fails; the returned result MUST carry an error in that case.

#### Scenario: Recompute fails after a mistake is recorded

- **WHEN** `markWordAsMistake` inserts the attempt successfully but the subsequent aggregate recompute returns an error
- **THEN** `markWordAsMistake` returns an `{ error }` result rather than `{ success: true }`
- **AND** the calling UI surfaces the failure to the user

#### Scenario: Recompute fails during session submission

- **WHEN** `submitSessionAttempts` inserts attempts successfully but the recompute step fails
- **THEN** the returned result carries an error so the caller can log or surface it


# inline-action-feedback Specification

## Purpose
Defines how async button actions confirm success inline on the triggering button (green tick, 800ms) rather than via a top-right Sonner toast, keeping feedback spatially close to the user's action and eliminating popup noise on high-frequency operations.
## Requirements
### Requirement: TickButton provides inline green-tick feedback
The system SHALL provide a reusable `TickButton` component that cycles through `idle → pending → done → idle` states on async actions. When the action succeeds the button SHALL display a green tick icon for 800ms before reverting to idle. When the action fails the button SHALL revert to idle immediately (the caller is responsible for showing an error toast). The component SHALL accept an optional `onDone` callback fired after the tick window, enabling modals to delay `onClose` until the tick has been visible.

#### Scenario: Successful action shows tick then reverts
- **WHEN** user clicks a TickButton and the async `onAction` resolves `true`
- **THEN** the button shows a green checkmark icon for ~800ms then returns to its idle label/icon with no top-right toast

#### Scenario: Failed action reverts to idle
- **WHEN** user clicks a TickButton and the async `onAction` resolves `false`
- **THEN** the button returns to idle immediately and an error toast (fired by the caller) appears

#### Scenario: Button is disabled during pending/done
- **WHEN** the button is in `pending` or `done` state
- **THEN** additional clicks are ignored (button is disabled)

#### Scenario: Modal closes after tick
- **WHEN** a TickButton is used as a modal save button with an `onDone` callback that calls `onClose`
- **THEN** the modal remains open while the tick is visible and closes after the 800ms tick window

### Requirement: Success toasts are removed from all in-scope action paths
The system SHALL NOT display a top-right Sonner success toast for: adding a word, vault mark-as-mistake, in-session vault mark-as-mistake, vault remove/archive (row and batch), or any modal save button (edit word, batch edit, edit pack, smart pack create, pack rename, import resolve). Error toasts SHALL remain on all these paths.

#### Scenario: Add word shows no success toast
- **WHEN** user adds a word successfully via the add-word modal
- **THEN** no top-right toast appears; the add button shows a green tick

#### Scenario: Vault mark-mistake shows no success toast
- **WHEN** user marks a word as a mistake in the vault
- **THEN** no top-right toast appears; the mistake button shows a green tick

#### Scenario: Modal save shows no success toast
- **WHEN** user saves changes via any modal (edit word, edit pack, import resolve, etc.)
- **THEN** no top-right toast appears; the Save button shows a green tick before the modal closes

#### Scenario: Error paths still toast
- **WHEN** any of the above actions fails
- **THEN** a red error toast appears in the top-right as before

### Requirement: Progress page header uses Dashboard button
The /progress page header SHALL display a Dashboard button styled identically to the white-bordered Dashboard button on the vault and packs pages, replacing the current `← Back` text link.

#### Scenario: Dashboard button navigates home
- **WHEN** user clicks the Dashboard button on the /progress page
- **THEN** the app navigates to `/`

#### Scenario: Dashboard button matches vault/packs style
- **WHEN** /progress page header is rendered
- **THEN** the button has a white background, grey border, and "Dashboard" label, consistent with vault/packs pages


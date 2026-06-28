## ADDED Requirements

### Requirement: Interactive controls have accessible names
The system SHALL give every interactive control an accessible name. Icon-only buttons and bare checkboxes MUST have an `aria-label` (or equivalent) describing their action or purpose, so assistive technology announces something more useful than "button" or "checkbox".

#### Scenario: Icon button announced with its purpose

- **WHEN** a screen-reader user focuses an icon-only button in practice or the vault (e.g. favourite, edit, copy, archive)
- **THEN** the control is announced with a descriptive name rather than just "button"

#### Scenario: Vault checkbox announced with context

- **WHEN** a screen-reader user focuses the vault select-all or a per-row checkbox
- **THEN** the control is announced with a label indicating what it selects

### Requirement: Modal dialogs manage focus
The system SHALL manage keyboard focus for modal dialogs. When the Add Word or Edit Word modal opens, focus MUST move into the dialog; Tab MUST cycle within the dialog while it is open; and on close, focus MUST return to the element that opened it. The dialog MUST expose `role="dialog"` and `aria-modal="true"`.

#### Scenario: Focus enters and is trapped in the modal

- **WHEN** the Add Word or Edit Word modal opens
- **THEN** keyboard focus moves to the first focusable field
- **AND** pressing Tab cycles only through controls inside the dialog
- **AND** closing the dialog returns focus to the control that opened it

### Requirement: Practice state changes are announced
The system SHALL announce significant non-visual state changes during a practice session via an ARIA live region, including when a card is flipped to reveal the answer and when the session advances to a new review iteration.

#### Scenario: Card flip announced

- **WHEN** the practice card flips to reveal the answer
- **THEN** an `aria-live` region communicates the change to assistive technology

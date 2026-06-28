## Context

Findings X1–X4. Practice and vault have many icon-only `<button>`s (lucide icons, no text). Vault
checkboxes lack labels. `AddWordModal`/`EditWordModal` render a fixed overlay but don't move focus
(the in-session drawer already sets `role="dialog"`, a good reference). No live region for practice
card flip / iteration splash.

## Goals / Non-Goals

**Goals:** accessible names on controls; modal focus (enter, trap, restore); a practice live region.
**Non-Goals:** a full WCAG audit; color-contrast changes; keyboard shortcuts; restructuring markup
beyond what's needed for the above.

## Decisions

**D1. `aria-label` on icon buttons/checkboxes.** Add static, descriptive labels (e.g. "Mark as
favourite", "Edit word", "Copy Greek", "Search on Google", "Archive word", "Select all words",
"Select <greek>" where a row value is available). No structural change.

**D2. Small shared `useFocusTrap(ref, isOpen)` hook** in `hooks/`. On open: record
`document.activeElement`, focus the first focusable element in the container; keydown handler keeps
Tab/Shift+Tab within the container's focusable set; on close/unmount: restore focus to the recorded
element. Both modals consume it. One implementation, two call sites — avoids duplicating fiddly focus
code. Add `role="dialog"` + `aria-modal="true"` + `aria-label`/`aria-labelledby` on each modal's
container.
Alternative: a third-party focus-trap lib — rejected to avoid a new dependency for ~30 lines.

**D3. Practice live region.** Add a visually-hidden `aria-live="polite"` element whose text is set to
a short message when the card flips (e.g. "Answer revealed") and when the iteration advances (e.g.
"Review N"). Drive it from existing state (`flipped`, `iteration`) via a small effect so no flow logic
changes.

## Risks / Trade-offs

- **[Risk] Focus trap interferes with the conflict-resolution modal stacked over AddWordModal.** →
  Mitigation: trap targets the topmost open dialog's container ref; the conflict modal is a separate
  component — verify tabbing works when it appears (manual keyboard pass).
- **[Risk] Over-chatty live region.** → Mitigation: `polite`, short messages, only on flip and
  iteration change (not every tick).
- **[Trade-off] Static aria-labels won't localize.** Accepted: the app UI is already mixed FR/EN;
  labels match existing copy conventions.

## Migration Plan

Pure additive client change. Verify: `tsc`/lint/build; keyboard-only pass (Tab into each modal, Tab
cycles within, close restores focus); confirm the app still works for mouse users unchanged.

## Why

The review found the app is largely unusable with a screen reader: icon-only buttons
(edit/copy/search/favourite/archive) announce as bare "button"; vault checkboxes announce as
"checkbox" with no context; the Add/Edit Word modals don't manage focus (no initial focus, no trap,
no restore); and there are no live-region announcements for the practice card flip or phase changes.
These are low-effort, high-impact fixes (review findings X1–X4).

## What Changes

- **X1 — icon button labels:** add `aria-label` to all icon-only buttons in `app/practice/page.tsx`
  and `app/vault/page.tsx` (edit, copy, Google search, favourite, archive, mark-as-mistake, etc.).
- **X3 — checkbox labels:** add `aria-label` to the vault select-all and per-row checkboxes.
- **X2 — modal focus management:** in `AddWordModal` and `EditWordModal`, focus the first field on
  open, trap Tab within the dialog, and restore focus to the trigger on close. Add `role="dialog"`
  and `aria-modal="true"` where missing.
- **X4 — live regions:** add an `aria-live` announcement in `app/practice/page.tsx` for the card
  flip (front→back reveal) and phase/iteration advance, so non-visual users know state changed.

## Capabilities

### New Capabilities
- `accessibility`: interactive controls MUST have accessible names; modal dialogs MUST manage focus
  (initial focus, focus trap, restore on close); and significant non-visual state changes in the
  practice flow MUST be announced via a live region.

## Impact

- **Files:** `app/practice/page.tsx`, `app/vault/page.tsx`, `components/AddWordModal.tsx`,
  `components/EditWordModal.tsx` (and possibly a small shared `useFocusTrap` hook).
- **Code:** additive attributes + a focus-management effect; no behavior change for sighted users.
- **Risk:** low. Verify with `tsc`/lint/build and a keyboard-only pass (Tab into a modal, Tab cycles
  within it, Esc/close returns focus).

## 1. Accessible names (X1, X3)

- [x] 1.1 Add descriptive `aria-label` to every icon-only button in `app/practice/page.tsx`
  (favourite, show-more, show-less, archive, edit, open-vault-drawer, end-session, etc.).
- [x] 1.2 Add descriptive `aria-label` to every icon-only button in `app/vault/page.tsx`
  (edit, copy, Google search, favourite, archive, mark-as-mistake, sort toggles, etc.).
- [x] 1.3 Add `aria-label` to the vault select-all checkbox and per-row checkboxes (use the row's
  Greek text where available, e.g. `Select ${greek}`).

## 2. Modal focus management (X2)

- [x] 2.1 Create `hooks/useFocusTrap.ts`: `useFocusTrap(containerRef, isOpen)` — on open, store the
  previously-focused element and focus the first focusable element in the container; trap Tab /
  Shift+Tab within the container; on close/unmount, restore focus to the stored element.
- [x] 2.2 Apply it in `components/AddWordModal.tsx` and `components/EditWordModal.tsx`; add
  `role="dialog"`, `aria-modal="true"`, and an accessible name (`aria-label` or `aria-labelledby`)
  to each modal container.

## 3. Practice live region (X4)

- [x] 3.1 In `app/practice/page.tsx`, add a visually-hidden `aria-live="polite"` element and set its
  message on card flip (answer revealed) and on iteration advance (Review N), driven from existing
  state via an effect (no flow-logic changes).

## 4. Verify

- [x] 4.1 `cd flath-app && npx tsc --noEmit` passes.
- [x] 4.2 Lint on touched files: no new violations.
- [x] 4.3 `cd flath-app && npx next build` succeeds.

## 5. Keyboard check (manual — user)

- [ ] 5.1 Tab into Add Word and Edit Word modals: focus enters, Tab cycles within, closing restores
  focus to the opener. App still works normally for mouse users.

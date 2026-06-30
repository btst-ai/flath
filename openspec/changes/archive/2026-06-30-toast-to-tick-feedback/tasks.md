## 1. TickButton component

- [x] 1.1 Create `flath-app/components/TickButton.tsx` — client component with `idle/pending/done` state, 800ms tick window, `onAction(): Promise<boolean>`, optional `onDone`, and `tickMs` prop. Render `children` (idle), spinner (pending), `<Check className="w-4 h-4 text-green-600" />` (done). Disable button during pending/done. Clear timer on unmount.

## 2. Progress page header

- [x] 2.1 In `flath-app/app/progress/page.tsx` replace the `← Back` button (lines 236-241) with the white-bordered Dashboard button: `px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition`.

## 3. Add word feedback

- [x] 3.1 In `flath-app/hooks/useAddWord.ts` remove the `toast.success(...)` at line 184. Return value already signals success to callers; no return-type change needed.
- [x] 3.2 In `flath-app/components/AddWordModal.tsx` wrap the Add/Save button with `TickButton`. The `onAction` calls the existing add handler and returns `true` on success, `false` on error (errors still toast internally). On `onDone` call `onClose()`.

## 4. Vault mark-as-mistake feedback

- [x] 4.1 In `flath-app/app/vault/page.tsx` remove `toast.success("Marked as mistake")` at line 356. Refactor `handleMarkAsMistake` to return `true` on success, `false` on error (keep `toast.error` at 354).
- [x] 4.2 Wire the vault-row mistake button to `TickButton` using the refactored handler.

## 5. Vault remove / archive feedback

- [x] 5.1 In `flath-app/app/vault/page.tsx` remove `toast.success("Word removed from your view.")` at line 431. Refactor the remove handler to return `true`/`false`. Wire the remove button to `TickButton`.
- [x] 5.2 Remove `toast.success(`${ids.length} word(s) archived.`)` at line 445. Refactor the batch-archive handler to return `true`/`false`. Wire the batch-archive toolbar button to `TickButton`.
- [x] 5.3 Remove `toast.success(`${result.ownedDeleted} word(s) permanently deleted.`)` at line 459 (batch delete goes silent — rows disappear, which is the confirmation). Keep `toast.error` at 457.

## 6. In-session vault drawer feedback

- [x] 6.1 In `flath-app/components/InSessionVaultDrawer.tsx` remove `toast.success(...)` at line 80. Refactor `handleMarkMistake` to return `true`/`false` (keep `toast.error` at 78).
- [x] 6.2 Wire the drawer mistake button (lines ~204-217) to `TickButton`, replacing the existing spinner/icon inline state with the component.

## 7. Modal save buttons (tick then close)

- [x] 7.1 `flath-app/components/EditWordModal.tsx`: remove `toast.success("Word updated successfully!")` at line 102. Move `onSuccess(); onClose();` into `onDone`. Wire Save button to `TickButton`.
- [x] 7.2 `flath-app/components/BatchEditModal.tsx`: remove success toast at line 67. Move `onClose()` into `onDone`. Wire Save button to `TickButton`.
- [x] 7.3 `flath-app/components/EditPackModal.tsx`: remove success toasts at lines 124 and 139. Move `onSuccess(); onClose();` into `onDone` for both Update and Delete buttons. Wire both to `TickButton`.
- [x] 7.4 `flath-app/app/packs/page.tsx`: remove `toast.success("Smart pack created!")` at line 260; wire the create button to `TickButton` with `onDone` collapsing the create form. Remove `toast.success("Pack renamed")` at line 322; wire the rename confirm button to `TickButton`.
- [x] 7.5 `flath-app/components/ImportSummaryModal.tsx`: remove success toasts at lines 112, 128, 146. Wire each resolve button (update/rename/merge) to `TickButton`.

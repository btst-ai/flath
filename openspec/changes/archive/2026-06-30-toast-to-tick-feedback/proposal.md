## Why

Success toasts (Sonner top-right popups) interrupt flow on high-frequency actions — adding a word, marking a mistake, archiving, saving a modal. The triggering button is a better feedback surface: it is already on screen, directly tied to the action, and visually flips to a green tick for <1s before reverting (or before the modal closes). Error toasts stay as-is.

## What Changes

- **Progress page header**: replace the `← Back` text link with the standard white-bordered **Dashboard** button used on the vault and packs pages.
- **New `TickButton` component**: reusable button wrapper that cycles through `idle → pending → done (green tick, 800ms) → idle`. Callers pass `onAction(): Promise<boolean>` (false = error, already toasted by caller) and optional `onDone` (fires after tick, used by modals to delay `onClose`).
- **Remove success toasts** from all of the following and wire their trigger buttons to the green-tick pattern:
  - Add a word (`useAddWord.ts` + `AddWordModal`)
  - Vault row mark-as-mistake (`vault/page.tsx`)
  - In-session vault drawer mark-as-mistake (`InSessionVaultDrawer`)
  - Vault remove / archive (row and batch) — **batch delete** goes silent (row disappears)
  - Modal save buttons: Edit Word, Batch Edit, Edit Pack (update + delete), Smart Pack create, Pack rename, Import resolve (update/rename/merge)
- **Toaster stays mounted** in `layout.tsx` — error toasts still use it.

## Capabilities

### New Capabilities

- `inline-action-feedback`: A `TickButton` component providing inline green-tick feedback on async button actions, replacing top-right success toasts.

### Modified Capabilities

- `mistake-tagging`: Success feedback path changes from toast to inline tick on the triggering button (vault row and in-session drawer). No change to the underlying RPC or aggregates.
- `word-management`: Success feedback for add-word and edit-word changes from toast to inline tick. No API or data change.
- `in-session-vault`: Mistake-button feedback changes from toast to inline tick. No session or attempt logic change.

## Impact

- `flath-app/components/TickButton.tsx` — new file
- `flath-app/app/progress/page.tsx` — header button
- `flath-app/hooks/useAddWord.ts` — drop success toast
- `flath-app/components/AddWordModal.tsx` — Add button → TickButton
- `flath-app/components/InSessionVaultDrawer.tsx` — mistake button → tick pattern
- `flath-app/app/vault/page.tsx` — mistake/remove/archive buttons → tick; batch-delete silent
- `flath-app/components/EditWordModal.tsx` — Save → tick-then-close
- `flath-app/components/BatchEditModal.tsx` — Save → tick-then-close
- `flath-app/components/EditPackModal.tsx` — Save/Delete → tick-then-close
- `flath-app/app/packs/page.tsx` — smart-create/rename → tick
- `flath-app/components/ImportSummaryModal.tsx` — update/rename/merge → tick
- No schema changes, no new runtime dependencies (`lucide-react` `Check` already present)

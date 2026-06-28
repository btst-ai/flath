## 1. Extract the shared function

- [x] 1.1 Create `app/vault/vaultFilterSort.ts` exporting `filterAndSortVocab(rows, opts)` and a
  `VaultFilterOpts` type. Body is a verbatim lift of the filter sequence + sort comparator from the
  current `displayedLibrary` memo, with local filter variables replaced by `opts.*` and `masteredIds`
  passed in. It does NOT seed-filter by archived status.

## 2. Use it in both memos

- [x] 2.1 In `app/vault/page.tsx`, replace the `displayedLibrary` memo body with
  `filterAndSortVocab(myLibrary.filter(w => !w.is_archived), { ...filters })`, keeping the same
  dependency array.
- [x] 2.2 Replace the `displayedRemoved` memo body with
  `filterAndSortVocab(myLibrary.filter(w => w.is_archived), { ...filters })`, same dependency array.

## 3. Verify

- [x] 3.1 `cd flath-app && npx tsc --noEmit` passes.
- [x] 3.2 Lint on the two touched files: no new violations.

## 4. Behavior check (manual — user)

- [ ] 4.1 In the vault, apply several filter + sort combinations and confirm the Library and Removed
  tabs behave identically to before.

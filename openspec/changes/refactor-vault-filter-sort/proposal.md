## Why

`app/vault/page.tsx` (~1,650 lines) contains two `useMemo` blocks — `displayedLibrary` and
`displayedRemoved` — that are byte-for-byte identical except for a single line (`!w.is_archived`
vs `w.is_archived`). That is ~123 lines of duplicated filter+sort logic and a real drift hazard:
any change to a filter or the sort comparator must be made in two places or the two tabs silently
diverge (review finding A2).

## What Changes

- Extract the shared filter+sort logic into a pure function `filterAndSortVocab(rows, opts)` in a
  new module `app/vault/vaultFilterSort.ts` (or `lib/`), parameterized by the filter values, sort
  field/direction, and `masteredIds`.
- Replace both `displayedLibrary` and `displayedRemoved` memos with calls to it (pre-filtering by
  `!is_archived` / `is_archived` respectively). Behavior is identical — same filters, same
  comparator, same dependency arrays.
- Scope note: this is the safe, high-ROI slice of the larger "refactor vault page" item. The full
  `VaultTable` / `VaultFilterBar` component-tree split and the filter-state-to-reducer change are
  **deferred** — extracting JSX + state across a 1,650-line file with **no automated tests** carries
  real regression risk and warrants human review of the diff rather than autonomous execution. This
  change removes the worst duplication without moving any state or markup.

## Capabilities

### New Capabilities
- `vault-listing`: the vault's filter+sort behavior for the library and archived tabs MUST be
  defined once and shared, so the two tabs cannot diverge.

## Impact

- **Files:** new `app/vault/vaultFilterSort.ts`; `app/vault/page.tsx` (two memos replaced, ~120
  net lines removed).
- **Code:** pure-function extraction; no state or JSX moves; no behavior change.
- **Risk:** low (pure logic, no UI moves). Verify with `tsc`/lint and a manual check that the
  Library and Removed tabs filter/sort identically to before.

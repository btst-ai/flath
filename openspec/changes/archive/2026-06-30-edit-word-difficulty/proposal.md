## Why

Users need a way to manually correct a word's difficulty bucket when the auto-derived frequency rank does not reflect how hard the word actually is for them. The Edit Word modal is the right place for this control — it is already the surface for correcting other word metadata. The Add Word modal should remain free of difficulty input, since new words should start with an auto-derived rank until the user has enough context to judge difficulty.

## What Changes

- Add a Difficulty dropdown to EditWordModal (easy / medium / hard / niche), pre-filled from the word's current `frequency_rank`, writing a bucket midpoint rank on save.
- Remove the existing spec prohibition on a Difficulty field in EditWordModal; retain the prohibition for AddWordModal.
- AddWordModal is unchanged.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `word-management`: Amend the "No frequency field in word modals" requirement to allow Difficulty editing in EditWordModal while keeping AddWordModal restriction intact.

## Impact

- `flath-app/components/EditWordModal.tsx` — add `difficulty` state, pre-fill from `getDifficultyFromRank`, add selector JSX, include `frequency_rank` in Supabase update payload.
- `openspec/specs/word-management/spec.md` — requirement amended via this change's archive cycle.
- No API, database schema, or RLS changes; `frequency_rank` column already exists on `words_dim`.

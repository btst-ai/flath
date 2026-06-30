## Context

`EditWordModal` already contains two exported helpers — `getDifficultyFromRank` and `getRankFromDifficulty` — that map between `frequency_rank` integers and four difficulty buckets (easy/medium/hard/niche). These are currently dead code: nothing in the modal uses them. The modal's `handleSave` updates `greek_text`, `french_text`, `theme`, and `part_of_speech` but never touches `frequency_rank`.

`AddWordModal` has no difficulty-related code and receives no change.

The identical difficulty selector already ships in `BatchEditModal` (lines 157-170), so the pattern is established in the codebase.

## Goals / Non-Goals

**Goals:**
- Add an editable Difficulty dropdown to EditWordModal, pre-filled from the word's current rank, writing a bucket midpoint to `frequency_rank` on save.
- Activate the existing dead-code helpers `getDifficultyFromRank` / `getRankFromDifficulty`.

**Non-Goals:**
- Any change to AddWordModal.
- Finer-grained rank editing (raw number input).
- A "keep current" option (user explicitly chose pre-fill + always write).

## Decisions

**Reuse existing helpers; do not add a "(keep current)" option.**
`getDifficultyFromRank` already handles the pre-fill mapping; `getRankFromDifficulty` handles the write. Adding a keep-option would require guarding the update payload, adding complexity without a user requirement.

Trade-off acknowledged: every save snaps the rank to a bucket midpoint (e.g. rank 1742 → 2000 after a save that only changed the translation). Accepted per user decision.

**Place the Difficulty selector as a new full-width row below the Theme/Part-of-Speech grid.**
The existing 2-col grid (`Theme | Part of Speech`) is already tight on mobile. A full-width row below keeps the layout clean at 375px.

**Respect `canEdit` gate.**
The selector is disabled when `canEdit` is false (same pattern as all other fields), so read-only users see the pre-filled value but cannot change it.

**`frequency_rank` guard on null/undefined.**
`getDifficultyFromRank` expects a number. If `word.frequency_rank` is null or undefined (possible for older words), fall back to `"niche"` via the function's default path (`return "niche"` for out-of-range). No special null check needed.

## Risks / Trade-offs

[Bucket snap on every save] Saving any edit writes a bucket midpoint to `frequency_rank`, losing sub-bucket precision. Mitigated by: the precision was invisible to the user anyway; difficulty is always displayed as a bucket label.

[Mobile layout length] Adding a field increases modal height. The modal is `max-w-md` centred with `p-4` outer. At 375px the existing modal already requires slight scroll for longer words; one more field adds ~72px. Acceptable — the modal is already scrollable via `overflow-y-auto` on the container.

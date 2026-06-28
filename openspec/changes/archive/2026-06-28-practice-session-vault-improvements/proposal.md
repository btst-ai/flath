## Why

The solo practice flow has a card-flip flash bug that spoils answers, a progress pill that mislabels recycled cards, no way to look up words mid-session, and a frequency field that adds friction. The Vault's "Added last X days" filter is broken at the data layer, there's no fast way to tag a word as a mistake, and end-of-session saves feel slow because everything commits at once. This change fixes the bugs and adds the quick-curation affordances that make daily review faster and less error-prone.

## What Changes

**Practice session bugfixes**
- Fix the answer-side flash when advancing to the next card in **solo** practice and **duel** mode: the card must reset to its hidden/front side before (or atomically with) the next card's data loading.
- Fix the runtime/state error when opening the edit-word modal from inside an active practice queue.
- Fix the 4-emoji progress pill: when a new review cycle (Review #i) starts, recycled cards move back into the ⚫ "Not seen yet" count instead of remaining stuck under 🔴 Forgot / 🟡 Unsure.

**In-session vault & quick-tagging**
- Add a minimal in-session Vault slide-over drawer in the practice view (search, view, edit, and a one-tap "Add a Mistake" action) that preserves the active session queue.
- Add an "Add a mistake" checkbox to AddWordModal, defaulting to checked; when saved checked, immediately records the word as a mistake.
- Add a one-tap "Add a Mistake" quick-action button on Vault word rows (main Vault and the in-session drawer).

**Word input & vault filter fixes**
- Remove the Frequency / Difficulty field from AddWordModal and EditWordModal entirely.
- Fix the "Added last X days" temporal filter by adding a per-user `added_at` timestamp and querying it correctly.

**Performance & curation**
- Background-save practice attempts in batches (~every 5 cards) so end-of-session save is fast.
- Add a rename action for existing word packs.
- Add a fast "move to removed"/archive action on individual rows in the "Added by others" and "My Library" lists.

## Capabilities

### New Capabilities
- `in-session-vault`: Minimal vault drawer accessible during an active practice session — search, view, edit, and quick-tag words without disrupting the queue.
- `mistake-tagging`: Marking a word as a mistake (via create-modal checkbox or vault quick-action) so it ranks down and surfaces in Mistake Fix remediation.

### Modified Capabilities
- `practice-session`: Card transition no longer flashes the answer side (solo + duel); progress-pill counts recycle correctly across review cycles; edit-from-session no longer errors; attempts save incrementally in the background.
- `word-management`: Frequency field removed from add/edit modals; word packs can be renamed; rows in Added-by-others / My Library can be archived/removed inline.
- `vault-filters`: "Added last X days" filter queries a real per-user `added_at` timestamp.

## Impact

- **Frontend**: `flath-app/app/practice/page.tsx` (flip/transition, pill counts, in-session drawer, edit-from-session), `flath-app/app/duel/LiveDuel.tsx` + `duelStateMachine.ts` (flip/transition), `flath-app/components/AddWordModal.tsx` & `EditWordModal.tsx` (remove frequency, add mistake checkbox), `flath-app/app/vault/page.tsx` (added_at filter, quick-action, inline archive, pack rename), `flath-app/hooks/useAddWord.ts` (mistake-on-create), word-packs UI.
- **Data layer**: `flath-app/app/actions/session.ts` (`submitSessionAttempts`, `recomputeUserWordSettings`, new single-word mistake helper, batched background save). Single-word mistake = 1 insert + 1 word-scoped recompute (3 indexed queries, negligible latency).
- **Database (one-time SQL migrations in Supabase)**: add `added_at TIMESTAMPTZ DEFAULT now()` to `user_word_settings` (backfilled); confirm `word_packs` has an editable `name` column.
- **Surfaces**: All features ship to desktop, mobile-web, and PWA per `flath-app/CLAUDE.md`; gate only where existing siblings are gated (e.g. duel entry, batch tools).
- **RLS**: No policy changes; all writes stay within the existing `auth.uid() = user_id` model.

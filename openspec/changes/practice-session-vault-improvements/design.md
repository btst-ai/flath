## Context

The practice flow renders a single card derived from `queue[0]` (solo) or `round.card` (duel), with a CSS 3D flip (`rotateY`) driven by a `flipped` boolean (solo) or the round `phase` (duel). Card content (`promptText` / `translationText`) is computed inline from the current card. Progress is tracked with cumulative `Set`s (`seenWordIds`, `mehWordIds`) plus a `masteredCount`. Attempts accumulate in a local `attempts` array and are flushed once in `handleEndSession` via `submitSessionAttempts` → `recomputeUserWordSettings`.

Vault data is fetched as `user_word_settings` joined with `words_dim (*)`. Filters run client-side over that array. Word CRUD goes directly through the Supabase browser client; mistake/remediation ranking is driven by `attempts_history.outcome='forgot'` (`lib/sessionQueue.ts getMistakesForRepair`).

This design covers the 12 items in the approved proposal. It is cross-cutting (practice, duel, vault, modals, packs, data layer) and includes a DB migration, so a design doc is warranted.

## Goals / Non-Goals

**Goals:**
- Eliminate the answer-side flash on card advance in solo and duel.
- Make the 4-emoji pill reflect the *current pass*, not cumulative history.
- Let users look up / edit / quick-tag words mid-session without losing the queue.
- Make "Add a mistake" a one-action affordance (on create and in vault rows).
- Remove the frequency field from add/edit; fix the "Added last X days" filter with a real per-user timestamp.
- Cut perceived end-of-session latency via background batched saves.
- Add pack rename and inline archive from list rows.

**Non-Goals:**
- No change to the spaced-repetition / scoring algorithm or RLS policies.
- No redesign of the full Vault page; the in-session drawer is intentionally minimal.
- No offline/queued-write support for background saves (best-effort online flush).
- No new mobile-only or desktop-only forks beyond existing gates.

## Decisions

### 1. Card-flip flash — flip down first, swap data after the flip completes
**Solo:** Today `setFlipped(false)` is synchronous but `setQueue(...)` is in a `setTimeout`; the same card un-flips showing its *front* with stale data, then the queue advances. Decision: keep the order (flip down → then advance) but gate the visible content so the front never renders the next card's data prematurely, and only advance the queue once `flipped` has settled to `false`. Concretely: drive the data swap off the flip animation's settle (a short delay already exists at 150ms for "know"; reuse the same pattern for the miss path's post-intercept advance) and ensure `promptText`/`translationText` are read from a card reference that updates *with* the queue, not before it.

**Duel:** The reducer already swaps `phase → idle_claim` and `card → next` atomically in `makeRound`. The flash is the 3D rotation animating back→front while the next card is mounted on the back face. Decision: ensure the back (answer) face content is hidden/cleared the instant `phase` leaves the revealed states, so the rotation never paints next/stale answer text. Use `backface-hidden` correctness + render the answer face content conditionally on `flipped` rather than always-mounted.

*Alternative considered:* keep both faces double-buffered with the previous card until animation end. Rejected — more state, and the conditional-render approach is simpler and matches how the front face already behaves.

### 2. Edit-from-session error — reproduce, then guard
All `setEditingWord` call sites pass a bare `words_dim` object (correct for the modal). The modal itself guards `if (!isOpen || !word) return null`. The fault is therefore most likely in the in-session `onSuccess` handler (`practice/page.tsx:518-529`) — it issues a Supabase fetch and `setQueue(prev.map(...))` referencing `item.words_dim.id`, which throws if any queue item's `words_dim` is null, or interacts badly with the running lock/timer effects. Decision: reproduce with the live app (open edit while a card is shown and while the 5s intercept is active), capture the actual error, then apply the minimal guard (null-safe map, and disable opening edit during the locked intercept window if that's the trigger). No speculative rewrite.

### 3. Progress pill — reset per-pass categorization at cycle boundary
`notSeen`/`meh`/`forgot` are derived from cumulative `seenWordIds`/`mehWordIds` filtered over the live queue, so recycled cards stay 🔴/🟡. Decision: when a new pass starts (the existing `isLastOfPass` branches that bump `iteration` and set `showIterationSplash`), clear `seenWordIds` and `mehWordIds` for the cards carried into the new pass (i.e. reset them to ⚫). `masteredCount` (🟢) is independent of these sets and stays. This keeps the pill scoped to "progress within the current Review #i".

*Alternative considered:* track a per-word `lastSeenPass` and derive counts from `pass === iteration`. Rejected as heavier; clearing the sets at the boundary is sufficient and local.

### 4. In-session Vault drawer — new minimal component, reuse data + EditWordModal
Decision: a new slide-over component (e.g. `components/InSessionVaultDrawer.tsx`) rendered in `practice/page.tsx`, opened by a toolbar button. It fetches the user's library on open (same query as vault: `user_word_settings` join `words_dim`), supports text search, lists rows with view + Edit (reusing `EditWordModal`) + a one-tap "Add a Mistake". It owns its own state and never touches `queue`, `attempts`, or the timers. Closing returns to the card untouched.

*Alternative considered:* embed the full vault page. Rejected — too heavy and risks coupling to session state.

### 5/6/7. Mistake tagging — one shared server helper
Decision: add `markWordAsMistake(userId, wordId, mode)` to `app/actions/session.ts`: insert one `attempts_history` row `{user_id, word_id, mode, outcome:'forgot', interest_interaction:'none'}`, then `recomputeUserWordSettings(userId, [wordId])`. This reuses the proven recompute path, drops avg success + stamps `last_mistake_at`, and makes the word eligible for `getMistakesForRepair`. Mode defaults to `'rec'` when no session context (creation / vault row).
- **Create (#5):** `AddWordModal` gets a `defaultChecked` "Add a mistake" checkbox; the flag is plumbed through `useAddWord.addWords` and, for each successfully added word, calls `markWordAsMistake`.
- **Vault quick-action (#6):** a one-tap button per row (main vault + drawer) calls `markWordAsMistake`, then refreshes the row.

Perf is bounded: one word = 1 insert + 2 selects + 1 update (all indexed on `user_id, word_id`), ~tens of ms. No loop.

### 8. Remove frequency field
Decision: delete the Difficulty/Frequency `<select>` from both `AddWordModal` and `EditWordModal`. New words still get a `frequency_rank` automatically via `getWordFrequency` in `useAddWord` (unchanged). `EditWordModal.handleSave` stops writing `frequency_rank` (drops `getRankFromDifficulty`), leaving the existing value intact. Keep the exported helper functions if still referenced elsewhere; remove only the UI + the edit-time write.

### 9. "Added last X days" filter — real per-user timestamp
Decision: add `added_at TIMESTAMPTZ DEFAULT now()` to `user_word_settings` (one-time SQL, backfilled), select it in the vault fetch, and change both filter blocks from `item.words_dim?.created_at` to `item.added_at`. `useAddWord`'s upsert into `user_word_settings` will set `added_at` on insert (default covers it; explicit set is harmless). Backfill uses earliest `attempts_history.ts` per user+word, falling back to `now()`.

### 10. Background batched save
Decision: in `practice/page.tsx`, track a `flushedCount` cursor. After each recorded attempt, if `attempts.length - flushedCount >= 5`, fire-and-await `submitSessionAttempts(userId, attempts.slice(flushedCount))` in the background and advance the cursor. `handleEndSession` flushes only the un-flushed remainder (`attempts.slice(flushedCount)`). This prevents duplicate inserts and removes the single large end-of-session write. Recompute still runs per batch (acceptable; batches are small).

*Alternative considered:* debounce-by-time. Rejected — card-count cadence is simpler and maps to the user's request ("every 5 cards").

### 11. Rename word packs
Decision: `word_packs.name` exists and is rendered (`packs/page.tsx:600`). Add an inline rename action (pencil → inline input or small modal) that updates `word_packs.name` for owned packs via Supabase, with optimistic UI + error toast. RLS owner-update assumed; verify during implementation.

### 12. Inline archive from list rows
Decision: reuse the existing `archiveWord(word_id, isArchived)` for "My Library" rows (already present) and add an equivalent inline archive/remove action on "Added by others" rows. For words not yet in the library, "remove" means hide/skip from the user's view — clarify behavior to match `archiveWord` semantics (add-then-archive, or a dedicated skip). Implement using the existing archive path to avoid new RLS surface.

## Risks / Trade-offs

- [Background save fails mid-session (network)] → Keep attempts in local array regardless of flush success; end-session re-flushes the full un-flushed remainder. A failed batch simply retries its slice later. Log + non-blocking.
- [Double-insert from batched + end-session flush] → Single `flushedCount` cursor is the source of truth; both paths slice from it.
- [Per-pass set reset hides legitimately-still-forgotten cards in pill] → Acceptable and intended: the pill shows current-pass progress; cumulative history lives in the end recap and DB.
- [added_at backfill on large libraries] → One-time, indexed by PK; mirrors the existing `add_last_correct_mistake.sql` backfill which is already in use.
- [Duel conditional-render of answer face changes layout timing] → Verify the flip animation still reads smoothly at all three viewports; the front face already renders this way, so risk is low.
- [Edit-from-session root cause differs from hypothesis] → Design mandates reproduce-first; fix scope adjusts to the captured error rather than guessing.

## Migration Plan

1. Run in Supabase SQL Editor (idempotent), committed under `flath-app/sql/add_added_at.sql`:
   ```sql
   ALTER TABLE public.user_word_settings
     ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT now();
   UPDATE public.user_word_settings uws
   SET added_at = COALESCE(sub.first_ts, now())
   FROM (
     SELECT user_id, word_id, MIN(ts) AS first_ts
     FROM public.attempts_history GROUP BY user_id, word_id
   ) sub
   WHERE uws.user_id = sub.user_id AND uws.word_id = sub.word_id
     AND uws.added_at IS NULL;
   ```
2. Deploy frontend (Vercel auto-deploys from `main`). The `added_at` select is backward-compatible (column defaults to now()).
3. Verify `word_packs` RLS allows owner `UPDATE` of `name`; if not, add an owner-update policy in `sql/`.
4. Rollback: revert frontend; the `added_at` column can stay (unused) — no destructive change.

## Open Questions

- "Move to removed" from **Added by others** (#12): for a word not yet in My Library, does "remove" mean (a) add-to-library-then-archive so it's tracked as removed, or (b) a per-user hidden/dismissed list? Default to (a) reusing `archiveWord`; confirm during tasks if (b) is preferred.
- In-session drawer Edit while a card is mid-intercept: should Edit be disabled during the 5s lock, or allowed? Default: allow, but ensure it doesn't interact with the lock timer (ties into #2).

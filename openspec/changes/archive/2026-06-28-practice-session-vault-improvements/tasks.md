## 1. Database migration

- [x] 1.1 Create `flath-app/sql/add_added_at.sql`: add `added_at TIMESTAMPTZ DEFAULT now()` to `user_word_settings` and backfill from earliest `attempts_history.ts` (COALESCE to now()). Idempotent.
- [x] 1.2 Note in the PR/description that this SQL must be run once in the Supabase SQL Editor before the "Added" filter works on existing rows.
- [x] 1.3 Verify `word_packs` allows owner `UPDATE` of `name` under RLS; if missing, add an owner-update policy SQL file.

## 2. Mistake recording (shared helper)

- [x] 2.1 Add `markWordAsMistake(userId, wordId, mode = 'rec')` to `flath-app/app/actions/session.ts`: insert one `attempts_history` row `{outcome:'forgot', interest_interaction:'none'}` then call `recomputeUserWordSettings(userId, [wordId])`. Return `{success}|{error}`.

## 3. Practice bugfixes (solo + duel)

- [x] 3.1 Solo flash: in `flath-app/app/practice/page.tsx`, ensure the queue advances only after `flipped` settles to false and the visible front never reads next-card data early (know path + post-intercept miss path). No answer flash.
- [x] 3.2 Duel flash: in `flath-app/app/duel/LiveDuel.tsx`, render the answer/back face conditionally on `flipped` so the back→front rotation never paints stale/next answer text after `makeRound`.
- [x] 3.3 Edit-from-session error: reproduce by opening EditWordModal mid-session (incl. during the 5s lock); capture the actual error; apply the minimal guard (null-safe `onSuccess` queue map at `practice/page.tsx:518-529` and/or isolate from lock timer). Verify save persists and queue continues.
- [x] 3.4 Progress pill recycle: at the cycle-boundary branches (the `isLastOfPass` blocks that bump `iteration`), clear `seenWordIds` and `mehWordIds` for cards carried into the new pass so they count ⚫; leave `masteredCount` intact.

## 4. Background batched save

- [x] 4.1 Add a `flushedCount` cursor in `practice/page.tsx`; after each recorded attempt, if `attempts.length - flushedCount >= 5`, background-flush `attempts.slice(flushedCount)` via `submitSessionAttempts` and advance the cursor.
- [x] 4.2 Change `handleEndSession` to flush only `attempts.slice(flushedCount)`; ensure no duplicate inserts and no long end-of-session spinner.

## 5. Word modals — remove frequency + add-mistake checkbox

- [x] 5.1 Remove the Difficulty/Frequency `<select>` from `flath-app/components/AddWordModal.tsx`.
- [x] 5.2 Remove the Difficulty/Frequency `<select>` from `flath-app/components/EditWordModal.tsx` and stop writing `frequency_rank` in its `handleSave`.
- [x] 5.3 Add a `defaultChecked` "Add a mistake" checkbox to `AddWordModal`; plumb the flag through `useAddWord.addWords` and call `markWordAsMistake` for each added word when checked.

## 6. Vault — quick-tag, filter, inline archive

- [x] 6.1 Fix the "Added" temporal filter in `flath-app/app/vault/page.tsx` (both filter blocks): select `added_at` in the fetch and change `item.words_dim?.created_at` → `item.added_at`. Set `added_at` on the `user_word_settings` upsert in `useAddWord`.
- [x] 6.2 Add a one-tap "Add a Mistake" quick-action button to word rows in the main vault (My Library rows), calling `markWordAsMistake` then refreshing the row.
- [x] 6.3 Add an inline archive/remove action on "Added by others" rows (reuse `archiveWord` semantics: add-then-archive). Confirm My Library inline archive still works.

## 7. In-session vault drawer

- [x] 7.1 Create `flath-app/components/InSessionVaultDrawer.tsx`: slide-over with search, word list, Edit (reuse `EditWordModal`), and a "Add a Mistake" quick-action. Owns its own fetch/state; never mutates session queue/attempts/timers.
- [x] 7.2 Wire a toolbar button in `practice/page.tsx` to open the drawer; verify the card and session state are untouched on open/close.

## 8. Word packs rename

- [x] 8.1 Add an inline rename action on owned packs in `flath-app/app/packs/page.tsx` that updates `word_packs.name` with optimistic UI and an error toast.

## 9. Verification

- [~] 9.1 Automated verification PASSED: `npx tsc --noEmit` clean, `npm run build` compiles all routes, `openspec validate` passes. Interactive QA (3 viewports, logged-in Supabase session) is pending — requires the user's authenticated browser session and live practice/vault data. Manual checklist: Solo + duel no answer flash on advance; pill resets recycled cards to ⚫ on Review #2 (🟢 stays); edit-from-session works; Add modal has no frequency field and default-checked "Add a mistake" word appears in Mistake Fix; "Added last 7 days" returns correct words (after running `sql/add_added_at.sql`); vault quick-mistake drops rank; inline archive + pack rename persist; attempts appear mid-session every ~5 cards with no duplicates.

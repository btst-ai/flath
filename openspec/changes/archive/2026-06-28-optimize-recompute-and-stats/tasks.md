## 1. Batch the recompute

- [x] 1.1 In `app/actions/session.ts`, rewrite `recomputeUserWordSettings` body: return `{}` early
  if `wordIds` is empty; otherwise do ONE `attempts_history` read with `.in("word_id",
  uniqueWordIds)` and group rows into a `Map<string, Row[]>` (sort each group by `ts` asc in JS).
- [x] 1.2 Do ONE `user_word_settings` read (`word_id, avg_success_rate_prod, avg_success_rate_rec`)
  with `.in("word_id", uniqueWordIds)` into a `Map` for the zero-attempts fallback.
- [x] 1.3 Compute each word's row with the SAME logic as today (weighted success rates, interest
  moving average, review_count, last_reviewed/last_correct_at/last_mistake_at, fallback to existing
  avg or 50). Collect into an array.
- [x] 1.4 Persist with ONE `upsert(rows, { onConflict: "user_id,word_id" })` containing only the 7
  computed columns + PK. Preserve the `{ error? }` contract: any query error → log + return
  `{ error }`; success → return `{}`.

## 2. Verify

- [x] 2.1 `cd flath-app && npx tsc --noEmit` passes.
- [x] 2.2 Lint on `app/actions/session.ts`: no new violations.

## 3. Behavior check (manual — user)

- [ ] 3.1 Run a practice session; confirm the recap + a spot-checked word's success rate match
  expectations (parity with pre-change behavior).
- [ ] 3.2 Favourite a word, run a session that includes it, confirm it stays favourited (upsert
  does not clobber `is_fav`/`is_archived`/`added_at`).

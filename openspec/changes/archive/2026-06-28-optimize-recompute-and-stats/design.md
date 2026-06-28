## Context

Current `recomputeUserWordSettings` (session.ts:14-104): `for` loop over unique word ids, each
iteration doing (a) read all `attempts_history` for that word, (b) read current
`user_word_settings` for the zero-attempts fallback, (c) `update` the settings row. Returns
`{ error? }`. Computed fields per word:
- `avg_success_rate_prod/rec`: weighted mean ×100 (know=1.0, meh=0.3, forgot=0.0), per mode;
  fallback to existing avg (or 50) when that mode has no attempts.
- `interest_score`: mean of last 10 non-'none' interactions (fav+30, up+5, down-5, archive-30).
- `review_count`: total attempts.
- `last_reviewed`: now(). `last_correct_at`/`last_mistake_at`: latest 'know'/'forgot' ts.

## Goals / Non-Goals

**Goals:** same outputs, same return contract, ~3 round-trips instead of ~3N.
**Non-Goals:** P2 (pack stats) / P3 (vault others) — deferred to refactor changes; removing the
every-5 flush — deferred to Change 6; moving math into SQL — explicitly rejected (user chose the
readable-TypeScript route).

## Decisions

**D1. Three batched queries.**
1. `attempts_history.select("*").eq(user_id).in("word_id", uniqueWordIds)` — all history at once.
   Group into `Map<word_id, rows[]>` in JS. (Order per word by `ts` in JS after grouping so the
   "last correct/mistake" and "last 10 interactions" logic is unchanged.)
2. `user_word_settings.select("word_id, avg_success_rate_prod, avg_success_rate_rec").eq(user_id)
   .in("word_id", uniqueWordIds)` — existing rows for the zero-attempts fallback, into a `Map`.
3. Build one array of computed rows; `upsert(rows, { onConflict: "user_id,word_id" })`.

**D2. Upsert instead of per-row update.**
The prior code used `update` (no-op if the row is missing). Upsert is required to batch. Side effect:
a word with attempts but no settings row gets one created — correct, not a regression. To avoid
nulling columns not in the computed set, the upsert payload includes exactly the same columns the
old `update` set (avg_prod, avg_rec, interest_score, review_count, last_reviewed, last_correct_at,
last_mistake_at) plus the PK (user_id, word_id). Columns like `is_fav`, `is_archived`, `added_at`
are NOT in the payload; upsert only overwrites provided columns on conflict, leaving those intact.
(Verified: Supabase upsert updates only the supplied columns on conflict.)

**D3. Preserve the zero-attempts fallback.** For a word present in `wordIds` but with no history rows,
behavior matches today: keep existing avg (from query 2) or 50; review_count 0; interest 0;
last_correct/mistake null; last_reviewed now(). Same as the current `!history`/empty path.

**D4. Error handling unchanged in shape.** Any of the three queries erroring → log + return
`{ error }`. Empty `wordIds` → return `{}` immediately (no queries).

## Risks / Trade-offs

- **[Risk] Upsert nulls a column the old update didn't touch.** → Mitigation: payload lists only the
  same 7 computed columns + PK; conflict-update touches only those. `added_at`/`is_fav`/`is_archived`
  untouched. Called out for manual verification (add a fav, run a session, confirm fav persists).
- **[Risk] Large `in()` list.** → Sessions cap at ~50 words; well within limits. Note for future
  callers passing huge lists (none today).
- **[Trade-off] Behavior parity rests on careful JS grouping.** Mitigated by keeping the exact same
  per-word computation, just fed from a grouped Map instead of a per-word query.

## Migration Plan

Pure code change in one function. Verify: `tsc`/lint; run a practice session and confirm recap stats
+ a spot-checked word's success rate match expectations; confirm a favourited word stays favourited
after a session (upsert column-preservation check). No DB or deploy steps.

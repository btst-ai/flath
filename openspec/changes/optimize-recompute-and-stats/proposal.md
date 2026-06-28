## Why

`recomputeUserWordSettings` (app/actions/session.ts) loops per word, running 2 reads + 1 write
each. A 25-word session is ~75 sequential Supabase round-trips, and it runs on every end-session
**and** every 5-attempt background flush — the user reported the end-of-session save feeling slow,
which this directly explains. The work is latency-bound (the math is trivial); batching the queries
collapses ~75 round-trips to ~3 with identical results.

## What Changes

- Rewrite `recomputeUserWordSettings` to be batched (review finding P1), preserving its current
  return contract (`Promise<{ error?: string }>`) and computed values exactly:
  1. ONE read of `attempts_history` for all `wordIds` via `.in("word_id", ids)`, grouped per word
     in a JS `Map`.
  2. ONE read of existing `user_word_settings` for all `wordIds` (for the zero-attempts fallback).
  3. ONE batched `upsert` of all computed rows (`onConflict: "user_id,word_id"`).
- Behavior is unchanged: same success-rate weighting (know=1.0, meh=0.3, forgot=0.0), same interest
  moving-average, same `last_correct_at`/`last_mistake_at`, same fallback to existing averages when a
  word has no attempts.
- Scope note: this change is **P1 only**. The pack-stats client-side recompute (P2) and the
  vault "added by others" JS filter (P3) are deferred to the vault/practice refactor changes, which
  already restructure those pages — folding them in there avoids touching the monolith twice.
- The every-5 background flush in `practice/page.tsx` is **left in place**: with recompute fast it is
  now cheap, and removing it is a behavior change better made during the practice refactor (Change 6),
  where the attempt-batching logic is being extracted anyway.

## Capabilities

### Modified Capabilities
- `attempt-aggregates`: the recompute MUST remain correct and report errors (unchanged contract),
  and SHALL perform a bounded, small number of database round-trips independent of word count.

## Impact

- **Files:** `app/actions/session.ts` (function body only).
- **Code:** internal rewrite; callers (`markWordAsMistake`, `submitSessionAttempts`, `duel.ts`)
  unchanged — same signature and return type.
- **Behavior:** identical aggregates; faster. Upsert (vs the prior `update`) will also create a
  settings row for any word that has attempts but somehow lacks one — a strict improvement.
- **Risk:** medium (core stats path). Verify with `tsc`/lint and a manual practice session whose
  recap/stats match expectations; spot-check a word's success rate before/after.

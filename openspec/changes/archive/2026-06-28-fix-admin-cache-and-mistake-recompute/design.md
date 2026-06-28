## Context

- `useIsAdmin` (hooks/useIsAdmin.ts): module-level `cachedIsAdmin`/`cachedUserId`, effect with `[]`
  deps, no auth subscription. Cache is uid-keyed so a *remounted* component recovers, but a
  *mounted* one goes stale on user switch.
- `recomputeUserWordSettings` (app/actions/session.ts): `for` loop of per-word read/read/update,
  returns nothing. `markWordAsMistake` (returns `{success:true}|{error}`) and `submitSessionAttempts`
  (returns `{success:true}|{error}`) call it without capturing failures.
- Callers of `markWordAsMistake` already do `if ("error" in result) toast.error(...)` (vault,
  AddWordModal, InSessionVaultDrawer). The practice flush caller logs `result.error`.

## Goals / Non-Goals

**Goals:** B1 — admin status reactive to auth changes. B3 — recompute failures propagate to callers.

**Non-Goals:** eliminating the N+1 in recompute (that's Change 4); refactoring how callers display
errors (they already branch on `error`).

## Decisions

**D1. Subscribe to `onAuthStateChange` in `useIsAdmin`.**
Add a subscription inside the effect. On every event, compare `session?.user?.id` to `cachedUserId`;
if different (including becoming null on `SIGNED_OUT`), clear `cachedIsAdmin`/`cachedUserId` and
re-run the role check (or set false when no uid). Return the unsubscribe in the effect cleanup. Keep
the existing initial `check()` for first mount. This preserves the cache's performance benefit while
making it correct across user switches.
Alternative considered: drop the module cache entirely. Rejected — it exists to avoid refetching the
role on every mount; the subscription fixes correctness without losing that.

**D2. `recomputeUserWordSettings` returns `Promise<{ error?: string }>`.**
Capture `.error` from each read/update; on the first error, log and return `{ error: message }`
(don't keep looping — a failing client/connection won't recover mid-loop). On full success return
`{}`. Non-breaking: no current caller uses the (void) return.

**D3. Propagate in the two callers.**
`markWordAsMistake`: after `recomputeUserWordSettings`, if it returns an error, return
`{ error: recomputeError }` instead of `{ success: true }`. The attempt row is already inserted, so
the error message notes aggregates may be stale (the row itself persisted).
`submitSessionAttempts`: same — return `{ error }` when recompute fails so the practice flush logs it.

## Risks / Trade-offs

- **[Risk] `onAuthStateChange` fires frequently (token refresh).** → Mitigation: the handler is a
  cheap uid comparison; it only refetches the role when the uid actually changes.
- **[Trade-off] On recompute failure the attempt row is already written.** Accepted: the insert is
  the source of truth; aggregates are derived and self-heal on the next successful recompute. The
  error informs the user/log that a refresh may be needed; we do not roll back the insert (that would
  need a transaction — out of scope, related to Change 3).
- **[Risk] Early-return on first recompute error skips remaining words.** Accepted: a failing
  Supabase client won't succeed on later words either; surfacing fast is better than N failures.

## Migration Plan

Pure code change. Verify: `tsc --noEmit`, lint (no new violations), and manual B1 test
(admin logout → non-admin login in same tab → admin UI disappears without reload).

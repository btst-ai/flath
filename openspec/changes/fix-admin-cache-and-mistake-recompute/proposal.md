## Why

Two correctness bugs from the review:

- **B1 — stale admin cache.** `hooks/useIsAdmin.ts` caches admin status at module scope keyed by
  uid, but its effect runs once (`[]` deps) and never subscribes to auth changes. A component
  mounted before a user switch (logout → different login in the same tab) keeps showing the previous
  user's admin UI until it remounts. This gates privileged controls, so stale state is a real risk.
- **B3 — swallowed recompute failures.** `recomputeUserWordSettings` returns `void`; its callers
  `markWordAsMistake` and `submitSessionAttempts` therefore report `{ success: true }` even if the
  aggregate recompute failed after the insert succeeded. Aggregates can silently drift from
  `attempts_history`, and the UI shows success on a partial failure.

## What Changes

- `hooks/useIsAdmin.ts`: subscribe to `supabase.auth.onAuthStateChange`; on `SIGNED_OUT` or a uid
  change, invalidate the module cache and re-evaluate. Unsubscribe on unmount.
- `app/actions/session.ts`:
  - `recomputeUserWordSettings` returns `{ error?: string }` (captures the first failing
    read/update instead of ignoring it).
  - `markWordAsMistake` and `submitSessionAttempts` check that result and include the recompute
    error in their own `{ error }` return when it fails.
- Callers already branch on `"error" in result` (vault, AddWordModal, InSessionVaultDrawer) and will
  surface the toast automatically; the practice background-flush caller already logs errors.

## Capabilities

### New Capabilities
- `admin-state`: admin status MUST track the current authenticated user and update without a manual
  page reload when the user signs out or changes.
- `attempt-aggregates`: operations that record attempts and recompute per-word aggregates MUST
  report a failure in the recompute step to the caller rather than reporting success.

## Impact

- **Files:** `hooks/useIsAdmin.ts`, `app/actions/session.ts`.
- **Code:** `recomputeUserWordSettings` signature changes from `Promise<void>` to
  `Promise<{ error?: string }>`; internal callers updated. No external caller passes/uses a return
  value today, so this is non-breaking.
- **Risk:** low. Verify with `tsc --noEmit`, lint, and the B1 manual test (logout→login, admin UI
  updates without reload).

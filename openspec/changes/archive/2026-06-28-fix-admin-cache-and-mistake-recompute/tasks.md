## 1. Reactive admin status (B1)

- [x] 1.1 In `hooks/useIsAdmin.ts`, subscribe to `supabase.auth.onAuthStateChange` inside the
  effect. On each event, if `session?.user?.id` differs from `cachedUserId` (including null on
  sign-out), invalidate `cachedIsAdmin`/`cachedUserId` and re-evaluate (set false when no uid,
  else refetch the role). Return the subscription's `unsubscribe` in the effect cleanup.

## 2. Propagate recompute failures (B3)

- [x] 2.1 In `app/actions/session.ts`, change `recomputeUserWordSettings` to return
  `Promise<{ error?: string }>`: capture `.error` from the history read, settings read, and update;
  on the first error log it and return `{ error }`; otherwise return `{}`. (Settings-read PGRST116
  "no rows" is tolerated, not treated as an error.)
- [x] 2.2 In `markWordAsMistake`, capture the recompute result; if it has an error, return
  `{ error }` instead of `{ success: true }`.
- [x] 2.3 In `submitSessionAttempts`, capture the recompute result; if it has an error, return
  `{ error }` instead of `{ success: true }`.

## 3. Verify

- [x] 3.1 `npx tsc --noEmit` passes (No errors found).
- [x] 3.2 Lint on touched files: no NEW violations. One pre-existing
  `@typescript-eslint/no-explicit-any` remains on `submitSessionAttempts(attempts: any[])`
  (review finding C1, addressed in refactor changes).
- [ ] 3.3 (Manual, user) Admin signs out, non-admin signs in same tab → admin-only UI disappears
  without a page reload.

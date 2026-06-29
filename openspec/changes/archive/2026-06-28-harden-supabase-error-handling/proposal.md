## Why

The project's `CLAUDE.md` mandates: *"Always check `error` on Supabase responses. RLS denials
return `{ data: [], error: null }` and look like 'no data' rather than failures. Surface errors via
Sonner toast and log to console."* A review found a few reads that violate this rule, so failures
surface as silent empty states with no feedback to the user.

## What Changes

- `app/packs/page.tsx`: the `user_word_settings` fetch (stats) and the `word_pack_items` fetch
  currently destructure only `data` and ignore `error`. Add `error` checks with a Sonner toast +
  console log; on error, stop the load cleanly rather than computing stats over partial data.
- `hooks/useAddWord.ts`: the `user_word_settings` upsert logs `settingsError` to the console but
  never tells the user. Surface a Sonner toast so a failed add is visible.
- Scope note: a review pass confirmed `app/vault/page.tsx` already checks `.error` on its reads
  (library, "added by others", mastered-ids), so it is **out of scope** — the original plan
  overstated this. No defensive owner-filter on `word_pack_items` is needed either: RLS verification
  confirmed it is correctly owner-scoped via an EXISTS policy.

## Capabilities

### New Capabilities
- `data-access-resilience`: every Supabase read/write whose failure would otherwise present as an
  empty or silently-incomplete UI MUST check `error` and surface it to the user (toast) and the
  console.

## Impact

- **Files:** `app/packs/page.tsx`, `hooks/useAddWord.ts`.
- **Code:** small, additive error-handling branches; no behavior change on the success path.
- **Risk:** low. Verification: `npm run lint` + `npx tsc --noEmit` clean; manually trigger a failing
  read (e.g. revoke a policy in a scratch project) and confirm a toast appears.

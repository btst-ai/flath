## Context

Two confirmed gaps against the CLAUDE.md "always check error" rule:
- `app/packs/page.tsx` `fetchPacks`: `wordsData` (lines ~80-91) and `staticItems` (lines ~93-95)
  destructure only `data`. A later block already checks `error` on the `word_packs` fetch (~114-124)
  and returns on failure, so the pattern to follow is in the same function.
- `hooks/useAddWord.ts` (~144-156): `settingsError` is `console.error`-logged but never toasted.

`app/vault/page.tsx` was re-checked and already complies (toasts on `myError`, `othersError`, and the
mastered-ids fetch error) — excluded from scope.

## Goals / Non-Goals

**Goals:** make the two flagged failures user-visible (toast) + logged, without altering success-path
behavior.

**Non-Goals:** a codebase-wide audit of every query (only the flagged ones); changing RLS (verified
correct); refactoring `fetchPacks` structure (covered later by Change 4's server-side stats work).

## Decisions

**D1. Match the existing in-file pattern.** In `fetchPacks`, the `word_packs` fetch already does
`if (error) { toast.error(...); setIsLoadingPacks(false); return; }`. The two new checks mirror it
exactly — on error, toast + console.error + `setIsLoadingPacks(false)` + `return`, so stats are never
computed over partial data. Consistent with the file; minimal surface area.

**D2. `useAddWord` toast on settings failure.** Replace the silent `console.error("Settings error")`
with `console.error(...)` retained **plus** `toast.error("Failed to save <greek> to your library")`.
Keep the `continue` semantics (the loop moves to the next word) so a multi-word import still processes
the rest. `toast` is already imported in the hook.

## Risks / Trade-offs

- **[Risk] Toast spam if many words fail in a bulk import.** → Mitigation: acceptable for now (bulk
  import is desktop-only and failures are rare); a future improvement could aggregate. Logged as a
  non-goal rather than over-engineered here.
- **[Trade-off] Returning early from `fetchPacks` on a stats-fetch error means no packs render.**
  Accepted: better an explicit "failed to load" toast than a silent partial list.

## Migration Plan

Pure code change. Verify with `npm run lint` and `npx tsc --noEmit`. No DB or deploy steps.

## 1. Packs page error checks

- [x] 1.1 In `app/packs/page.tsx` `fetchPacks`, add an `error` check to the `user_word_settings`
  (stats) fetch: on error, `console.error`, `toast.error("Failed to load packs")`,
  `setIsLoadingPacks(false)`, and `return` — mirroring the existing `word_packs` error block.
- [x] 1.2 Add the same `error` check to the `word_pack_items` fetch in the same function.

## 2. useAddWord settings error

- [x] 2.1 In `hooks/useAddWord.ts`, when the `user_word_settings` upsert returns `settingsError`,
  add `toast.error(\`Failed to save ${word.greek_text} to your library\`)` alongside the existing
  `console.error`. Keep the `continue` so remaining words still process.

## 3. Verify

- [x] 3.1 Lint: `npx eslint` on the two touched files introduces no NEW violations. Pre-existing
  `@typescript-eslint/no-explicit-any` / `no-unused-vars` warnings remain (tracked as review
  finding C1, addressed in the refactor changes).
- [x] 3.2 `npx tsc --noEmit` passes (No errors found).

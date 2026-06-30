## 1. Add difficulty state and pre-fill

- [ ] 1.1 In `flath-app/components/EditWordModal.tsx`, add `const [difficulty, setDifficulty] = useState<string>("")` to the component state declarations
- [ ] 1.2 In the word-load `useEffect` (lines 63-70), add `setDifficulty(getDifficultyFromRank(word.frequency_rank ?? 8001))` after the existing `setPos` call

## 2. Add selector JSX

- [ ] 2.1 After the Theme/Part-of-Speech grid closing `</div>` (around line 225), add a full-width Difficulty `<select>` with options easy/medium/hard/niche, bound to `difficulty` state, gated by `disabled={!canEdit}`

## 3. Write frequency_rank on save

- [ ] 3.1 In `handleSave`, add `frequency_rank: getRankFromDifficulty(difficulty)` to the Supabase `.update({...})` payload

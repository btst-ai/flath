# Phase 3 — Practice Engine Overhaul

## Context

The training platform needs finer state control during practice and better isolation of weak spots:
- Users repeat words they've already reviewed today, wasting session slots.
- The single-pass progress count (`X / Y`) hides what's actually happening — known vs. retrying vs. unseen cards.
- A user can dismiss a missed card too fast to absorb the correct answer.
- Successful struggles (low-success-rate words finally getting it right) are invisible in the recap.
- Some Vault filters add little value on mobile and crowd the layout.

This phase introduces a new daily/today exclusion, per-state progress, an iteration counter, a forced 5s exposure on misses, a celebration marker for hard-won wins, and a mobile-trimmed Vault.

---

## 1. Exclude Reviewed Today filter

**File**: `flath-app/components/PracticeSelectionModal.tsx`

- Add `excludeReviewedToday` state (default `true`), as a second checkbox directly under the existing `excludeSuccessful` checkbox at the top of the modal (lines 82–93).
- Pass to all four mode buttons (Smart, Mistakes, Random, Pack) as `&exclude_today=1`.

**File**: `flath-app/app/practice/page.tsx`

- Parse `exclude_today` from search params (mirroring `excludeSuccessful` lines 32–34).
- After `fetchUserWords` / `getMistakesForRepair`, if enabled, drop words where `last_reviewed` falls inside today's local calendar date.
  - Use a local-date comparison (not 24h rolling), since the requirement is "current calendar date". Compare `new Date(w.last_reviewed).toDateString() === new Date().toDateString()`.
- `getMistakesForRepair` already filters 24h-rolling. Apply the new today-calendar filter on top regardless of mode, after the fetch — single shared step.

---

## 2. Vault filter sync + mobile trim

**File**: `flath-app/app/vault/page.tsx`

- Add a new `filterExcludeSuccessful: boolean` state (default `false`), rendered as a checkbox in the existing filter strip (next to status/heat filters around lines 70–75 of state, with the visible chip alongside other filter controls).
- When checked, apply the same logic as `filterMasteredWords` (`lib/sessionQueue.ts` line 185–217): success rate >75% over last 7 days from `attempts_history` excludes the word.
  - Implementation: fetch the recent attempts once on vault load (or memoize lazily when the filter is toggled on) and compute a `Set<word_id>` of "mastered" ids; intersect with the current list. Avoid running the query on every filter pass.
  - Reuse `filterMasteredWords` directly by calling it after the existing filter pipeline (it's already a `Promise<UserSetting[]>` — wrap with a `useEffect` that produces `masteredIds` set; gate via the checkbox).

- Mobile gate the following filter controls in the vault filter row (use existing `showDesktopOnly = !isMobileSurface(surface)` already on line 42):
  - Review count range (`filterReviewMin/Max`)
  - Success rate range (`filterSuccessMin/Max`)
  - Heat filter (`filterHeat`)
  - Frequency rank range (`filterFreqMin/Max`)
- Wrap each of those filter UI blocks with `{showDesktopOnly && (...)}`. Leave the state variables intact (they default to "no filter") so logic doesn't break.
- Add `// desktop-only — see flath-app/CLAUDE.md` comments at each gate site, and update the gate registry list in `flath-app/CLAUDE.md`.

---

## 3. Progress tracker rework (K / N / R + iteration)

**File**: `flath-app/app/practice/page.tsx`

Replace the current `{masteredCount} / {totalSessionSize}` pill (lines 402–405 mobile, 426–429 desktop) with a four-token display:

```
🟢 K   ⚪ N   🔴 R   ·   Review #i
```

Where:
- **K** = count of words removed from queue via "know" (currently tracked as `masteredCount`).
- **N** = words not yet seen this session: `totalSessionSize - seenWordIds.size`.
- **R** = words to retry: `queue.length - (currentWord not yet answered)` minus N, i.e. words that have been answered as meh/forgot and are still pending. Derive from a `seenWordIds: Set<string>` populated when a word is first answered.
- **i** = iteration counter, starting at 1, incremented when a full pass of the queue completes and we wrap back to recycle unmastered cards.

State additions:
- `const [seenWordIds, setSeenWordIds] = useState<Set<string>>(new Set())`
- `const [iteration, setIteration] = useState(1)`
- `const [passStartQueueIds, setPassStartQueueIds] = useState<string[]>([])` — the ordered ids that began the current pass.

Iteration trigger (in `handleAction`, when an item is moved to the back via meh/forgot):
- When the card just answered is the LAST id of the current pass (i.e., it was the final unseen id from `passStartQueueIds`), the new queue formed afterward IS the next pass. Increment `iteration`, reset `passStartQueueIds` to the new queue's ids.
- Initialize `passStartQueueIds` to the initial queue ids in `fetchSessionData`.

Render letters as single-character colored chips:
- `K` green (`text-green-600`)
- `N` gray (`text-gray-400`)
- `R` red (`text-red-600`)
Use the same pill container styling as the existing stats pill. Keep both mobile and desktop variants in sync.

---

## 4. Retention Intercept (5s block on miss)

**File**: `flath-app/app/practice/page.tsx`

When `handleAction("meh")` or `handleAction("forgot")` fires (line 164), introduce a 5-second cooldown during which all action buttons are disabled (Forgot / Unsure / Knew It on the action row, plus "Show less", "Show more", flip, archive, fav). No countdown UI — no text, no spinner — just disabled buttons and the card showing the answer.

Implementation:
- Add `const [isLockedUntil, setIsLockedUntil] = useState<number>(0)`.
- On miss outcome (meh/forgot), set `isLockedUntil = Date.now() + 5000` BEFORE the existing 150ms `setTimeout` advances the queue.
- The 150ms advance currently flips back and moves the card to the back — change that flow on miss: instead, KEEP the card flipped (don't reset `flipped`), KEEP `queue[0]` as-is, and lock buttons. After 5s, advance the queue and reset `flipped`.
- Action buttons compute `disabled = Date.now() < isLockedUntil` (via a ticking effect or `useState(0)` + `setInterval` re-render every 250ms while locked). Use `pointer-events-none opacity-60` styling.
- Apply to flip handler too: `onClick={() => { if (Date.now() < isLockedUntil) return; setFlipped(!flipped); }}` — but actually no visible affordance, per user request "just the cards with no distraction".
- Show less / Show more / fav / archive: also no-op while locked.
- The "know" path is unaffected (no lock).

Edge case: if this was a `isReviewingSkippedCard` flow and outcome is miss, still apply the lock (the user wanted exposure to the answer regardless).

---

## 5. Celebration marker on session summary

**File**: `flath-app/app/practice/page.tsx` (recap section lines 254–339)

Trigger: a word qualifies for 🎉 if **all** of:
1. It was answered `know` on its FIRST attempt this session.
2. EITHER its historical avg success rate (mean of `avg_success_rate_prod` and `avg_success_rate_rec`, from the `SessionWord` already loaded — already available on each `sw`) is **< 40**, OR its most recent prior attempt in `attempts_history` had outcome `forgot`.

State + data:
- During session, track first-attempt-correct ids: derive from `attempts` array in the recap render — for each `word_id`, find its first attempt; if outcome is `know`, it qualifies on condition (1).
- For condition (2):
  - Historical success rate is on `sessionWords[i]` already (no extra fetch needed for the <40% branch).
  - "Previous attempt was forgot" requires a single query before the session ends, OR a query at recap render time. Add a new server action: `getLastAttemptOutcomes(userId, wordIds) → Map<word_id, "know"|"meh"|"forgot">` in `flath-app/app/actions/session.ts`. Query `attempts_history` for the given `word_ids`, latest `ts` per word BEFORE the session started (`ts < sessionStartTs`). Call this from `handleEndSession` after attempts are submitted, store result in state, render in recap.
  - Capture `sessionStartTs` at the top of `fetchSessionData`.

Recap row update (around line 312–328):
- Compute `qualifies` per row using the criteria above.
- When `qualifies`, render a `🎉` badge in the badges row (before the ✗/?/✓ pills), e.g. `<span className="text-base">🎉</span>`.

---

## Critical files

- `flath-app/components/PracticeSelectionModal.tsx` — new checkbox + URL param
- `flath-app/app/practice/page.tsx` — biggest changes (param parsing, today-exclusion, K/N/R + iteration, 5s lock, recap 🎉)
- `flath-app/app/vault/page.tsx` — exclude-successful checkbox, mobile gating of 4 filter blocks
- `flath-app/app/actions/session.ts` — new `getLastAttemptOutcomes` server action
- `flath-app/lib/sessionQueue.ts` — reuse `filterMasteredWords` (no edits needed)
- `flath-app/CLAUDE.md` — update gated-features registry with the new mobile gates

---

## Verification

Run the app locally (`cd flath-app && pnpm dev` per project convention) and:

1. **Exclude Reviewed Today**:
   - Practice a word, end session. Reopen practice modal; with checkbox ON, that word should not appear. Toggle OFF, it should be available again. Re-test at midnight boundary if possible (calendar-date semantics, not 24h).
2. **Vault sync + mobile**:
   - Desktop ≥1024px: confirm "Exclude successful" checkbox works on Vault, matches PracticeSelectionModal behavior for the same user.
   - Resize to 375px (DevTools): confirm review count / success rate / heat / frequency filter controls are hidden; theme, status, PoS, last-reviewed, search remain.
3. **K/N/R + iteration**:
   - Start a 10-card session. Mark 3 as "know", 3 as "forgot", 4 as "meh". Verify K=3, R=7 (or appropriate), N=0 after first pass. When the recycled queue starts, verify Review #2 appears.
4. **5s block**:
   - Mark a card as forgot. Try immediately tapping Forgot/Unsure/Knew/flip — all should be no-ops. After ~5s, buttons re-enable. No countdown UI is visible.
5. **🎉 marker**:
   - Find a word with historical success rate <40% (or that you last answered "forgot"). Practice it, answer "know" on first attempt. Confirm 🎉 next to it on the session summary.
   - Same word but miss it first attempt → no 🎉.
6. **Type-check**: `pnpm tsc --noEmit` from `flath-app/`.
7. **Smoke test on PWA viewport** (375px DevTools, Application → Manifest "installed" preview) per `flath-app/CLAUDE.md` checklist.


Also in the plan:
# Plan — Adaptive Modality Distribution in `assignTracks`

## Context

Today, `assignTracks()` in [lib/sessionQueue.ts:289](flath-app/lib/sessionQueue.ts:289) decides per card whether to show Production (FR→EL) or Recognition (EL→FR) using a per-word 20% success-rate delta with a flat 50/50 coin flip as fallback. This ignores the learner's *global* vulnerability and gives Production no structural preference, even though active recall is the learning goal.

The new spec turns the decision into a population-level **dynamic randomizer**:

- **Adaptive bias:** continuously evaluate the delta between Production failures and Recognition failures across the user's recent attempts.
- **Default siphon:** skew card generation toward whichever modality is currently more vulnerable.
- **Baseline:** when failures are balanced, fall back to a fixed Production-leaning bias (70%) to build active vocabulary.

Per the user's answers: replace the per-word logic entirely, baseline = 70% Production, failure window = last 14 days.

## Approach

Replace the per-word branching in `assignTracks()` with a single global probability `pProd` computed once per session, then sample each word independently against it.

### Computing `pProd`

New helper, colocated in [lib/sessionQueue.ts](flath-app/lib/sessionQueue.ts):

```ts
export function computeProdProbability(
  prodFailures14d: number,
  recFailures14d: number,
  baseline = 0.70,        // baseline Production bias
  maxSwing = 0.25,        // cap on adaptive deviation
): number
```

Logic:

1. `total = prodFailures14d + recFailures14d`
2. If `total < 10` (sample too small): return `baseline` (0.70).
3. `failureShareProd = prodFailures14d / total` — share of recent failures that came from the Production track.
4. `vulnerabilityDelta = failureShareProd - 0.5` — positive means Production is the weaker modality (more failures there), so we should siphon *toward* Production.
5. `pProd = clamp(baseline + vulnerabilityDelta * 2 * maxSwing, baseline - maxSwing, baseline + maxSwing)`
6. Hard floor/ceiling at `[0.40, 0.95]` so neither modality starves entirely.

This keeps Production baseline-favored (0.70), lets recent Recognition strength push it up toward ~0.95, and lets Recognition vulnerability pull it back down only to ~0.45 (never below floor) — Production remains structurally preferred even when Recognition is weaker, matching the "baseline bias toward Production" rule.

### Fetching failure counts

A new server action in [app/actions/session.ts](flath-app/app/actions/session.ts), next to the existing `recomputeUserWordSettings()` recap logic that already groups `attempts_history` by `mode`:

```ts
export async function getModalityFailureCounts(userId: string, days = 14):
  Promise<{ prodFailures: number; recFailures: number }>
```

Query `attempts_history` for the user, last 14 days, where `outcome = 'no'` (failures), grouped by `mode`. `outcome = 'meh'` is **not** counted as a failure to keep the signal clean — same convention as `recomputeUserWordSettings` which weights `meh` at 0.3.

### Wiring into the session

In [app/practice/page.tsx:157](flath-app/app/practice/page.tsx:157), before `assignTracks(...)`:

1. Call `getModalityFailureCounts(userId, 14)`.
2. Compute `pProd = computeProdProbability(prodFailures, recFailures)`.
3. Pass `pProd` into `assignTracks(words, "mixed", pProd)`.

### New `assignTracks` signature

```ts
export function assignTracks(
  words: UserSetting[],
  mode: CardMode,
  pProd = 0.70,   // only used in "mixed"; ignored for forced modes
): SessionWord[]
```

For `"prod"` / `"rec"` modes, behavior is unchanged (forced track). For `"mixed"`, the entire per-word branch becomes:

```ts
track = Math.random() < pProd ? "prod" : "rec";
```

The per-word 20% delta logic at lines 297–303 is removed, per the user's choice.

## Critical files

- [lib/sessionQueue.ts](flath-app/lib/sessionQueue.ts) — replace `assignTracks` body; add `computeProdProbability`.
- [app/actions/session.ts](flath-app/app/actions/session.ts) — add `getModalityFailureCounts` server action; reuse the same `attempts_history` query shape as `recomputeUserWordSettings` (lines 52–60).
- [app/practice/page.tsx](flath-app/app/practice/page.tsx) — fetch failure counts and pass `pProd` into `assignTracks` at line 157.

No DB schema change. `attempts_history.mode` and `attempts_history.outcome` already exist.

## Surface impact

Pure engine change, no UI. Applies identically to `desktop`, `mobile-web`, `pwa` — no surface gating needed per [CLAUDE.md](flath-app/CLAUDE.md).

## Verification

1. **Unit-level sanity** (manual, in REPL or a throwaway test):
   - `computeProdProbability(0, 0)` → `0.70`
   - `computeProdProbability(30, 10)` → above 0.70 (Production is weaker, siphon toward Production), clamped at `0.70 + 0.25 = 0.95`.
   - `computeProdProbability(10, 30)` → below 0.70 (Recognition is weaker), around `0.70 - 0.25*0.5 ≈ 0.575`, floored at 0.45.
   - `computeProdProbability(5, 4)` → `0.70` (under sample threshold).
2. **End-to-end**: start a Practice session in "mixed" mode with a user who has ≥10 failures in the last 14 days; in the React DevTools / network, confirm `getModalityFailureCounts` returns and that `queue[].track` distribution over a 25-card session is roughly Production-skewed (~70% Production at balanced state).
3. **Edge case**: new user with empty `attempts_history` → `pProd = 0.70`, no errors.
4. **Verify analytics still recompute**: complete a session, confirm `recomputeUserWordSettings` still writes per-modality success rates as before (unchanged path).
5. **Smoke test on all three surfaces** per [CLAUDE.md](flath-app/CLAUDE.md): 1280px, 768px, 375px.
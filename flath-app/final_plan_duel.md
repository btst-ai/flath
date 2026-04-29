# Plan: The Duel Feature

## Context

The Greek Lexical Engine is a B1 Modern Greek vocabulary app (Next.js 16 App Router + Supabase + Framer Motion). It already has a solo Practice loop with SRS-style scoring, Interest Score, Word Packs, and Smart Shuffle.

The **Duel** feature (Iteration 3) adds a **local 2-player competitive mode** on a single device: P1 (left keyboard cluster: `ZXC` / `Q`) vs. P2 (right keyboard cluster: `BNM` / `P`). The hooks are: confidence-claim race → a "Winner" speaks the answer → peers grade each other → dual confirmation → next card. Goal: turn passive solo practice into an active-recall social ritual between Baptiste 🇫🇷 and Efi 🇬🇷.

Per clarifying answers:
- **Same device, one keyboard** — no Supabase Realtime needed.
- **Card mode**: 50% Production / 50% Recognition by default; Lobby lets P1 choose Prod-only / Rec-only / Mixed.
- **Fixed 50 cards** per duel (no endless loop).
- **P2 is optional/guest-capable.** Email may be empty (guest, no sync), valid & ≠ P1 (🟢 connected, full sync), or entered-but-invalid (🔴 blocks start with inline error). Connection status shown as a live icon in the Lobby.
- **Scoring**: `I Know {+2,0,-3}`, `Meh {+1,+0.5,-0.5}`, `Don't Know {+0.5,+0.5,0}`. Winner's row is doubled. Tie-break rules:
  - Both `I Know` → fastest timestamp is Winner and gets ×2.
  - Both `Meh` or both `Don't Know` → **no Winner, no ×2** — both players get un-doubled scoring; card auto-reveals (no speak phase).
  - Different confidence → highest confidence is Winner (speed ignored); ×2 applies.
- **Evolution chart is always visible during the duel** (HUD), not just on the victory screen. It updates after each round is SCORED.
- **Persistence**: lightweight `duels` summary table only (no per-round rows). The per-round series powering the live chart lives in React state.
- **Interest axis is disabled in-duel**; editing still available from the Vault/edit modals.

---

## 1. Data Model — new `duels` table

The existing tables (`words_dim`, `user_word_settings`, `attempts_history`, `word_packs`, `word_pack_items`) were created by hand in the Supabase Dashboard — there is no `supabase/` folder, CLI, or migration pipeline in the repo. We'll match that pattern: keep the SQL **in the repo for documentation** under `flath-app/sql/duels.sql`, and the user runs it once by **pasting it into Supabase Dashboard → SQL Editor → Run**. No CLI install required.

`p2_user_id` is **nullable** to support guest mode.

```sql
CREATE TYPE duel_data_source AS ENUM ('p1', 'p2', 'avg');
CREATE TYPE duel_card_mode   AS ENUM ('prod', 'rec', 'mixed');
CREATE TYPE duel_winner      AS ENUM ('p1', 'p2', 'tie');

CREATE TABLE duels (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  p1_user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  p2_user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL = guest P2
  p2_is_guest      BOOLEAN NOT NULL DEFAULT FALSE,
  p1_display_name  TEXT NOT NULL DEFAULT 'Baptiste',
  p2_display_name  TEXT NOT NULL DEFAULT 'Efi',
  p1_flag          TEXT NOT NULL DEFAULT '🇫🇷',
  p2_flag          TEXT NOT NULL DEFAULT '🇬🇷',
  pack_id          UUID REFERENCES word_packs(id) ON DELETE SET NULL,
  data_source      duel_data_source NOT NULL DEFAULT 'avg',
  card_mode        duel_card_mode   NOT NULL DEFAULT 'mixed',
  p1_final_score   NUMERIC(6,1) NOT NULL,
  p2_final_score   NUMERIC(6,1) NOT NULL,
  winner           duel_winner  NOT NULL,
  total_cards      INT NOT NULL,
  duration_ms      INT NOT NULL,
  ts_started       TIMESTAMPTZ NOT NULL,
  ts_finished      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (p2_user_id IS NULL OR p1_user_id <> p2_user_id)
);

ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Duel participants can read their duels" ON duels
  FOR SELECT USING (auth.uid() = p1_user_id OR auth.uid() = p2_user_id);
CREATE POLICY "P1 can insert" ON duels
  FOR INSERT WITH CHECK (auth.uid() = p1_user_id);

CREATE INDEX idx_duels_p1 ON duels(p1_user_id, ts_finished DESC);
CREATE INDEX idx_duels_p2 ON duels(p2_user_id, ts_finished DESC) WHERE p2_user_id IS NOT NULL;
```

**No new table for per-round data.** Per-round scores live in React state during the session (powering the live chart HUD); only the summary is persisted. `attempts_history` gets one row per card **for P1 always**, and one row per card **for P2 only when P2 is connected** (reusing the existing batch-insert path in `app/actions/session.ts:3-85`).

---

## 2. UX Flow

### 2.1 Entry point
Add a **"Duel"** button on the home dashboard (`flath-app/app/page.tsx`) next to Practice / Vault / Packs. Route: `/duel`.

### 2.2 Lobby (`/duel` — initial state)
- **Source selector**: Smart Shuffle | Word Pack (fetch packs via the existing `PracticeSelectionModal` data path in `flath-app/components/PracticeSelectionModal.tsx:19-50`).
- **Data source radio** (only visible when Smart Shuffle is picked): `P1 ranks` | `P2 ranks` | `Average of both` (default).
  - If P2 is guest (empty email), `P2 ranks` and `Average of both` are greyed out; `P1 ranks` forced.
- **Card mode radio**: `Prod only` | `Rec only` | `Mixed 50/50` (default).
- **P1 panel**: auto-filled from current session (display name + flag editable, defaults Baptiste 🇫🇷). Connection icon: 🟢 (always connected).
- **P2 panel**: email input (debounced validate), display name + flag (defaults Efi 🇬🇷). Connection icon states:
  - ⚪ empty → **Guest mode** — label "Guest (no progress sync)"; Start Duel **enabled**.
  - 🟡 checking → debounced server action in flight; Start Duel disabled.
  - 🔴 invalid / not found / same as P1 → inline error, Start Duel **disabled**.
  - 🟢 connected → label shows matched display name if available; Start Duel enabled, full sync.
- **Start Duel** button — disabled only when P2 panel is 🟡 or 🔴. Guest (⚪) and connected (🟢) both allow start.

### 2.3 Live Duel (same route, `state === 'playing'`)
Layout (three zones):
- **Top bar**: `P1 name + flag + score` — `Card N/50` — `Timer` — `P2 name + flag + score`.
- **Left/right of the card**: **live Evolution Chart HUD** — compact SVG line graph updated after each SCORED round, showing both players' cumulative score per card. On the victory screen the same chart expands to full width.
- **Center**: flip card reused from `flath-app/app/practice/page.tsx:384-501` (same `.perspective-1000` / `.backface-hidden` utilities in `flath-app/app/globals.css`).
- **Below card**: phase-dependent cue line:
  - IDLE_CLAIM: "P1 press Z/X/C — P2 press B/N/M"
  - After both claim: **"🏆 P1 typed first with 'I Know' — P1 speaks. Any key to reveal."** (dynamic based on computed Winner; if no-Winner tie, shows "Both picked Meh — no speaker. Any key to reveal.")
  - REVEAL: "P1 grade P2 (Z/X/C) · P2 grade P1 (B/N/M)"
  - AWAIT_LOCKIN: two LED dots with "P1 press Q · P2 press P to confirm"
  - SCORED: "+X / +Y — any key for next card"
  - COUNTDOWN: big "3… 2… 1…"

Roast banner appears under the losing player's score when their score drops `< 0` (tiers per PRD §3.2).

### 2.4 Victory (`state === 'finished'`)
- Winner name + confetti, final scores, total session time.
- **Evolution chart expanded to full width** (same component as the HUD — just a size prop).
- **Rematch** button (returns to Lobby with the same config pre-filled).
- **Return to Dashboard** button.

---

## 3. State Machine (per card)

File: `flath-app/app/duel/duelStateMachine.ts`

```
IDLE_CLAIM   ── both players claimed ──▶ RESOLVE_WINNER
RESOLVE_WINNER ── immediate ──▶ AWAIT_REVEAL   (shows who typed first + who speaks, or "no speaker")
AWAIT_REVEAL ── any key press ──▶ REVEAL
REVEAL       ── P2 graded P1 (BNM) AND P1 graded P2 (ZXC) ──▶ AWAIT_LOCKIN
AWAIT_LOCKIN ── P1 pressed Q AND P2 pressed P ──▶ SCORED
SCORED       ── any key press ──▶ COUNTDOWN_3 ─▶ COUNTDOWN_2 ─▶ COUNTDOWN_1 ─▶ NEXT_CARD
```

Implementation detail: React `useReducer` keyed by card index. Per-phase sub-state tracks timestamps (`performance.now()`) for tie-break.

**Claim-change rule**: while in `IDLE_CLAIM`, either player may retype their own claim key to overwrite it. Once both have locked claims, `RESOLVE_WINNER` fires and further ZXC/BNM presses are ignored until next card.

**Winner resolution (`RESOLVE_WINNER`)**:
1. If confidence levels differ → higher confidence player is Winner (×2). Timestamps ignored.
2. If both `I Know` → faster timestamp is Winner (×2).
3. If both `Meh` or both `Don't Know` → **no Winner**. Both players receive un-doubled scoring. `AWAIT_REVEAL` still requires any-key to flip (both players can press); no speak step is labelled.

The `AWAIT_REVEAL` UI reads:
- "🏆 **P1** typed first with **I Know** — P1 speaks. Press any key to reveal." (when a Winner is resolved)
- "Both picked **Meh** — no speaker. Press any key to reveal." (when no Winner)

---

## 4. Scoring (`flath-app/app/duel/duelScoring.ts`)

```ts
export const SCORE_MATRIX = {
  know:   { right: 2,   meh: 0,   wrong: -3   },
  meh:    { right: 1,   meh: 0.5, wrong: -0.5 },
  forgot: { right: 0.5, meh: 0.5, wrong: 0    },  // "Don't Know"
} as const;

// A player gets ×2 only when they are the resolved Winner of the round.
// Winner is null when both picked Meh or both picked Don't Know (no ×2 for anyone).
// When both picked I Know, the faster timestamp IS the Winner and still gets ×2.
export function scoreRound(
  claim: 'know'|'meh'|'forgot',
  peerGrade: 'right'|'meh'|'wrong',
  isWinner: boolean,
): number {
  const base = SCORE_MATRIX[claim][peerGrade];
  return isWinner ? base * 2 : base;
}
```

**Roast tiers** (rendered under the negative-scoring player's panel):
- `[0, -5)` → "Is your brain in 'Airplane Mode'?"
- `[-5, -15)` → "Maybe stick to French for a while?"
- `< -15` → "The Greek gods are literally laughing at you right now."

---

## 5. Keyboard Handler (`flath-app/app/duel/useDuelKeyboard.ts`)

Single global `window.addEventListener('keydown', …)` attached via `useEffect`, keyed by the current phase from the reducer:

| Phase | P1 keys | P2 keys |
|---|---|---|
| IDLE_CLAIM | `Z`=know · `X`=meh · `C`=forgot | `B`=know · `N`=meh · `M`=forgot |
| AWAIT_REVEAL | any key → REVEAL | any key → REVEAL |
| REVEAL | `Z`=right · `X`=meh · `C`=wrong (P1 grading P2) | `B`=right · `N`=meh · `M`=wrong (P2 grading P1) |
| AWAIT_LOCKIN | `Q` ✔ | `P` ✔ |
| SCORED | any key → countdown | any key → countdown |

- Uses `e.code` not `e.key` (layout-safe).
- Ignores auto-repeat (`if (e.repeat) return`).
- Records timestamp at the first non-repeat keydown per phase per player for the tie-break.
- `preventDefault` on the relevant keys to stop scrolling.

The "Lock-In ready check" (PRD PM note §2): render two dot LEDs beside each player's score; fill green when that player has pressed their confirmation key.

---

## 6. Files to Create / Modify

### Create
- `flath-app/app/duel/page.tsx` — route entry, switches between `DuelLobby` / `LiveDuel` / `DuelVictory` via a single reducer.
- `flath-app/app/duel/DuelLobby.tsx` — lobby UI + P2 email connection check.
- `flath-app/app/duel/LiveDuel.tsx` — active game UI (reuses flip card markup pattern from Practice).
- `flath-app/app/duel/DuelVictory.tsx` — victory screen + evolution chart.
- `flath-app/app/duel/EvolutionChart.tsx` — small SVG line chart (no new dep).
- `flath-app/app/duel/duelStateMachine.ts` — reducer + phase types.
- `flath-app/app/duel/duelScoring.ts` — score matrix, roast tiers, tie-break logic.
- `flath-app/app/duel/useDuelKeyboard.ts` — keydown router keyed on phase.
- `flath-app/app/duel/duelTypes.ts` — shared TS types (`DuelConfig`, `DuelRound`, `DuelState`, `Claim`, `Grade`).
- `flath-app/app/actions/duel.ts` — server actions:
  - `lookupP2(email, p1UserId)` → `{ userId, displayName? } | { error }` (uses service-role client, same pattern as `app/actions/words.ts:5,23`). Error codes: `not_found`, `same_as_p1`.
  - `finishDuel(summary, attemptsP1, attemptsP2 | null)` → writes one `duels` row (with `p2_is_guest` + nullable `p2_user_id`); inserts into `attempts_history` for P1 always, and for P2 only when P2 is connected; recomputes `user_word_settings` aggregates for each synced user (factor out the existing aggregation code in `app/actions/session.ts:19-81` into a shared helper, then call it once per synced user).
- `flath-app/sql/duels.sql` — table + enum + RLS DDL. Committed as documentation; the user pastes its contents into **Supabase Dashboard → SQL Editor → Run** once, before starting the dev loop.

### Modify
- `flath-app/app/page.tsx` — add Duel entry tile to the dashboard.
- `flath-app/app/actions/session.ts` — extract `recomputeUserWordSettings(userId, touchedWordIds)` so both solo and duel flows share aggregation (no behaviour change for solo).

### Reuse as-is (do not duplicate)
- Flip animation + `.perspective-1000` / `.backface-hidden` utilities → `flath-app/app/globals.css`.
- Smart Shuffle ordering logic → `flath-app/app/practice/page.tsx:129-143`. Extract into `flath-app/lib/sessionQueue.ts` exported as `buildSmartQueue({ source: 'p1'|'p2'|'avg', userIds, packId?, limit: 50 })`. Replace the inline copy in Practice with a call to the helper.
- Pack fetching → `flath-app/components/PracticeSelectionModal.tsx:19-50` — import and reuse the fetch function (extract if it's inline).
- Toast notifications → already wired via `sonner` in the root layout.
- `useAddWord`-style optimistic UI pattern for P2 email validation.

### The "Average" Smart Shuffle
Per PM advice §3: `avg_success_rate = (p1.avg + p2.avg) / 2`, sorted ascending (hardest for both). Implemented inside the extracted `buildSmartQueue` helper. For `p1` / `p2` sources, the existing solo ordering is reused against that user's `user_word_settings`.

---

## 7. Verification Steps

### Before starting (one-time schema setup)
The app already follows a "hand-run SQL" convention — there's no migration tooling wired up. To create the new `duels` table:
1. Open the **Supabase Dashboard** for your project.
2. Navigate to **SQL Editor** → **New query**.
3. Paste the contents of `flath-app/sql/duels.sql` (the file we'll add in this implementation).
4. Click **Run**. Confirm the `duels` table appears under **Database → Tables**.

If you'd rather I skip writing the SQL file and just give you the SQL to paste in chat, that's also fine — say the word.

### Dev loop
1. `cd flath-app && npm run dev` — confirm home page renders the new Duel tile.
2. Click **Duel** → Lobby:
   - Leave P2 email empty → ⚪ guest, Start Duel enabled, `Average`/`P2 ranks` disabled.
   - Enter a non-existent email → 🔴 icon, inline error, Start Duel disabled.
   - Enter P1's own email → 🔴 icon, "can't duel yourself" error.
   - Enter a valid second account → 🟡 → 🟢; Smart Shuffle `Average` becomes available.
3. Start a **connected** duel with Smart Shuffle / Average / Mixed / 50 cards.
4. Round 1 — exercise different matrix cells:
   - P1 `Z` (Know), P2 `N` (Meh) → P1 is Winner (higher confidence). Cue line shows "P1 typed first with I Know — P1 speaks."
   - Any key → reveal. P2 grades P1 with `B` (right); P1 grades P2 with `X` (meh).
   - P1 `Q`, P2 `P` → green LEDs both fill; SCORED. Live Evolution Chart HUD updates.
   - Expected: P1 +4 (2 × ×2 winner), P2 +0.5.
5. Round — both `Z` / `B` (I Know tied) → faster is Winner and **keeps ×2**. Verify.
6. Round — both `X` / `N` (Meh tied) → **no Winner, no ×2** — both scored normally. Cue line reads "Both picked Meh — no speaker." Verify.
7. Round — both `C` / `M` (Don't Know tied) → same no-Winner rule. Verify.
8. After 50 cards → Victory screen. Evolution chart expands, shows 50 points per player.
9. Run roast path: drive P2 below -15 → verify the three roast thresholds fire in order.
10. Run a **guest** duel (P2 email empty):
    - Smart Shuffle `Average` is disabled; only `P1 ranks` is selectable.
    - After finishing: `SELECT p2_is_guest, p2_user_id FROM duels ORDER BY ts_finished DESC LIMIT 1;` → `true, NULL`.
    - No `attempts_history` rows for any P2 user.
11. Inspect Supabase for the connected duel:
    - `SELECT * FROM duels ORDER BY ts_finished DESC LIMIT 1;` — one row, `p2_is_guest = false`.
    - `SELECT COUNT(*) FROM attempts_history WHERE user_id IN (p1,p2) AND ts > <duel.ts_started>;` — ~100 (50 cards × 2 players).
    - `SELECT avg_success_rate_prod, avg_success_rate_rec, review_count FROM user_word_settings WHERE user_id = <p2> AND word_id IN (…);` — updated.
12. Regression check on solo Practice: run one solo session, confirm scoring + `user_word_settings` aggregation still works after the `recomputeUserWordSettings` extraction.
13. Run `npm run build && npm run lint && npx tsc --noEmit` to confirm no regressions.

### Accessibility / polish checks
- Keyboard focus never leaves the document during duel (add `tabindex="-1"` on body while playing, or just avoid focusable controls mid-round).
- `e.repeat` filtered so holding a key doesn't rapid-fire.
- Roast banner uses `aria-live="polite"`.

---

## 8. Known Assumptions (to confirm during implementation, not blockers)

1. **Claim-change lock**: I interpret PRD §2.1 ("as long as the next one hasn't typed its…") as: either player can overwrite their own claim until both have claimed, at which point the resolver fires. If you meant *first-to-submit locks the other*, swap the lock condition in `duelStateMachine.ts` — one-line change.
2. **Web Speech TTS on reveal**: Not wired in this pass (Winner speaks aloud, the app doesn't need to). If desired later, tap the existing `lang: 'el-GR'` usage pattern from MVP.
3. **Roast display**: shown only on the *current* player whose score is negative at that moment; clears when they climb back ≥ 0.
4. **Evolution chart persistence**: lost on page refresh mid-duel (we chose the lightweight summary table). Acceptable per the answer; re-opening a finished duel from history shows final scores only.
5. **Smart-Shuffle `Average` when guest P2**: disabled in the Lobby (we have no second user to average against). If you'd prefer it to fall back to P1-only silently, flip the radio-disable to a silent-fallback — two-line change in `DuelLobby.tsx`.
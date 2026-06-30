# ⚡🇫🇷 FLATH 🇬🇷⚡

A high-precision vocabulary mastery tool for B1 Modern Greek learners. Focuses on intent and two-track recall (production and recognition) with adaptive spaced repetition.

Live at: [flath.vercel.app](https://flath.vercel.app) · Installable as a PWA on Android.

---

## Repository structure

```
flath/
├── flath-app/          # Next.js 16 web app (the main product)
├── data_processing/    # Python scripts to process and categorize raw vocabulary data
├── datasets/           # Raw vocabulary CSV/TXT files for batch import
└── docs/               # PRDs, schema specs, design notes
```

---

## Features

- **Vault** — browse, add, edit, and archive your personal Greek word library. Accent-insensitive search. CSV bulk import (desktop). Scrollable on mobile. Optional "exclude successful" filter mirrors the practice setup.
- **Practice** — adaptive sessions with two tracks: recognition (Greek → French) and production (French → Greek). Mixed mode uses a dynamic modality randomizer: baseline 70% Production bias, continuously adjusted by the delta between recent Production and Recognition failures over the last 14 days, so whichever track is currently weaker gets more cards. Exclude successful words (>75% in last 7 days) and/or words reviewed today. Per-state progress (Known / Not seen / Retry) plus an iteration counter for recycled passes. A 5-second retention intercept blocks input on missed cards so the correct answer registers. Hard-won wins (first-attempt correct on historically tough words) get a 🎉 marker on the session recap.
- **Word Packs** — manual or smart (filter-based) packs. Scope a practice session to a pack.
- **Duel** — real-time multiplayer vocabulary battle. Two players race through shared words. Desktop only.
- **Progress** — dashboard streak metric (with one-day grace), "This week" header with distinct-words and words-added counters (zero-activity state shows "Let's get started"), and a `/progress` page with a 30-day activity line chart (per-day hover tooltip, `"D Mon"` date labels), struggling/forgetting word lists with inline 👍/👎 quick-review buttons (records a real `rec` attempt on tap), production vs recognition weighted averages, theme breakdown pie (top-6 + "Others"), words-added stacked bar (top-6 + "Others", per-day hover tooltip), and duel W/L/T summary.
- **PWA** — installable on Android via Chrome "Add to Home Screen". Runs fullscreen with no browser chrome.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| Auth + DB | Supabase (Postgres + Row-Level Security) |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel (auto-deploy from `main`) |

---

## Local development

```bash
cd flath-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create `flath-app/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

`SUPABASE_SERVICE_ROLE_KEY` is **server-only** — never prefix it with `NEXT_PUBLIC_`. It is used by server actions that write across users (Duel feature). Never commit `.env.local` to git.

---

## Deployment (Vercel)

1. Import this repo on [vercel.com](https://vercel.com).
2. Set **Root Directory** to `flath-app`.
3. Add the three env vars above (`SUPABASE_SERVICE_ROLE_KEY` must not be exposed to the browser).
4. After first deploy, add the Vercel URL to Supabase → Auth → **Site URL** and **Redirect URLs**.

Auto-deploys on every push to `main`.

---

## UI

- **Background** — a custom photo (`flath_bckgrng.png`) is rotated 90° to portrait and displayed ~30% larger than the central white card, visible on all pages.
- **Home title** — rendered in the *Greek To Me* carved-stone typeface (`public/font/GreekToMe.ttf`).
- **Flashcard** — top chrome (theme, difficulty, action icons) stacks in rows on mobile instead of overlapping absolute corners. Card fills available screen height on mobile. Recognition/Production track label removed.
- **"+" button** — fixed to the bottom-left corner (with PWA safe-area inset).

---

## Surface model

One codebase, two presentations. A `useSurface()` hook (`flath-app/lib/surface.ts`) detects at runtime whether the user is on desktop, mobile browser, or installed PWA. Features are gated — not deleted — so the codebase stays unified.

**Currently desktop-only:** Duel mode, CSV import, batch edit, batch archive, batch delete, the numeric Vault filters (Success Rate, Review Count, Heat, Frequency Rank), and the Practice Selected button.

**Currently mobile-only:** `#71B2F4` blue background on the Word Packs and Vault pages.

See `flath-app/CLAUDE.md` for the full surface-gating rules (auto-loaded by Claude Code on every session).

---

## Database

RLS is enabled on all tables. Standard policy: `auth.uid() = user_id`. The `duels` table uses an OR-policy for cross-player reads. Reference SQL in `flath-app/sql/`.

Key tables: `words_dim`, `user_word_settings`, `attempts_history`, `word_packs`, `word_pack_items`, `duels`, `user_roles`.

### Pending migrations

Two migration files need to be run in the Supabase SQL editor before some Phase 2 features are fully enforced:

| File | What it does | Run order |
|------|-------------|-----------|
| [`flath-app/sql/phase2_pos.sql`](flath-app/sql/phase2_pos.sql) | Backfills invalid PoS values to `Autre`, adds a NOT NULL column default, adds a CHECK constraint restricting `part_of_speech` to the 10 allowed French values | 1 |
| [`flath-app/sql/phase2_rbac.sql`](flath-app/sql/phase2_rbac.sql) | Creates `user_roles` table, adds `is_admin()` helper function, enables RLS on `words_dim` with owner-or-admin policies, seeds the project owner as admin | 2 |

Before running `phase2_pos.sql`, check what would change:

```bash
cd flath-app && node scripts/preview_pos_migration.mjs
```

This prints the current PoS distribution and lists any rows that would be rewritten to `Autre` — nothing is mutated.

---

## Changelog

### Phase 3.6.2 — Progress UI polish (June 2026)

**Charts**
- 30-day line chart and words-added stacked bar: y-axis numeric label removed; x-axis dates reformatted to `"D Mon"` (e.g. `"15 Jun"`); per-day hover/tap tooltip shows date + per-series values. Touch support on mobile.
- Theme pie and stacked bar: themes beyond the top 6 (by count) are collapsed into a grey "Others" entry, reducing clutter when many themes exist.
- Day-key/display-label split in the stacked bar builder ensures the friendly date format does not break the internal `added_at` matching logic.

**Word lists**
- Struggling and forgetting word rows now have 👎 (left) and 👍 (right) inline review buttons. Tapping records a real recognition attempt (`mode: "rec"`) via `submitSessionAttempts`. Chosen thumb highlights; row stays visible. Sonner toast confirms success or reports error. Double-tap guard prevents duplicate recording.

**Section labels**
- `(30d)` removed from "Words seen by theme" and "Words added per day by theme" headings; replaced with a greyed italic "Last 30 days" subtitle.
- "Duels" section gains an "All time" italic subtitle.

**Dashboard counters**
- "Words (7d)" and "Added (7d)" labels simplified to "Words" and "Added".
- "This week" header added above the three-metric grid.
- Zero-activity state (streak = 0, no words seen, no words added in 7 days) shows "Let's get started" header with `0` for all counters instead of `—`.

---

### Phase 3.6.1 — Progress tracker bugfixes (June 2026)

**Bug fixes**
- Production vs recognition rates now display as valid percentages (e.g. 57%, not 5670%). Root cause: the stored 0-100 scale was being multiplied by 100 a second time at render. Gap copy and threshold corrected to match.
- Streak "No streak yet" despite recent activity: the previous query hit PostgREST's default 1000-row cap on high-volume history, silently truncating today's rows. Replaced with a `streak_dates()` Postgres RPC that returns O(days) distinct dates — cap-immune. Add order+limit guards to the 30-day and 7-day attempt queries.
- Words-added stacked bar showed all-zero bars: label generation used `"MM-DD"` but matching used `"MM/DD"` — every word was skipped. Fixed to use dashes consistently.
- Struggling/forgetting word lists had corrupted sampling weights: `(1 - blend) + 0.1` went negative when `blend` was ~50 on the 0-100 scale. Fixed to `(1 - blend/100) + 0.1`.

**Tests** — 34 tests (up from 32). Unit test fixtures updated to the 0-100 production scale; two regression tests added for weight boundary values.

**SQL** — `sql/add_streak_rpc.sql` added. Run once in Supabase SQL Editor to deploy the `streak_dates()` RPC. Re-run `sql/add_added_at.sql` backfill if `added_at` is NULL on legacy rows, then `ALTER TABLE public.user_word_settings ALTER COLUMN added_at SET NOT NULL`.

---

### Phase 3.6 — Progress tracker (June 2026)

**Dashboard**
- Streak metric row added below the header: current streak (days), a "Day N+1 in reach" label when not yet studied today, and longest streak.
- Two additional header metrics: distinct words practised in the last 7 days, and longest all-time streak.
- "Show Progress" button links to `/progress`.

**Progress page (`/progress`)**
- 30-day activity line chart: daily `know` attempt count (green) vs `forgot` count (red), hand-rolled SVG.
- Struggling words list: bottom 5 by weighted success rate (blend of production and recognition), sampled via roulette-wheel so different words surface on each visit.
- Forgetting words list: 5 words with the most recent `forgot` attempts, similarly sampled.
- Production vs recognition averages: two large weighted-average numbers derived from `avg_success_rate_prod` / `avg_success_rate_rec` on `user_word_settings`.
- Theme breakdown pie chart: word count per theme, SVG.
- Words added over time stacked bar chart: words added per day over the last 30 days, SVG.
- Duel W/L/T summary: counts from the `duels` table.
- Unauthenticated access redirects to `/login`.

**Stats helpers (`lib/progressStats.ts`)**
- Pure functions with zero side effects: `computeStreak`, `weightedBlendSuccess`, `weightedAverage`, `weightedSample`, `buildStrugglingPool`, `buildForgettingPool`, `bucketByDay`.
- `weightedSample` accepts an injectable `rng` so tests are deterministic; production passes `Math.random`.

**Tests**
- First unit test suite in the repo: 32 tests via [vitest](https://vitest.dev) (`npm test`). `vitest.config.ts` added at `flath-app/` root.
- Zero new runtime dependencies; vitest is devDep only.

---

### Phase 3.5 — Flash fix, in-session vault, mistake tagging, vault/pack fixes (June 2026)

**Practice — bug fixes**
- Fixed the answer-side flash when advancing to the next card in both solo practice and duel mode. The card now stays on its hidden/front face through the data swap instead of briefly painting the next (or previous) card's translation. Solo gates card content to the unflipped face (`displayWordRef`) and settles the flip before the queue advances; duel renders the answer face only while flipped.
- Fixed a crash when opening the Edit Word modal from inside an active practice session (null-safe `words_dim` handling in the session refresh).
- Progress pill now resets recycled cards to ⚫ Not seen yet when a new review cycle (Review #N) begins, instead of leaving them stuck under 🔴 Forgot / 🟡 Unsure. 🟢 Mastered is preserved across cycles.

**Practice — performance**
- Attempts now save to the background in batches (~every 5 cards) instead of one large write at session end, so ending a session no longer hangs on a long save. An in-flight guard plus a synchronous flush cursor prevent overlapping flushes from double-inserting; the end-of-session flush sends only the remainder.

**In-session vault & mistake tagging**
- New in-session Vault drawer: search, view, edit, and one-tap "Add a Mistake" without leaving or disrupting the active practice session.
- AddWordModal has an "Add a mistake" checkbox (default on) — a word saved with it checked is immediately recorded as a `forgot` attempt so it ranks down and surfaces in Mistake Fix.
- One-tap "Add a Mistake" quick-action on word rows in the main Vault and the in-session drawer (shared `markWordAsMistake` helper).

**Vault & word management**
- Removed the Frequency / Difficulty field from the Add and Edit Word modals. New words still get an auto-derived frequency rank; editing no longer changes it.
- Fixed the "Added last X days" temporal filter — it now queries a real per-user `added_at` timestamp on `user_word_settings` instead of a non-existent word-creation field. Requires running `flath-app/sql/add_added_at.sql` once in Supabase (adds + backfills the column).
- Word packs can now be renamed inline (owner-only; requires `flath-app/sql/word_packs_rename_policy.sql`).
- Inline archive/remove action added to "Added by others" rows (add-then-archive).

---

### Phase 3.4 — Practice pill redesign and Add Word UX (May 2026)

**Practice**
- Progress pill now shows 4 emoji counters: 🟢 Mastered / 🟡 Unsure (meh, still in queue) / 🔴 Forgot (still in queue) / ⚫ Not seen yet. Previously "meh" and "forgot" were merged into a single red counter.
- "Review #N" merged into the End Session button as a split pill (iteration label on the left, stop icon + label on the right). Frees up space in the stats bar.

**Add Word modal**
- French translation field now auto-lowercases input as you type.
- Theme/Group field no longer pre-fills with "General" — shows it as a greyed placeholder instead. Submitting without a value still saves as "General".

---

### Phase 3.3 — Vault tweaks and mobile input fixes (May 2026)

**Bug fixes**
- Fixed infinite re-fetch loop when launching a review session from the vault ("Review this" button). The practice page's `fetchSessionData` callback was regenerating on every render due to an unstable `wordIds` array dependency, causing the loading state to toggle perpetually. Now removes the duplicate array derivation and stabilizes the callback dependencies so data fetches once per session load.
- Fixed unreadable (light grey) text in Add/Edit Word modals on dark-mode Android devices. Root cause: leftover Next.js dark-mode boilerplate in `globals.css` was flipping body text to `#ededed` on OS dark mode while the modals stayed `bg-white`. Removed the `@media (prefers-color-scheme: dark)` block — the app is light-only and has no dark-mode design.
- Greek Word field in Add/Edit modals now suppresses auto-capitalize and auto-correct (`autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`). Also strengthened `lang="el"` scoping to container level to improve Gboard keyboard-language detection on Android.

**Vault**
- "Review this" limit reduced from 50 to 25 words.
- "Practice Selected" button renamed to "Other Practice".

---

### Phase 3.2 — Mobile polish, safety caps, and vault temporal filter (May 2026)

**Mobile surface**
- Word Packs and Vault pages now use a solid `#71B2F4` blue background on mobile (all other surfaces keep `bg-gray-50`).
- "Practice Selected" button hidden on mobile — requires checkbox row-selection which is already desktop-only.

**Vault improvements**
- "Review this" cap raised from 20 to 50 words (later reduced to 25 in Phase 3.3).
- Theme autocomplete in Add/Edit word modals is now accent-insensitive (uses `normalizeForSearch()` — same NFD normalization as vault search).
- Temporal filter redesigned: replaces the fixed Today/Week/Month buttons with a free-form `[field] [in the last | more than] [X] days` control. Supported fields: Last reviewed, Last correct, Last mistake, Added.

**DB migration** — `flath-app/sql/add_last_correct_mistake.sql`
- Adds `last_correct_at` and `last_mistake_at` columns to `user_word_settings`.
- Backfills from `attempts_history` (max `ts` per user+word for `know` and `forgot` outcomes).
- `recomputeUserWordSettings` now writes both fields after every session.

---

### Phase 3.1 — Adaptive Modality Distribution (May 2026)

**Dynamic modality randomizer**
- Replaced the per-word 20%-delta + 50/50 coin-flip logic in `assignTracks()` with a population-level adaptive bias.
- New `computeProdProbability()` helper in `lib/sessionQueue.ts` computes `pProd` from the last 14 days of `attempts_history`: baseline 70% Production, adaptive swing up to ±25% driven by the failure-share delta between Production and Recognition tracks. Hard floor/ceiling at [0.40, 0.95] so neither modality starves.
- New `getModalityFailureCounts()` server action in `app/actions/session.ts` queries `attempts_history` for `outcome = 'forgot'` in the last 14 days, grouped by `mode`.
- `assignTracks()` now accepts an optional `pProd` parameter; in "mixed" mode, each card is sampled independently against it.
- No DB schema change — uses existing `attempts_history.mode` and `attempts_history.outcome` columns.

---

### Phase 3 — Practice Engine Overhaul (May 2026)

**Session filters**
- New "Exclude words reviewed today" toggle in the practice setup (default ON). Compares against the calendar date, not a 24h rolling window.
- The Vault now exposes the same "Exclude successful (>75% last 7d)" filter as practice, so users can browse the same working set.

**In-session UX**
- Progress display now shows three single-letter counters (**K** Known / **N** Not seen / **R** Retry) plus a `Review #i` iteration counter that increments when the queue recycles through unmastered cards.
- After a missed card (Unsure / Forgot), all card actions are silently disabled for 5 seconds while the answer stays on screen — no countdown UI, just enforced exposure.

**Session recap**
- A 🎉 marker appears next to words that were answered correctly on the FIRST attempt this session AND were historically hard (avg success rate <40%, or the most recent prior attempt was "forgot"). Backed by a new `getLastAttemptOutcomes` server action.

**Mobile vault cleanup**
- The numeric range filters (Success Rate, Review Count, Frequency Rank) and the Heat chip filter are now hidden on mobile to declutter the filter strip. State is preserved; only the UI is gated.

### Phase 2 — Data Management, RBAC & CSV Import (May 2026)

**Part of Speech engine**
- `part_of_speech` is now a controlled vocabulary: `Adjectif`, `Adverbe`, `Conjonction`, `Interjection`, `Nom`, `Phrase`, `Preposition`, `Verbe`, `Pronom`, `Autre`. Invalid or blank values fall back to `Autre`.
- DB: CHECK constraint + NOT NULL default (run `phase2_pos.sql`).
- UI: all PoS fields are now dropdowns. New words default to `Nom`. Batch edit supports optional PoS override.

**Access control (RBAC)**
- New `user_roles` table with a single `admin` role.
- RLS policies on `words_dim`: owners can edit their own words; admins can edit any word including global system words (`created_by_user_id IS NULL`).
- `EditWordModal` shows a lock badge and disables all inputs for words the current user cannot edit.
- Run `phase2_rbac.sql` to enable (seeds the project owner as admin).

**CSV import — matrix recap**
- `ImportSummaryModal` replaced with a full difficulty × theme matrix. Click any cell to expand an inline drawer showing the word pairs for that bucket.
- Inline editing in the drawer: edit Greek text, translation, PoS, and theme directly and save without leaving the modal. Matrix counts update live on save.
- Theme management toolbar: rename a theme (scoped to imported words) or merge one theme into another.
- New optional CSV columns: `Frequency Rank` (`Matched` → real rank from `el_50k.txt` frequency list, `Niche` → 8000) and `Part of Speech` (coerced to allowed values).
- `Matched` rank lookup: strips leading Greek articles, takes the first token (handles verb pairs like `τρώω, έφαγα`), looks up in the 50k-word frequency list. Unmatched words noted in the recap.

**Vault batch actions**
- New toolbar buttons: **Archive** (sets `is_archived = true` for selected words) and **Delete** (permanent delete for owned words; library removal for others). Both gated to desktop, both require the existing multi-select state.
- Delete has a confirm dialog.
- "Added by others" single-row button relabeled to "My Library" with a wider hit target.

**New files**
- `flath-app/sql/phase2_pos.sql` — PoS migration (run in Supabase SQL editor)
- `flath-app/sql/phase2_rbac.sql` — RBAC migration (run in Supabase SQL editor)
- `flath-app/scripts/preview_pos_migration.mjs` — read-only DB preview before running the PoS migration
- `flath-app/lib/freqLookup.ts` — memoized frequency map loader
- `flath-app/hooks/useIsAdmin.ts` — cached admin role hook
- `flath-app/public/datasets/el_50k.txt` — Greek frequency list (50k words) served as a static asset

---

## Data processing

Scripts in `data_processing/` scrape and categorize raw Greek vocabulary before import. The web app reads only from Supabase; run these scripts separately if regenerating the word list.

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

- **Vault** — browse, add, edit, and archive your personal Greek word library. Accent-insensitive search. CSV bulk import (desktop). Scrollable on mobile.
- **Practice** — adaptive sessions with two tracks: recognition (Greek → French) and production (French → Greek). Mixed mode weighs harder words first. Exclude successful words (>75% success rate in last 7 days) from sessions.
- **Word Packs** — manual or smart (filter-based) packs. Scope a practice session to a pack.
- **Duel** — real-time multiplayer vocabulary battle. Two players race through shared words. Desktop only.
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

**Currently desktop-only:** Duel mode, CSV import, batch edit, batch archive, batch delete.

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

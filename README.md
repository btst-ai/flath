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

- **Vault** — browse, add, edit, and archive your personal Greek word library. CSV bulk import (desktop). Scrollable on mobile.
- **Practice** — adaptive sessions with two tracks: recognition (Greek → French) and production (French → Greek). Mixed mode weighs harder words first.
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

**Currently desktop-only:** Duel mode, CSV import, batch edit.

See `flath-app/CLAUDE.md` for the full surface-gating rules (auto-loaded by Claude Code on every session).

---

## Database

RLS is enabled on all tables. Standard policy: `auth.uid() = user_id`. The `duels` table uses an OR-policy for cross-player reads. Reference SQL in `flath-app/sql/`.

Key tables: `words_dim`, `user_word_settings`, `attempts_history`, `word_packs`, `word_pack_items`, `duels`.

---

## Data processing

Scripts in `data_processing/` scrape and categorize raw Greek vocabulary before import. The web app reads only from Supabase; run these scripts separately if regenerating the word list.

# Flath — Greek Lexical Engine

A high-precision vocabulary mastery tool for B1 Modern Greek learners, focused on intent and two-track recall (recognition + production).

Built with Next.js 16 (App Router), Supabase, and Tailwind CSS. Deployed on Vercel. Installable as a PWA on Android.

---

## Features

- **Vault** — browse, add, edit, and archive your personal Greek word library. Import words via CSV (desktop only).
- **Practice** — spaced-repetition sessions with two tracks: recognition (Greek → French) and production (French → Greek). Mixed mode uses a dynamic modality randomizer: 70% Production baseline, adjusted each session by the delta between recent Production and Recognition failures (14-day window) so the weaker track always gets more cards.
- **Word Packs** — organise words into manual or smart (filter-based) packs. Start a practice session scoped to a pack.
- **Duel** — real-time multiplayer vocabulary battle. Two players race through shared words. Desktop only.
- **PWA** — installable from Chrome on Android via "Add to Home Screen". Runs fullscreen, no browser chrome.

---

## Surface model

One codebase, multiple surfaces. A `useSurface()` hook (`lib/surface.ts`) detects at runtime whether the user is on desktop, mobile browser, or installed PWA.

**Currently gated to desktop only:**
- Duel mode entry (`app/page.tsx`)
- CSV import (`app/vault/page.tsx`)
- Batch edit modal (`app/vault/page.tsx`)

See `CLAUDE.md` for the full surface-gating rules and checklist for adding new features.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| Auth + DB | Supabase (Postgres + Row-Level Security) |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Toasts | Sonner |
| CSV parsing | PapaParse |
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

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only — never prefix it with `NEXT_PUBLIC_`. It's used by server actions that write across users (Duel feature).

---

## Database (Supabase)

### Key tables

| Table | Description |
|---|---|
| `words_dim` | Shared word reference. Greek text, French translation, POS, theme, frequency rank. |
| `user_word_settings` | Per-user word state: favourite, archived, success rates, interest score. |
| `attempts_history` | Raw attempt log per word per user per session. |
| `word_packs` | Manual and smart packs (filter-criteria JSON for smart packs). |
| `word_pack_items` | Many-to-many between packs and words. |
| `duels` | Active and completed duel sessions. |

### Row-Level Security

RLS is enabled on all tables. Standard policy: `auth.uid() = user_id` (or `author_id`). The `duels` table uses an OR-policy so both players can read the shared row. Server actions that need cross-user writes use the service-role key and bypass RLS.

SQL for duel policies: `sql/duels.sql`.

---

## Deployment (Vercel)

1. Import `btst-ai/flath` on vercel.com.
2. Set **Root Directory** to `flath-app`.
3. Add the three env vars above (mark `SUPABASE_SERVICE_ROLE_KEY` as server-only).
4. After first deploy, add the Vercel URL to Supabase → Auth → **Site URL** and **Redirect URLs**.

Auto-deploys on every push to `main`.

---

## PWA install (Android)

1. Open the Vercel URL in Chrome on Android.
2. Menu (⋮) → **Install app**.
3. Icon appears on home screen. Opens fullscreen.

Icons: `public/icon-192.png` and `public/icon-512.png`. Manifest: `app/manifest.webmanifest`.

---

## Project structure

```
flath-app/
├── app/
│   ├── actions/          # Server actions (Supabase writes, AI calls)
│   ├── duel/             # Duel lobby + game UI
│   ├── packs/            # Word Packs page
│   ├── practice/         # Practice session page
│   ├── vault/            # Vocabulary vault page
│   ├── layout.tsx        # Root layout (metadata, viewport, PWA tags)
│   ├── manifest.webmanifest
│   └── page.tsx          # Home / navigation hub
├── components/           # Shared UI components (modals, buttons, etc.)
├── hooks/                # useAddWord and other custom hooks
├── lib/
│   ├── sessionQueue.ts   # Word fetching, sorting, track assignment
│   ├── surface.ts        # useSurface() hook — desktop / mobile-web / pwa
│   └── supabase.ts       # Supabase client
├── public/               # Static assets (icons, anthems)
├── sql/                  # Reference SQL (duels policies, schema notes)
├── AGENTS.md             # Warning: Next.js 16 breaking changes
└── CLAUDE.md             # Surface-gating rules and coding discipline
```

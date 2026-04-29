@AGENTS.md

# Flath — coding rules for AI assistants and humans

## Surface model (READ THIS FIRST)

This app runs as **one codebase across multiple surfaces**:

- `desktop` — laptop browser, ≥768px wide, not installed as PWA
- `mobile-web` — phone browser, <768px wide, not installed
- `pwa` — installed via "Add to Home Screen" (display-mode: standalone)

**Default rule:** every feature ships to ALL surfaces. Do not add a feature that only works on one surface unless it is explicitly gated and documented.

**How to gate:** use `useSurface()` and `isMobileSurface()` from `lib/surface.ts`.

```ts
import { useSurface, isMobileSurface } from "@/lib/surface";

const surface = useSurface();
const showDesktopOnly = !isMobileSurface(surface);

{showDesktopOnly && <DesktopOnlyThing />}
```

Note: `useSurface()` returns `'desktop'` during SSR and on first render before hydration. Surface-gated content briefly shows the desktop variant on mobile before the effect runs. For the gates currently applied this flash is acceptable.

## Currently gated (desktop-only)

When you change one of these, update this list AND the comment at the gate site.

- Duel mode entry on home — `app/page.tsx`
- CSV import section in vault — `app/vault/page.tsx`
- Batch edit modal + per-row checkboxes + select-all in vault — `app/vault/page.tsx`

The `/duel` route itself is NOT route-blocked — typing the URL still loads it. Gate is purely UI hiding.

## Adding a new feature — checklist

Before merging:

1. Built once, no per-surface forks unless intentional.
2. Tested at three viewports in DevTools: 1280px, 768px, 375px.
3. If gated, add a comment `// <surface>-only — see flath-app/CLAUDE.md` at the gate site, and update the list above.
4. Tested as installed PWA on phone (or at least Chrome DevTools "Application → Manifest" preview).

## Supabase / RLS rules

- Row-Level Security is **enabled** on all `public` tables. Do not disable it, even temporarily.
- Standard pattern: each user sees only their own rows (`auth.uid() = user_id` or `auth.uid() = author_id`).
- Cross-user access exists ONLY for Duel: the `duels` table uses an OR-policy (`auth.uid() = p1_user_id OR auth.uid() = p2_user_id`). See `sql/duels.sql`.
- The service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is server-only. Never import it into a client component, never expose with `NEXT_PUBLIC_`. It bypasses RLS — leaking it is worse than no RLS at all.
- Always check `error` on Supabase responses. RLS denials return `{ data: [], error: null }` and look like "no data" rather than failures. Surface errors via Sonner toast and log to console.

## Hosting

- Production: Vercel. Auto-deploys from `main`.
- The Next.js app lives at `flath-app/` (not repo root). Vercel's "Root Directory" setting must remain `flath-app`.
- Required env vars on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only).

## What NOT to do

- Don't disable RLS, even temporarily.
- Don't add features that only work on one surface without a gate + a note in this file.
- Don't introduce a separate Android/mobile codebase. We are intentionally one codebase.
- Don't put the service-role key in a `NEXT_PUBLIC_` env var.
- Don't delete features to "remove them from mobile" — gate them via `useSurface()` instead.

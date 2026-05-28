# Phase 2 — Data Management, RBAC & CSV Import Upgrades

## Context

Flath's data layer is currently permissive: Part of Speech is a free-text field with no validation, there is no role system (the server actions in [app/actions/words.ts](flath-app/app/actions/words.ts) bypass RLS via the service-role key with a comment acknowledging the workaround), CSV import shows a thin summary modal, and the Vault's "Added by others" tab has minimal affordances. The "You don't have permission to edit this word" toast in [EditWordModal.tsx:85](flath-app/components/EditWordModal.tsx#L85) is a symptom of having no real permission model — it's a generic "0 rows updated" fallback.

Phase 2 hardens the schema (PoS CHECK constraint + fallback), introduces a minimal RBAC layer (owner + admin), upgrades the CSV import to a matrix recap with theme management, and adds batch actions to the Vault. Note: [flath-app/CLAUDE.md](flath-app/CLAUDE.md) claims RLS is enabled on all public tables, but exploration found explicit RLS only on `duels` ([sql/duels.sql:53](flath-app/sql/duels.sql#L53)). This plan adds RLS for `words_dim` and `user_roles` per the documented pattern and the Oct 30 2026 grants deadline in [SUPABASE_GRANTS.md](SUPABASE_GRANTS.md).

Decisions locked with the user:
- **RBAC**: Owner + single `admin` role. Global words = `created_by_user_id IS NULL`, editable only by admin. Seed `baptiste.dufresne@gmail.com` (the project owner) as the first admin so he can edit any word in the system.
- **PoS enforcement**: Postgres `CHECK` constraint (not ENUM). Backfill unknowns → `Autre`. New-word default is `Nom`; `Autre` is also user-selectable in the dropdown.
- **Import UX**: Extend `ImportSummaryModal` rather than build a new modal.
- **"Added by others" quick action**: Move to my library (one-click, mirrors existing `+`).
- **CSV Frequency Rank column**: Three-state — `Matched` → look up the Greek word in [datasets/el_50k.txt](datasets/el_50k.txt) and use its line number as the rank; `Niche` → 8000; missing/blank → 8000.
- **Migrations**: User runs them by pasting each SQL file into the Supabase SQL editor.

---

## 1. Strict Part of Speech engine

**Domain values** (case-sensitive, French):
`Adjectif, Adverbe, Conjonction, Interjection, Nom, Phrase, Preposition, Verbe, Pronom, Autre`

### DB migration (new file: `flath-app/sql/phase2_pos.sql`)

**Step 1 — CLI preview via Node script (read-only)**

Neither `supabase` CLI nor `psql` is installed locally, but `SUPABASE_SERVICE_ROLE_KEY` is in `flath-app/.env.local`. I'll add a tiny one-shot script `flath-app/scripts/preview_pos_migration.mjs` that uses `@supabase/supabase-js` (already a project dependency) to:

1. `SELECT part_of_speech, COUNT(*)` grouped — prints a table of every distinct current value and row counts.
2. List up to 200 rows whose value would be rewritten to `Autre`, with id/greek/french/pos so you can scan.

Run with: `cd flath-app && node scripts/preview_pos_migration.mjs`. Output is printed to the terminal — nothing is mutated.

You inspect that output. If you spot values you'd rather salvage (e.g. `Verb` → `Verbe`, `Noun` → `Nom`), add the targeted `UPDATE` statements to `phase2_pos.sql` *above* the catch-all UPDATE so they run first. Examples:

```sql
UPDATE public.words_dim SET part_of_speech = 'Verbe' WHERE part_of_speech IN ('Verb','verb','verbe');
UPDATE public.words_dim SET part_of_speech = 'Nom'   WHERE part_of_speech IN ('Noun','noun','nom');
-- etc., based on what the preview script showed
```

**Step 2 — apply the migration (you paste into Supabase SQL editor):**

```sql
-- Anything still not in the allowed set becomes 'Autre'
UPDATE public.words_dim
SET part_of_speech = 'Autre'
WHERE part_of_speech IS NULL
   OR part_of_speech NOT IN ('Adjectif','Adverbe','Conjonction','Interjection',
                              'Nom','Phrase','Preposition','Verbe','Pronom','Autre');

ALTER TABLE public.words_dim
  ALTER COLUMN part_of_speech SET DEFAULT 'Autre',
  ALTER COLUMN part_of_speech SET NOT NULL;

ALTER TABLE public.words_dim
  ADD CONSTRAINT part_of_speech_domain CHECK (
    part_of_speech IN ('Adjectif','Adverbe','Conjonction','Interjection',
                       'Nom','Phrase','Preposition','Verbe','Pronom','Autre')
  );
```

**Rollback** (if needed): `ALTER TABLE public.words_dim DROP CONSTRAINT part_of_speech_domain;` and `ALTER COLUMN part_of_speech DROP NOT NULL;`. The data backfill is not automatically reversible — take a Supabase snapshot before Step 2 if you want a safety net.

### App layer

- **New constant**: add `POS_VALUES` array + `coercePos(value: string | null): string` to [flath-app/lib/normalize.ts](flath-app/lib/normalize.ts). `coercePos` trims, checks membership, returns `'Autre'` on miss. Used by every write path (Add, Edit, Batch, CSV).
- **EditWordModal** ([components/EditWordModal.tsx:184-192](flath-app/components/EditWordModal.tsx#L184)): replace the `<input type="text">` with a `<select>` styled identically to the Difficulty select on lines 197-206. Same border/padding/focus classes. Default selected = current value coerced through `coercePos`.
- **AddWordModal** ([components/AddWordModal.tsx](flath-app/components/AddWordModal.tsx)): same dropdown. Default new words to `Nom`.
- **BatchEditModal** ([components/BatchEditModal.tsx](flath-app/components/BatchEditModal.tsx)): add an optional PoS dropdown (with an "— leave unchanged —" sentinel option, since batch fields are optional).

## 2. RBAC: owner + admin

### DB migration (new file: `flath-app/sql/phase2_rbac.sql`)

```sql
CREATE TABLE public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role row (for client-side UI gating)
CREATE POLICY "users read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Helper function for use in policies
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

-- Enable RLS on words_dim and add policies
ALTER TABLE public.words_dim ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read all words" ON public.words_dim
  FOR SELECT USING (true);

CREATE POLICY "insert own words" ON public.words_dim
  FOR INSERT WITH CHECK (auth.uid() = created_by_user_id OR public.is_admin());

CREATE POLICY "owner or admin updates" ON public.words_dim
  FOR UPDATE USING (
    auth.uid() = created_by_user_id OR public.is_admin()
  );

CREATE POLICY "owner or admin deletes" ON public.words_dim
  FOR DELETE USING (
    auth.uid() = created_by_user_id OR public.is_admin()
  );

-- Seed: make the project owner an admin so he can edit any word.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'baptiste.dufresne@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
```

**What this means in practice**: there are two kinds of words in the database — *personal* ones (rows with `created_by_user_id` set to a user's UUID — the user who added them) and *global system* ones (rows with `created_by_user_id IS NULL` — typically seeded by bulk imports or other admins). Without admin rights, a user can only edit their own personal rows. With the admin seed above, `baptiste.dufresne@gmail.com` can edit every row — personal *and* global — because the `is_admin()` half of each policy passes for him.

### App layer

- **New hook**: `flath-app/hooks/useIsAdmin.ts` — reads `user_roles` once on mount, exposes `{ isAdmin, loading }`. Cache in module-level state to avoid refetches across components.
- **Remove service-key bypass** in [app/actions/words.ts](flath-app/app/actions/words.ts): switch `editWord` and `batchEditWords` to use the user's auth context (cookie-bound supabase client from `@supabase/ssr`). RLS now enforces permissions; service-key path is gone. The "You may not have permission" toast in [EditWordModal.tsx:85](flath-app/components/EditWordModal.tsx#L85) becomes accurate.
- **UI hint**: in the Vault row hover state and EditWordModal, if `!canEdit` (non-owner, non-admin), show a lock icon + tooltip "Only the owner or an admin can edit this word" — disable the edit button entirely instead of letting the click fail.

## 3. CSV import diagnostics & matrix recap

### Parser changes ([app/vault/page.tsx](flath-app/app/vault/page.tsx) ~line 787-863)

Accept three new optional trailing columns:

| Column header        | Default     | Mapping |
|----------------------|-------------|---------|
| `Group`              | `General`   | → `theme` |
| `Frequency Rank`     | `Niche`     | `Matched` → lookup in [datasets/el_50k.txt](datasets/el_50k.txt); `Niche` → 8000 |
| `Part of Speech`     | `Autre`     | Run through `coercePos` |

All other CSV behavior unchanged. Header lookups should be case-insensitive and accept either French or English column names where they already exist.

#### Frequency lookup table

The file [datasets/el_50k.txt](datasets/el_50k.txt) is a 50k-line list, one entry per line in the form `<greek_word> <raw_count>`, ordered by frequency (so line N = rank N). Build a lookup map once at import time:

1. Add `flath-app/lib/freqLookup.ts` exporting `loadFrequencyMap(): Promise<Map<string, number>>`. It fetches `/datasets/el_50k.txt` from the public folder (move the file to `flath-app/public/datasets/el_50k.txt` so Next.js serves it as a static asset), parses each line into `[word, rank]` where rank = line index + 1.
2. Memoize the promise so it loads once per session.
3. During CSV parse, for any row with `Frequency Rank = Matched`:
   - Take the `greek_text` cell, **split on whitespace, comma, or `/`, and use only the first token** for the lookup. This is because verb entries are typically written as `<present>, <past>` (e.g. `τρώω, έφαγα`), and we want to match only the first-person present form against el_50k.txt — which is itself indexed by single-word forms. Documents this rule in a comment in `freqLookup.ts`.
   - Normalize the token via [lib/normalize.ts](flath-app/lib/normalize.ts) (lowercase, strip leading articles like `ο/η/το/οι/τα` only if you decide to — see below) and look it up in the map.
   - If found, use that rank. If not found, fall back to 8000 and add the row to a "could not match" list shown as a footnote under the import recap so you can see which verbs didn't resolve.
   - **Open question for implementation**: nouns are stored with leading articles (e.g. `η γυναίκα`). el_50k.txt entries are bare (`γυναίκα`). Decide whether to strip a leading Greek article token before the lookup. Recommend yes — strip `ο|η|το|οι|τα|τον|την|τους|τις|του|της|των` before splitting. The "first token" rule then applies to whatever remains.

This means `Matched` words actually get a meaningful rank from real-world Greek frequency data — not a hardcoded 2000.

### Extend `ImportSummaryModal` ([components/ImportSummaryModal.tsx](flath-app/components/ImportSummaryModal.tsx))

Replace the current 2-column "By Theme / By Difficulty" layout (lines 32-71) with a single matrix:

- **Rows**: difficulty tiers (`Débutant`, `Intermédiaire`, `Avancé`, `Niche`) derived from `frequency_rank` using [getDifficultyFromRank](flath-app/components/EditWordModal.tsx#L8). (Map existing `easy`/`medium`/`hard` labels to French for display.)
- **Columns**: themes present in the import + a `No Theme` column.
- **Cell value**: count of imported words at that intersection.
- **Props change**: replace `byTheme` and `byDifficulty` with a single `matrix: Record<diff, Record<theme, WordSummary[]>>` and `themes: string[]`. Callers in [app/vault/page.tsx](flath-app/app/vault/page.tsx) build this from the just-imported rows (we already have them in memory post-insert).

#### Interactive cells

- Clicking a cell expands an inline drawer underneath the matrix showing the Greek ↔ French pairs for that subset. Each row is editable in place (small inputs for greek/french, dropdown for PoS, dropdown for theme). Save writes via the same edit path used by EditWordModal (single-word update). Re-render the matrix on save so counts stay accurate if theme changes.

#### Theme management toolbar (above the matrix)

- **Rename theme**: dropdown of themes in this import + text input + Apply. Updates `words_dim.theme` for matching rows (scoped to imported word IDs, not globally).
- **Merge theme**: source dropdown + "into" target dropdown + Apply. Bulk update source rows to target value. After merge, source column disappears from the matrix.

Both actions go through a new server action `renameOrMergeTheme(wordIds, fromTheme, toTheme)` in `app/actions/words.ts`. RLS will reject rows the user can't edit — surface a partial-success toast if counts differ.

## 4. Vault batch actions & "Added by others" quick action

### Multi-select batch actions

Selection state already exists ([app/vault/page.tsx:52](flath-app/app/vault/page.tsx#L52), `selectedWordIds: Set<string>`) and checkboxes are rendered on desktop (lines 1182-1194). Today only Batch Edit is wired up. Add:

- **Batch Archive**: button in the existing selection toolbar. Updates `user_word_settings.is_archived = true` for `(user_id = auth.uid(), word_id IN selected)`. Upsert pattern — some selected words may not yet have a settings row.
- **Batch Delete**: with a confirm dialog ("Delete N words? This removes them from your library."). For owner/admin: deletes the `words_dim` row entirely. For non-owners: deletes only the user's `user_word_settings` row (effectively "remove from my library"). The action checks per-row ownership and splits the operation.

Surface both buttons only on desktop (`!isMobileSurface(surface)`) per [flath-app/CLAUDE.md](flath-app/CLAUDE.md) gating rules. Add a comment `// desktop-only — see flath-app/CLAUDE.md` at each gate and update the gated-features list in that file.

### "Added by others" quick action

Per the user's decision, this is essentially a styling/labeling pass on the existing `+` button at [app/vault/page.tsx:1156-1161](flath-app/app/vault/page.tsx#L1156): rename it "Move to my library", widen the hit target on each row, ensure it works for multi-select too (add the same selection toolbar to this tab — currently it only renders on the My Library tab).

---

## Critical files

| File | Change |
|------|--------|
| `flath-app/scripts/preview_pos_migration.mjs` | NEW — node script that previews PoS distribution + rows that would be rewritten. Read-only, uses service-role key from .env.local |
| `flath-app/sql/phase2_pos.sql` | NEW — backfill + CHECK constraint (you paste into Supabase SQL editor after running the preview script) |
| `flath-app/sql/phase2_rbac.sql` | NEW — `user_roles`, `is_admin()`, RLS policies on `words_dim`, admin seed for baptiste.dufresne@gmail.com (you paste into Supabase SQL editor) |
| `flath-app/public/datasets/el_50k.txt` | MOVE from repo root `datasets/` so Next.js can serve it as a static asset for the frequency lookup |
| `flath-app/lib/normalize.ts` | Add `POS_VALUES`, `coercePos` |
| `flath-app/lib/freqLookup.ts` | NEW — memoized loader returning `Map<greek_word, rank>` from el_50k.txt |
| `flath-app/hooks/useIsAdmin.ts` | NEW — admin role check hook |
| `flath-app/components/EditWordModal.tsx` | PoS → `<select>`; lock UI if not editable |
| `flath-app/components/AddWordModal.tsx` | PoS → `<select>`, default `Nom` |
| `flath-app/components/BatchEditModal.tsx` | Add optional PoS dropdown |
| `flath-app/components/ImportSummaryModal.tsx` | Matrix + interactive cells + theme rename/merge toolbar |
| `flath-app/app/vault/page.tsx` | CSV parser extensions; batch archive/delete; selection toolbar on Others tab; quick action relabel |
| `flath-app/app/actions/words.ts` | Drop service-key bypass; add `renameOrMergeTheme`, `batchArchive`, `batchDelete` |
| `flath-app/CLAUDE.md` | Update gated-features list with new desktop-only batch actions |

---

## Verification

1. **DB migration** — Run `phase2_pos.sql` against staging Supabase. Confirm pre-existing rows with junk PoS values are now `Autre`. Try inserting `part_of_speech = 'Foo'` directly via SQL — should fail with `part_of_speech_domain` violation.
2. **RBAC** — As a non-admin user: try to edit a word owned by another user. Edit button should be disabled; if forced via devtools, the update should return 0 rows. Insert yourself into `user_roles` as admin and confirm you can now edit any word.
3. **CSV import** — `npm run dev` in `flath-app/`. Open Vault on desktop (≥768px). Import a CSV with: a row missing PoS (should land in `Autre`), a row with `Frequency Rank=Matched` where the Greek word IS in el_50k.txt (should get the real rank from the file), a row with `Matched` where the Greek word is NOT in the file (should fall back to 8000 and appear in the "could not match" footnote), a `Niche` row (→ 8000), and rows split across 2 themes + 3 difficulty tiers. Confirm the matrix renders with correct counts and `No Theme` column appears for rows missing `Group`.
4. **Matrix interactions** — Click a cell, edit a translation pair inline, save. Confirm DB row updated and matrix counts reflect any theme change. Rename a theme from the toolbar; confirm scoped update. Merge two themes; confirm source column disappears.
5. **Vault batch actions** — Select 5 words, batch archive → confirm they leave the active view and reappear in the archived filter. Select 3 words including one owned by another user, batch delete → confirm only your own gets the words_dim delete; the others get `user_word_settings` removal only.
6. **Mobile gates** — Resize to 375px in DevTools, confirm batch checkboxes and CSV section remain hidden.
7. **PWA** — Install on phone or use Chrome DevTools "Application → Manifest" preview; confirm the EditWordModal PoS dropdown renders correctly and the lock icon shows for non-editable words.

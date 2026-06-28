## Context

`displayedLibrary` (vault/page.tsx ~496-620) and `displayedRemoved` (~622-746) are identical except
the seed filter (`!w.is_archived` vs `w.is_archived`). Both depend on the same 19 values. The sort
"smart" branch and the per-field comparator are duplicated verbatim.

## Goals / Non-Goals

**Goals:** one shared pure function; both memos call it; zero behavior change.
**Non-Goals:** component split, filter-state reducer, typing away the existing `any` row shape
(keep the row type as-is to minimize churn and risk).

## Decisions

**D1. Pure function signature.**
`filterAndSortVocab(rows, opts)` where `opts` bundles the filter values + `sortField` + `sortDirection`
+ `masteredIds`. It does NOT seed-filter by archived status — the caller passes already-seeded rows
(`myLibrary.filter(w => !w.is_archived)` / `(w => w.is_archived)`), keeping the archived distinction
at the call site exactly as today. Returns a new sorted array.

**D2. Module location: `app/vault/vaultFilterSort.ts`.**
Co-located with the page. Exports the function and an `VaultFilterOpts` type. Row param typed as the
same loose shape the page uses (`any`-ish record) to avoid a typing refactor here; the goal is dedup,
not type-tightening (tracked separately as C1).

**D3. Move the comparator and all filter branches verbatim.**
Copy the exact filter sequence and the exact sort comparator into the function body, substituting the
local filter variables for `opts.*`. No logic edits — a literal lift so the diff is reviewable and
behavior is provably identical.

## Risks / Trade-offs

- **[Risk] Subtle divergence during the lift (a filter dropped or reordered).** → Mitigation: lift
  verbatim; after extraction, both memos are a single call, and a manual tab-comparison confirms
  parity. `tsc` guards signature mismatches.
- **[Trade-off] Keeps the loose row typing.** Accepted — type-tightening is a separate concern (C1);
  bundling it here would enlarge the diff and the risk.

## Migration Plan

Pure code change. Verify: `tsc --noEmit`, lint (no new violations), and a manual check that Library
and Removed tabs behave identically across a few filter/sort combinations.

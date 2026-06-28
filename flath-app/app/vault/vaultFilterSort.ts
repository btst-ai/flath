import { normalizeForSearch } from "@/lib/normalize";

// Loose row shape matching the vault page's existing usage (a user_word_settings
// row joined with words_dim). Kept loose intentionally; type-tightening is a
// separate concern. See openspec finding C1.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type VaultRow = any;

export type SortField =
  | "smart"
  | "greek_text"
  | "french_text"
  | "theme"
  | "success"
  | "frequency"
  | "review_count"
  | "heat";

export interface VaultFilterOpts {
  searchQuery: string;
  filterTheme: string;
  filterPOS: string;
  filterStatus: string;
  filterExcludeSuccessful: boolean;
  masteredIds: Set<string>;
  filterSuccessMin: number | "";
  filterSuccessMax: number | "";
  filterFreqMin: number | "";
  filterFreqMax: number | "";
  filterReviewMin: number | "";
  filterReviewMax: number | "";
  filterTemporalField: "last_reviewed" | "last_correct_at" | "last_mistake_at" | "added" | null;
  filterTemporalDays: number | "";
  filterTemporalMode: "less_than" | "more_than";
  filterHeat: string | null;
  sortField: SortField;
  sortDirection: "asc" | "desc";
}

/**
 * Filter + sort a set of vault rows. Shared by the library and archived tabs so
 * their behavior cannot diverge. The caller seeds `rows` with the archived
 * distinction (`!is_archived` vs `is_archived`); this function does not.
 *
 * This is a verbatim lift of the logic previously duplicated in the
 * displayedLibrary / displayedRemoved memos in app/vault/page.tsx.
 */
export function filterAndSortVocab(rows: VaultRow[], opts: VaultFilterOpts): VaultRow[] {
  const {
    searchQuery,
    filterTheme,
    filterPOS,
    filterStatus,
    filterExcludeSuccessful,
    masteredIds,
    filterSuccessMin,
    filterSuccessMax,
    filterFreqMin,
    filterFreqMax,
    filterReviewMin,
    filterReviewMax,
    filterTemporalField,
    filterTemporalDays,
    filterTemporalMode,
    filterHeat,
    sortField,
    sortDirection,
  } = opts;

  let data = rows;

  // Filters
  if (searchQuery) {
    const q = normalizeForSearch(searchQuery);
    data = data.filter(item =>
      normalizeForSearch(item.words_dim?.greek_text || "").includes(q) ||
      normalizeForSearch(item.words_dim?.french_text || "").includes(q)
    );
  }

  if (filterTheme) {
    data = data.filter(item => item.words_dim?.theme === filterTheme);
  }
  if (filterPOS) {
    data = data.filter(item => item.words_dim?.part_of_speech === filterPOS);
  }
  if (filterStatus === "fav") {
    data = data.filter(item => item.is_fav);
  }
  if (filterExcludeSuccessful) {
    data = data.filter(item => !masteredIds.has(item.word_id));
  }

  if (filterSuccessMin !== "") {
    data = data.filter(item => Math.round((item.avg_success_rate_prod + item.avg_success_rate_rec) / 2) >= filterSuccessMin);
  }
  if (filterSuccessMax !== "") {
    data = data.filter(item => Math.round((item.avg_success_rate_prod + item.avg_success_rate_rec) / 2) <= filterSuccessMax);
  }
  if (filterFreqMin !== "") {
    data = data.filter(item => item.words_dim?.frequency_rank >= filterFreqMin);
  }
  if (filterFreqMax !== "") {
    data = data.filter(item => item.words_dim?.frequency_rank <= filterFreqMax);
  }
  if (filterReviewMin !== "") {
    data = data.filter(item => (item.review_count || 0) >= filterReviewMin);
  }
  if (filterReviewMax !== "") {
    data = data.filter(item => (item.review_count || 0) <= filterReviewMax);
  }
  if (filterTemporalField && filterTemporalDays !== "") {
    const cutoff = new Date(Date.now() - (filterTemporalDays as number) * 24 * 60 * 60 * 1000);
    data = data.filter(item => {
      // "added" uses the per-user added_at from user_word_settings, not words_dim.created_at
      const raw = filterTemporalField === "last_reviewed" ? item.last_reviewed
        : filterTemporalField === "last_correct_at" ? item.last_correct_at
        : filterTemporalField === "last_mistake_at" ? item.last_mistake_at
        : item.added_at;
      if (filterTemporalMode === "less_than") {
        return raw && new Date(raw) >= cutoff;
      } else {
        return !raw || new Date(raw) < cutoff;
      }
    });
  }
  if (filterHeat) {
    data = data.filter(item => {
      const score = item.interest_score || 0;
      if (filterHeat === "hot") return score > 5;
      if (filterHeat === "warm") return score >= 1 && score <= 5;
      return score <= 0;
    });
  }

  // Sort
  return [...data].sort((a, b) => {
    if (sortField === "smart") {
      // 1. Heat (desc)
      const aHeat = a.interest_score || 0;
      const bHeat = b.interest_score || 0;
      if (aHeat !== bHeat) return sortDirection === "asc" ? bHeat - aHeat : aHeat - bHeat;

      // 2. Success (asc)
      const aSuccess = (a.avg_success_rate_prod + a.avg_success_rate_rec) / 2;
      const bSuccess = (b.avg_success_rate_prod + b.avg_success_rate_rec) / 2;
      if (aSuccess !== bSuccess) return sortDirection === "asc" ? aSuccess - bSuccess : bSuccess - aSuccess;

      // 3. Frequency (asc)
      const aFreq = a.words_dim?.frequency_rank > 0 ? a.words_dim.frequency_rank : 99999;
      const bFreq = b.words_dim?.frequency_rank > 0 ? b.words_dim.frequency_rank : 99999;
      return sortDirection === "asc" ? aFreq - bFreq : bFreq - aFreq;
    }

    let aVal: any = "";
    let bVal: any = "";

    switch (sortField) {
      case "greek_text":
        aVal = a.words_dim?.greek_text || "";
        bVal = b.words_dim?.greek_text || "";
        break;
      case "french_text":
        aVal = a.words_dim?.french_text || "";
        bVal = b.words_dim?.french_text || "";
        break;
      case "theme":
        aVal = a.words_dim?.theme || "";
        bVal = b.words_dim?.theme || "";
        break;
      case "success":
        aVal = (a.avg_success_rate_prod + a.avg_success_rate_rec) / 2;
        bVal = (b.avg_success_rate_prod + b.avg_success_rate_rec) / 2;
        break;
      case "frequency":
        aVal = a.words_dim?.frequency_rank > 0 ? a.words_dim.frequency_rank : 99999;
        bVal = b.words_dim?.frequency_rank > 0 ? b.words_dim.frequency_rank : 99999;
        break;
      case "review_count":
        aVal = a.review_count || 0;
        bVal = b.review_count || 0;
        break;
      case "heat":
        aVal = a.interest_score || 0;
        bVal = b.interest_score || 0;
        break;
    }

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
}

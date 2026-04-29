import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Shared domain types — used by solo Practice and by the Duel feature.
// ---------------------------------------------------------------------------

export interface VocabRecord {
  id: string;
  greek_text: string;
  french_text: string;
  part_of_speech: string;
  theme: string;
  frequency_rank: number;
}

export interface UserSetting {
  word_id: string;
  is_fav: boolean;
  is_archived: boolean;
  interest_score: number;
  avg_success_rate_prod: number;
  avg_success_rate_rec: number;
  words_dim: VocabRecord;
}

export type Track = "rec" | "prod";

export interface SessionWord extends UserSetting {
  track: Track;
}

export type CardMode = "prod" | "rec" | "mixed";

// ---------------------------------------------------------------------------
// Fetch: user_word_settings joined with words_dim, filtered by optional pack.
// Mirrors the logic previously inlined in app/practice/page.tsx.
// ---------------------------------------------------------------------------

export async function fetchUserWords(
  userId: string,
  packId?: string | null,
  wordIds?: string[] | null,
): Promise<UserSetting[]> {
  let query = supabase
    .from("user_word_settings")
    .select(`
      *,
      words_dim!inner (*)
    `)
    .eq("user_id", userId)
    .eq("is_archived", false);

  if (wordIds && wordIds.length > 0) {
    query = query.in("word_id", wordIds);
  } else if (packId) {
    if (packId.startsWith("auto-theme-")) {
      const themeToMatch = decodeURIComponent(packId.replace("auto-theme-", ""));
      query = query.eq("words_dim.theme", themeToMatch);
    } else {
      const { data: packData } = await supabase.from("word_packs").select("*").eq("id", packId).single();
      if (packData) {
        if (packData.is_smart) {
          const { filter_criteria } = packData;
          if (filter_criteria.theme) query = query.eq("words_dim.theme", filter_criteria.theme);
          if (filter_criteria.pos) query = query.eq("words_dim.part_of_speech", filter_criteria.pos);
          if (filter_criteria.favOnly) query = query.eq("is_fav", true);
        } else {
          const { data: items } = await supabase
            .from("word_pack_items")
            .select("word_id")
            .eq("pack_id", packId);
          if (items && items.length > 0) {
            query = query.in("word_id", items.map(i => i.word_id));
          } else {
            // Empty pack — force zero results
            query = query.eq("word_id", "00000000-0000-0000-0000-000000000000");
          }
        }
      }
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("[sessionQueue] fetchUserWords failed", error);
    return [];
  }
  if (!data) return [];
  return data as UserSetting[];
}

// ---------------------------------------------------------------------------
// Shuffle
// ---------------------------------------------------------------------------

/** Fisher-Yates in-place shuffle, returns a new array. */
export function randomShuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sort orders
// ---------------------------------------------------------------------------

/**
 * Solo priority: interest_score desc → avg success asc → frequency_rank asc.
 * Mirrors the ordering used by Practice.
 */
export function sortSoloPriority(words: UserSetting[]): UserSetting[] {
  return [...words].sort((a, b) => {
    if (a.interest_score !== b.interest_score) return b.interest_score - a.interest_score;
    const successA = (a.avg_success_rate_prod + a.avg_success_rate_rec) / 2;
    const successB = (b.avg_success_rate_prod + b.avg_success_rate_rec) / 2;
    if (successA !== successB) return successA - successB;
    const freqA = a.words_dim.frequency_rank > 0 ? a.words_dim.frequency_rank : 99999;
    const freqB = b.words_dim.frequency_rank > 0 ? b.words_dim.frequency_rank : 99999;
    return freqA - freqB;
  });
}

/**
 * Intersect two users' libraries and sort by the average of their per-word
 * success rates, ascending (hardest for both players first). Tie-breaker:
 * frequency_rank asc. Only words present in BOTH users' libraries are eligible.
 */
export function sortAveragePriority(
  p1Words: UserSetting[],
  p2Words: UserSetting[],
): UserSetting[] {
  const p2ById = new Map(p2Words.map(w => [w.word_id, w]));
  const intersected = p1Words.filter(w => p2ById.has(w.word_id));

  return intersected.sort((a, b) => {
    const p2a = p2ById.get(a.word_id)!;
    const p2b = p2ById.get(b.word_id)!;
    const avgA = (((a.avg_success_rate_prod + a.avg_success_rate_rec) / 2)
                + ((p2a.avg_success_rate_prod + p2a.avg_success_rate_rec) / 2)) / 2;
    const avgB = (((b.avg_success_rate_prod + b.avg_success_rate_rec) / 2)
                + ((p2b.avg_success_rate_prod + p2b.avg_success_rate_rec) / 2)) / 2;
    if (avgA !== avgB) return avgA - avgB;
    const freqA = a.words_dim.frequency_rank > 0 ? a.words_dim.frequency_rank : 99999;
    const freqB = b.words_dim.frequency_rank > 0 ? b.words_dim.frequency_rank : 99999;
    return freqA - freqB;
  });
}

// ---------------------------------------------------------------------------
// Track assignment
// ---------------------------------------------------------------------------

/**
 * Assign rec/prod to each word.
 * - "prod" / "rec": forced track
 * - "mixed": adaptive weighting — if one track is 20%+ stronger, force the
 *   other; otherwise pick 50/50 randomly.
 */
export function assignTracks(words: UserSetting[], mode: CardMode): SessionWord[] {
  return words.map(word => {
    let track: Track;
    if (mode === "prod") {
      track = "prod";
    } else if (mode === "rec") {
      track = "rec";
    } else {
      if (word.avg_success_rate_rec > word.avg_success_rate_prod + 20) {
        track = "prod"; // Recognition is much better, force Production
      } else if (word.avg_success_rate_prod > word.avg_success_rate_rec + 20) {
        track = "rec";  // Production is much better, force Recognition
      } else {
        track = Math.random() > 0.5 ? "rec" : "prod";
      }
    }
    return { ...word, track };
  });
}

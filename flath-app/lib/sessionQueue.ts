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
  last_reviewed?: string | null;
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
          if (filter_criteria.excludedIds?.length > 0) {
            query = query.not("word_id", "in", `(${filter_criteria.excludedIds.join(",")})`);
          }
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
// Fetch: words from mistakes in last 7 days, not reviewed today.
// ---------------------------------------------------------------------------

export async function getMistakesForRepair(
  userId: string,
  limit: number,
): Promise<UserSetting[]> {
  // Get mistakes from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Query: get all "forgot" attempts in last 7 days, group by word_id, count them
  const { data: mistakeAttempts, error } = await supabase
    .from("attempts_history")
    .select("word_id")
    .eq("user_id", userId)
    .eq("outcome", "forgot")
    .gte("ts", sevenDaysAgo);

  if (error) {
    console.error("[sessionQueue] getMistakesForRepair failed", error);
    return [];
  }

  if (!mistakeAttempts || mistakeAttempts.length === 0) {
    return [];
  }

  // Count "forgot" occurrences per word_id
  const mistakeCounts = new Map<string, number>();
  for (const attempt of mistakeAttempts) {
    const count = mistakeCounts.get(attempt.word_id) || 0;
    mistakeCounts.set(attempt.word_id, count + 1);
  }

  const wordIds = Array.from(mistakeCounts.keys());

  // Fetch user_word_settings for these words, filter by last_reviewed
  const { data: userSettings, error: settingsError } = await supabase
    .from("user_word_settings")
    .select(`
      *,
      words_dim!inner (*)
    `)
    .eq("user_id", userId)
    .in("word_id", wordIds)
    .eq("is_archived", false);

  if (settingsError) {
    console.error("[sessionQueue] getMistakesForRepair user_settings query failed", settingsError);
    return [];
  }

  if (!userSettings) {
    return [];
  }

  // Filter: only include words NOT reviewed in last 24 hours
  const filtered = userSettings.filter((word: UserSetting) => {
    if (!word.last_reviewed) return true; // Never reviewed, include it
    const lastReviewedTime = new Date(word.last_reviewed).getTime();
    const twentyFourHoursAgoTime = new Date(twentyFourHoursAgo).getTime();
    return lastReviewedTime < twentyFourHoursAgoTime;
  });

  // Sort by: mistake count DESC, then apply sortSoloPriority for secondary sort
  const sorted = filtered.sort((a: UserSetting, b: UserSetting) => {
    const countA = mistakeCounts.get(a.word_id) || 0;
    const countB = mistakeCounts.get(b.word_id) || 0;
    if (countA !== countB) return countB - countA; // More mistakes first

    // Secondary sort: use sortSoloPriority logic (Heat, Success, Frequency)
    if (a.interest_score !== b.interest_score) return b.interest_score - a.interest_score;
    const successA = (a.avg_success_rate_prod + a.avg_success_rate_rec) / 2;
    const successB = (b.avg_success_rate_prod + b.avg_success_rate_rec) / 2;
    if (successA !== successB) return successA - successB;
    const freqA = a.words_dim.frequency_rank > 0 ? a.words_dim.frequency_rank : 99999;
    const freqB = b.words_dim.frequency_rank > 0 ? b.words_dim.frequency_rank : 99999;
    return freqA - freqB;
  });

  return sorted.slice(0, limit) as UserSetting[];
}

// ---------------------------------------------------------------------------
// Filter: remove words with >75% success rate in the last 7 days (smart mode).
// ---------------------------------------------------------------------------

export async function filterMasteredWords(
  userId: string,
  words: UserSetting[],
): Promise<UserSetting[]> {
  if (words.length === 0) return words;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: attempts, error } = await supabase
    .from("attempts_history")
    .select("word_id, outcome")
    .eq("user_id", userId)
    .gte("ts", sevenDaysAgo);

  if (error || !attempts || attempts.length === 0) return words;

  // Count total and "know" outcomes per word
  const totals = new Map<string, number>();
  const knows = new Map<string, number>();
  for (const a of attempts) {
    totals.set(a.word_id, (totals.get(a.word_id) || 0) + 1);
    if (a.outcome === "know") {
      knows.set(a.word_id, (knows.get(a.word_id) || 0) + 1);
    }
  }

  return words.filter(w => {
    const total = totals.get(w.word_id);
    if (!total) return true; // No recent reviews — keep it
    const successRate = (knows.get(w.word_id) || 0) / total;
    return successRate <= 0.75;
  });
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
 * Compute the probability of assigning a card to the Production (FR→EL) track.
 *
 * Baseline is 0.70 (Production-favoured). The adaptive component shifts it
 * based on which modality has accumulated more failures recently: more
 * Production failures → higher pProd (siphon towards the weaker modality).
 *
 * Returns baseline when the failure sample is too small (<10 total).
 */
export function computeProdProbability(
  prodFailures14d: number,
  recFailures14d: number,
  baseline = 0.70,
  maxSwing = 0.25,
): number {
  const total = prodFailures14d + recFailures14d;
  if (total < 10) return baseline;
  const failureShareProd = prodFailures14d / total;
  const vulnerabilityDelta = failureShareProd - 0.5;
  const raw = baseline + vulnerabilityDelta * 2 * maxSwing;
  const clamped = Math.min(baseline + maxSwing, Math.max(baseline - maxSwing, raw));
  return Math.min(0.95, Math.max(0.40, clamped));
}

/**
 * Assign rec/prod track to each word.
 * - "prod" / "rec": forced track
 * - "mixed": sample each word independently against pProd (default 0.70)
 */
export function assignTracks(words: UserSetting[], mode: CardMode, pProd = 0.70): SessionWord[] {
  return words.map(word => {
    let track: Track;
    if (mode === "prod") {
      track = "prod";
    } else if (mode === "rec") {
      track = "rec";
    } else {
      track = Math.random() < pProd ? "prod" : "rec";
    }
    return { ...word, track };
  });
}

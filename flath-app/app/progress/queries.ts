import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Fetch distinct local-timezone date strings via RPC (immune to PostgREST 1000-row cap).
// The streak_dates RPC returns O(days) rows rather than O(attempts), so high-volume
// users never have today's rows silently truncated out of the result set.
export async function fetchStreakDates(_userId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("streak_dates", {
    p_days: 90,
    p_tz: "Europe/Athens",
  });

  if (error) {
    toast.error("Failed to load streak data");
    return [];
  }

  return (data ?? []).map((r: { day: string }) => r.day);
}

// Count distinct word_ids practiced in last 7 days.
export async function fetchDistinctWords7d(userId: string): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("attempts_history")
    .select("word_id")
    .eq("user_id", userId)
    .gte("ts", since)
    .order("ts", { ascending: false })
    .limit(10000);

  if (error) {
    toast.error("Failed to load vocabulary stats");
    return 0;
  }

  return new Set((data ?? []).map((r) => r.word_id)).size;
}

// Count words added in last 7 days.
export async function fetchWordsAdded7d(userId: string): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("user_word_settings")
    .select("word_id", { count: "exact" })
    .eq("user_id", userId)
    .gte("added_at", since)
    .or("added_at.lt.2026-06-28T00:00:00.000Z,added_at.gte.2026-06-29T00:00:00.000Z");

  if (error) {
    toast.error("Failed to load words added");
    return 0;
  }

  return data?.length ?? 0;
}

// Fetch all attempts in last 30 days.
export async function fetchAttemptsLast30d(userId: string): Promise<
  Array<{ ts: string; wordId: string; outcome: string }>
> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("attempts_history")
    .select("ts, word_id, outcome")
    .eq("user_id", userId)
    .gte("ts", since)
    .order("ts", { ascending: false })
    .limit(20000);

  if (error) {
    toast.error("Failed to load practice history");
    return [];
  }

  return (data ?? []).map((r) => ({ ts: r.ts, wordId: r.word_id, outcome: r.outcome }));
}

export interface WordWithSettings {
  word_id: string;
  greek_text: string;
  theme: string | null;
  is_archived: boolean;
  avg_success_rate_prod: number;
  avg_success_rate_rec: number;
  review_count: number;
  last_reviewed: string | null;
  last_mistake_at: string | null;
}

// Fetch user_word_settings joined to words_dim for all non-archived words.
export async function fetchUserWordSettings(userId: string): Promise<WordWithSettings[]> {
  const { data, error } = await supabase
    .from("user_word_settings")
    .select(`
      word_id,
      is_archived,
      avg_success_rate_prod,
      avg_success_rate_rec,
      review_count,
      last_reviewed,
      last_mistake_at,
      words_dim (greek_text, theme)
    `)
    .eq("user_id", userId)
    .eq("is_archived", false);

  if (error) {
    toast.error("Failed to load word settings");
    return [];
  }

  return (data ?? []).map((r) => {
    const wd = Array.isArray(r.words_dim) ? r.words_dim[0] : r.words_dim;
    return {
      word_id: r.word_id,
      greek_text: wd?.greek_text ?? "",
      theme: wd?.theme ?? null,
      is_archived: r.is_archived,
      avg_success_rate_prod: r.avg_success_rate_prod ?? 0,
      avg_success_rate_rec: r.avg_success_rate_rec ?? 0,
      review_count: r.review_count ?? 0,
      last_reviewed: r.last_reviewed,
      last_mistake_at: r.last_mistake_at,
    };
  });
}

export interface DuelRow {
  winner: string;
  p1_user_id: string;
  p2_user_id: string | null;
}

// Fetch duels from the last 30 days where user was p1 or p2.
export async function fetchDuelSummary(userId: string): Promise<DuelRow[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("duels")
    .select("winner, p1_user_id, p2_user_id")
    .or(`p1_user_id.eq.${userId},p2_user_id.eq.${userId}`)
    .gte("ts_finished", since);

  if (error) {
    toast.error("Failed to load duel history");
    return [];
  }

  return data ?? [];
}

export interface WordAddedRow {
  added_at: string;
  theme: string | null;
}

// Fetch words added in last 30 days with their theme.
export async function fetchWordsAddedLast30d(userId: string): Promise<WordAddedRow[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("user_word_settings")
    .select("added_at, words_dim(theme)")
    .eq("user_id", userId)
    .gte("added_at", since)
    .or("added_at.lt.2026-06-28T00:00:00.000Z,added_at.gte.2026-06-29T00:00:00.000Z");

  if (error) {
    toast.error("Failed to load vocabulary additions");
    return [];
  }

  return (data ?? []).map((r) => {
    const wd = Array.isArray(r.words_dim) ? r.words_dim[0] : r.words_dim;
    return { added_at: r.added_at, theme: (wd as { theme?: string | null } | null)?.theme ?? null };
  });
}

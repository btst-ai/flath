import { supabase as browserSupabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type AttemptRow = {
  word_id: string;
  mode: "prod" | "rec";
  outcome: "know" | "meh" | "forgot";
  interest_interaction: "fav" | "up" | "down" | "archive" | "none";
  ts: string;
};

/**
 * Recompute `user_word_settings` aggregates (avg_success_rate_prod/rec,
 * interest_score, review_count, last_reviewed) for a user across a set of
 * word ids, based on the full `attempts_history` for those words.
 *
 * Shared between solo Practice and the Duel feature. The caller injects the
 * Supabase client so this can run either client-side (anon + user JWT) or
 * server-side (service-role) — the Duel finishing flow uses service-role to
 * recompute aggregates for both P1 and P2.
 */
export async function recomputeUserWordSettings(
  userId: string,
  wordIds: string[],
  client: SupabaseClient = browserSupabase,
): Promise<{ error?: string }> {
  const uniqueWordIds = Array.from(new Set(wordIds));
  if (uniqueWordIds.length === 0) return {};

  // Batched: one history read for all words (was one per word — the N+1 fix).
  const { data: allHistory, error: historyError } = await client
    .from("attempts_history")
    .select("*")
    .eq("user_id", userId)
    .in("word_id", uniqueWordIds);

  if (historyError) {
    console.error("recomputeUserWordSettings: history read failed", historyError);
    return { error: historyError.message };
  }

  // Group rows by word, sorted by ts ascending (matches the prior per-word query order).
  const historyByWord = new Map<string, AttemptRow[]>();
  for (const h of (allHistory ?? []) as AttemptRow[]) {
    const arr = historyByWord.get(h.word_id);
    if (arr) arr.push(h);
    else historyByWord.set(h.word_id, [h]);
  }
  for (const arr of historyByWord.values()) {
    arr.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  }

  // Batched: one settings read for the zero-attempts fallback (was one per word).
  const { data: existingSettings, error: settingsReadError } = await client
    .from("user_word_settings")
    .select("word_id, avg_success_rate_prod, avg_success_rate_rec")
    .eq("user_id", userId)
    .in("word_id", uniqueWordIds);

  if (settingsReadError) {
    console.error("recomputeUserWordSettings: settings read failed", settingsReadError);
    return { error: settingsReadError.message };
  }

  const settingsByWord = new Map<string, { avg_success_rate_prod: number; avg_success_rate_rec: number }>();
  for (const s of existingSettings ?? []) {
    settingsByWord.set(s.word_id, s);
  }

  const now = new Date().toISOString();

  const rows = uniqueWordIds.map((wId) => {
    const history = historyByWord.get(wId) ?? [];

    let prodAttempts = 0;
    let prodScore = 0;
    let recAttempts = 0;
    let recScore = 0;

    // Moving average of the last 10 non-'none' interactions for interest score.
    const interestInteractions = history.filter(h => h.interest_interaction !== 'none').slice(-10);
    let interestScore = 0;

    if (interestInteractions.length > 0) {
      let sum = 0;
      for (const h of interestInteractions) {
        if (h.interest_interaction === 'fav') sum += 30;
        else if (h.interest_interaction === 'up') sum += 5;
        else if (h.interest_interaction === 'down') sum -= 5;
        else if (h.interest_interaction === 'archive') sum -= 30;
      }
      interestScore = Math.round(sum / interestInteractions.length);
    }

    for (const h of history) {
      const weight = h.outcome === 'know' ? 1.0 : (h.outcome === 'meh' ? 0.3 : 0.0);
      if (h.mode === 'prod') {
        prodAttempts++;
        prodScore += weight;
      } else {
        recAttempts++;
        recScore += weight;
      }
    }

    const current = settingsByWord.get(wId);
    const avgProd = prodAttempts > 0 ? (prodScore / prodAttempts) * 100 : (current?.avg_success_rate_prod ?? 50);
    const avgRec = recAttempts > 0 ? (recScore / recAttempts) * 100 : (current?.avg_success_rate_rec ?? 50);
    const reviewCount = prodAttempts + recAttempts;

    const lastCorrect = [...history].reverse().find(h => h.outcome === 'know')?.ts ?? null;
    const lastMistake = [...history].reverse().find(h => h.outcome === 'forgot')?.ts ?? null;

    return {
      user_id: userId,
      word_id: wId,
      avg_success_rate_prod: avgProd,
      avg_success_rate_rec: avgRec,
      interest_score: interestScore,
      review_count: reviewCount,
      last_reviewed: now,
      last_correct_at: lastCorrect,
      last_mistake_at: lastMistake,
    };
  });

  // Batched: one upsert for all words (was one update per word). Only the
  // computed columns + PK are sent, so is_fav / is_archived / added_at are
  // preserved on existing rows.
  const { error: upsertError } = await client
    .from("user_word_settings")
    .upsert(rows, { onConflict: "user_id,word_id" });

  if (upsertError) {
    console.error("recomputeUserWordSettings: upsert failed", upsertError);
    return { error: upsertError.message };
  }

  return {};
}

/**
 * Fetch the most-recent prior attempt outcome (before `beforeTs`) for each
 * given word id. Used by the session recap to decide which first-attempt-
 * correct words qualify for a 🎉 marker.
 */
export async function getLastAttemptOutcomes(
  userId: string,
  wordIds: string[],
  beforeTs: string,
): Promise<Record<string, "know" | "meh" | "forgot">> {
  if (wordIds.length === 0) return {};

  const { data, error } = await browserSupabase
    .from("attempts_history")
    .select("word_id, outcome, ts")
    .eq("user_id", userId)
    .in("word_id", wordIds)
    .lt("ts", beforeTs)
    .order("ts", { ascending: false });

  if (error || !data) return {};

  const out: Record<string, "know" | "meh" | "forgot"> = {};
  for (const row of data) {
    if (!out[row.word_id]) out[row.word_id] = row.outcome;
  }
  return out;
}

/**
 * Count Production vs Recognition failures in the last `days` days.
 * Used at session start to compute the adaptive modality bias (pProd).
 */
export async function getModalityFailureCounts(
  userId: string,
  days = 14,
): Promise<{ prodFailures: number; recFailures: number }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await browserSupabase
    .from("attempts_history")
    .select("mode")
    .eq("user_id", userId)
    .eq("outcome", "forgot")
    .gte("ts", since);

  if (error || !data) return { prodFailures: 0, recFailures: 0 };

  let prodFailures = 0;
  let recFailures = 0;
  for (const row of data) {
    if (row.mode === "prod") prodFailures++;
    else recFailures++;
  }
  return { prodFailures, recFailures };
}

/**
 * Record a single word as a mistake and recompute its aggregates.
 *
 * Inserts one `attempts_history` row with `outcome:'forgot'` and
 * `interest_interaction:'none'`, then calls `recomputeUserWordSettings` so
 * `avg_success_rate_*` drops and `last_mistake_at` is stamped. Mode defaults
 * to `'rec'` when there is no active production-mode session context (e.g.
 * when tagging from the vault or the add-word modal).
 *
 * Used by: AddWordModal "Add a mistake" checkbox, Vault quick-tag button,
 * in-session drawer quick-tag button.
 */
export async function markWordAsMistake(
  userId: string,
  wordId: string,
  mode: "prod" | "rec" = "rec",
): Promise<{ success: true } | { error: string }> {
  const { error: insertErr } = await browserSupabase
    .from("attempts_history")
    .insert({
      user_id: userId,
      word_id: wordId,
      mode,
      outcome: "forgot",
      interest_interaction: "none",
    });

  if (insertErr) {
    console.error("markWordAsMistake: failed to insert attempt", insertErr);
    return { error: insertErr.message };
  }

  const recompute = await recomputeUserWordSettings(userId, [wordId]);
  if (recompute.error) {
    // The attempt row persisted, but aggregates may be stale until the next
    // successful recompute. Surface it so the caller can inform the user.
    return { error: `Saved the mistake but stats may be out of date: ${recompute.error}` };
  }

  return { success: true };
}

export async function submitSessionAttempts(userId: string, attempts: any[]) {
  // 1. Insert attempts
  const historyInserts = attempts.map(a => ({
    user_id: userId,
    word_id: a.word_id,
    mode: a.mode,
    outcome: a.outcome,
    interest_interaction: a.interest_interaction || 'none',
  }));

  const { error: insertErr } = await browserSupabase.from("attempts_history").insert(historyInserts);
  if (insertErr) {
    console.error("Failed to insert attempts", insertErr);
    return { error: insertErr.message };
  }

  // 2. Recalculate aggregates for the involved words
  const recompute = await recomputeUserWordSettings(userId, attempts.map(a => a.word_id));
  if (recompute.error) {
    // Attempts persisted; aggregates may lag until the next successful recompute.
    return { error: `Saved attempts but stats may be out of date: ${recompute.error}` };
  }

  return { success: true };
}

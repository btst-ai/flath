import { supabase as browserSupabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

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
) {
  const uniqueWordIds = Array.from(new Set(wordIds));

  for (const wId of uniqueWordIds) {
    const { data: history } = await client
      .from("attempts_history")
      .select("*")
      .eq("user_id", userId)
      .eq("word_id", wId)
      .order("ts", { ascending: true });

    if (!history) continue;

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

    const { data: currentSettings } = await client
      .from("user_word_settings")
      .select("avg_success_rate_prod, avg_success_rate_rec")
      .eq("user_id", userId)
      .eq("word_id", wId)
      .single();

    const avgProd = prodAttempts > 0 ? (prodScore / prodAttempts) * 100 : (currentSettings?.avg_success_rate_prod ?? 50);
    const avgRec = recAttempts > 0 ? (recScore / recAttempts) * 100 : (currentSettings?.avg_success_rate_rec ?? 50);
    const reviewCount = prodAttempts + recAttempts;

    await client.from("user_word_settings").update({
      avg_success_rate_prod: avgProd,
      avg_success_rate_rec: avgRec,
      interest_score: interestScore,
      review_count: reviewCount,
      last_reviewed: new Date().toISOString()
    }).eq("user_id", userId).eq("word_id", wId);
  }
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
  await recomputeUserWordSettings(userId, attempts.map(a => a.word_id));

  return { success: true };
}

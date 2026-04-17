import { supabase } from "@/lib/supabase";

export async function submitSessionAttempts(userId: string, attempts: any[]) {
  // 1. Insert attempts
  const historyInserts = attempts.map(a => ({
    user_id: userId,
    word_id: a.word_id,
    mode: a.mode,
    outcome: a.outcome,
    interest_interaction: a.interest_interaction || 'none',
  }));

  const { error: insertErr } = await supabase.from("attempts_history").insert(historyInserts);
  if (insertErr) {
    console.error("Failed to insert attempts", insertErr);
    return { error: insertErr.message };
  }

  // 2. Recalculate aggregates for the involved words
  const wordIds = Array.from(new Set(attempts.map(a => a.word_id)));
  
  for (const wId of wordIds) {
    // Get all history for this word
    const { data: history } = await supabase
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
    
    // For interest score moving average (last 10 valid interactions)
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

    const { data: currentSettings } = await supabase
      .from("user_word_settings")
      .select("avg_success_rate_prod, avg_success_rate_rec")
      .eq("user_id", userId)
      .eq("word_id", wId)
      .single();

    const avgProd = prodAttempts > 0 ? (prodScore / prodAttempts) * 100 : (currentSettings?.avg_success_rate_prod ?? 50);
    const avgRec = recAttempts > 0 ? (recScore / recAttempts) * 100 : (currentSettings?.avg_success_rate_rec ?? 50);
    const reviewCount = prodAttempts + recAttempts;

    await supabase.from("user_word_settings").update({
      avg_success_rate_prod: avgProd,
      avg_success_rate_rec: avgRec,
      interest_score: interestScore,
      review_count: reviewCount,
      last_reviewed: new Date().toISOString()
    }).eq("user_id", userId).eq("word_id", wId);
  }

  return { success: true };
}

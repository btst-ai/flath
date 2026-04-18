"use server";

import { createClient } from "@supabase/supabase-js";
import { recomputeUserWordSettings } from "@/app/actions/session";

// ---------------------------------------------------------------------------
// Server-side client (service role) — same pattern as app/actions/words.ts.
// Required to look up auth.users by email and to write attempts on behalf of
// P2, whose JWT is not present in this request.
// ---------------------------------------------------------------------------
function serviceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, serviceKey);
}

// ---------------------------------------------------------------------------
// lookupP2 — validate an opponent's email against auth.users.
// ---------------------------------------------------------------------------

export type LookupP2Result =
  | { ok: true; userId: string; email: string }
  | { ok: false; error: "not_found" | "same_as_p1" | "invalid" | "server_error" };

export async function lookupP2(email: string, p1UserId: string): Promise<LookupP2Result> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "invalid" };
  }

  const client = serviceClient();
  // `auth.admin.listUsers` supports filtering client-side; for the small scale
  // of this app we page through until we find a match. Alternatively a direct
  // SQL query on auth.users by email would be faster; this keeps it simple.
  try {
    // listUsers supports up to 1000 per page by default in supabase-js v2.
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      console.error("lookupP2 listUsers failed", error);
      return { ok: false, error: "server_error" };
    }
    const match = data.users.find(u => (u.email ?? "").toLowerCase() === trimmed);
    if (!match) return { ok: false, error: "not_found" };
    if (match.id === p1UserId) return { ok: false, error: "same_as_p1" };
    return { ok: true, userId: match.id, email: match.email ?? trimmed };
  } catch (e) {
    console.error("lookupP2 threw", e);
    return { ok: false, error: "server_error" };
  }
}

// ---------------------------------------------------------------------------
// finishDuel — persist the summary row and sync attempts for connected users.
// ---------------------------------------------------------------------------

export interface DuelAttempt {
  word_id: string;
  mode: "prod" | "rec";
  outcome: "know" | "meh" | "forgot";
}

export interface FinishDuelSummary {
  p1UserId: string;
  p2UserId: string | null;         // null when P2 is guest
  p1DisplayName: string;
  p2DisplayName: string;
  p1Flag: string;
  p2Flag: string;
  packId: string | null;
  dataSource: "p1" | "p2" | "avg";
  cardMode: "prod" | "rec" | "mixed";
  p1FinalScore: number;
  p2FinalScore: number;
  winner: "p1" | "p2" | "tie";
  totalCards: number;
  durationMs: number;
  tsStarted: string;               // ISO
}

export async function finishDuel(
  summary: FinishDuelSummary,
  attemptsP1: DuelAttempt[],
  attemptsP2: DuelAttempt[] | null,
) {
  const client = serviceClient();

  // 1) Summary row.
  const { data: duelRow, error: duelErr } = await client
    .from("duels")
    .insert({
      p1_user_id: summary.p1UserId,
      p2_user_id: summary.p2UserId,
      p2_is_guest: summary.p2UserId === null,
      p1_display_name: summary.p1DisplayName,
      p2_display_name: summary.p2DisplayName,
      p1_flag: summary.p1Flag,
      p2_flag: summary.p2Flag,
      pack_id: summary.packId,
      data_source: summary.dataSource,
      card_mode: summary.cardMode,
      p1_final_score: summary.p1FinalScore,
      p2_final_score: summary.p2FinalScore,
      winner: summary.winner,
      total_cards: summary.totalCards,
      duration_ms: summary.durationMs,
      ts_started: summary.tsStarted,
    })
    .select("id")
    .single();

  if (duelErr) {
    console.error("finishDuel: insert into duels failed", duelErr);
    return { error: duelErr.message };
  }

  // 2) Attempt-history rows (P1 always, P2 only when connected).
  const p1Rows = attemptsP1.map(a => ({
    user_id: summary.p1UserId,
    word_id: a.word_id,
    mode: a.mode,
    outcome: a.outcome,
    interest_interaction: "none",
  }));
  if (p1Rows.length > 0) {
    const { error: p1Err } = await client.from("attempts_history").insert(p1Rows);
    if (p1Err) console.error("finishDuel: P1 attempts insert failed", p1Err);
  }

  if (summary.p2UserId && attemptsP2 && attemptsP2.length > 0) {
    const p2Rows = attemptsP2.map(a => ({
      user_id: summary.p2UserId!,
      word_id: a.word_id,
      mode: a.mode,
      outcome: a.outcome,
      interest_interaction: "none",
    }));
    const { error: p2Err } = await client.from("attempts_history").insert(p2Rows);
    if (p2Err) console.error("finishDuel: P2 attempts insert failed", p2Err);
  }

  // 3) Recompute aggregates for each synced user using the service client.
  const p1WordIds = attemptsP1.map(a => a.word_id);
  if (p1WordIds.length > 0) {
    await recomputeUserWordSettings(summary.p1UserId, p1WordIds, client);
  }
  if (summary.p2UserId && attemptsP2) {
    const p2WordIds = attemptsP2.map(a => a.word_id);
    if (p2WordIds.length > 0) {
      await recomputeUserWordSettings(summary.p2UserId, p2WordIds, client);
    }
  }

  return { success: true, duelId: duelRow?.id };
}

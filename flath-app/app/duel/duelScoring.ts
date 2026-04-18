import type { Claim, Grade, PlayerId } from "./duelTypes";

/**
 * Scoring matrix — see prd_duel.md §3.1.
 * Values are per-round base points before the Winner ×2 bonus.
 */
export const SCORE_MATRIX: Record<Claim, Record<Grade, number>> = {
  know:   { right: 2,   meh: 0,   wrong: -3   },
  meh:    { right: 1,   meh: 0.5, wrong: -0.5 },
  forgot: { right: 0.5, meh: 0.5, wrong: 0    },
};

/** Rank for confidence tie-break: know > meh > forgot. */
const CONFIDENCE_RANK: Record<Claim, number> = { know: 2, meh: 1, forgot: 0 };

/**
 * Determine the round Winner (or null for no-Winner).
 *
 * Rules (see plan §3):
 *  - Different confidence → the higher-confidence player is Winner (×2). Speed ignored.
 *  - Both `I Know` → faster timestamp is Winner (×2).
 *  - Both `Meh` or both `Don't Know` → **no Winner** (neither gets ×2).
 */
export function resolveWinner(
  p1Claim: Claim,
  p2Claim: Claim,
  p1At: number,
  p2At: number,
): PlayerId | null {
  const r1 = CONFIDENCE_RANK[p1Claim];
  const r2 = CONFIDENCE_RANK[p2Claim];
  if (r1 !== r2) return r1 > r2 ? "p1" : "p2";
  // Same confidence level
  if (p1Claim === "know") {
    // Only I-Know tie triggers speed-based Winner with bonus.
    return p1At <= p2At ? "p1" : "p2";
  }
  // Both "meh" or both "forgot" → no Winner, no ×2 for anyone.
  return null;
}

/** Points for a given player in a round. */
export function scoreRound(
  claim: Claim,
  peerGrade: Grade,
  isWinner: boolean,
): number {
  const base = SCORE_MATRIX[claim][peerGrade];
  return isWinner ? base * 2 : base;
}

/**
 * Roast message by current score. Returns null when score >= 0.
 * See prd_duel.md §3.2.
 */
export function roastFor(score: number): string | null {
  if (score >= 0) return null;
  if (score < -15) return "The Greek gods are literally laughing at you right now.";
  if (score <= -5) return "Maybe stick to French for a while?";
  return "Is your brain in 'Airplane Mode'?";
}

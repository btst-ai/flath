import type { SessionWord, CardMode } from "@/lib/sessionQueue";

export type PlayerId = "p1" | "p2";
export type Claim = "know" | "meh" | "forgot";
export type Grade = "right" | "meh" | "wrong";
export type DataSource = "p1" | "p2" | "avg";

/** Per-player stable identity for the duel. */
export interface PlayerIdentity {
  userId: string | null;   // null when P2 is a guest
  displayName: string;
  flag: string;
  isGuest: boolean;
}

/** Lobby-level configuration chosen before the duel starts. */
export interface DuelConfig {
  p1: PlayerIdentity;
  p2: PlayerIdentity;
  source: "smart" | "pack";
  dataSource: DataSource;           // only meaningful when source === "smart"
  packId: string | null;            // only meaningful when source === "pack"
  cardMode: CardMode;               // prod | rec | mixed
  totalCards: number;               // fixed 50 by default
}

/**
 * Phases of a single card round. See plan §3.
 */
export type Phase =
  | "idle_claim"      // waiting for both players to claim confidence
  | "await_reveal"    // both claimed; cue line announces Winner/no-speaker; any key → reveal
  | "reveal"          // card back visible; P1 grades P2 (ZXC), P2 grades P1 (BNM)
  | "await_lockin"    // grades done; waiting for P1=Q AND P2=P to confirm
  | "scored"          // points applied; any key → countdown
  | "countdown";      // 3 → 2 → 1 → next card

/** Per-card transient state, reset between rounds. */
export interface RoundState {
  phase: Phase;
  cardIndex: number;              // 0-based
  card: SessionWord;
  p1Claim: Claim | null;
  p2Claim: Claim | null;
  p1ClaimAt: number | null;       // performance.now() timestamp
  p2ClaimAt: number | null;
  winner: PlayerId | null;        // null = tied below I-Know (no bonus)
  p1GradeOfP2: Grade | null;      // P1 grades P2 via Z/X/C
  p2GradeOfP1: Grade | null;      // P2 grades P1 via B/N/M
  p1ConfirmedLockin: boolean;     // P1 pressed Q
  p2ConfirmedLockin: boolean;     // P2 pressed P
  p1RoundPoints: number;          // computed at SCORED
  p2RoundPoints: number;
  countdown: 3 | 2 | 1 | null;
}

/** A finalized round, committed to the cumulative series. */
export interface FinalizedRound {
  cardIndex: number;
  wordId: string;
  track: "rec" | "prod";
  p1Claim: Claim;
  p2Claim: Claim;
  winner: PlayerId | null;
  p1GradeOfP2: Grade;
  p2GradeOfP1: Grade;
  p1Points: number;
  p2Points: number;
  /** Cumulative score after this round. */
  p1CumScore: number;
  p2CumScore: number;
}

/** Top-level duel state carried by the reducer. */
export interface DuelState {
  stage: "lobby" | "playing" | "finished";
  config: DuelConfig | null;
  queue: SessionWord[];           // full 50-card queue
  round: RoundState | null;       // current in-flight round
  history: FinalizedRound[];      // completed rounds (powers the live chart)
  startedAt: number | null;       // performance.now() — monotonic, for durations
  startedAtIso: string | null;    // Date-based ISO timestamp — for DB persistence
  finishedAt: number | null;      // performance.now()
}

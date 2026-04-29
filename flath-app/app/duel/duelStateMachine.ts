import type { SessionWord } from "@/lib/sessionQueue";
import type {
  Claim,
  DuelConfig,
  DuelState,
  FinalizedRound,
  Grade,
  PlayerId,
  Phase,
  RoundState,
} from "./duelTypes";
import { resolveWinner, scoreRound } from "./duelScoring";

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type DuelAction =
  | { type: "START"; config: DuelConfig; queue: SessionWord[]; now: number; nowIso: string }
  | { type: "CLAIM"; player: PlayerId; claim: Claim; now: number }
  | { type: "REVEAL" }
  | { type: "GRADE"; player: PlayerId; grade: Grade }
  | { type: "REQUEST_NEXT" }
  | { type: "COUNTDOWN_TICK" }
  | { type: "FINISH"; now: number }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRound(queue: SessionWord[], cardIndex: number): RoundState {
  return {
    phase: "idle_claim",
    cardIndex,
    card: queue[cardIndex],
    p1Claim: null,
    p2Claim: null,
    p1ClaimAt: null,
    p2ClaimAt: null,
    winner: null,
    p1Grade: null,
    p2Grade: null,
    p1RoundPoints: 0,
    p2RoundPoints: 0,
    countdown: null,
  };
}

export function initialDuelState(): DuelState {
  return {
    stage: "lobby",
    config: null,
    queue: [],
    round: null,
    history: [],
    startedAt: null,
    startedAtIso: null,
    finishedAt: null,
  };
}

function cumScores(history: FinalizedRound[]): { p1: number; p2: number } {
  if (history.length === 0) return { p1: 0, p2: 0 };
  const last = history[history.length - 1];
  return { p1: last.p1CumScore, p2: last.p2CumScore };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function duelReducer(state: DuelState, action: DuelAction): DuelState {
  switch (action.type) {
    case "START": {
      if (action.queue.length === 0) return state;
      return {
        stage: "playing",
        config: action.config,
        queue: action.queue,
        round: makeRound(action.queue, 0),
        history: [],
        startedAt: action.now,
        startedAtIso: action.nowIso,
        finishedAt: null,
      };
    }

    case "CLAIM": {
      if (state.stage !== "playing" || !state.round) return state;
      if (state.round.phase !== "idle_claim") return state;

      const round = { ...state.round };
      if (action.player === "p1") {
        round.p1Claim = action.claim;
        round.p1ClaimAt = action.now;
      } else {
        round.p2Claim = action.claim;
        round.p2ClaimAt = action.now;
      }

      // Both claimed? Resolve winner and advance.
      if (round.p1Claim && round.p2Claim && round.p1ClaimAt !== null && round.p2ClaimAt !== null) {
        round.winner = resolveWinner(round.p1Claim, round.p2Claim, round.p1ClaimAt, round.p2ClaimAt);
        round.phase = "await_reveal";
      }

      return { ...state, round };
    }

    case "REVEAL": {
      if (state.stage !== "playing" || !state.round) return state;
      if (state.round.phase !== "await_reveal") return state;
      return { ...state, round: { ...state.round, phase: "reveal" } };
    }

    case "GRADE": {
      if (state.stage !== "playing" || !state.round) return state;
      if (state.round.phase !== "reveal") return state;

      const round = { ...state.round };
      if (action.player === "p1") {
        // P1 uses Z/X/C to self-grade.
        round.p1Grade = action.grade;
      } else {
        // P2 uses B/N/M to self-grade.
        round.p2Grade = action.grade;
      }

      // Both grades in → compute points and move directly to scored (no lockin step).
      if (round.p1Grade && round.p2Grade) {
        const { p1Claim, p2Claim, p1Grade, p2Grade, winner, card } = round;
        if (!p1Claim || !p2Claim) return state;

        // Each player's score uses their own self-grade.
        const p1Points = scoreRound(p1Claim, p1Grade, winner === "p1");
        const p2Points = scoreRound(p2Claim, p2Grade, winner === "p2");
        round.p1RoundPoints = p1Points;
        round.p2RoundPoints = p2Points;
        round.phase = "scored";

        const prev = cumScores(state.history);
        const final: FinalizedRound = {
          cardIndex: round.cardIndex,
          wordId: card.word_id,
          track: card.track,
          p1Claim,
          p2Claim,
          winner,
          p1Grade,
          p2Grade,
          p1Points,
          p2Points,
          p1CumScore: +(prev.p1 + p1Points).toFixed(1),
          p2CumScore: +(prev.p2 + p2Points).toFixed(1),
        };
        return { ...state, round, history: [...state.history, final] };
      }

      return { ...state, round };
    }

    case "REQUEST_NEXT": {
      if (state.stage !== "playing" || !state.round) return state;
      if (state.round.phase !== "scored") return state;
      return { ...state, round: { ...state.round, phase: "countdown", countdown: 3 } };
    }

    case "COUNTDOWN_TICK": {
      if (state.stage !== "playing" || !state.round) return state;
      if (state.round.phase !== "countdown" || state.round.countdown == null) return state;

      const next = state.round.countdown - 1;
      if (next > 0) {
        return { ...state, round: { ...state.round, countdown: next as 3 | 2 | 1 } };
      }
      // Countdown done — advance to next card or finish.
      const nextIndex = state.round.cardIndex + 1;
      if (nextIndex >= state.queue.length) {
        return { ...state, stage: "finished", round: null, finishedAt: performance.now() };
      }
      return { ...state, round: makeRound(state.queue, nextIndex) };
    }

    case "FINISH": {
      return { ...state, stage: "finished", round: null, finishedAt: action.now };
    }

    case "RESET": {
      return initialDuelState();
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Selectors (pure helpers for the UI)
// ---------------------------------------------------------------------------

export function currentScores(state: DuelState): { p1: number; p2: number } {
  return cumScores(state.history);
}

export function phaseOf(state: DuelState): Phase | "lobby" | "finished" {
  if (state.stage === "lobby") return "lobby";
  if (state.stage === "finished") return "finished";
  return state.round?.phase ?? "idle_claim";
}

"use client";

import { useEffect, useMemo, useState, type Dispatch } from "react";
import { StopCircle, Pencil } from "lucide-react";
import type { DuelState, Claim, Grade, Phase, PlayerId } from "./duelTypes";
import { currentScores, type DuelAction } from "./duelStateMachine";
import { useDuelKeyboard, type PhaseForKeyboard } from "./useDuelKeyboard";
import { roastFor } from "./duelScoring";
import { EvolutionChart } from "./EvolutionChart";
import { EditWordModal } from "@/components/EditWordModal";

interface Props {
  state: DuelState;
  dispatch: Dispatch<DuelAction>;
  onEndSession: () => void;
}

export function LiveDuel({ state, dispatch, onEndSession }: Props) {
  const round = state.round;
  const config = state.config;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  // Session timer.
  useEffect(() => {
    if (state.stage !== "playing" || !state.startedAt) return;
    const start = state.startedAt;
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((performance.now() - start) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [state.stage, state.startedAt]);

  // Keyboard routing keyed on phase — suspended while edit modal is open.
  const keyboardPhase: PhaseForKeyboard = round ? round.phase : "idle";
  useDuelKeyboard(keyboardPhase, dispatch, !isEditing);

  // Countdown timer (driven by the reducer via COUNTDOWN_TICK).
  useEffect(() => {
    if (!round || round.phase !== "countdown") return;
    const id = setTimeout(() => dispatch({ type: "COUNTDOWN_TICK" }), 700);
    return () => clearTimeout(id);
  }, [round?.phase, round?.countdown, dispatch, round]);

  const scores = currentScores(state);
  const p1Roast = useMemo(() => roastFor(scores.p1), [scores.p1]);
  const p2Roast = useMemo(() => roastFor(scores.p2), [scores.p2]);

  if (!round || !config) {
    return null;
  }

  const flipped = round.phase === "reveal" || round.phase === "scored" || round.phase === "countdown";
  const isRec = round.card.track === "rec";
  const promptText = isRec ? round.card.words_dim.greek_text : round.card.words_dim.french_text;
  const translationText = isRec ? round.card.words_dim.french_text : round.card.words_dim.greek_text;

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // Cue line text per phase.
  const cueLine = (() => {
    switch (round.phase) {
      case "idle_claim":
        return null; // Buttons on each side replace the key-hint cue
      case "await_reveal": {
        const winnerName =
          round.winner === "p1" ? config.p1.displayName :
          round.winner === "p2" ? config.p2.displayName : null;
        const claimLabel = (c: "know" | "meh" | "forgot") =>
          c === "know" ? "I Know" : c === "meh" ? "Meh" : "Don't Know";
        if (winnerName) {
          const winnerClaim = round.winner === "p1" ? round.p1Claim! : round.p2Claim!;
          return (
            <span className="text-gray-700">
              🏆 <strong>{winnerName}</strong> typed first with <strong>{claimLabel(winnerClaim)}</strong> — {winnerName} speaks.
              Press any key to reveal.
            </span>
          );
        }
        const claim = round.p1Claim!;
        return (
          <span className="text-gray-700">
            Both picked <strong>{claimLabel(claim)}</strong> — no speaker. Press any key to reveal.
          </span>
        );
      }
      case "reveal":
        return null; // Grade buttons on each side replace the cue
      case "scored":
        return (
          <span className="text-gray-700">
            <strong className="text-blue-600">{config.p1.displayName}</strong> {fmtPoints(round.p1RoundPoints)}
            {"   ·   "}
            <strong className="text-purple-600">{config.p2.displayName}</strong> {fmtPoints(round.p2RoundPoints)}
            {"   — press any key for next card"}
          </span>
        );
      case "countdown":
        return null;
      default:
        return null;
    }
  })();

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
      {/* Edit modal — rendered over the duel UI, suspends keyboard shortcuts */}
      {isEditing && (
        <EditWordModal
          isOpen={isEditing}
          word={round.card.words_dim}
          onClose={() => setIsEditing(false)}
          onSuccess={() => setIsEditing(false)}
        />
      )}

      {/* Top bar */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-4 mt-2">
        {/* P1 score panel */}
        <div className="flex flex-col items-start min-w-[10rem]">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span>{config.p1.flag}</span>
            <span className="text-blue-700">{config.p1.displayName}</span>
          </div>
          <div className="text-3xl font-extrabold text-blue-700 font-mono">{scores.p1.toFixed(1)}</div>
          {p1Roast && <p className="text-xs italic text-red-500 mt-1 max-w-[14rem]" aria-live="polite">{p1Roast}</p>}
        </div>

        {/* Center stats */}
        <div className="flex items-center gap-4 bg-white px-5 py-2 rounded-full border border-gray-200 shadow-sm font-semibold text-gray-700">
          <span className="font-mono">{fmtTime(elapsedSeconds)}</span>
          <div className="w-px h-4 bg-gray-300" />
          <span>Card {round.cardIndex + 1} / {state.queue.length}</span>
          <div className="w-px h-4 bg-gray-300" />
          <button
            onClick={onEndSession}
            className="flex items-center gap-1 text-red-500 hover:text-red-700 text-sm"
          >
            <StopCircle className="w-4 h-4" />
            End
          </button>
        </div>

        {/* P2 score panel */}
        <div className="flex flex-col items-end min-w-[10rem]">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="text-purple-700">{config.p2.displayName}</span>
            <span>{config.p2.flag}</span>
          </div>
          <div className="text-3xl font-extrabold text-purple-700 font-mono">{scores.p2.toFixed(1)}</div>
          {p2Roast && <p className="text-xs italic text-red-500 mt-1 max-w-[14rem] text-right" aria-live="polite">{p2Roast}</p>}
        </div>
      </div>

      {/* Main playing zone */}
      <div className="w-full max-w-5xl grid grid-cols-[1fr_minmax(320px,460px)_1fr] items-center gap-4">
        {/* Left: P1 action panel */}
        <PlayerActionPanel
          player="p1"
          phase={round.phase}
          claim={round.p1Claim}
          grade={round.p1Grade}
          dispatch={dispatch}
          color="blue"
        />

        {/* Center: flashcard — no flip animation, instant switch */}
        <div className="w-full aspect-[4/3]">
          {!flipped ? (
            <div className="w-full h-full bg-white rounded-3xl shadow-lg border border-gray-100 flex flex-col items-center justify-center p-8 text-center relative">
              <div className="absolute top-6 left-6">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  Theme: {round.card.words_dim.theme || "None"}
                </span>
              </div>
              <div className="absolute top-6 right-6 flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${isRec ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                  {isRec ? "Recognition" : "Production"}
                </span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-full text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition"
                  title="Edit this word"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <h2 className={`font-medium text-gray-900 mb-4 ${isRec ? "text-5xl sm:text-6xl font-serif" : "text-4xl sm:text-5xl"}`}>
                {promptText}
              </h2>
              <p className="text-gray-400 font-medium">{round.card.words_dim.part_of_speech}</p>
            </div>
          ) : (
            <div className="w-full h-full bg-gray-900 rounded-3xl shadow-xl flex flex-col items-center justify-center p-8 text-center relative">
              <div className="absolute top-6 right-6">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-full text-gray-600 hover:text-white hover:bg-gray-700 transition"
                  title="Edit this word"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Guard answer content on flipped so the back→front transition
                  never paints stale answer text from the previous card. */}
              {flipped && (
                <>
                  <p className="text-gray-400 text-lg mb-4">{promptText}</p>
                  <h2 className={`font-medium text-white ${!isRec ? "text-5xl sm:text-6xl font-serif" : "text-4xl sm:text-5xl"}`}>
                    {translationText}
                  </h2>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: P2 action panel */}
        <PlayerActionPanel
          player="p2"
          phase={round.phase}
          claim={round.p2Claim}
          grade={round.p2Grade}
          dispatch={dispatch}
          color="purple"
        />
      </div>

      {/* Evolution chart HUD — below the card */}
      <div className="w-full max-w-5xl mt-4">
        <EvolutionChart
          history={state.history}
          totalCards={state.queue.length}
          p1Name={config.p1.displayName}
          p2Name={config.p2.displayName}
          size="hud"
        />
      </div>

      {/* Cue line */}
      <div className="mt-4 min-h-[3rem] flex items-center justify-center text-center px-4">
        {round.phase === "countdown" ? (
          <div className="text-6xl font-extrabold text-gray-800 font-mono">
            {round.countdown ?? "→"}
          </div>
        ) : cueLine}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// PlayerActionPanel — claim buttons (idle_claim / await_reveal) or grade
// buttons (reveal) for one player. Also clickable.
// ---------------------------------------------------------------------------

const CLAIM_OPTIONS: Array<{ claim: Claim; label: string }> = [
  { claim: "know",   label: "I Know!" },
  { claim: "meh",    label: "Not Sure" },
  { claim: "forgot", label: "No Idea" },
];

const GRADE_OPTIONS: Array<{ grade: Grade; label: string }> = [
  { grade: "right", label: "Right ✓" },
  { grade: "meh",   label: "Meh ~" },
  { grade: "wrong", label: "Wrong ✗" },
];

function PlayerActionPanel({
  player, phase, claim, grade, dispatch, color,
}: {
  player: PlayerId;
  phase: Phase;
  claim: Claim | null;
  grade: Grade | null;
  dispatch: Dispatch<DuelAction>;
  color: "blue" | "purple";
}) {
  const keys = player === "p1" ? ["Z", "X", "C"] : ["B", "N", "M"];
  const isClaimPhase = phase === "idle_claim" || phase === "await_reveal";
  const isGradePhase = phase === "reveal";
  const isActive = isClaimPhase || isGradePhase;

  const activeRing = color === "blue"
    ? "bg-blue-100 border-blue-400 text-blue-700"
    : "bg-purple-100 border-purple-400 text-purple-700";
  const idleAvailable = "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer";
  const idleDisabled = "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed";

  if (isGradePhase) {
    return (
      <div className="flex flex-col gap-2 justify-self-center w-full max-w-[10rem]">
        {GRADE_OPTIONS.map(({ grade: g, label }, i) => (
          <button
            key={g}
            onClick={() => dispatch({ type: "GRADE", player, grade: g })}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
              grade === g ? activeRing : idleAvailable
            }`}
          >
            <span>{label}</span>
            <kbd className="ml-2 text-xs font-mono opacity-75">{keys[i]}</kbd>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 justify-self-center w-full max-w-[10rem]">
      {CLAIM_OPTIONS.map(({ claim: c, label }, i) => (
        <button
          key={c}
          onClick={isClaimPhase ? () => dispatch({ type: "CLAIM", player, claim: c, now: performance.now() }) : undefined}
          disabled={!isClaimPhase}
          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
            claim === c ? activeRing : isActive ? idleAvailable : idleDisabled
          }`}
        >
          <span>{label}</span>
          <kbd className="ml-2 text-xs font-mono opacity-75">{keys[i]}</kbd>
        </button>
      ))}
    </div>
  );
}

function fmtPoints(p: number): string {
  const sign = p >= 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}`;
}

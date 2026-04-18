"use client";

import { useEffect, useMemo, useState, type Dispatch } from "react";
import { motion } from "framer-motion";
import { StopCircle } from "lucide-react";
import type { DuelState } from "./duelTypes";
import { currentScores, type DuelAction } from "./duelStateMachine";
import { useDuelKeyboard, type PhaseForKeyboard } from "./useDuelKeyboard";
import { roastFor } from "./duelScoring";
import { EvolutionChart } from "./EvolutionChart";

interface Props {
  state: DuelState;
  dispatch: Dispatch<DuelAction>;
  onEndSession: () => void;
}

export function LiveDuel({ state, dispatch, onEndSession }: Props) {
  const round = state.round;
  const config = state.config;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Session timer.
  useEffect(() => {
    if (state.stage !== "playing" || !state.startedAt) return;
    const start = state.startedAt;
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((performance.now() - start) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [state.stage, state.startedAt]);

  // Keyboard routing keyed on phase.
  const keyboardPhase: PhaseForKeyboard = round ? round.phase : "idle";
  useDuelKeyboard(keyboardPhase, dispatch);

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

  const flipped = round.phase === "reveal" || round.phase === "await_lockin" || round.phase === "scored" || round.phase === "countdown";
  const isRec = round.card.track === "rec";
  const promptText = isRec ? round.card.words_dim.greek_text : round.card.words_dim.french_text;
  const translationText = isRec ? round.card.words_dim.french_text : round.card.words_dim.greek_text;

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // Cue line text per phase.
  const cueLine = (() => {
    switch (round.phase) {
      case "idle_claim":
        return (
          <span className="text-gray-500">
            P1: <kbd className="font-mono font-bold">Z</kbd>/<kbd className="font-mono font-bold">X</kbd>/<kbd className="font-mono font-bold">C</kbd>
            {"  —  "}
            P2: <kbd className="font-mono font-bold">B</kbd>/<kbd className="font-mono font-bold">N</kbd>/<kbd className="font-mono font-bold">M</kbd>
          </span>
        );
      case "await_reveal": {
        const winnerName =
          round.winner === "p1" ? config.p1.displayName :
          round.winner === "p2" ? config.p2.displayName : null;
        const claimLabel = (c: "know" | "meh" | "forgot") => (c === "know" ? "I Know" : c === "meh" ? "Meh" : "Don't Know");
        if (winnerName) {
          const winnerClaim = round.winner === "p1" ? round.p1Claim! : round.p2Claim!;
          return (
            <span className="text-gray-700">
              🏆 <strong>{winnerName}</strong> typed first with <strong>{claimLabel(winnerClaim)}</strong> — {winnerName} speaks.
              Press any key to reveal.
            </span>
          );
        }
        const claim = round.p1Claim!; // both claims are equal here
        return (
          <span className="text-gray-700">
            Both picked <strong>{claimLabel(claim)}</strong> — no speaker. Press any key to reveal.
          </span>
        );
      }
      case "reveal":
        return (
          <span className="text-gray-700">
            P1 grade P2: <kbd className="font-mono font-bold">Z</kbd>/<kbd className="font-mono font-bold">X</kbd>/<kbd className="font-mono font-bold">C</kbd>
            {"  ·  "}
            P2 grade P1: <kbd className="font-mono font-bold">B</kbd>/<kbd className="font-mono font-bold">N</kbd>/<kbd className="font-mono font-bold">M</kbd>
          </span>
        );
      case "await_lockin":
        return (
          <span className="text-gray-700 flex items-center gap-4 justify-center">
            <span className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full ${round.p1ConfirmedLockin ? "bg-green-500" : "bg-gray-300"}`} />
              P1 press <kbd className="font-mono font-bold">Q</kbd>
            </span>
            <span className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full ${round.p2ConfirmedLockin ? "bg-green-500" : "bg-gray-300"}`} />
              P2 press <kbd className="font-mono font-bold">P</kbd>
            </span>
          </span>
        );
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
        return null; // replaced by big countdown number
      default:
        return null;
    }
  })();

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
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
      <div className="w-full max-w-5xl grid grid-cols-[1fr_minmax(360px,520px)_1fr] items-center gap-6">
        {/* Left: chart HUD */}
        <div className="justify-self-center">
          <EvolutionChart
            history={state.history}
            totalCards={state.queue.length}
            p1Name={config.p1.displayName}
            p2Name={config.p2.displayName}
            size="hud"
          />
        </div>

        {/* Center: flashcard */}
        <div className="w-full aspect-[4/3] perspective-1000">
          <motion.div
            className="w-full h-full relative preserve-3d"
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            {/* Front */}
            <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-lg border border-gray-100 flex flex-col items-center justify-center p-8 text-center">
              <div className="absolute top-6 left-6">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  Theme: {round.card.words_dim.theme || "None"}
                </span>
              </div>
              <div className="absolute top-6 right-6">
                <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${isRec ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                  {isRec ? "Recognition" : "Production"}
                </span>
              </div>
              <h2 className={`font-medium text-gray-900 mb-4 ${isRec ? "text-5xl sm:text-6xl font-serif" : "text-4xl sm:text-5xl"}`}>
                {promptText}
              </h2>
              <p className="text-gray-400 font-medium">{round.card.words_dim.part_of_speech}</p>
            </div>

            {/* Back */}
            <div
              className="absolute w-full h-full backface-hidden bg-gray-900 rounded-3xl shadow-xl flex flex-col items-center justify-center p-8 text-center"
              style={{ transform: "rotateY(180deg)" }}
            >
              <p className="text-gray-400 text-lg mb-4">{promptText}</p>
              <h2 className={`font-medium text-white ${!isRec ? "text-5xl sm:text-6xl font-serif" : "text-4xl sm:text-5xl"}`}>
                {translationText}
              </h2>
            </div>
          </motion.div>
        </div>

        {/* Right: player claim indicators */}
        <div className="justify-self-center flex flex-col items-center gap-4">
          <ClaimIndicator label={`${config.p1.flag} ${config.p1.displayName}`} claim={round.p1Claim} color="blue" />
          <ClaimIndicator label={`${config.p2.flag} ${config.p2.displayName}`} claim={round.p2Claim} color="purple" />
        </div>
      </div>

      {/* Cue line */}
      <div className="mt-6 min-h-[3rem] flex items-center justify-center text-center px-4">
        {round.phase === "countdown" ? (
          <div className="text-6xl font-extrabold text-gray-800 font-mono">
            {round.countdown ?? "→"}
          </div>
        ) : cueLine}
      </div>
    </main>
  );
}

function ClaimIndicator({ label, claim, color }: { label: string; claim: "know" | "meh" | "forgot" | null; color: "blue" | "purple" }) {
  const text = claim === "know" ? "I Know" : claim === "meh" ? "Meh" : claim === "forgot" ? "Don't Know" : "—";
  const bg = claim == null
    ? "bg-gray-100 text-gray-400"
    : color === "blue" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className={`px-3 py-1 rounded-full text-sm font-bold ${bg}`}>{text}</span>
    </div>
  );
}

function fmtPoints(p: number): string {
  const sign = p >= 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}`;
}

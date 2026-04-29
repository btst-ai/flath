"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy, RotateCw, Home } from "lucide-react";
import type { DuelState } from "./duelTypes";
import { currentScores } from "./duelStateMachine";
import { EvolutionChart } from "./EvolutionChart";
import { finishDuel, type DuelAttempt } from "@/app/actions/duel";

interface Props {
  state: DuelState;
  onRematch: () => void;
  onHome: () => void;
}

export function DuelVictory({ state, onRematch, onHome }: Props) {
  const [saving, setSaving] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { p1, p2 } = currentScores(state);
  const winner: "p1" | "p2" | "tie" = p1 > p2 ? "p1" : p2 > p1 ? "p2" : "tie";
  const config = state.config;

  const durationMs = state.finishedAt && state.startedAt
    ? Math.round(state.finishedAt - state.startedAt)
    : 0;

  const fmtTime = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60).toString().padStart(2, "0");
    const s = (total % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Play winner's national anthem on mount.
  // Pre-req: drop fr_anthem.mp3 and gr_anthem.mp3 into flath-app/public/.
  useEffect(() => {
    if (!config) return;
    const flagToAnthem: Record<string, string> = {
      "🇫🇷": "/fr_anthem.mp3",
      "🇬🇷": "/gr_anthem.mp3",
    };
    const winnerFlag =
      winner === "p1" ? config.p1.flag :
      winner === "p2" ? config.p2.flag : null;
    const src = winnerFlag ? (flagToAnthem[winnerFlag] ?? null) : null;
    if (src) {
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.play().catch(() => {}); // ignore autoplay policy errors silently
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!config) {
        setSaving(false);
        return;
      }
      const attemptsP1: DuelAttempt[] = state.history.map(r => ({
        word_id: r.wordId,
        mode: r.track,
        outcome: r.p1Claim,
      }));
      const attemptsP2: DuelAttempt[] | null = config.p2.isGuest
        ? null
        : state.history.map(r => ({
            word_id: r.wordId,
            mode: r.track,
            outcome: r.p2Claim,
          }));

      const tsStarted = state.startedAtIso ?? new Date().toISOString();

      const res = await finishDuel({
        p1UserId: config.p1.userId!,
        p2UserId: config.p2.userId,
        p1DisplayName: config.p1.displayName,
        p2DisplayName: config.p2.displayName,
        p1Flag: config.p1.flag,
        p2Flag: config.p2.flag,
        packId: config.packId,
        dataSource: config.dataSource,
        cardMode: config.cardMode,
        p1FinalScore: +p1.toFixed(1),
        p2FinalScore: +p2.toFixed(1),
        winner,
        totalCards: state.history.length,
        durationMs,
        tsStarted,
      }, attemptsP1, attemptsP2);

      if (cancelled) return;
      if ("error" in res && res.error) {
        setSaveError(res.error);
      }
      setSaving(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!config) return null;

  const winnerName =
    winner === "tie" ? "Tie!" :
    winner === "p1" ? `${config.p1.flag} ${config.p1.displayName} wins!` :
                      `${config.p2.flag} ${config.p2.displayName} wins!`;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-sm border border-gray-200 p-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900">{winnerName}</h1>
          <p className="text-gray-500 mt-2">
            {state.history.length} cards · {fmtTime(durationMs)} elapsed
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className={`p-6 rounded-2xl border text-center ${winner === "p1" ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200"}`}>
            <p className="text-sm font-semibold text-blue-700">{config.p1.flag} {config.p1.displayName}</p>
            <p className="text-4xl font-extrabold text-blue-700 font-mono mt-2">{p1.toFixed(1)}</p>
          </div>
          <div className={`p-6 rounded-2xl border text-center ${winner === "p2" ? "bg-purple-50 border-purple-300" : "bg-gray-50 border-gray-200"}`}>
            <p className="text-sm font-semibold text-purple-700">{config.p2.flag} {config.p2.displayName}</p>
            <p className="text-4xl font-extrabold text-purple-700 font-mono mt-2">{p2.toFixed(1)}</p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Score evolution</h3>
          <EvolutionChart
            history={state.history}
            totalCards={state.history.length}
            p1Name={config.p1.displayName}
            p2Name={config.p2.displayName}
            size="full"
          />
        </div>

        {saving && (
          <div className="text-sm text-blue-500 mb-4 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Saving duel…
          </div>
        )}
        {saveError && (
          <p className="text-sm text-red-600 mb-4">Save failed: {saveError}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onHome}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-800 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={onRematch}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition shadow"
          >
            <RotateCw className="w-4 h-4" />
            Rematch
          </button>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DuelLobby } from "./DuelLobby";
import { LiveDuel } from "./LiveDuel";
import { DuelVictory } from "./DuelVictory";
import { duelReducer, initialDuelState } from "./duelStateMachine";
import type { DuelConfig } from "./duelTypes";
import type { SessionWord } from "@/lib/sessionQueue";

export default function DuelPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [state, dispatch] = useReducer(duelReducer, initialDuelState());
  const [lastConfig, setLastConfig] = useState<DuelConfig | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      setAuthChecking(false);
    });
  }, [router]);

  const handleStart = (config: DuelConfig, queue: SessionWord[]) => {
    setLastConfig(config);
    dispatch({
      type: "START",
      config,
      queue,
      now: performance.now(),
      nowIso: new Date().toISOString(),
    });
  };

  const handleEndSession = () => {
    dispatch({ type: "FINISH", now: performance.now() });
  };

  const handleRematch = () => {
    dispatch({ type: "RESET" });
  };

  if (authChecking || !userId) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (state.stage === "lobby") {
    return (
      <DuelLobby
        p1UserId={userId}
        initialConfig={lastConfig}
        onStart={handleStart}
        onCancel={() => router.push("/")}
      />
    );
  }

  if (state.stage === "playing") {
    return (
      <LiveDuel
        state={state}
        dispatch={dispatch}
        onEndSession={handleEndSession}
      />
    );
  }

  // finished
  return (
    <DuelVictory
      state={state}
      onRematch={handleRematch}
      onHome={() => router.push("/")}
    />
  );
}

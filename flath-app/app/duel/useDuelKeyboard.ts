"use client";

import { useEffect } from "react";
import type { Dispatch } from "react";
import type { Claim, Grade, PlayerId } from "./duelTypes";
import type { DuelAction } from "./duelStateMachine";

// ---------------------------------------------------------------------------
// Key maps — use `event.code` (layout-independent). ZXC / QWE cluster for P1,
// BNM / P cluster for P2.
// ---------------------------------------------------------------------------

const P1_CLAIM: Record<string, Claim> = {
  KeyZ: "know",
  KeyX: "meh",
  KeyC: "forgot",
};
const P2_CLAIM: Record<string, Claim> = {
  KeyB: "know",
  KeyN: "meh",
  KeyM: "forgot",
};
const P1_GRADE: Record<string, Grade> = {
  KeyZ: "right",
  KeyX: "meh",
  KeyC: "wrong",
};
const P2_GRADE: Record<string, Grade> = {
  KeyB: "right",
  KeyN: "meh",
  KeyM: "wrong",
};
/**
 * Any key press recognized for phase transitions that accept "any key".
 * We intentionally use keydown on the window.
 */
export type PhaseForKeyboard =
  | "idle_claim"
  | "await_reveal"
  | "reveal"
  | "scored"
  | "countdown"
  | "idle"; // off-phase (lobby / finished)

export function useDuelKeyboard(
  phase: PhaseForKeyboard,
  dispatch: Dispatch<DuelAction>,
  enabled = true,
) {
  useEffect(() => {
    if (phase === "idle" || !enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const now = performance.now();
      const code = e.code;

      switch (phase) {
        case "idle_claim": {
          if (code in P1_CLAIM) {
            e.preventDefault();
            dispatch({ type: "CLAIM", player: "p1", claim: P1_CLAIM[code], now });
            return;
          }
          if (code in P2_CLAIM) {
            e.preventDefault();
            dispatch({ type: "CLAIM", player: "p2", claim: P2_CLAIM[code], now });
            return;
          }
          return;
        }

        case "await_reveal": {
          e.preventDefault();
          dispatch({ type: "REVEAL" });
          return;
        }

        case "reveal": {
          if (code in P1_GRADE) {
            e.preventDefault();
            dispatch({ type: "GRADE", player: "p1", grade: P1_GRADE[code] });
            return;
          }
          if (code in P2_GRADE) {
            e.preventDefault();
            dispatch({ type: "GRADE", player: "p2", grade: P2_GRADE[code] });
            return;
          }
          return;
        }

        case "scored": {
          e.preventDefault();
          dispatch({ type: "REQUEST_NEXT" });
          return;
        }

        case "countdown":
          // Countdown is driven by a timer, not keyboard.
          return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, dispatch, enabled]);
}

// Re-exported so the UI can describe the expected keys without duplicating them.
export const DUEL_KEYS = {
  p1: ["Z", "X", "C"],
  p2: ["B", "N", "M"],
};

export function _playerFromCode(code: string): PlayerId | null {
  if (code === "KeyZ" || code === "KeyX" || code === "KeyC") return "p1";
  if (code === "KeyB" || code === "KeyN" || code === "KeyM") return "p2";
  return null;
}

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
const P1_LOCKIN = "KeyQ";
const P2_LOCKIN = "KeyP";

/**
 * Any key press recognized for phase transitions that accept "any key".
 * We intentionally use keydown on the window.
 */
export type PhaseForKeyboard =
  | "idle_claim"
  | "await_reveal"
  | "reveal"
  | "await_lockin"
  | "scored"
  | "countdown"
  | "idle"; // off-phase (lobby / finished)

export function useDuelKeyboard(
  phase: PhaseForKeyboard,
  dispatch: Dispatch<DuelAction>,
) {
  useEffect(() => {
    if (phase === "idle") return;

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

        case "await_lockin": {
          if (code === P1_LOCKIN) {
            e.preventDefault();
            dispatch({ type: "LOCKIN", player: "p1" });
            return;
          }
          if (code === P2_LOCKIN) {
            e.preventDefault();
            dispatch({ type: "LOCKIN", player: "p2" });
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
  }, [phase, dispatch]);
}

// Re-exported so the UI can describe the expected keys without duplicating them.
export const DUEL_KEYS = {
  p1Claim: { know: "Z", meh: "X", forgot: "C" },
  p2Claim: { know: "B", meh: "N", forgot: "M" },
  p1Grade: { right: "Z", meh: "X", wrong: "C" },
  p2Grade: { right: "B", meh: "N", wrong: "M" },
  p1Lockin: "Q",
  p2Lockin: "P",
};

export function _playerFromCode(code: string): PlayerId | null {
  if (code === "KeyZ" || code === "KeyX" || code === "KeyC" || code === "KeyQ") return "p1";
  if (code === "KeyB" || code === "KeyN" || code === "KeyM" || code === "KeyP") return "p2";
  return null;
}

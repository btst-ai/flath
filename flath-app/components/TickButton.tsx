"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

type Phase = "idle" | "pending" | "done";

interface TickButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onAction: () => Promise<boolean>;
  onDone?: () => void;
  tickMs?: number;
  doneClassName?: string;
  spinnerClassName?: string;
}

export function TickButton({
  onAction,
  onDone,
  tickMs = 800,
  doneClassName = "",
  spinnerClassName = "",
  children,
  className = "",
  disabled,
  ...rest
}: TickButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handle = async () => {
    if (phase !== "idle") return;
    setPhase("pending");
    const ok = await onAction();
    if (!ok) {
      setPhase("idle");
      return;
    }
    setPhase("done");
    timerRef.current = setTimeout(() => {
      setPhase("idle");
      onDone?.();
    }, tickMs);
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled || phase !== "idle"}
      className={phase === "done" ? `${className} ${doneClassName}`.trim() : className}
      {...rest}
    >
      {phase === "pending" ? (
        <div
          className={
            spinnerClassName ||
            "w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          }
        />
      ) : phase === "done" ? (
        <Check className="w-4 h-4 text-green-600" />
      ) : (
        children
      )}
    </button>
  );
}

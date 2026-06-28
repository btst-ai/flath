"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getVisibleFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.closest("[hidden]") && el.offsetParent !== null,
  );
}

/**
 * Traps keyboard focus inside `containerRef` while `isOpen` is true.
 * On open: stores the previously-focused element and focuses the first
 * focusable element in the container.
 * On close / unmount: restores focus to the stored element.
 *
 * Guard: does nothing during SSR or when containerRef is null.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
): void {
  // Store the element that was focused before the dialog opened so we can
  // restore it when the dialog closes.
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // SSR guard
    if (typeof document === "undefined") return;
    if (!isOpen) {
      // Restore focus to the element that triggered the dialog.
      if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Capture currently-focused element before moving focus into dialog.
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Focus the first focusable element in the container.
    const focusable = getVisibleFocusable(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      // Fallback: make the container itself focusable and focus it.
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableNow = getVisibleFocusable(container);
      if (focusableNow.length === 0) return;

      const first = focusableNow[0];
      const last = focusableNow[focusableNow.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, containerRef]);

  // Restore focus on unmount too — covers a parent unmounting the consumer
  // while it is still open (the isOpen-driven effect above only restores when
  // isOpen transitions to false).
  useEffect(() => {
    return () => {
      if (
        typeof document !== "undefined" &&
        previousFocusRef.current &&
        document.body.contains(previousFocusRef.current)
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, []);
}

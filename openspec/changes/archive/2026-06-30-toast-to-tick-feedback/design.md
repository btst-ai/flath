## Context

The app uses Sonner (`toast.success(...)`) for all action confirmations. Success toasts appear top-right, interrupt focus on high-frequency actions, and feel disconnected from the button that triggered them. The button itself is a better feedback surface.

Error toasts stay — they need to be noticeable and are infrequent.

## Goals / Non-Goals

**Goals:**
- Replace every in-scope success toast with an inline green tick on the triggering button.
- Provide a single reusable `TickButton` component so each call site changes minimally.
- Swap the `← Back` text link on `/progress` for the standard Dashboard button.
- Keep error toasts, the Toaster mount, and all error-handling logic untouched.

**Non-Goals:**
- Removing the Toaster from layout (error toasts still need it).
- Changing any data/RPC logic — this is purely a feedback-layer change.
- Handling the `progress-ui-polish` thumb buttons (separate in-progress change).

## Decisions

**D1: `TickButton` as a wrapper component (not a hook)**
Options: (a) hook `useTickFeedback` that callers compose into any button; (b) `TickButton` component that owns its own `<button>` element.
Chosen: (b). Most call sites are simple buttons with no custom inner structure; a component reduces duplication more than a hook. The few icon-only buttons (vault mistake, drawer mistake) pass an icon as `children`, which works fine. For buttons that need unusual wrappers, callers can still use a local 3-state variable.

**D2: `onAction` returns `boolean` (not throws)**
Error paths already call `toast.error(...)` in the existing handlers. The cleanest migration: keep error handling in the handler, change the return type to `boolean` (true = success, false = error already handled). `TickButton` never knows about toasts.

**D3: `onDone` callback for modal close timing**
For modals, the tick must be visible before `onClose()` is called. `TickButton` accepts `onDone?: () => void`, fired after the 800ms tick window. Callers move `onSuccess(); onClose();` into `onDone`. The modal stays mounted while the tick shows, then closes.

**D4: 800ms tick duration**
Long enough to register visually; short enough to feel snappy. Hardcoded default, overridable via `tickMs` prop for edge cases.

**D5: Batch delete goes silent**
On batch delete, the selected rows disappear — there is no button left on screen to flip. The row removal is itself the confirmation. The success toast is simply removed with no replacement.

## Risks / Trade-offs

- [Risk] Icon-only buttons (mistake, archive) are small; the tick icon may feel cramped. → Mitigation: use `Check` from lucide-react at `w-4 h-4`, same size as the replaced icons. Identical sizing already used in the codebase.
- [Risk] Modal close delay (+800ms) could feel sluggish. → Mitigation: 800ms is the lower bound; modals close during the tick animation so the perceived delay is the animation itself, not dead time.
- [Risk] `TickButton` used inside a modal that unmounts during the tick could cause a "setState on unmounted component" warning. → Mitigation: clear the timer in a cleanup function in `useEffect`.

## Migration Plan

1. Create `TickButton` component.
2. Swap progress page header button (zero risk, standalone).
3. Per capability: remove `toast.success`, refactor handler to return boolean, wire button to `TickButton`. Capabilities are independent — can be done in any order.
4. No rollback needed; each change is isolated to its call site.

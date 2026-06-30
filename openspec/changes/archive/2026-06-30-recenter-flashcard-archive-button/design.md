## Context

The revealed flashcard back face is an absolutely-positioned `div` with `p-6 md:p-8`. The interest-buttons row inside it is also absolutely positioned (`absolute bottom-8 w-full px-8`). Because an absolutely-positioned child's `w-full` resolves to the parent's width (excluding the parent's padding), the row spans the full card width and its own `px-8` (32px) handles the visual inset from the card edge. At the desktop breakpoint this coincidentally matches the card's `md:p-8` (32px). At mobile, however, the card is `p-6` (24px) while the row is `px-8` (32px), producing a visible asymmetry: the archive button sits closer to the right edge than the favourite button to the left edge.

## Goals / Non-Goals

**Goals:**
- Make the favourite (left) and archive (right) buttons equidistant from their respective card edges at all breakpoints.

**Non-Goals:**
- Changing vertical positioning (`bottom-8`) — vertical spacing is already symmetric and correct.
- Touching any other element or behaviour in the practice flow.

## Decisions

**Use `px-6 md:px-8` on the buttons row container.**

This mirrors the card container's own `p-6 md:p-8` exactly, so at every breakpoint the row's horizontal inset matches the card's content-box inset. The buttons land at the same horizontal position as all other card content (theme badge, difficulty pill, copy/edit buttons), which is the visually correct alignment.

Alternative considered: switch the card container from `p-6 md:p-8` to a uniform `p-8`. Rejected — that enlarges the card's top/bottom padding on mobile unnecessarily and the card layout already fits `p-6`.

## Risks / Trade-offs

[None] This is a single Tailwind utility change on one element. No logic, no API surface, no data model. Rollback is reverting the class.

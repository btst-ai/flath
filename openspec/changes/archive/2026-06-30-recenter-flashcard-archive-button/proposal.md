## Why

On the revealed flashcard, the archive button (right edge) has less visual breathing room from the card edge than the favourite button (left edge). The bottom-row buttons container uses `px-8` (32px) but the card container uses `p-6 md:p-8` (24px mobile / 32px desktop), so at mobile breakpoints the row overhangs the card's padding box and `justify-between` seats the archive button closer to the edge than the favourite button.

## What Changes

- Change the bottom-row buttons container's horizontal padding from a flat `px-8` to `px-6 md:px-8`, matching the card container's responsive `p-6 md:p-8`.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `practice-session`: Add a scenario asserting symmetric horizontal inset of the revealed-card action row at the mobile breakpoint.

## Impact

- `flath-app/app/practice/page.tsx` — single Tailwind class change on the interest-buttons row container.
- No API, database, or logic changes.

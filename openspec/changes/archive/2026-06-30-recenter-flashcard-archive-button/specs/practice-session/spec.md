## ADDED Requirements

### Requirement: Revealed-card action row has symmetric horizontal inset
The interest-buttons row on the revealed (back) flashcard SHALL use horizontal padding equal to the card container's own padding (`px-6 md:px-8`), so the favourite button's left inset equals the archive button's right inset at all breakpoints.

#### Scenario: Mobile breakpoint — symmetric inset
- **WHEN** a practice card is revealed on a viewport narrower than 768px
- **THEN** the favourite button's left gap to the card edge equals the archive button's right gap to the card edge

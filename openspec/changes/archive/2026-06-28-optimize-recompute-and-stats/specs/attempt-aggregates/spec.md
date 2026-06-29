## ADDED Requirements

### Requirement: Aggregate recompute is batched
The system SHALL recompute per-word aggregates using a bounded, small number of database round-trips that does not grow per word. Recomputing aggregates for N words MUST NOT issue O(N) sequential queries; it SHALL read attempt history and existing settings in batched queries and persist results in a single batched write.

#### Scenario: Recomputing many words at once

- **WHEN** `recomputeUserWordSettings` is called with 25 word ids
- **THEN** it issues a small constant number of queries (a batched history read, a batched settings read, and a batched upsert) rather than ~75 sequential round-trips
- **AND** the computed aggregates (success rates, interest score, review count, last_correct_at, last_mistake_at) are identical to the per-word computation

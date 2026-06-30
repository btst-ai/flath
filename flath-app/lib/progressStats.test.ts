import { describe, it, expect } from "vitest";
import {
  computeStreak,
  weightedBlendSuccess,
  weightedAverage,
  weightedSample,
  buildStrugglingPool,
  buildForgettingPool,
  bucketByDay,
  type UserWordSetting,
} from "./progressStats";

// Seeded PRNG for deterministic tests (mulberry32).
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeWord(overrides: Partial<UserWordSetting> = {}): UserWordSetting {
  return {
    word_id: "w1",
    greek_text: "λέξη",
    theme: "food",
    is_archived: false,
    avg_success_rate_prod: 50,
    avg_success_rate_rec: 50,
    review_count: 5,
    last_reviewed: null,
    last_mistake_at: null,
    ...overrides,
  };
}

// ── computeStreak ────────────────────────────────────────────────────────────

describe("computeStreak", () => {
  it("returns 0 for empty history", () => {
    expect(computeStreak([], "2026-01-10")).toEqual({ streak: 0, missed: 0, studiedToday: false });
  });

  it("counts consecutive days including today", () => {
    const dates = ["2026-01-08", "2026-01-09", "2026-01-10"];
    const result = computeStreak(dates, "2026-01-10");
    expect(result.streak).toBe(3);
    expect(result.missed).toBe(0);
    expect(result.studiedToday).toBe(true);
  });

  it("today pending: streak intact, studiedToday false", () => {
    const dates = ["2026-01-08", "2026-01-09"];
    const result = computeStreak(dates, "2026-01-10");
    expect(result.streak).toBe(2);
    expect(result.studiedToday).toBe(false);
    expect(result.missed).toBe(0);
  });

  it("single gap mid-run: streak continues, missed increments", () => {
    // Gap on 2026-01-08
    const dates = ["2026-01-06", "2026-01-07", "2026-01-09", "2026-01-10"];
    const result = computeStreak(dates, "2026-01-10");
    expect(result.streak).toBe(4);
    expect(result.missed).toBe(1);
    expect(result.studiedToday).toBe(true);
  });

  it("two consecutive missed days reset streak to post-gap run", () => {
    // Gap on 2026-01-06 and 2026-01-07 — streak resets
    const dates = ["2026-01-01", "2026-01-02", "2026-01-08", "2026-01-09", "2026-01-10"];
    const result = computeStreak(dates, "2026-01-10");
    expect(result.streak).toBe(3); // only Jan 8-10
    expect(result.missed).toBe(0);
  });

  it("two non-consecutive single gaps accumulate missed=2", () => {
    // Gap on Jan 05 and Jan 08
    const dates = ["2026-01-03", "2026-01-04", "2026-01-06", "2026-01-07", "2026-01-09", "2026-01-10"];
    const result = computeStreak(dates, "2026-01-10");
    expect(result.streak).toBe(6);
    expect(result.missed).toBe(2);
  });

  it("single day today only: streak=1, studiedToday=true", () => {
    const result = computeStreak(["2026-01-10"], "2026-01-10");
    expect(result.streak).toBe(1);
    expect(result.studiedToday).toBe(true);
  });
});

// ── weightedBlendSuccess ─────────────────────────────────────────────────────

describe("weightedBlendSuccess", () => {
  it("blends correctly with known inputs", () => {
    // prod 0.5 × 40 + rec 0.9 × 10 / 50 = (20 + 9) / 50 = 0.58
    expect(weightedBlendSuccess(0.5, 0.9, 40, 10)).toBeCloseTo(0.58, 5);
  });

  it("returns 0 when total count is 0", () => {
    expect(weightedBlendSuccess(0.5, 0.9, 0, 0)).toBe(0);
  });

  it("works with prod-only (recCount=0)", () => {
    expect(weightedBlendSuccess(0.7, 0.0, 10, 0)).toBeCloseTo(0.7, 5);
  });
});

// ── weightedAverage ──────────────────────────────────────────────────────────

describe("weightedAverage", () => {
  it("computes weighted mean correctly", () => {
    const rows = [{ rate: 0.9, count: 10 }, { rate: 0.5, count: 40 }];
    expect(weightedAverage(rows)).toBeCloseTo(0.58, 5);
  });

  it("returns 0 for empty rows", () => {
    expect(weightedAverage([])).toBe(0);
  });

  it("returns 0 when all counts are 0", () => {
    expect(weightedAverage([{ rate: 0.9, count: 0 }])).toBe(0);
  });

  it("a 1-attempt word barely moves a 40-attempt average", () => {
    const base = weightedAverage([{ rate: 0.9, count: 40 }]);
    const withOutlier = weightedAverage([{ rate: 0.9, count: 40 }, { rate: 0.0, count: 1 }]);
    expect(withOutlier).toBeGreaterThan(0.85); // still close to 0.9
    expect(withOutlier).toBeLessThan(base);    // but slightly lower
  });
});

// ── weightedSample ───────────────────────────────────────────────────────────

describe("weightedSample", () => {
  const pool = [
    { item: "a", weight: 0.9 },
    { item: "b", weight: 0.5 },
    { item: "c", weight: 0.1 },
  ];

  it("returns whole pool when pool.length <= k", () => {
    const result = weightedSample(pool, 5, makeRng(1));
    expect(result.sort()).toEqual(["a", "b", "c"]);
  });

  it("returns all items when k equals pool size", () => {
    const result = weightedSample(pool, 3, makeRng(1));
    expect(result.sort()).toEqual(["a", "b", "c"]);
  });

  it("returns empty array for empty pool", () => {
    expect(weightedSample([], 5, makeRng(1))).toEqual([]);
  });

  it("returns k distinct items", () => {
    const result = weightedSample(pool, 2, makeRng(42));
    expect(result.length).toBe(2);
    expect(new Set(result).size).toBe(2);
  });

  it("is deterministic with seeded rng", () => {
    const r1 = weightedSample(pool, 2, makeRng(99));
    const r2 = weightedSample(pool, 2, makeRng(99));
    expect(r1).toEqual(r2);
  });

  it("high-weight item is selected more often than low-weight item over many draws", () => {
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const rng = makeRng(7);
    for (let i = 0; i < 3000; i++) {
      const picked = weightedSample(pool, 1, rng)[0] as string;
      counts[picked]++;
    }
    // 'a' (weight 0.9) should be picked more than 'c' (weight 0.1)
    expect(counts.a).toBeGreaterThan(counts.b);
    expect(counts.b).toBeGreaterThan(counts.c);
  });
});

// ── buildStrugglingPool ──────────────────────────────────────────────────────

describe("buildStrugglingPool", () => {
  it("excludes archived words", () => {
    const words = [makeWord({ word_id: "w1", is_archived: true, review_count: 5 })];
    expect(buildStrugglingPool(words)).toHaveLength(0);
  });

  it("excludes words with review_count < 3", () => {
    const words = [makeWord({ word_id: "w1", review_count: 2 })];
    expect(buildStrugglingPool(words)).toHaveLength(0);
  });

  it("includes words with review_count >= 3 and not archived", () => {
    const words = [makeWord({ word_id: "w1", review_count: 3 })];
    expect(buildStrugglingPool(words)).toHaveLength(1);
  });

  it("weight formula: weight = (1 - blend/100) + 0.1 on 0-100 stored scale", () => {
    // Both rates 50 (0-100 scale), equal counts → blend = 50, weight = (1 - 50/100) + 0.1 = 0.6
    const words = [makeWord({ avg_success_rate_prod: 50, avg_success_rate_rec: 50, review_count: 10 })];
    const pool = buildStrugglingPool(words);
    expect(pool[0].weight).toBeCloseTo(0.6, 5);
  });

  it("weight is 0.1 (minimum) for perfect recall (rates 100/100)", () => {
    const words = [makeWord({ avg_success_rate_prod: 100, avg_success_rate_rec: 100, review_count: 10 })];
    const pool = buildStrugglingPool(words);
    expect(pool[0].weight).toBeCloseTo(0.1, 5);
  });

  it("weight is 1.1 (maximum) for zero recall (rates 0/0)", () => {
    const words = [makeWord({ avg_success_rate_prod: 0, avg_success_rate_rec: 0, review_count: 10 })];
    const pool = buildStrugglingPool(words);
    expect(pool[0].weight).toBeCloseTo(1.1, 5);
  });
});

// ── buildForgettingPool ──────────────────────────────────────────────────────

describe("buildForgettingPool", () => {
  const NOW = new Date("2026-01-20T12:00:00Z").getTime();
  const EIGHT_DAYS_AGO = "2026-01-12T12:00:00Z"; // > 7d ago
  const THREE_DAYS_AGO = "2026-01-17T12:00:00Z"; // within 7d

  it("includes word with both criteria met", () => {
    const words = [makeWord({
      last_mistake_at: EIGHT_DAYS_AGO,
      last_reviewed: EIGHT_DAYS_AGO,
    })];
    expect(buildForgettingPool(words, NOW)).toHaveLength(1);
  });

  it("excludes word reviewed within last 7 days", () => {
    const words = [makeWord({
      last_mistake_at: EIGHT_DAYS_AGO,
      last_reviewed: THREE_DAYS_AGO,
    })];
    expect(buildForgettingPool(words, NOW)).toHaveLength(0);
  });

  it("excludes word whose mistake was within last 7 days", () => {
    const words = [makeWord({
      last_mistake_at: THREE_DAYS_AGO,
      last_reviewed: EIGHT_DAYS_AGO,
    })];
    expect(buildForgettingPool(words, NOW)).toHaveLength(0);
  });

  it("excludes word with no last_mistake_at", () => {
    const words = [makeWord({ last_mistake_at: null, last_reviewed: EIGHT_DAYS_AGO })];
    expect(buildForgettingPool(words, NOW)).toHaveLength(0);
  });
});

// ── bucketByDay ──────────────────────────────────────────────────────────────

describe("bucketByDay", () => {
  const NOW = new Date("2026-01-10T12:00:00").getTime();

  it("produces exactly `days` buckets", () => {
    expect(bucketByDay([], NOW, 30)).toHaveLength(30);
  });

  it("zero-fills days with no attempts", () => {
    const buckets = bucketByDay([], NOW, 7);
    for (const b of buckets) {
      expect(b.cards).toBe(0);
      expect(b.distinct).toBe(0);
      expect(b.known).toBe(0);
    }
  });

  it("counts cards, distinct words, and known correctly", () => {
    const attempts = [
      { ts: "2026-01-10T08:00:00", wordId: "w1", outcome: "know" },
      { ts: "2026-01-10T09:00:00", wordId: "w2", outcome: "forgot" },
      { ts: "2026-01-10T10:00:00", wordId: "w1", outcome: "know" }, // w1 again
    ];
    const buckets = bucketByDay(attempts, NOW, 7);
    const today = buckets.find((b) => b.date === "2026-01-10");
    expect(today?.cards).toBe(3);
    expect(today?.distinct).toBe(2); // w1 and w2
    expect(today?.known).toBe(2);
  });

  it("ignores attempts outside the window", () => {
    const attempts = [
      { ts: "2025-12-01T08:00:00", wordId: "w1", outcome: "know" }, // way outside 7d
    ];
    const buckets = bucketByDay(attempts, NOW, 7);
    const total = buckets.reduce((s, b) => s + b.cards, 0);
    expect(total).toBe(0);
  });
});

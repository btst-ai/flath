// Pure stats helpers for the progress tracker.
// All functions accept plain data and injected `now`/`rng` so they are deterministic in tests.

export interface UserWordSetting {
  word_id: string;
  greek_text: string;
  theme: string | null;
  is_archived: boolean;
  avg_success_rate_prod: number;
  avg_success_rate_rec: number;
  review_count: number;
  last_reviewed: string | null;
  last_mistake_at: string | null;
}

export interface DayBucket {
  date: string;
  cards: number;
  distinct: number;
  known: number;
}

export interface StreakResult {
  streak: number;
  missed: number;
  studiedToday: boolean;
}

export interface WeightedItem<T> {
  item: T;
  weight: number;
}

// Returns a blended success rate weighted by attempt counts.
// Returns 0 if total count is 0.
export function weightedBlendSuccess(
  prodRate: number,
  recRate: number,
  prodCount: number,
  recCount: number
): number {
  const total = prodCount + recCount;
  if (total === 0) return 0;
  return (prodRate * prodCount + recRate * recCount) / total;
}

// Returns review-count-weighted mean of success rates.
// Returns 0 if total count is 0.
export function weightedAverage(rows: Array<{ rate: number; count: number }>): number {
  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  if (totalCount === 0) return 0;
  const totalWeighted = rows.reduce((s, r) => s + r.rate * r.count, 0);
  return totalWeighted / totalCount;
}

// Roulette-wheel sampling without replacement.
// Returns whole pool if pool.length <= k.
export function weightedSample<T>(
  pool: WeightedItem<T>[],
  k: number,
  rng: () => number
): T[] {
  if (pool.length <= k) return pool.map((p) => p.item);

  const remaining = pool.map((p) => ({ ...p }));
  const result: T[] = [];

  for (let i = 0; i < k; i++) {
    const totalWeight = remaining.reduce((s, p) => s + p.weight, 0);
    let pick = rng() * totalWeight;
    let idx = 0;
    for (idx = 0; idx < remaining.length; idx++) {
      pick -= remaining[idx].weight;
      if (pick <= 0) break;
    }
    // Clamp idx in case of floating-point overshoot
    idx = Math.min(idx, remaining.length - 1);
    result.push(remaining[idx].item);
    remaining.splice(idx, 1);
  }

  return result;
}

// Pool for "struggling" list: non-archived words with review_count >= 3.
export function buildStrugglingPool(settings: UserWordSetting[]): WeightedItem<UserWordSetting>[] {
  return settings
    .filter((s) => !s.is_archived && s.review_count >= 3)
    .map((s) => {
      const blend = weightedBlendSuccess(
        s.avg_success_rate_prod,
        s.avg_success_rate_rec,
        s.review_count,
        s.review_count
      );
      return { item: s, weight: (1 - blend) + 0.1 };
    });
}

// Pool for "forgetting" list: last_mistake_at > 7d ago AND last_reviewed > 7d ago.
export function buildForgettingPool(
  settings: UserWordSetting[],
  nowMs: number
): WeightedItem<UserWordSetting>[] {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff = nowMs - sevenDaysMs;

  return settings
    .filter((s) => {
      if (!s.last_mistake_at) return false;
      if (!s.last_reviewed) return false;
      const mistakeMs = new Date(s.last_mistake_at).getTime();
      const reviewedMs = new Date(s.last_reviewed).getTime();
      return mistakeMs < cutoff && reviewedMs < cutoff;
    })
    .map((s) => {
      const blend = weightedBlendSuccess(
        s.avg_success_rate_prod,
        s.avg_success_rate_rec,
        s.review_count,
        s.review_count
      );
      return { item: s, weight: (1 - blend) + 0.1 };
    });
}

// Computes streak from an array of local-timezone date strings (YYYY-MM-DD).
// `nowDate` is today's date string in the same format.
// Rules:
//   - If studied today: today counts as day 1 of the streak, walk back from yesterday.
//   - If not studied today: today is "pending" (not a miss), walk back from yesterday.
//   - A single missed calendar day within the run: streak continues, missed++.
//   - Two consecutive missed days: streak resets (stop walking).
export function computeStreak(dates: string[], nowDate: string): StreakResult {
  if (dates.length === 0) return { streak: 0, missed: 0, studiedToday: false };

  const dateSet = new Set(dates);
  const studiedToday = dateSet.has(nowDate);

  let streak = studiedToday ? 1 : 0;
  let missed = 0;
  let pendingMiss = false;

  const todayDate = new Date(nowDate + "T12:00:00");

  // Walk back starting from yesterday (always skip today — handled above).
  for (let i = 1; i < 366; i++) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() - i);
    const dayStr = toDateString(d);

    if (dateSet.has(dayStr)) {
      if (pendingMiss) {
        missed++;
        pendingMiss = false;
      }
      streak++;
    } else {
      if (pendingMiss) {
        // Second consecutive miss — break the streak.
        break;
      }
      pendingMiss = true;
      // Don't break yet; one miss is allowed. But if streak is 0 so far
      // (no studied days found yet walking back), this is just pre-history.
      // If streak == 0 after a miss, we can stop — no streak to extend.
      if (streak === 0) break;
    }
  }

  return { streak, missed, studiedToday };
}

// Buckets attempts into per-day counts over the last `days` calendar days.
// Timezone: user's local timezone (via toLocaleDateString).
export function bucketByDay(
  attempts: Array<{ ts: string; wordId: string; outcome: string }>,
  nowMs: number,
  days: number
): DayBucket[] {
  // Build the list of dates from (today - days + 1) to today
  const buckets: DayBucket[] = [];
  const today = new Date(nowMs);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets.push({ date: toDateString(d), cards: 0, distinct: 0, known: 0 });
  }

  const bucketMap = new Map(buckets.map((b) => [b.date, b]));
  const distinctPerDay = new Map<string, Set<string>>();

  for (const a of attempts) {
    const d = toDateString(new Date(a.ts));
    const bucket = bucketMap.get(d);
    if (!bucket) continue;
    bucket.cards++;
    if (a.outcome === "know") bucket.known++;
    if (!distinctPerDay.has(d)) distinctPerDay.set(d, new Set());
    distinctPerDay.get(d)!.add(a.wordId);
  }

  for (const [d, wordSet] of distinctPerDay) {
    const bucket = bucketMap.get(d);
    if (bucket) bucket.distinct = wordSet.size;
  }

  return buckets;
}

// Formats a Date to a local YYYY-MM-DD string.
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

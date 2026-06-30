"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LineChartMulti, PieChart, StackedBarChart } from "@/components/charts";
import { submitSessionAttempts } from "@/app/actions/session";
import { toast } from "sonner";
import {
  computeStreak,
  weightedAverage,
  weightedSample,
  buildStrugglingPool,
  buildForgettingPool,
  bucketByDay,
  type UserWordSetting,
  type DayBucket,
} from "@/lib/progressStats";
import {
  fetchStreakDates,
  fetchAttemptsLast30d,
  fetchUserWordSettings,
  fetchDuelSummary,
  fetchWordsAddedLast30d,
  type WordWithSettings,
  type DuelRow,
  type WordAddedRow,
} from "./queries";

// Pie colour palette — enough for up to 12 themes.
const PIE_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4",
  "#84cc16", "#a78bfa",
];

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

interface DuelStats {
  wins: number;
  losses: number;
  ties: number;
}

function computeDuelStats(duels: DuelRow[], userId: string): DuelStats {
  let wins = 0, losses = 0, ties = 0;
  for (const d of duels) {
    if (d.winner === "tie") { ties++; continue; }
    const userIsP1 = d.p1_user_id === userId;
    const userIsP2 = d.p2_user_id === userId;
    const won =
      (userIsP1 && d.winner === "p1") ||
      (userIsP2 && d.winner === "p2");
    if (won) wins++;
    else if (userIsP1 || userIsP2) losses++;
  }
  return { wins, losses, ties };
}

function buildThemePieData(
  attempts: Array<{ ts: string; wordId: string; outcome: string }>,
  wordSettings: WordWithSettings[]
): Array<{ label: string; value: number; color: string }> {
  const wordThemeMap = new Map(wordSettings.map((w) => [w.word_id, w.theme ?? "Untagged"]));
  const themeCounts = new Map<string, Set<string>>();
  for (const a of attempts) {
    const theme = wordThemeMap.get(a.wordId) ?? "Untagged";
    if (!themeCounts.has(theme)) themeCounts.set(theme, new Set());
    themeCounts.get(theme)!.add(a.wordId);
  }
  const sorted = Array.from(themeCounts.entries()).sort((a, b) => b[1].size - a[1].size);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);
  const result = top.map(([label, wordSet], i) => ({
    label,
    value: wordSet.size,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));
  if (rest.length > 0) {
    const othersValue = rest.reduce((sum, [, wordSet]) => sum + wordSet.size, 0);
    result.push({ label: "Others", value: othersValue, color: "#9ca3af" });
  }
  return result;
}

function buildStackedBarData(
  wordsAdded: WordAddedRow[],
  nowMs: number,
  days: number
): { dayLabels: string[]; series: Array<{ label: string; color: string; values: number[] }> } {
  const today = new Date(nowMs);
  const dayKeys: string[] = [];
  const dayDisplayLabels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const s = toLocalDateString(d);
    dayKeys.push(s.slice(5));         // MM-DD for matching
    dayDisplayLabels.push(fmtDay(s)); // "D Mon" for display
  }

  const themes = new Set(wordsAdded.map((w) => w.theme ?? "Untagged"));
  const themeList = Array.from(themes).sort();
  const dayIndexMap = new Map(dayKeys.map((label, i) => [label, i]));

  // Pre-pass: compute per-theme totals to determine top-6.
  const themeTotals = new Map<string, number>();
  for (const w of wordsAdded) {
    const theme = w.theme ?? "Untagged";
    themeTotals.set(theme, (themeTotals.get(theme) ?? 0) + 1);
  }
  const sortedThemes = Array.from(themeTotals.entries()).sort((a, b) => b[1] - a[1]);
  const top6Themes = new Set(sortedThemes.slice(0, 6).map(([t]) => t));

  const seriesData: Array<{ label: string; color: string; values: number[] }> = themeList
    .filter((theme) => top6Themes.has(theme))
    .map((theme, i) => ({
      label: theme,
      color: PIE_COLORS[i % PIE_COLORS.length],
      values: new Array(days).fill(0),
    }));

  const hasOthers = themeList.some((t) => !top6Themes.has(t));
  if (hasOthers) {
    seriesData.push({ label: "Others", color: "#9ca3af", values: new Array(days).fill(0) });
  }

  for (const w of wordsAdded) {
    const d = new Date(w.added_at);
    const label = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayIdx = dayIndexMap.get(label);
    if (dayIdx === undefined) continue;
    const theme = w.theme ?? "Untagged";
    const targetLabel = top6Themes.has(theme) ? theme : "Others";
    const seriesEntry = seriesData.find((s) => s.label === targetLabel);
    if (seriesEntry) seriesEntry.values[dayIdx]++;
  }

  return { dayLabels: dayDisplayLabels, series: seriesData };
}

function WordReviewRow({
  word,
  mark,
  isPending,
  onMark,
}: {
  word: UserWordSetting;
  mark?: "know" | "forgot";
  isPending: boolean;
  onMark: (outcome: "know" | "forgot") => void;
}) {
  return (
    <li className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-3">
      <button
        onClick={() => onMark("forgot")}
        disabled={isPending}
        aria-label={`Mark ${word.greek_text} as forgotten`}
        className={`p-1 rounded-full transition ${
          mark === "forgot"
            ? "bg-red-100 ring-2 ring-red-300"
            : "hover:bg-red-50"
        } disabled:opacity-40`}
      >
        👎
      </button>
      <span className="flex-1 text-gray-900 font-medium text-center" lang="el">
        {word.greek_text}
      </span>
      <button
        onClick={() => onMark("know")}
        disabled={isPending}
        aria-label={`Mark ${word.greek_text} as known`}
        className={`p-1 rounded-full transition ${
          mark === "know"
            ? "bg-green-100 ring-2 ring-green-300"
            : "hover:bg-green-50"
        } disabled:opacity-40`}
      >
        👍
      </button>
    </li>
  );
}

export default function ProgressPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  // Computed state
  const [streakLabel, setStreakLabel] = useState("—");
  const [lineBuckets, setLineBuckets] = useState<DayBucket[]>([]);
  const [struggling, setStruggling] = useState<UserWordSetting[]>([]);
  const [forgetting, setForgetting] = useState<UserWordSetting[]>([]);
  const [showStruggling, setShowStruggling] = useState(false);
  const [showForgetting, setShowForgetting] = useState(false);
  const [prodAvg, setProdAvg] = useState<number>(0);
  const [recAvg, setRecAvg] = useState<number>(0);
  const [themePie, setThemePie] = useState<Array<{ label: string; value: number; color: string }>>([]);
  const [stackedDays, setStackedDays] = useState<string[]>([]);
  const [stackedSeries, setStackedSeries] = useState<Array<{ label: string; color: string; values: number[] }>>([]);
  const [duelStats, setDuelStats] = useState<DuelStats>({ wins: 0, losses: 0, ties: 0 });
  const [marks, setMarks] = useState<Record<string, "know" | "forgot">>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  async function handleMark(wordId: string, outcome: "know" | "forgot") {
    if (!uid) return;
    setPending((prev) => ({ ...prev, [wordId]: true }));
    const result = await submitSessionAttempts(uid, [
      { word_id: wordId, mode: "rec", outcome, interest_interaction: "none" },
    ]);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      setMarks((prev) => ({ ...prev, [wordId]: outcome }));
      toast.success(outcome === "know" ? "Recorded 👍" : "Recorded 👎");
    }
    setPending((prev) => ({ ...prev, [wordId]: false }));
  }

  async function loadAll(uid: string) {
    const nowMs = Date.now();
    const today = new Date(nowMs);
    const nowDate = toLocalDateString(today);

    const [streakDates, attempts, settings, duels, wordsAdded] = await Promise.all([
      fetchStreakDates(uid),
      fetchAttemptsLast30d(uid),
      fetchUserWordSettings(uid),
      fetchDuelSummary(uid),
      fetchWordsAddedLast30d(uid),
    ]);

    // Streak label
    const sr = computeStreak(streakDates, nowDate);
    if (sr.streak === 0) {
      setStreakLabel("No streak yet");
    } else {
      const missedStr = sr.missed > 0 ? ` · ${sr.missed} missed` : "";
      setStreakLabel(
        sr.studiedToday
          ? `${sr.streak} day streak 🔥${missedStr}`
          : `Day ${sr.streak + 1} in reach${missedStr}`
      );
    }

    // Line chart
    const buckets = bucketByDay(attempts, nowMs, 30);
    setLineBuckets(buckets);

    // Word lists — map settings to UserWordSetting shape
    const mapped: UserWordSetting[] = settings.map((s) => ({
      word_id: s.word_id,
      greek_text: s.greek_text,
      theme: s.theme,
      is_archived: s.is_archived,
      avg_success_rate_prod: s.avg_success_rate_prod,
      avg_success_rate_rec: s.avg_success_rate_rec,
      review_count: s.review_count,
      last_reviewed: s.last_reviewed,
      last_mistake_at: s.last_mistake_at,
    }));

    const strugglingPool = buildStrugglingPool(mapped);
    setStruggling(weightedSample(strugglingPool, 5, Math.random));

    const forgettingPool = buildForgettingPool(mapped, nowMs);
    setForgetting(weightedSample(forgettingPool, 5, Math.random));

    // Prod vs rec weighted average
    const prodRows = settings.map((s) => ({ rate: s.avg_success_rate_prod, count: s.review_count }));
    const recRows = settings.map((s) => ({ rate: s.avg_success_rate_rec, count: s.review_count }));
    setProdAvg(weightedAverage(prodRows));
    setRecAvg(weightedAverage(recRows));

    // Theme pie
    setThemePie(buildThemePieData(attempts, settings));

    // Stacked bar
    const { dayLabels, series } = buildStackedBarData(wordsAdded, nowMs, 30);
    setStackedDays(dayLabels);
    setStackedSeries(series);

    // Duels
    setDuelStats(computeDuelStats(duels, uid));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUid(data.user.id);
      await loadAll(data.user.id);
      setLoading(false);
    };
    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const lineDayLabels = lineBuckets.map((b) => fmtDay(b.date));
  const lineGap = Math.abs(recAvg - prodAvg);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Progress</h1>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Dashboard
          </button>
        </div>

        <p className="text-sm text-gray-500 -mt-4">{streakLabel}</p>

        {/* Section 1: 30-day line chart */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Last 30 days</h2>
          <LineChartMulti
            series={[
              { label: "Cards", color: "#ef4444", values: lineBuckets.map((b) => b.cards) },
              { label: "Words seen", color: "#eab308", values: lineBuckets.map((b) => b.distinct) },
              { label: "Know outcomes", color: "#22c55e", values: lineBuckets.map((b) => b.known) },
            ]}
            labels={lineDayLabels}
            ariaLabel="30-day activity: cards practiced, distinct words seen, and know outcomes per day"
          />
        </section>

        {/* Section 2: Struggling words */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">Words you&apos;re struggling with</h2>
          {struggling.length === 0 ? (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">You&apos;re all good 👍</p>
          ) : (
            <>
              <button
                onClick={() => setShowStruggling((v) => !v)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-4 py-2 bg-white hover:bg-gray-50 transition"
                aria-expanded={showStruggling}
                aria-label="Reveal words you're struggling with"
              >
                {showStruggling ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showStruggling ? "Hide" : "Reveal"} ({struggling.length} words)
              </button>
              {showStruggling && (
                <ul className="mt-3 space-y-2">
                  {struggling.map((w) => (
                    <WordReviewRow
                      key={w.word_id}
                      word={w}
                      mark={marks[w.word_id]}
                      isPending={pending[w.word_id] ?? false}
                      onMark={(outcome) => handleMark(w.word_id, outcome)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {/* Section 3: Forgetting words */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">Words you may be forgetting</h2>
          {forgetting.length === 0 ? (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">You&apos;re all good 👍</p>
          ) : (
            <>
              <button
                onClick={() => setShowForgetting((v) => !v)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-4 py-2 bg-white hover:bg-gray-50 transition"
                aria-expanded={showForgetting}
                aria-label="Reveal words you may be forgetting"
              >
                {showForgetting ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showForgetting ? "Hide" : "Reveal"} ({forgetting.length} words)
              </button>
              {showForgetting && (
                <ul className="mt-3 space-y-2">
                  {forgetting.map((w) => (
                    <WordReviewRow
                      key={w.word_id}
                      word={w}
                      mark={marks[w.word_id]}
                      isPending={pending[w.word_id] ?? false}
                      onMark={(outcome) => handleMark(w.word_id, outcome)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {/* Section 4: Prod vs rec */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Production vs recognition</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Production (Greek → French)</p>
              <p className="text-3xl font-bold text-gray-900">{Math.round(prodAvg)}%</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Recognition (French → Greek)</p>
              <p className="text-3xl font-bold text-gray-900">{Math.round(recAvg)}%</p>
            </div>
          </div>
          {lineGap > 10 && (prodAvg > 0 || recAvg > 0) && (
            <p className="mt-2 text-xs text-gray-500">
              {recAvg > prodAvg
                ? `You recognise ${Math.round(recAvg - prodAvg)}pp more than you can produce — focus on production drills.`
                : `Production is ahead of recognition by ${Math.round(prodAvg - recAvg)}pp.`}
            </p>
          )}
        </section>

        {/* Section 5: Theme pie */}
        {themePie.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Words seen by theme</h2>
            <p className="text-xs italic text-gray-400 mb-3">Last 30 days</p>
            <PieChart
              slices={themePie}
              ariaLabel="Pie chart showing distinct words practiced in the last 30 days broken down by theme"
            />
          </section>
        )}

        {/* Section 6: Words added stacked bar */}
        {stackedSeries.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Words added per day by theme</h2>
            <p className="text-xs italic text-gray-400 mb-3">Last 30 days</p>
            <StackedBarChart
              days={stackedDays}
              series={stackedSeries}
              ariaLabel="Stacked bar chart showing words added per day by theme over the last 30 days"
            />
          </section>
        )}

        {/* Section 7: Duels */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Duels</h2>
          <p className="text-xs italic text-gray-400 mb-3">All time</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-xs text-green-700 mb-1">Wins</p>
              <p className="text-3xl font-bold text-green-800">{duelStats.wins}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-xs text-red-700 mb-1">Losses</p>
              <p className="text-3xl font-bold text-red-800">{duelStats.losses}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Ties</p>
              <p className="text-3xl font-bold text-gray-700">{duelStats.ties}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

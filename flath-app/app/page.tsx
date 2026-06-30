"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BookOpen, Layers, Folder, Swords, BarChart3 } from "lucide-react";
import { PracticeSelectionModal } from "@/components/PracticeSelectionModal";
import { useSurface, isMobileSurface } from "@/lib/surface";
import {
  fetchStreakDates,
  fetchDistinctWords7d,
  fetchWordsAdded7d,
} from "@/app/progress/queries";
import { computeStreak } from "@/lib/progressStats";

export default function Home() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Surface gating — see flath-app/CLAUDE.md (Surface model)
  const surface = useSurface();
  const showDesktopOnly = !isMobileSurface(surface);

  // Modal State
  const [showPracticeModal, setShowPracticeModal] = useState(false);

  // Progress metrics
  const [streakResult, setStreakResult] = useState<{
    streak: number;
    missed: number;
    studiedToday: boolean;
  } | null>(null);
  const [distinctWords7d, setDistinctWords7d] = useState<number | null>(null);
  const [wordsAdded7d, setWordsAdded7d] = useState<number | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      setIsAuthenticated(!!data.user);
      if (data.user) setUserId(data.user.id);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const loadMetrics = async () => {
      const today = new Date();
      const nowDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const [dates, distinct, added] = await Promise.all([
        fetchStreakDates(userId),
        fetchDistinctWords7d(userId),
        fetchWordsAdded7d(userId),
      ]);

      setStreakResult(computeStreak(dates, nowDate));
      setDistinctWords7d(distinct);
      setWordsAdded7d(added);
    };
    loadMetrics();
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const openPracticeModal = () => {
    setShowPracticeModal(true);
  };

  const streakLabel = (): string => {
    if (!streakResult) return "—";
    const { streak, missed, studiedToday } = streakResult;
    if (streak === 0) return "No streak yet";
    const missedStr = missed > 0 ? ` · ${missed} missed` : "";
    if (studiedToday) return `${streak} day streak 🔥${missedStr}`;
    return `Day ${streak + 1} in reach${missedStr}`;
  };

  const noActivity = (streakResult?.streak ?? 0) === 0 && !distinctWords7d && !wordsAdded7d;

  if (isAuthenticated === null) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Practice Modal */}
      <PracticeSelectionModal
        isOpen={showPracticeModal}
        onClose={() => setShowPracticeModal(false)}
        userId={userId || ""}
      />

      <main className="w-full max-w-2xl bg-white rounded-3xl border border-gray-200 shadow-sm p-12 text-center">
        <div className="mb-8">
          {/* Mobile: 3 rows */}
          <h1 className="md:hidden flex flex-col items-center gap-1 font-bold tracking-widest text-gray-900 mb-2">
            <span style={{ fontFamily: "initial" }} className="text-3xl">⚡🇫🇷⚡</span>
            <span style={{ fontFamily: "var(--font-ac5x5)" }} className="text-4xl">ΦΛΑΘ</span>
            <span style={{ fontFamily: "initial" }} className="text-3xl">⚡🇬🇷⚡</span>
          </h1>
          {/* Desktop: single row */}
          <h1 className="hidden md:block text-5xl font-bold tracking-widest text-gray-900 mb-2">
            <span style={{ fontFamily: "initial" }}>⚡🇫🇷 </span>
            <span style={{ fontFamily: "var(--font-ac5x5)" }}>ΦΛΑΘ</span>
            <span style={{ fontFamily: "initial" }}> 🇬🇷⚡</span>
          </h1>
        </div>

        {isAuthenticated ? (
          <>
            {/* Progress metrics row */}
            <p className="text-xs text-gray-400 mb-2 text-center">
              {noActivity ? "Let's get started" : "This week"}
            </p>
            <div className="grid grid-cols-3 gap-2 mb-6 max-w-sm mx-auto">
              <div className="bg-gray-50 rounded-xl px-2 py-3 flex flex-col items-center">
                <span className="text-xs text-gray-500 mb-1 leading-tight text-center">Streak</span>
                <span className="text-sm font-semibold text-gray-900 leading-tight text-center">
                  {streakLabel()}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl px-2 py-3 flex flex-col items-center">
                <span className="text-xs text-gray-500 mb-1 leading-tight text-center">Words</span>
                <span className="text-2xl font-bold text-gray-900">
                  {distinctWords7d ?? (noActivity ? 0 : "—")}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl px-2 py-3 flex flex-col items-center">
                <span className="text-xs text-gray-500 mb-1 leading-tight text-center">Added</span>
                <span className="text-2xl font-bold text-gray-900">
                  {wordsAdded7d ?? (noActivity ? 0 : "—")}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-4 max-w-sm mx-auto">
              <button
                onClick={openPracticeModal}
                className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 transition shadow"
              >
                <BookOpen className="w-5 h-5" />
                Start Practice Session
              </button>
              {showDesktopOnly && (
                // Duel is desktop-only — see flath-app/CLAUDE.md
                <button
                  onClick={() => router.push("/duel")}
                  className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-red-600 text-white rounded-xl font-semibold text-lg hover:bg-red-700 transition shadow"
                >
                  <Swords className="w-5 h-5" />
                  Duel
                </button>
              )}
              <button
                onClick={() => router.push("/packs")}
                className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-white text-gray-800 border-2 border-gray-200 rounded-xl font-semibold text-lg hover:bg-gray-50 hover:border-gray-300 transition"
              >
                <Folder className="w-5 h-5" />
                Word Packs
              </button>
              <button
                onClick={() => router.push("/vault")}
                className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-white text-gray-800 border-2 border-gray-200 rounded-xl font-semibold text-lg hover:bg-gray-50 hover:border-gray-300 transition"
              >
                <Layers className="w-5 h-5" />
                Manage Vocabulary
              </button>
              <button
                onClick={() => router.push("/progress")}
                className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-white text-gray-800 border-2 border-gray-200 rounded-xl font-semibold text-lg hover:bg-gray-50 hover:border-gray-300 transition"
              >
                <BarChart3 className="w-5 h-5" />
                Show Progress
              </button>
              <button
                onClick={handleLogout}
                className="mt-6 text-sm text-gray-700 hover:text-gray-900 underline transition"
              >
                Sign Out
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            <button
              onClick={() => router.push("/login")}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition shadow"
            >
              Sign In
            </button>
            <p className="text-sm text-gray-700 mt-4">
              You must be logged in to access the vault or practice features.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

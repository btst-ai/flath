"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BookOpen, Layers, Folder, Swords } from "lucide-react";
import { PracticeSelectionModal } from "@/components/PracticeSelectionModal";
import { useSurface, isMobileSurface } from "@/lib/surface";

export default function Home() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Surface gating — see flath-app/CLAUDE.md (Surface model)
  const surface = useSurface();
  const showDesktopOnly = !isMobileSurface(surface);

  // Modal State
  const [showPracticeModal, setShowPracticeModal] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      setIsAuthenticated(!!data.user);
      if (data.user) setUserId(data.user.id);
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const openPracticeModal = () => {
    setShowPracticeModal(true);
  };

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
            <span style={{ fontFamily: "var(--font-greek-to-me)" }} className="text-4xl">FLATH</span>
            <span style={{ fontFamily: "initial" }} className="text-3xl">⚡🇬🇷⚡</span>
          </h1>
          {/* Desktop: single row */}
          <h1 className="hidden md:block text-5xl font-bold tracking-widest text-gray-900 mb-2" style={{ fontFamily: "var(--font-greek-to-me)" }}>
            <span style={{ fontFamily: "initial" }}>⚡🇫🇷 </span>FLATH<span style={{ fontFamily: "initial" }}> 🇬🇷⚡</span>
          </h1>
        </div>

        {isAuthenticated ? (
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
              onClick={handleLogout}
              className="mt-6 text-sm text-gray-500 hover:text-gray-800 underline transition"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            <button
              onClick={() => router.push("/login")}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition shadow"
            >
              Sign In
            </button>
            <p className="text-sm text-gray-500 mt-4">
              You must be logged in to access the vault or practice features.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

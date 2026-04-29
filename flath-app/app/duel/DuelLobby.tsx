"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Swords, CheckCircle2, XCircle, Circle, Loader2 } from "lucide-react";
import {
  fetchUserWords,
  sortSoloPriority,
  sortAveragePriority,
  randomShuffle,
  assignTracks,
  type SessionWord,
  type CardMode,
} from "@/lib/sessionQueue";
import { lookupP2 } from "@/app/actions/duel";
import type { DuelConfig, DataSource, PlayerIdentity } from "./duelTypes";

interface Props {
  p1UserId: string;
  initialConfig?: DuelConfig | null;
  onStart: (config: DuelConfig, queue: SessionWord[]) => void;
  onCancel: () => void;
}

type P2State =
  | { kind: "empty" }                                       // ⚪ guest
  | { kind: "checking" }                                    // 🟡
  | { kind: "invalid"; reason: "not_found" | "same_as_p1" | "invalid" | "server_error" }  // 🔴
  | { kind: "connected"; userId: string; email: string };   // 🟢

export function DuelLobby({ p1UserId, initialConfig, onStart, onCancel }: Props) {
  const [p1Name, setP1Name] = useState(initialConfig?.p1.displayName ?? "Baptiste");
  const [p1Flag, setP1Flag] = useState(initialConfig?.p1.flag ?? "🇫🇷");
  const [p2Name, setP2Name] = useState(initialConfig?.p2.displayName ?? "Efi");
  const [p2Flag, setP2Flag] = useState(initialConfig?.p2.flag ?? "🇬🇷");

  const [p2Email, setP2Email] = useState("");
  const [p2State, setP2State] = useState<P2State>({ kind: "empty" });

  const [source, setSource] = useState<"smart" | "pack">(initialConfig?.source ?? "smart");
  const [dataSource, setDataSource] = useState<DataSource>(initialConfig?.dataSource ?? "avg");
  const [cardMode, setCardMode] = useState<CardMode>(initialConfig?.cardMode ?? "mixed");
  const [packId, setPackId] = useState<string | null>(initialConfig?.packId ?? null);
  const [totalCards, setTotalCards] = useState(initialConfig?.totalCards ?? 20);

  const [packs, setPacks] = useState<Array<{ id: string; name: string; is_smart: boolean }>>([]);
  const [isLoadingPacks, setIsLoadingPacks] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Load packs (same logic as PracticeSelectionModal).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingPacks(true);
      const { data: wordsData } = await supabase
        .from("user_word_settings")
        .select(`words_dim(theme)`)
        .eq("user_id", p1UserId)
        .eq("is_archived", false);

      const themes = new Set<string>();
      if (wordsData) {
        (wordsData as unknown as Array<{ words_dim: { theme: string | null } | null }>).forEach(w => {
          if (w.words_dim?.theme) themes.add(w.words_dim.theme);
        });
      }
      const autoPacks = Array.from(themes).filter(Boolean).sort().map(theme => ({
        id: `auto-theme-${encodeURIComponent(theme)}`,
        name: `${theme} (Theme Pack)`,
        is_smart: true,
      }));

      const { data } = await supabase
        .from("word_packs")
        .select("id, name, is_smart")
        .eq("author_id", p1UserId)
        .order("ts_created", { ascending: false });

      if (!cancelled) {
        setPacks([...autoPacks, ...((data ?? []) as Array<{ id: string; name: string; is_smart: boolean }>)]);
        setIsLoadingPacks(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [p1UserId]);

  // Debounced P2 email validation.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = p2Email.trim();
    if (trimmed.length === 0) {
      setP2State({ kind: "empty" });
      // Guest mode: p2/avg require a connected P2 — fall back to p1.
      if (dataSource !== "p1" && dataSource !== "random") setDataSource("p1");
      return;
    }
    setP2State({ kind: "checking" });
    debounceRef.current = setTimeout(async () => {
      const res = await lookupP2(trimmed, p1UserId);
      if (res.ok) {
        setP2State({ kind: "connected", userId: res.userId, email: res.email });
      } else {
        setP2State({ kind: "invalid", reason: res.error });
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // We intentionally don't depend on dataSource here to avoid feedback loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p2Email, p1UserId]);

  const canStart = useMemo(() => {
    if (isStarting) return false;
    if (p2State.kind === "checking" || p2State.kind === "invalid") return false;
    return true;
  }, [p2State, isStarting]);

  const handleStart = async () => {
    setStartError(null);
    setIsStarting(true);
    try {
      const p2Identity: PlayerIdentity = p2State.kind === "connected"
        ? { userId: p2State.userId, displayName: p2Name, flag: p2Flag, isGuest: false }
        : { userId: null, displayName: p2Name, flag: p2Flag, isGuest: true };

      const p1Identity: PlayerIdentity = {
        userId: p1UserId, displayName: p1Name, flag: p1Flag, isGuest: false,
      };

      // Build the queue based on source + data source.
      let queue: SessionWord[] = [];
      if (source === "pack") {
        if (!packId) {
          setStartError("Pick a pack first.");
          setIsStarting(false);
          return;
        }
        const p1Words = await fetchUserWords(p1UserId, packId);
        const ranked = sortSoloPriority(p1Words);
        queue = assignTracks(ranked.slice(0, totalCards), cardMode);
      } else {
        // Smart shuffle.
        const effectiveDataSource = p2Identity.isGuest && dataSource !== "random"
          ? "p1" : dataSource;
        if (effectiveDataSource === "random") {
          const p1Words = await fetchUserWords(p1UserId, null);
          const shuffled = randomShuffle(p1Words);
          queue = assignTracks(shuffled.slice(0, totalCards), cardMode);
        } else if (effectiveDataSource === "p1") {
          const p1Words = await fetchUserWords(p1UserId, null);
          const ranked = sortSoloPriority(p1Words);
          queue = assignTracks(ranked.slice(0, totalCards), cardMode);
        } else if (effectiveDataSource === "p2" && p2Identity.userId) {
          const p2Words = await fetchUserWords(p2Identity.userId, null);
          const ranked = sortSoloPriority(p2Words);
          queue = assignTracks(ranked.slice(0, totalCards), cardMode);
        } else if (effectiveDataSource === "avg" && p2Identity.userId) {
          const [p1Words, p2Words] = await Promise.all([
            fetchUserWords(p1UserId, null),
            fetchUserWords(p2Identity.userId, null),
          ]);
          const ranked = sortAveragePriority(p1Words, p2Words);
          queue = assignTracks(ranked.slice(0, totalCards), cardMode);
        }
      }

      if (queue.length === 0) {
        setStartError("No words available for the chosen source. Add vocabulary first.");
        setIsStarting(false);
        return;
      }

      const config: DuelConfig = {
        p1: p1Identity,
        p2: p2Identity,
        source,
        dataSource: p2Identity.isGuest && dataSource !== "random" ? "p1" : dataSource,
        packId: source === "pack" ? packId : null,
        cardMode,
        totalCards: queue.length,
      };

      onStart(config, queue);
    } catch (e) {
      console.error(e);
      setStartError(e instanceof Error ? e.message : "Failed to start duel.");
      setIsStarting(false);
    }
  };

  const p2StatusIcon = () => {
    switch (p2State.kind) {
      case "empty":
        return <Circle className="w-4 h-4 text-gray-300" />;
      case "checking":
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case "invalid":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "connected":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
  };
  const p2StatusLabel = () => {
    switch (p2State.kind) {
      case "empty":
        return "Guest (no progress sync)";
      case "checking":
        return "Checking…";
      case "invalid":
        if (p2State.reason === "not_found") return "No account with this email.";
        if (p2State.reason === "same_as_p1") return "Can't duel yourself.";
        if (p2State.reason === "invalid") return "Invalid email format.";
        return "Server error — try again.";
      case "connected":
        return `Connected: ${p2State.email}`;
    }
  };

  const p2Connected = p2State.kind === "connected";

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-sm border border-gray-200 p-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
            <Swords className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Duel</h1>
            <p className="text-sm text-gray-500">Two players, one keyboard.</p>
          </div>
        </div>

        {/* Players */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* P1 */}
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">P1 (you)</span>
            </div>
            <input
              value={p1Flag}
              onChange={e => setP1Flag(e.target.value)}
              className="w-12 text-2xl bg-transparent border-b border-blue-200 focus:outline-none focus:border-blue-500 mb-2"
              maxLength={4}
            />
            <input
              value={p1Name}
              onChange={e => setP1Name(e.target.value)}
              className="w-full text-lg font-semibold text-gray-900 bg-transparent border-b border-blue-200 focus:outline-none focus:border-blue-500"
            />
            <p className="mt-2 text-xs text-gray-500">Keys: Z · X · C</p>
          </div>
          {/* P2 */}
          <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              {p2StatusIcon()}
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">P2</span>
            </div>
            <input
              value={p2Flag}
              onChange={e => setP2Flag(e.target.value)}
              className="w-12 text-2xl bg-transparent border-b border-purple-200 focus:outline-none focus:border-purple-500 mb-2"
              maxLength={4}
            />
            <input
              value={p2Name}
              onChange={e => setP2Name(e.target.value)}
              className="w-full text-lg font-semibold text-gray-900 bg-transparent border-b border-purple-200 focus:outline-none focus:border-purple-500 mb-2"
            />
            <input
              type="email"
              placeholder="email (optional — for sync)"
              value={p2Email}
              onChange={e => setP2Email(e.target.value)}
              className="w-full text-sm bg-white border border-purple-200 rounded px-2 py-1 focus:outline-none focus:border-purple-500"
            />
            <p className={`mt-2 text-xs ${p2State.kind === "invalid" ? "text-red-600" : "text-gray-500"}`}>
              {p2StatusLabel()}
            </p>
            <p className="mt-2 text-xs text-gray-500">Keys: B · N · M</p>
          </div>
        </div>

        {/* Source */}
        <div className="mb-6">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">Source</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSource("smart")}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold border transition ${source === "smart" ? "bg-green-50 border-green-300 text-green-700" : "bg-white border-gray-200 text-gray-600"}`}
            >Smart Shuffle</button>
            <button
              onClick={() => setSource("pack")}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold border transition ${source === "pack" ? "bg-green-50 border-green-300 text-green-700" : "bg-white border-gray-200 text-gray-600"}`}
            >Word Pack</button>
          </div>
        </div>

        {/* Smart Shuffle options */}
        {source === "smart" && (
          <div className="mb-6">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">Data source</label>
            <div className="flex gap-2 flex-wrap">
              {(["p1", "p2", "avg", "random"] as DataSource[]).map(opt => {
                const disabled = !p2Connected && (opt === "p2" || opt === "avg");
                const label = opt === "p1" ? "P1 ranks" : opt === "p2" ? "P2 ranks" : opt === "avg" ? "Average" : "Random";
                return (
                  <button
                    key={opt}
                    disabled={disabled}
                    onClick={() => setDataSource(opt)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition ${
                      disabled ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                      : dataSource === opt ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-gray-200 text-gray-600"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pack picker */}
        {source === "pack" && (
          <div className="mb-6">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">Pack</label>
            {isLoadingPacks ? (
              <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>
            ) : packs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4 border border-dashed rounded-xl">No packs found. Create one in the Vault.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {packs.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPackId(p.id)}
                    className={`w-full flex items-center justify-between p-3 border rounded-xl text-left transition ${packId === p.id ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200"}`}
                  >
                    <span className="font-semibold text-gray-800">{p.name}</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">{p.is_smart ? "Smart" : "Static"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Card count */}
        <div className="mb-6">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">Number of cards</label>
          <div className="flex gap-2">
            {[10, 20, 50].map(n => (
              <button
                key={n}
                onClick={() => setTotalCards(n)}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition ${totalCards === n ? "bg-orange-50 border-orange-300 text-orange-700" : "bg-white border-gray-200 text-gray-600"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Card mode */}
        <div className="mb-8">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">Card mode</label>
          <div className="flex gap-2">
            {(["mixed", "prod", "rec"] as CardMode[]).map(opt => (
              <button
                key={opt}
                onClick={() => setCardMode(opt)}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition ${cardMode === opt ? "bg-purple-50 border-purple-300 text-purple-700" : "bg-white border-gray-200 text-gray-600"}`}
              >
                {opt === "mixed" ? "Mixed 50/50" : opt === "prod" ? "Production only" : "Recognition only"}
              </button>
            ))}
          </div>
        </div>

        {startError && (
          <p className="mb-4 text-sm text-red-600">{startError}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-white text-gray-700 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`flex-1 px-6 py-3 rounded-xl font-semibold text-white transition shadow ${canStart ? "bg-red-600 hover:bg-red-700" : "bg-gray-300 cursor-not-allowed"}`}
          >
            {isStarting ? "Starting…" : "Start Duel"}
          </button>
        </div>
      </div>
    </main>
  );
}

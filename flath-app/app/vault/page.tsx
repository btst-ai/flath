"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Star, Trash2, UploadCloud, ChevronDown, ChevronUp, Plus, Archive, ArrowUpDown, Edit2, Search, AlertTriangle } from "lucide-react";
import { markWordAsMistake } from "@/app/actions/session";
import { useAddWord, WordInput } from "@/hooks/useAddWord";
import { ConflictResolutionModal } from "@/components/ConflictResolutionModal";
import { EditWordModal, getDifficultyFromRank } from "@/components/EditWordModal";
import { ImportSummaryModal, ImportedWord } from "@/components/ImportSummaryModal";
import { BatchEditModal } from "@/components/BatchEditModal";
import { PracticeSelectionModal } from "@/components/PracticeSelectionModal";
import { useSurface, isMobileSurface } from "@/lib/surface";
import { normalizeForSearch, coercePos } from "@/lib/normalize";
import { loadFrequencyMap, extractLookupToken } from "@/lib/freqLookup";
import { batchArchiveWords, batchDeleteWords } from "@/app/actions/words";
import { filterAndSortVocab } from "@/app/vault/vaultFilterSort";

interface CsvRow {
  "Greek Word"?: string;
  "French Translation"?: string;
  "Part of Speech"?: string;
  Group?: string;
  "Frequency Rank"?: string;
  [key: string]: string | undefined;
}

type SortField = "smart" | "greek_text" | "french_text" | "theme" | "success" | "frequency" | "review_count" | "heat";
type SortDirection = "asc" | "desc";

export default function VaultPage() {
  const router = useRouter();

  useEffect(() => {
    document.body.classList.add("hide-background");
    return () => document.body.classList.remove("hide-background");
  }, []);

  // Surface gating — CSV import + batch-edit are desktop-only. See flath-app/CLAUDE.md.
  const surface = useSurface();
  const showDesktopOnly = !isMobileSurface(surface);
  const isMobile = isMobileSurface(surface); // mobile-only background — see flath-app/CLAUDE.md

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"my_library" | "added_by_others" | "removed">("my_library");
  const [myLibrary, setMyLibrary] = useState<any[]>([]);
  const [othersLibrary, setOthersLibrary] = useState<any[]>([]);
  const [isLoadingVocab, setIsLoadingVocab] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("smart");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Filtering
  const [filterTheme, setFilterTheme] = useState<string>("");
  const [filterSuccessMin, setFilterSuccessMin] = useState<number | "">("");
  const [filterSuccessMax, setFilterSuccessMax] = useState<number | "">("");
  const [filterFreqMin, setFilterFreqMin] = useState<number | "">("");
  const [filterFreqMax, setFilterFreqMax] = useState<number | "">("");
  const [filterReviewMin, setFilterReviewMin] = useState<number | "">("");
  const [filterReviewMax, setFilterReviewMax] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<"all" | "fav">("all");
  const [filterPOS, setFilterPOS] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTemporalField, setFilterTemporalField] = useState<"last_reviewed" | "last_correct_at" | "last_mistake_at" | "added" | null>(null);
  const [filterTemporalDays, setFilterTemporalDays] = useState<number | "">("");
  const [filterTemporalMode, setFilterTemporalMode] = useState<"less_than" | "more_than">("less_than");
  const [filterHeat, setFilterHeat] = useState<"hot" | "warm" | "cold" | null>(null);
  const [filterExcludeSuccessful, setFilterExcludeSuccessful] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [customThemes, setCustomThemes] = useState<string[]>([]);
  const [showNewThemeInput, setShowNewThemeInput] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");

  const [editingWord, setEditingWord] = useState<any | null>(null);
  const [mistakeInFlight, setMistakeInFlight] = useState<string | null>(null);
  const [isBatchEditing, setIsBatchEditing] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  
  const [visibleCount, setVisibleCount] = useState(50);

  // Reset visible count when filters or sorting change
  useEffect(() => {
    setVisibleCount(50);
  }, [activeTab, sortField, sortDirection, filterTheme, filterSuccessMin, filterSuccessMax, filterFreqMin, filterFreqMax, filterReviewMin, filterReviewMax, filterStatus, searchQuery, filterPOS, filterTemporalField, filterTemporalDays, filterTemporalMode, filterHeat, filterExcludeSuccessful]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      setVisibleCount(prev => prev + 50);
    }
  };

  // Mobile uses document scroll (the inner table scroll is gated to md:); attach
  // a window listener so infinite-scroll still triggers near the bottom.
  useEffect(() => {
    const onWindowScroll = () => {
      if (window.innerWidth >= 768) return;
      const { scrollY, innerHeight } = window;
      const docHeight = document.documentElement.scrollHeight;
      if (docHeight - (scrollY + innerHeight) <= 200) {
        setVisibleCount(prev => prev + 50);
      }
    };
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", onWindowScroll);
  }, []);
  
  const [importSummary, setImportSummary] = useState<{
    isOpen: boolean;
    words: ImportedWord[];
  } | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addWords, isAdding, conflictState } = useAddWord();

  const fetchVocab = useCallback(async () => {
    if (!userId) return;
    setIsLoadingVocab(true);
    
    const { data: myData, error: myError } = await supabase
      .from("user_word_settings")
      .select(`
        *,
        words_dim (*)
      `)
      .eq("user_id", userId);

    if (myError) {
      toast.error(`Failed to fetch your library: ${myError.message}`);
    } else {
      setMyLibrary(myData || []);
    }

    const { data: allWords, error: othersError } = await supabase
      .from("words_dim")
      .select(`
        *,
        user_word_settings ( user_id )
      `);

    if (othersError) {
      toast.error(`Failed to fetch other words: ${othersError.message}`);
    } else {
      const others = (allWords || []).filter(w => {
        const hasSetting = w.user_word_settings?.some((s: any) => s.user_id === userId);
        return !hasSetting;
      });
      setOthersLibrary(others);
    }
    
    setIsLoadingVocab(false);
  }, [userId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        router.replace("/login");
      } else {
        setUserId(data.user.id);
        setIsAuthChecking(false);
      }
    });
  }, [router]);

  useEffect(() => {
    if (userId) {
      fetchVocab();
    }
  }, [userId, fetchVocab]);

  // Load "mastered" ids (>75% success rate over last 7 days) lazily when the
  // exclude-successful filter is toggled on. Mirrors filterMasteredWords in
  // lib/sessionQueue.ts so Vault stays in sync with practice setup.
  useEffect(() => {
    if (!filterExcludeSuccessful || !userId) return;
    let cancelled = false;
    (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("attempts_history")
        .select("word_id, outcome")
        .eq("user_id", userId)
        .gte("ts", sevenDaysAgo);
      if (cancelled || error || !data) return;
      const totals = new Map<string, number>();
      const knows = new Map<string, number>();
      for (const a of data) {
        totals.set(a.word_id, (totals.get(a.word_id) || 0) + 1);
        if (a.outcome === "know") knows.set(a.word_id, (knows.get(a.word_id) || 0) + 1);
      }
      const mastered = new Set<string>();
      for (const [wid, total] of totals.entries()) {
        const rate = (knows.get(wid) || 0) / total;
        if (rate > 0.75) mastered.add(wid);
      }
      setMasteredIds(mastered);
    })();
    return () => { cancelled = true; };
  }, [filterExcludeSuccessful, userId]);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file.");
      return;
    }

    setFileName(file.name);
    setIsUploading(true);

    try {
      Papa.parse<CsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          // Pre-load frequency map for "Matched" rows
          let freqMap: Map<string, number> | null = null;
          const hasMatchedRows = results.data.some(r => (r["Frequency Rank"] ?? "").trim().toLowerCase() === "matched");
          if (hasMatchedRows) {
            try { freqMap = await loadFrequencyMap(); } catch (e) { console.warn("Freq map load failed", e); }
          }

          const rows: (WordInput & { frequency_rank?: number })[] = results.data
            .map((row) => {
              const greekText = (row["Greek Word"] ?? "").trim();
              const freqRankRaw = (row["Frequency Rank"] ?? "").trim().toLowerCase();

              let frequency_rank: number | undefined;
              if (freqRankRaw === "matched" && freqMap) {
                const token = extractLookupToken(greekText);
                frequency_rank = freqMap.get(token) ?? 8000;
              } else if (freqRankRaw === "niche" || freqRankRaw === "") {
                frequency_rank = 8000;
              }

              return {
                greek_text: greekText,
                french_text: (row["French Translation"] ?? "").trim(),
                part_of_speech: coercePos((row["Part of Speech"] ?? "").trim()),
                theme: (row["Group"] ?? "").trim() || "General",
                frequency_rank,
              };
            })
            .filter((r) => r.greek_text);

          if (rows.length === 0) {
            toast.error("No valid rows found in the CSV.");
            setIsUploading(false);
            return;
          }

          const result = await addWords(rows);

          if (result && result.stats && result.stats.length > 0) {
            // Build ImportedWord list from inserted stats (stats includes id + all fields)
            const importedWords: ImportedWord[] = result.stats.map((s: any) => ({
              id: s.id,
              greek_text: s.greek_text || "",
              french_text: s.french_text || "",
              theme: s.theme || "General",
              part_of_speech: s.part_of_speech || "Autre",
              frequency_rank: s.frequency_rank || 8000,
            }));

            setImportSummary({
              isOpen: true,
              words: importedWords,
            });
          }

          setFileName(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          fetchVocab();
          setShowUploader(false);
          setIsUploading(false);
        },
        error: (err) => {
          toast.error(`CSV parse error: ${err.message}`);
          setIsUploading(false);
        },
      });
    } catch (err) {
      toast.error("An unexpected error occurred.");
      console.error(err);
      setIsUploading(false);
    }
  }, [addWords, fetchVocab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const toggleFav = async (word_id: string, currentFav: boolean) => {
    setMyLibrary((prev) => 
      prev.map((v) => v.word_id === word_id ? { ...v, is_fav: !currentFav } : v)
    );
    const { error } = await supabase
      .from("user_word_settings")
      .update({ is_fav: !currentFav })
      .eq("word_id", word_id)
      .eq("user_id", userId);
    if (error) {
      toast.error(`Failed to update favorite status: ${error.message}`);
      fetchVocab();
    }
  };

  const archiveWord = async (word_id: string, currentArchived: boolean) => {
    setMyLibrary((prev) => 
      prev.map((v) => v.word_id === word_id ? { ...v, is_archived: !currentArchived } : v)
    );
    const { error } = await supabase
      .from("user_word_settings")
      .update({ is_archived: !currentArchived })
      .eq("word_id", word_id)
      .eq("user_id", userId);
    if (error) {
      toast.error(`Failed to update status: ${error.message}`);
      fetchVocab();
    }
  };

  const handleMarkAsMistake = async (word_id: string) => {
    if (!userId) return;
    setMistakeInFlight(word_id);
    const result = await markWordAsMistake(userId, word_id);
    setMistakeInFlight(null);
    if ("error" in result) {
      toast.error(`Failed to mark as mistake: ${result.error}`);
    } else {
      toast.success("Marked as mistake");
      // Targeted single-row refetch: avoids the unbounded all-words query that
      // fetchVocab() issues. The mistake tag updates aggregates (success rate,
      // last_mistake_at) that are displayed in the row, so we merge the fresh
      // server row back into myLibrary state. Fall back to fetchVocab() only if
      // the targeted query itself fails.
      const { data: fresh, error: freshErr } = await supabase
        .from("user_word_settings")
        .select("*, words_dim (*)")
        .eq("user_id", userId)
        .eq("word_id", word_id)
        .single();
      if (freshErr || !fresh) {
        console.warn("[vault] targeted row refetch failed, falling back to full fetchVocab", freshErr);
        fetchVocab();
      } else {
        setMyLibrary((prev) => prev.map((v) => v.word_id === word_id ? fresh : v));
      }
    }
  };

  const addToMyLibrary = async (word: any) => {
    const wordInput: WordInput = {
      greek_text: word.greek_text,
      french_text: word.french_text,
      part_of_speech: word.part_of_speech,
      theme: word.theme,
    };
    await addWords([wordInput]);
    fetchVocab();
  };

  const [removeOtherInFlight, setRemoveOtherInFlight] = useState<string | null>(null);

  // For "Added by others" words not yet in the user's library:
  // "remove" = add-then-archive (design decision #12) so the word lands in the
  // user's removed/archived set and no longer appears under "Added by others".
  const removeFromOthers = async (word: any) => {
    if (!userId) return;
    setRemoveOtherInFlight(word.id);
    try {
      // Step 1: add to library (upsert via addWords, ignoreDuplicates)
      const wordInput: WordInput = {
        greek_text: word.greek_text,
        french_text: word.french_text,
        part_of_speech: word.part_of_speech,
        theme: word.theme,
      };
      await addWords([wordInput]);

      // Step 2: find the newly created user_word_settings row and archive it
      const { data: settingsData, error: settingsErr } = await supabase
        .from("user_word_settings")
        .select("word_id")
        .eq("user_id", userId)
        .eq("word_id", word.id)
        .maybeSingle();

      if (settingsErr || !settingsData) {
        toast.error("Word added but could not archive — please archive manually.");
        fetchVocab();
        return;
      }

      const { data: archiveData, error: archiveErr } = await supabase
        .from("user_word_settings")
        .update({ is_archived: true })
        .eq("user_id", userId)
        .eq("word_id", word.id)
        .select();

      if (archiveErr || !archiveData || archiveData.length === 0) {
        toast.error(archiveErr ? `Failed to archive: ${archiveErr.message}` : "Could not archive word — permission denied");
        return;
      }
      toast.success("Word removed from your view.");
      fetchVocab();
    } finally {
      setRemoveOtherInFlight(null);
    }
  };

  const handleBatchArchive = async () => {
    if (!userId || selectedWordIds.size === 0) return;
    const ids = Array.from(selectedWordIds);
    const result = await batchArchiveWords(userId, ids);
    if ("error" in result) {
      toast.error(`Archive failed: ${result.error}`);
    } else {
      toast.success(`${ids.length} word(s) archived.`);
      setSelectedWordIds(new Set());
      fetchVocab();
    }
  };

  const handleBatchDelete = async () => {
    if (!userId || selectedWordIds.size === 0) return;
    const ids = Array.from(selectedWordIds);
    const result = await batchDeleteWords(userId, ids);
    setShowBatchDeleteConfirm(false);
    if ("error" in result) {
      toast.error(`Delete failed: ${result.error}`);
    } else {
      if (result.ownedDeleted > 0) toast.success(`${result.ownedDeleted} word(s) permanently deleted.`);
      if (result.removedFromLibrary > 0) toast.info(`${result.removedFromLibrary} word(s) removed from your library.`);
      setSelectedWordIds(new Set());
      fetchVocab();
    }
  };

  const addSelectedToMyLibrary = async () => {
    const selectedWords = othersLibrary.filter(w => selectedWordIds.has(w.id));
    const wordInputs: WordInput[] = selectedWords.map(w => ({
      greek_text: w.greek_text,
      french_text: w.french_text,
      part_of_speech: w.part_of_speech,
      theme: w.theme,
    }));
    await addWords(wordInputs);
    setSelectedWordIds(new Set());
    fetchVocab();
  };

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300 inline-block ml-1" />;
    return sortDirection === "asc" 
      ? <ChevronUp className="w-3 h-3 text-gray-700 inline-block ml-1" />
      : <ChevronDown className="w-3 h-3 text-gray-700 inline-block ml-1" />;
  };

  // Filter and Sort Data — shared logic lives in filterAndSortVocab so the
  // library and removed tabs cannot diverge.
  const vaultFilterOpts = useMemo(() => ({
    searchQuery, filterTheme, filterPOS, filterStatus, filterExcludeSuccessful, masteredIds,
    filterSuccessMin, filterSuccessMax, filterFreqMin, filterFreqMax, filterReviewMin,
    filterReviewMax, filterTemporalField, filterTemporalDays, filterTemporalMode, filterHeat,
    sortField, sortDirection,
  }), [searchQuery, filterTheme, filterPOS, filterStatus, filterExcludeSuccessful, masteredIds, filterSuccessMin, filterSuccessMax, filterFreqMin, filterFreqMax, filterReviewMin, filterReviewMax, filterTemporalField, filterTemporalDays, filterTemporalMode, filterHeat, sortField, sortDirection]);

  const displayedLibrary = useMemo(
    () => filterAndSortVocab(myLibrary.filter(w => !w.is_archived), vaultFilterOpts),
    [myLibrary, vaultFilterOpts]
  );

  const displayedRemoved = useMemo(
    () => filterAndSortVocab(myLibrary.filter(w => w.is_archived), vaultFilterOpts),
    [myLibrary, vaultFilterOpts]
  );

  const displayedOthers = useMemo(() => {
    let data = othersLibrary;

    // Filters for 'others' are limited as they don't have personal stats
    if (searchQuery) {
      const q = normalizeForSearch(searchQuery);
      data = data.filter(item =>
        normalizeForSearch(item.greek_text || "").includes(q) ||
        normalizeForSearch(item.french_text || "").includes(q)
      );
    }

    if (filterTheme) {
      data = data.filter(item => item.theme === filterTheme);
    }
    if (filterPOS) {
      data = data.filter(item => item.part_of_speech === filterPOS);
    }
    if (filterFreqMin !== "") {
      data = data.filter(item => item.frequency_rank >= filterFreqMin);
    }
    if (filterFreqMax !== "") {
      data = data.filter(item => item.frequency_rank <= filterFreqMax);
    }

    return [...data].sort((a, b) => {
      let aVal: any = "";
      let bVal: any = "";
      
      switch (sortField) {
        case "greek_text":
          aVal = a.greek_text || "";
          bVal = b.greek_text || "";
          break;
        case "french_text":
          aVal = a.french_text || "";
          bVal = b.french_text || "";
          break;
        case "theme":
          aVal = a.theme || "";
          bVal = b.theme || "";
          break;
        case "frequency":
          aVal = a.frequency_rank > 0 ? a.frequency_rank : 99999;
          bVal = b.frequency_rank > 0 ? b.frequency_rank : 99999;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [othersLibrary, sortField, sortDirection, filterTheme, filterFreqMin, filterFreqMax, searchQuery, filterPOS]);

  const toggleSelection = (id: string, index: number, metaKey: boolean) => {
    const currentList =
      activeTab === "my_library" ? displayedLibrary.map(w => w.word_id) :
      activeTab === "removed"    ? displayedRemoved.map(w => w.word_id) :
                                   displayedOthers.map(w => w.id);

    if (metaKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
      const lo = Math.min(lastSelectedIndex, index);
      const hi = Math.max(lastSelectedIndex, index);
      const newSet = new Set(selectedWordIds);
      for (let i = lo; i <= hi; i++) newSet.add(currentList[i]);
      setSelectedWordIds(newSet);
    } else {
      const newSet = new Set(selectedWordIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedWordIds(newSet);
      setLastSelectedIndex(index);
    }
  };

  const toggleAllSelection = () => {
    if (activeTab === "my_library") {
      if (selectedWordIds.size === displayedLibrary.length) setSelectedWordIds(new Set());
      else setSelectedWordIds(new Set(displayedLibrary.map(w => w.word_id)));
    } else if (activeTab === "removed") {
      if (selectedWordIds.size === displayedRemoved.length) setSelectedWordIds(new Set());
      else setSelectedWordIds(new Set(displayedRemoved.map(w => w.word_id)));
    } else {
      if (selectedWordIds.size === displayedOthers.length) setSelectedWordIds(new Set());
      else setSelectedWordIds(new Set(displayedOthers.map(w => w.id)));
    }
  };

  const uniqueThemes = useMemo(() => {
    const themes = new Set<string>();
    myLibrary.forEach(item => {
      if (item.words_dim?.theme) themes.add(item.words_dim.theme);
    });
    othersLibrary.forEach(item => {
      if (item.theme) themes.add(item.theme);
    });
    customThemes.forEach(t => themes.add(t));
    return Array.from(themes).sort();
  }, [myLibrary, othersLibrary, customThemes]);

  const uniquePOS = useMemo(() => {
    const pos = new Set<string>();
    myLibrary.forEach(item => {
      if (item.words_dim?.part_of_speech) pos.add(item.words_dim.part_of_speech);
    });
    othersLibrary.forEach(item => {
      if (item.part_of_speech) pos.add(item.part_of_speech);
    });
    return Array.from(pos).sort();
  }, [myLibrary, othersLibrary]);

  const handleCreatePackFromSelection = () => {
    if (selectedWordIds.size === 0) return;
    // We can store these IDs in localStorage or context to pass to the Packs page, or use query params.
    // For simplicity, let's alert and log, since actual "Create Pack" usually needs a modal or redirect.
    toast.success(`Ready to create pack with ${selectedWordIds.size} words! (Implementation pending)`);
  };

  const startReviewTopDisplayed = () => {
    const ids = displayedLibrary.slice(0, 25).map((w) => w.word_id);
    if (ids.length === 0) {
      toast.error("No words to review with the current filters.");
      return;
    }
    const qs = new URLSearchParams({
      word_ids: ids.join(","),
      limit: "25",
      preserve_order: "1",
    });
    router.push(`/practice?${qs.toString()}`);
  };

  if (isAuthChecking) {
    return (
      <main className={`min-h-screen ${isMobile ? "bg-[#71B2F4]" : "bg-gray-50"} flex items-center justify-center`}>
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className={`min-h-screen md:h-screen md:overflow-hidden p-4 md:p-6 md:pb-0 flex flex-col items-center ${isMobile ? "bg-[#71B2F4]" : ""}`}>
      <ConflictResolutionModal {...conflictState} />
      <EditWordModal 
        isOpen={!!editingWord}
        onClose={() => setEditingWord(null)}
        word={editingWord}
        onSuccess={() => {
          setEditingWord(null);
          fetchVocab();
        }}
      />
      {showDesktopOnly && (
        <BatchEditModal
          isOpen={isBatchEditing}
          onClose={() => setIsBatchEditing(false)}
          selectedWordIds={Array.from(selectedWordIds)}
          onSuccess={() => {
            setIsBatchEditing(false);
            setSelectedWordIds(new Set());
            fetchVocab();
          }}
        />
      )}
      {importSummary && (
        <ImportSummaryModal
          isOpen={importSummary.isOpen}
          onClose={() => setImportSummary(null)}
          words={importSummary.words}
          onRefresh={fetchVocab}
        />
      )}
      <PracticeSelectionModal 
        isOpen={showPracticeModal} 
        onClose={() => setShowPracticeModal(false)} 
        userId={userId || ""} 
      />
      {/* Batch delete confirm dialog — desktop-only, see flath-app/CLAUDE.md */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Delete {selectedWordIds.size} word(s)?</h3>
            <p className="text-sm text-gray-600">
              Words you own will be permanently deleted. Words added by others will be removed from your library only.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchDelete}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl flex flex-col h-full">
        <div className="shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Advanced Word Vault
            </h1>
            <p className="mt-2 text-gray-700 text-sm">
              Manage your Greek vocabulary, view stats, and import words.
            </p>
          </div>
          <div className="flex gap-4 flex-wrap justify-end">
            {activeTab === "my_library" && (
              <button
                type="button"
                onClick={startReviewTopDisplayed}
                disabled={displayedLibrary.length === 0 || isLoadingVocab}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review this
              </button>
            )}
            {/* desktop-only — see flath-app/CLAUDE.md */}
            {showDesktopOnly && (
            <button
              type="button"
              onClick={() => setShowPracticeModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold shadow hover:bg-green-700 transition"
            >
              Other Practice
            </button>
            )}
            <button
              type="button"
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              Dashboard
            </button>
          </div>
        </div>

        {/* Uploader Section — desktop-only, see flath-app/CLAUDE.md */}
        {showDesktopOnly && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
          <button
            onClick={() => setShowUploader(!showUploader)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition"
          >
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <UploadCloud className="w-5 h-5" />
              Import CSV
            </div>
            {showUploader ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </button>
          {showUploader && (
             <div className="p-6 border-t border-gray-200">
               <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-4 rounded-lg border border-blue-100">
                 <p className="font-semibold text-blue-800 mb-1">Expected CSV Format:</p>
                 <p>Your CSV should include the following header columns:</p>
                 <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                   <li><strong>Greek Word</strong> (required)</li>
                   <li><strong>French Translation</strong></li>
                   <li><strong>Part of Speech</strong> — optional, defaults to &ldquo;Autre&rdquo;</li>
                   <li><strong>Group</strong> — optional, becomes the Theme (default: &ldquo;General&rdquo;)</li>
                   <li><strong>Frequency Rank</strong> — optional: &ldquo;Matched&rdquo; (lookup from frequency list) or &ldquo;Niche&rdquo; (default)</li>
                 </ul>
               </div>
               <div
                 onDrop={handleDrop}
                 onDragOver={handleDragOver}
                 onDragLeave={handleDragLeave}
                 onClick={() => !isUploading && fileInputRef.current?.click()}
                 className={`
                   relative flex flex-col items-center justify-center gap-4
                   rounded-2xl border-2 border-dashed p-12 text-center
                   transition-all duration-200 cursor-pointer
                   ${
                     isDragging
                       ? "border-blue-500 bg-blue-50"
                       : "border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50"
                   }
                   ${isUploading ? "pointer-events-none opacity-60" : ""}
                 `}
               >
                 <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100">
                   <UploadCloud className="w-7 h-7 text-blue-600" />
                 </div>
                 {isUploading || isAdding ? (
                   <div className="flex flex-col items-center gap-2">
                     <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                     <p className="text-sm text-gray-500">Processing...</p>
                   </div>
                 ) : (
                   <>
                     <div>
                       <p className="font-semibold text-gray-700">
                         {fileName ?? "Drop your CSV here"}
                       </p>
                       <p className="text-sm text-gray-400 mt-1">
                         or click to browse
                       </p>
                     </div>
                     <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                       .csv files only
                     </span>
                   </>
                 )}
                 <input
                   ref={fileInputRef}
                   type="file"
                   accept=".csv"
                   className="hidden"
                   onChange={handleFileChange}
                   disabled={isUploading || isAdding}
                 />
               </div>
             </div>
          )}
        </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Theme</label>
              {showNewThemeInput ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    type="text"
                    value={newThemeName}
                    onChange={(e) => setNewThemeName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newThemeName.trim()) {
                        const name = newThemeName.trim();
                        setCustomThemes(prev => prev.includes(name) ? prev : [...prev, name]);
                        setFilterTheme(name);
                        setNewThemeName("");
                        setShowNewThemeInput(false);
                      } else if (e.key === "Escape") {
                        setNewThemeName("");
                        setShowNewThemeInput(false);
                      }
                    }}
                    placeholder="Theme name…"
                    className="border border-blue-400 rounded p-1.5 text-sm w-32 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (newThemeName.trim()) {
                        const name = newThemeName.trim();
                        setCustomThemes(prev => prev.includes(name) ? prev : [...prev, name]);
                        setFilterTheme(name);
                      }
                      setNewThemeName("");
                      setShowNewThemeInput(false);
                    }}
                    className="text-blue-600 text-xs font-semibold hover:text-blue-800"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setNewThemeName(""); setShowNewThemeInput(false); }}
                    className="text-gray-400 text-xs hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  value={filterTheme}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setShowNewThemeInput(true);
                    } else {
                      setFilterTheme(e.target.value);
                    }
                  }}
                  className="border border-gray-300 rounded p-1.5 text-sm"
                >
                  <option value="">All Themes</option>
                  <option value="__new__">+ New Theme</option>
                  {uniqueThemes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">POS</label>
              <select 
                value={filterPOS}
                onChange={(e) => setFilterPOS(e.target.value)}
                className="border border-gray-300 rounded p-1.5 text-sm"
              >
                <option value="">All Parts of Speech</option>
                {uniquePOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            
            {activeTab === "my_library" && (
              <>
                {/* desktop-only — see flath-app/CLAUDE.md */}
                {showDesktopOnly && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Success Rate (%)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" placeholder="Min"
                      value={filterSuccessMin} onChange={(e) => setFilterSuccessMin(e.target.value ? Number(e.target.value) : "")}
                      className="border border-gray-300 rounded p-1.5 text-sm w-16"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number" placeholder="Max"
                      value={filterSuccessMax} onChange={(e) => setFilterSuccessMax(e.target.value ? Number(e.target.value) : "")}
                      className="border border-gray-300 rounded p-1.5 text-sm w-16"
                    />
                  </div>
                </div>
                )}

                {/* desktop-only — see flath-app/CLAUDE.md */}
                {showDesktopOnly && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Review Count</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" placeholder="Min"
                      value={filterReviewMin} onChange={(e) => setFilterReviewMin(e.target.value ? Number(e.target.value) : "")}
                      className="border border-gray-300 rounded p-1.5 text-sm w-16"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number" placeholder="Max"
                      value={filterReviewMax} onChange={(e) => setFilterReviewMax(e.target.value ? Number(e.target.value) : "")}
                      className="border border-gray-300 rounded p-1.5 text-sm w-16"
                    />
                  </div>
                </div>
                )}

                <div className="flex items-center gap-2 pb-1.5">
                  <input
                    type="checkbox"
                    id="exclude-successful-vault"
                    checked={filterExcludeSuccessful}
                    onChange={(e) => setFilterExcludeSuccessful(e.target.checked)}
                    className="rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="exclude-successful-vault" className="text-sm font-medium text-gray-700">Exclude successful (&gt;75% last 7d)</label>
                </div>

                <div className="flex items-center gap-2 pb-1.5">
                  <input 
                    type="checkbox" 
                    id="fav" 
                    checked={filterStatus === "fav"} 
                    onChange={(e) => setFilterStatus(e.target.checked ? "fav" : "all")} 
                    className="rounded text-blue-600 border-gray-300 focus:ring-blue-500" 
                  />
                  <label htmlFor="fav" className="text-sm font-medium text-gray-700">Favorites Only</label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Temporal Filter</label>
                  <div className="flex items-center gap-1 flex-wrap">
                    <select
                      value={filterTemporalField ?? ""}
                      onChange={e => setFilterTemporalField((e.target.value || null) as typeof filterTemporalField)}
                      className="border border-gray-300 rounded p-1.5 text-xs"
                    >
                      <option value="">— field —</option>
                      <option value="last_reviewed">Last reviewed</option>
                      <option value="last_correct_at">Last correct</option>
                      <option value="last_mistake_at">Last mistake</option>
                      <option value="added">Added</option>
                    </select>
                    <select
                      value={filterTemporalMode}
                      onChange={e => setFilterTemporalMode(e.target.value as typeof filterTemporalMode)}
                      className="border border-gray-300 rounded p-1.5 text-xs"
                      disabled={!filterTemporalField}
                    >
                      <option value="less_than">in the last</option>
                      <option value="more_than">more than</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={filterTemporalDays}
                      onChange={e => setFilterTemporalDays(e.target.value ? Number(e.target.value) : "")}
                      placeholder="X"
                      disabled={!filterTemporalField}
                      className="border border-gray-300 rounded p-1.5 text-xs w-14"
                    />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                </div>

                {/* desktop-only — see flath-app/CLAUDE.md */}
                {showDesktopOnly && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Heat</label>
                  <div className="flex gap-1">
                    {(["hot", "warm", "cold"] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => setFilterHeat(filterHeat === level ? null : level)}
                        className={`px-2 py-1 rounded text-xs font-medium border transition ${
                          filterHeat === level
                            ? level === "hot" ? "bg-red-500 text-white border-red-500"
                              : level === "warm" ? "bg-orange-400 text-white border-orange-400"
                              : "bg-blue-300 text-white border-blue-300"
                            : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {level === "hot" ? "🔥 Hot" : level === "warm" ? "~ Warm" : "❄ Cold"}
                      </button>
                    ))}
                  </div>
                </div>
                )}
              </>
            )}

            {/* desktop-only — see flath-app/CLAUDE.md */}
            {showDesktopOnly && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Frequency Rank</label>
              <div className="flex items-center gap-1">
                <input 
                  type="number" placeholder="Min" 
                  value={filterFreqMin} onChange={(e) => setFilterFreqMin(e.target.value ? Number(e.target.value) : "")}
                  className="border border-gray-300 rounded p-1.5 text-sm w-16" 
                />
                <span className="text-gray-400">-</span>
                <input 
                  type="number" placeholder="Max" 
                  value={filterFreqMax} onChange={(e) => setFilterFreqMax(e.target.value ? Number(e.target.value) : "")}
                  className="border border-gray-300 rounded p-1.5 text-sm w-16"
                />
              </div>
            </div>
            )}

            <button
              onClick={() => {
                setFilterTheme(""); setFilterSuccessMin(""); setFilterSuccessMax("");
                setFilterFreqMin(""); setFilterFreqMax(""); setFilterReviewMin(""); setFilterReviewMax("");
                setFilterStatus("all"); setSearchQuery(""); setFilterPOS("");
                setFilterTemporalField(null); setFilterTemporalDays(""); setFilterTemporalMode("less_than"); setFilterHeat(null);
                setFilterExcludeSuccessful(false);
                setSortField("smart"); setSortDirection("asc");
              }}
              className="text-sm text-blue-600 hover:text-blue-800 underline pb-2"
            >
              Clear Filters & Sort
            </button>
          </div>
        </div>

        {/* Tabs & Batch Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
              <button
                onClick={() => { setActiveTab("my_library"); setSelectedWordIds(new Set()); setLastSelectedIndex(null); }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  activeTab === "my_library" ? "bg-gray-100 text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                My Library ({displayedLibrary.length})
              </button>
              <button
                onClick={() => { setActiveTab("added_by_others"); setSelectedWordIds(new Set()); setLastSelectedIndex(null); }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  activeTab === "added_by_others" ? "bg-gray-100 text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                Added by Others ({displayedOthers.length})
              </button>
              <button
                onClick={() => { setActiveTab("removed"); setSelectedWordIds(new Set()); setLastSelectedIndex(null); }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  activeTab === "removed" ? "bg-gray-100 text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                Removed ({displayedRemoved.length})
              </button>
            </div>
            
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search words..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64 shadow-sm"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {showDesktopOnly && selectedWordIds.size > 0 && (activeTab === "my_library" || activeTab === "removed") && (
              <>
                <button
                  onClick={() => setIsBatchEditing(true)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded-md text-sm font-medium hover:bg-gray-300 transition shadow"
                >
                  Batch Edit ({selectedWordIds.size})
                </button>
                {/* desktop-only — see flath-app/CLAUDE.md */}
                <button
                  onClick={handleBatchArchive}
                  className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-md text-sm font-medium hover:bg-orange-200 transition shadow"
                >
                  Archive ({selectedWordIds.size})
                </button>
                {/* desktop-only — see flath-app/CLAUDE.md */}
                <button
                  onClick={() => setShowBatchDeleteConfirm(true)}
                  className="px-3 py-1.5 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200 transition shadow"
                >
                  Delete ({selectedWordIds.size})
                </button>
                <button
                  onClick={handleCreatePackFromSelection}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition shadow"
                >
                  Create Word Pack ({selectedWordIds.size})
                </button>
                {activeTab === "my_library" && (
                  <button
                    onClick={() => router.push(`/practice?word_ids=${Array.from(selectedWordIds).join(",")}`)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition shadow"
                  >
                    Start Session ({selectedWordIds.size})
                  </button>
                )}
              </>
            )}
            {showDesktopOnly && selectedWordIds.size > 0 && activeTab === "added_by_others" && (
              <>
                <button
                  onClick={() => setIsBatchEditing(true)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded-md text-sm font-medium hover:bg-gray-300 transition shadow"
                >
                  Batch Edit ({selectedWordIds.size})
                </button>
                <button
                  onClick={addSelectedToMyLibrary}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition"
                >
                  Move {selectedWordIds.size} to My Library
                </button>
              </>
            )}
          </div>
        </div>
        </div>

        {/* Vocabulary List Section */}
        <div className="bg-white rounded-t-2xl border border-gray-200 border-b-0 shadow-sm flex-1 flex flex-col md:overflow-hidden">
          <div className="overflow-x-auto md:overflow-y-auto md:flex-1 relative" onScroll={handleScroll}>
            {isLoadingVocab ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (activeTab === "my_library" ? displayedLibrary.length : activeTab === "removed" ? displayedRemoved.length : displayedOthers.length) === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No vocabulary found matching these filters.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-gray-700 relative">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
                  <tr>
                    {showDesktopOnly && (
                      <th className="px-4 py-3 w-12 text-center">
                        <input
                          type="checkbox"
                          onChange={toggleAllSelection}
                          checked={
                            (activeTab === "my_library" && displayedLibrary.length > 0 && selectedWordIds.size === displayedLibrary.length) ||
                            (activeTab === "removed" && displayedRemoved.length > 0 && selectedWordIds.size === displayedRemoved.length) ||
                            (activeTab === "added_by_others" && displayedOthers.length > 0 && selectedWordIds.size === displayedOthers.length)
                          }
                          className="rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("greek_text")}>
                      Greek Word <SortIcon field="greek_text" />
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("french_text")}>
                      Translation <SortIcon field="french_text" />
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("theme")}>
                      Theme <SortIcon field="theme" />
                    </th>
                    <th className="px-4 py-3 text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort("success")}>
                      Success % <SortIcon field="success" />
                    </th>
                    <th className="px-4 py-3 text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort("heat")}>
                      Heat <SortIcon field="heat" />
                    </th>
                    <th className="px-4 py-3 text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort("review_count")}>
                      Reviews <SortIcon field="review_count" />
                    </th>
                    <th className="px-4 py-3 text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort("frequency")}>
                      Freq Rank <SortIcon field="frequency" />
                    </th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-gray-100">
                {(activeTab === "my_library" || activeTab === "removed") && (activeTab === "my_library" ? displayedLibrary : displayedRemoved).slice(0, visibleCount).map((setting, index) => {
                  const vocab = setting.words_dim;
                    const isArchived = setting.is_archived;
                    const isFavorite = setting.is_fav;
                    const isSelected = selectedWordIds.has(setting.word_id);
                    
                    return (
                      <tr 
                        key={setting.word_id} 
                        className={`hover:bg-gray-50 transition ${isArchived ? "opacity-50 bg-gray-50" : ""} ${isSelected ? "bg-blue-50/50" : ""}`}
                      >
                        {showDesktopOnly && (
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              onClick={(e) => toggleSelection(setting.word_id, index, e.shiftKey)}
                              className="rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 font-medium text-gray-900">{vocab?.greek_text}</td>
                        <td className="px-4 py-3">{vocab?.french_text}</td>
                        <td className="px-4 py-3">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                            {vocab?.theme || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-green-600">
                          {Math.round((setting.avg_success_rate_prod + setting.avg_success_rate_rec) / 2)}%
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-orange-500">
                          {setting.interest_score > 0 ? `+${setting.interest_score}` : setting.interest_score}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-gray-500">
                          {setting.review_count || 0}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-400 flex flex-col items-center gap-1">
                          <span>{vocab?.frequency_rank > 0 ? vocab.frequency_rank : "—"}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            (() => {
                              const rank = vocab?.frequency_rank > 0 ? vocab.frequency_rank : 99999;
                              const diff = getDifficultyFromRank(rank);
                              if (diff === 'easy') return 'bg-green-100 text-green-700';
                              if (diff === 'medium') return 'bg-yellow-100 text-yellow-700';
                              if (diff === 'hard') return 'bg-orange-100 text-orange-700';
                              return 'bg-red-100 text-red-700';
                            })()
                          }`}>
                            {getDifficultyFromRank(vocab?.frequency_rank > 0 ? vocab.frequency_rank : 99999)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                           <div className="flex justify-center items-center gap-1">
                            <button
                              onClick={() => toggleFav(setting.word_id, isFavorite)}
                              disabled={isArchived}
                              className={`p-1.5 rounded-full transition-colors ${
                                isArchived 
                                  ? "cursor-not-allowed text-gray-300" 
                                  : isFavorite 
                                    ? "text-yellow-500 hover:bg-yellow-50" 
                                    : "text-gray-300 hover:text-yellow-500 hover:bg-gray-100"
                              }`}
                              title={isFavorite ? "Remove favorite" : "Mark as favorite"}
                            >
                              <Star className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
                            </button>
                            <button
                              onClick={() => setEditingWord(vocab)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                              title="Edit word"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleMarkAsMistake(setting.word_id)}
                              disabled={isArchived || mistakeInFlight === setting.word_id}
                              className={`p-1.5 rounded-full transition-colors ${
                                isArchived || mistakeInFlight === setting.word_id
                                  ? "cursor-not-allowed text-gray-300"
                                  : "text-gray-400 hover:text-orange-500 hover:bg-orange-50"
                              }`}
                              title="Mark as mistake"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => archiveWord(setting.word_id, isArchived)}
                              className={`p-1.5 rounded-full transition-colors ${
                                isArchived 
                                  ? "text-blue-500 hover:text-blue-600 hover:bg-blue-50" 
                                  : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                              }`}
                              title={isArchived ? "Restore to Library" : "Remove from Library"}
                            >
                              {isArchived ? <UploadCloud className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {activeTab === "added_by_others" && displayedOthers.slice(0, visibleCount).map((vocab, index) => {
                  const isSelected = selectedWordIds.has(vocab.id);
                    return (
                      <tr 
                        key={vocab.id} 
                        className={`hover:bg-gray-50 transition ${isSelected ? "bg-blue-50/50" : ""}`}
                      >
                        {showDesktopOnly && (
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              onClick={(e) => toggleSelection(vocab.id, index, e.shiftKey)}
                              className="rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 font-medium text-gray-900">{vocab.greek_text}</td>
                        <td className="px-4 py-3">{vocab.french_text}</td>
                        <td className="px-4 py-3">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                            {vocab.theme || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">—</td>
                        <td className="px-4 py-3 text-center text-gray-300">—</td>
                        <td className="px-4 py-3 text-center text-gray-300">—</td>
                        <td className="px-4 py-3 text-center text-xs text-gray-400 flex flex-col items-center gap-1">
                          <span>{vocab.frequency_rank > 0 ? vocab.frequency_rank : "—"}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            (() => {
                              const rank = vocab.frequency_rank > 0 ? vocab.frequency_rank : 99999;
                              const diff = getDifficultyFromRank(rank);
                              if (diff === 'easy') return 'bg-green-100 text-green-700';
                              if (diff === 'medium') return 'bg-yellow-100 text-yellow-700';
                              if (diff === 'hard') return 'bg-orange-100 text-orange-700';
                              return 'bg-red-100 text-red-700';
                            })()
                          }`}>
                            {getDifficultyFromRank(vocab.frequency_rank > 0 ? vocab.frequency_rank : 99999)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center items-center gap-1">
                            <button
                              onClick={() => addToMyLibrary(vocab)}
                              disabled={removeOtherInFlight === vocab.id}
                              className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition text-xs font-medium flex items-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Move to My Library"
                            >
                              <Plus className="w-3.5 h-3.5" /> My Library
                            </button>
                            <button
                              onClick={() => removeFromOthers(vocab)}
                              disabled={removeOtherInFlight === vocab.id}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Remove (archive)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

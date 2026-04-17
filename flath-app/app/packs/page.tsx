"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Folder, Play, Plus, X, Star, Settings, Edit, Trash2, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { getDifficultyFromRank } from "@/components/EditWordModal";
import { EditPackModal } from "@/components/EditPackModal";

// Helper for pack color
const getPackColorStyle = (packId: string, avgHeat: number) => {
  let hash = 0;
  for (let i = 0; i < packId.length; i++) hash = packId.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  
  const normalizedHeat = Math.max(-30, Math.min(30, avgHeat));
  const heatFactor = (normalizedHeat + 30) / 60; // 0 to 1
  
  const saturation = 30 + (70 * heatFactor);
  const lightness = 80 - (40 * heatFactor);
  
  return {
    backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    color: heatFactor > 0.5 ? 'white' : '#1f2937'
  };
};

export default function PacksPage() {
  const router = useRouter();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [packs, setPacks] = useState<any[]>([]);
  const [isLoadingPacks, setIsLoadingPacks] = useState(false);

  // Sorting & Filtering
  const [sortField, setSortField] = useState<"smart" | "name" | "last_played" | "success" | "heat" | "difficulty">("smart");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterLastPlayed, setFilterLastPlayed] = useState<string>("");
  const [filterSuccessMin, setFilterSuccessMin] = useState<number | "">("");
  const [filterSuccessMax, setFilterSuccessMax] = useState<number | "">("");
  const [filterHeatMin, setFilterHeatMin] = useState<number | "">("");
  const [filterHeatMax, setFilterHeatMax] = useState<number | "">("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");

  const [isCreatingSmart, setIsCreatingSmart] = useState(false);
  const [editingPack, setEditingPack] = useState<any | null>(null);

  // Smart Pack Form
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("");
  const [pos, setPos] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [limit, setLimit] = useState(50);
  const [sort, setSort] = useState("interest_desc");
  
  // Preview
  const [previewWords, setPreviewWords] = useState<any[]>([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<string>>(new Set());
  const [isPreviewing, setIsPreviewing] = useState(false);

  const fetchPacks = useCallback(async () => {
    if (!userId) return;
    setIsLoadingPacks(true);
    
    // Fetch all user words for stats
    const { data: wordsData } = await supabase
      .from("user_word_settings")
      .select(`
        word_id,
        is_fav,
        interest_score,
        avg_success_rate_prod,
        avg_success_rate_rec,
        words_dim(theme, part_of_speech, frequency_rank)
      `)
      .eq("user_id", userId)
      .eq("is_archived", false);

    const { data: staticItems } = await supabase
      .from("word_pack_items")
      .select("pack_id, word_id");

    const themes = new Set<string>();
    if (wordsData) {
      wordsData.forEach((w: any) => {
        if (w.words_dim?.theme) themes.add(w.words_dim.theme);
      });
    }

    const autoPacks = Array.from(themes).filter(Boolean).sort().map(theme => ({
      id: `auto-theme-${encodeURIComponent(theme)}`,
      name: `${theme} (Theme Pack)`,
      is_smart: true,
      is_auto: true,
      filter_criteria: { theme, sort: 'interest_desc', favOnly: false, pos: '', excludedIds: [] },
      is_fav: false,
      last_played_ts: null
    }));

    const { data, error } = await supabase
      .from("word_packs")
      .select("*")
      .eq("author_id", userId)
      .order("ts_created", { ascending: false });

    if (error) {
      toast.error("Failed to load packs");
      setIsLoadingPacks(false);
      return;
    }

    const allPacksRaw = [...autoPacks, ...(data || [])];
    
    const computeStats = (pack: any) => {
      let matched = [];
      if (pack.is_auto) {
        matched = (wordsData || []).filter(w => w.words_dim?.theme === pack.filter_criteria.theme);
      } else if (pack.is_smart) {
        matched = (wordsData || []).filter(w => {
          const c = pack.filter_criteria;
          if (c.theme && w.words_dim?.theme !== c.theme) return false;
          if (c.pos && w.words_dim?.part_of_speech !== c.pos) return false;
          if (c.favOnly && !w.is_fav) return false;
          if (c.excludedIds?.includes(w.word_id)) return false;
          return true;
        });
      } else {
        const packWordIds = new Set((staticItems || []).filter(i => i.pack_id === pack.id).map(i => i.word_id));
        matched = (wordsData || []).filter(w => packWordIds.has(w.word_id));
      }

      const numWords = matched.length;
      let avgSuccess = 0, avgHeat = 0, avgFreqRank = 0;
      if (numWords > 0) {
        avgSuccess = Math.round(matched.reduce((acc, w) => acc + (w.avg_success_rate_prod + w.avg_success_rate_rec) / 2, 0) / numWords);
        avgHeat = Math.round(matched.reduce((acc, w) => acc + w.interest_score, 0) / numWords);
        avgFreqRank = Math.round(matched.reduce((acc, w) => acc + (w.words_dim?.frequency_rank > 0 ? w.words_dim.frequency_rank : 99999), 0) / numWords);
      }
      return { ...pack, numWords, avgSuccess, avgHeat, avgFreqRank };
    };

    setPacks(allPacksRaw.map(computeStats));
    setIsLoadingPacks(false);
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
    if (userId) fetchPacks();
  }, [userId, fetchPacks]);

  const handlePreview = async () => {
    if (!name) {
      toast.error("Please enter a pack name");
      return;
    }
    
    // Fetch user words matching filters
    let query = supabase
      .from("user_word_settings")
      .select(`
        *,
        words_dim!inner (*)
      `)
      .eq("user_id", userId)
      .eq("is_archived", false);

    if (favOnly) query = query.eq("is_fav", true);
    if (theme) query = query.eq("words_dim.theme", theme);
    if (pos) query = query.eq("words_dim.part_of_speech", pos);

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to preview: " + error.message);
      return;
    }

    let results = data || [];
    
    // Sort
    if (sort === "interest_desc") {
      results.sort((a, b) => b.interest_score - a.interest_score);
    } else if (sort === "success_asc") {
      const getAvg = (s: any) => (s.avg_success_rate_prod + s.avg_success_rate_rec) / 2;
      results.sort((a, b) => getAvg(a) - getAvg(b));
    }

    if (limit > 0) {
      results = results.slice(0, limit);
    }

    setPreviewWords(results);
    setSelectedPreviewIds(new Set(results.map(r => r.word_id)));
    setIsPreviewing(true);
  };

  const handleCreateSmartPack = async () => {
    const excludedIds = previewWords
      .filter(w => !selectedPreviewIds.has(w.word_id))
      .map(w => w.word_id);

    const filterCriteria = {
      theme,
      pos,
      favOnly,
      limit,
      sort,
      excludedIds
    };

    const { error } = await supabase.from("word_packs").insert({
      author_id: userId,
      name,
      is_smart: true,
      filter_criteria: filterCriteria,
    });

    if (error) {
      toast.error("Failed to create pack: " + error.message);
    } else {
      toast.success("Smart pack created!");
      setIsCreatingSmart(false);
      setIsPreviewing(false);
      setName("");
      fetchPacks();
    }
  };

  const togglePreviewSelection = (id: string) => {
    const newSet = new Set(selectedPreviewIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedPreviewIds(newSet);
  };

  const displayedPacks = useMemo(() => {
    let data = [...packs];

    // Filters
    if (filterSuccessMin !== "") {
      data = data.filter(p => (p.avgSuccess || 0) >= filterSuccessMin);
    }
    if (filterSuccessMax !== "") {
      data = data.filter(p => (p.avgSuccess || 0) <= filterSuccessMax);
    }
    if (filterHeatMin !== "") {
      data = data.filter(p => (p.avgHeat || 0) >= filterHeatMin);
    }
    if (filterHeatMax !== "") {
      data = data.filter(p => (p.avgHeat || 0) <= filterHeatMax);
    }
    if (filterDifficulty !== "") {
      data = data.filter(p => getDifficultyFromRank(p.avgFreqRank || 99999) === filterDifficulty);
    }
    if (filterLastPlayed) {
      const now = new Date();
      data = data.filter(p => {
        if (!p.last_played_ts) return filterLastPlayed === "never";
        const daysSince = (now.getTime() - new Date(p.last_played_ts).getTime()) / (1000 * 3600 * 24);
        if (filterLastPlayed === "today") return daysSince <= 1;
        if (filterLastPlayed === "week") return daysSince <= 7;
        if (filterLastPlayed === "month") return daysSince <= 30;
        return true;
      });
    }

    // Sort
    return data.sort((a, b) => {
      if (sortField === "smart") {
        if (a.is_fav !== b.is_fav) return a.is_fav ? -1 : 1;
        const aHeat = a.avgHeat || 0;
        const bHeat = b.avgHeat || 0;
        if (aHeat !== bHeat) return bHeat - aHeat; // desc
        const aFreq = a.avgFreqRank > 0 ? a.avgFreqRank : 99999;
        const bFreq = b.avgFreqRank > 0 ? b.avgFreqRank : 99999;
        return aFreq - bFreq; // asc
      }

      let aVal: any = "";
      let bVal: any = "";
      
      switch (sortField) {
        case "name":
          aVal = a.name; bVal = b.name; break;
        case "last_played":
          aVal = a.last_played_ts || ""; bVal = b.last_played_ts || ""; break;
        case "success":
          aVal = a.avgSuccess || 0; bVal = b.avgSuccess || 0; break;
        case "heat":
          aVal = a.avgHeat || 0; bVal = b.avgHeat || 0; break;
        case "difficulty":
          aVal = a.avgFreqRank > 0 ? a.avgFreqRank : 99999; bVal = b.avgFreqRank > 0 ? b.avgFreqRank : 99999; break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [packs, sortField, sortDirection, filterSuccessMin, filterSuccessMax, filterHeatMin, filterHeatMax, filterDifficulty, filterLastPlayed]);

  if (isAuthChecking) return <div className="min-h-screen bg-gray-50" />;

  return (
    <main className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <EditPackModal 
        isOpen={!!editingPack} 
        onClose={() => setEditingPack(null)} 
        pack={editingPack} 
        onSuccess={() => { setEditingPack(null); fetchPacks(); }} 
        userId={userId || ""} 
      />
      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Word Packs</h1>
            <p className="mt-2 text-gray-500">Manage static and smart flashcard packs.</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setIsCreatingSmart(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4 inline-block mr-2" />
              New Smart Pack
            </button>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              Dashboard
            </button>
          </div>
        </div>

        {/* Create Modal */}
        {isCreatingSmart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-xl overflow-hidden my-8">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900">Create Smart Pack</h2>
                <button onClick={() => { setIsCreatingSmart(false); setIsPreviewing(false); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                {!isPreviewing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pack Name</label>
                      <input 
                        type="text" value={name} onChange={e => setName(e.target.value)}
                        className="w-full border-gray-300 rounded-lg shadow-sm p-2 border" 
                        placeholder="e.g., Geopolitics Top 50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Theme Filter</label>
                        <input 
                          type="text" value={theme} onChange={e => setTheme(e.target.value)}
                          className="w-full border-gray-300 rounded-lg shadow-sm p-2 border" 
                          placeholder="e.g., Geopolitics (Optional)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Part of Speech</label>
                        <input 
                          type="text" value={pos} onChange={e => setPos(e.target.value)}
                          className="w-full border-gray-300 rounded-lg shadow-sm p-2 border" 
                          placeholder="e.g., Verb (Optional)"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                        <select value={sort} onChange={e => setSort(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm p-2 border bg-white">
                          <option value="interest_desc">Highest Interest First</option>
                          <option value="success_asc">Lowest Success First</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Limit (0 for all)</label>
                        <input 
                          type="number" value={limit} onChange={e => setLimit(Number(e.target.value))}
                          className="w-full border-gray-300 rounded-lg shadow-sm p-2 border" 
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="fav" checked={favOnly} onChange={e => setFavOnly(e.target.checked)} className="rounded text-blue-600" />
                      <label htmlFor="fav" className="text-sm font-medium text-gray-700">Favorites Only</label>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button onClick={handlePreview} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                        Preview Words
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Preview: {previewWords.length} words found</h3>
                    <p className="text-sm text-gray-500 mb-4">Uncheck words you want to exclude from this live pack.</p>
                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg mb-4">
                      {previewWords.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">No words match these criteria.</div>
                      ) : (
                        <table className="w-full text-left text-sm text-gray-700">
                          <tbody className="divide-y divide-gray-100">
                            {previewWords.map(w => (
                              <tr key={w.word_id} className={!selectedPreviewIds.has(w.word_id) ? "opacity-50" : ""}>
                                <td className="px-4 py-2 w-10">
                                  <input 
                                    type="checkbox" checked={selectedPreviewIds.has(w.word_id)}
                                    onChange={() => togglePreviewSelection(w.word_id)}
                                    className="rounded text-blue-600"
                                  />
                                </td>
                                <td className="px-4 py-2 font-medium">{w.words_dim.greek_text}</td>
                                <td className="px-4 py-2">{w.words_dim.french_text}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <button onClick={() => setIsPreviewing(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                        Back to Filters
                      </button>
                      <button onClick={handleCreateSmartPack} className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700">
                        Save Pack
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filter & Sort Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sort By</label>
              <select 
                value={sortField}
                onChange={(e) => {
                  setSortField(e.target.value as any);
                  setSortDirection("asc"); // reset direction on field change
                }}
                className="border border-gray-300 rounded p-1.5 text-sm"
              >
                <option value="smart">Smart Rank (Default)</option>
                <option value="name">Name</option>
                <option value="last_played">Last Played</option>
                <option value="success">Avg Success</option>
                <option value="heat">Avg Heat</option>
                <option value="difficulty">Avg Difficulty</option>
              </select>
              {sortField !== "smart" && (
                <button 
                  onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}
                  className="ml-2 p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 inline-flex"
                >
                  {sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Last Played</label>
              <select 
                value={filterLastPlayed}
                onChange={(e) => setFilterLastPlayed(e.target.value)}
                className="border border-gray-300 rounded p-1.5 text-sm"
              >
                <option value="">Any time</option>
                <option value="today">Today</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="never">Never Played</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Success (%)</label>
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

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Heat</label>
              <div className="flex items-center gap-1">
                <input 
                  type="number" placeholder="Min" 
                  value={filterHeatMin} onChange={(e) => setFilterHeatMin(e.target.value ? Number(e.target.value) : "")}
                  className="border border-gray-300 rounded p-1.5 text-sm w-16" 
                />
                <span className="text-gray-400">-</span>
                <input 
                  type="number" placeholder="Max" 
                  value={filterHeatMax} onChange={(e) => setFilterHeatMax(e.target.value ? Number(e.target.value) : "")}
                  className="border border-gray-300 rounded p-1.5 text-sm w-16" 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Avg Difficulty</label>
              <select 
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="border border-gray-300 rounded p-1.5 text-sm"
              >
                <option value="">All</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="niche">Niche</option>
              </select>
            </div>

            <button 
              onClick={() => {
                setSortField("smart"); setSortDirection("asc");
                setFilterLastPlayed(""); setFilterSuccessMin(""); setFilterSuccessMax("");
                setFilterHeatMin(""); setFilterHeatMax(""); setFilterDifficulty("");
              }}
              className="text-sm text-blue-600 hover:text-blue-800 underline pb-2"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Packs List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoadingPacks ? (
            <div className="col-span-full py-12 flex justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : displayedPacks.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-200 border-dashed">
              No packs match your criteria.
            </div>
          ) : (
            displayedPacks.map(pack => (
              <div key={pack.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-4 relative">
                  {!pack.is_auto && (
                    <button 
                      onClick={() => setEditingPack(pack)}
                      className="absolute top-0 right-0 p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 rounded-full transition"
                      title="Edit Pack"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                    style={getPackColorStyle(pack.id, pack.avgHeat || 0)}
                  >
                    <Folder className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 line-clamp-1" title={pack.name}>{pack.name}</h3>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold uppercase tracking-wider">
                        {pack.is_smart ? "Smart" : "Static"}
                      </span>
                      {pack.is_fav && <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Words</span>
                    <span className="font-medium text-gray-800">{pack.numWords || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Avg Success</span>
                    <span className="font-medium text-green-600">{pack.avgSuccess || 0}%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Difficulty</span>
                    <span className="font-medium text-gray-800 capitalize">{getDifficultyFromRank(pack.avgFreqRank || 99999)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Avg Heat</span>
                    <span className="font-mono text-orange-500 font-medium">{(pack.avgHeat || 0) > 0 ? `+${pack.avgHeat}` : pack.avgHeat || 0}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-4 flex items-center gap-1 justify-center">
                  <span className="font-medium">Last played:</span> 
                  {pack.last_played_ts ? new Date(pack.last_played_ts).toLocaleDateString() : "Never"}
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button 
                    onClick={() => router.push(`/practice?pack_id=${pack.id}`)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-gray-50 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 hover:text-green-600 transition"
                  >
                    <Play className="w-4 h-4" /> Practice This Pack
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

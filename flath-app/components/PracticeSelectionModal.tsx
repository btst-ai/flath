import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { X, Play, Shuffle, AlertCircle } from "lucide-react";

const SESSION_SIZES = [10, 25, 50] as const;
type SessionSize = typeof SESSION_SIZES[number];

interface PracticeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function PracticeSelectionModal({ isOpen, onClose, userId }: PracticeSelectionModalProps) {
  const router = useRouter();
  const [packs, setPacks] = useState<any[]>([]);
  const [isLoadingPacks, setIsLoadingPacks] = useState(false);
  const [smartLimit, setSmartLimit] = useState<SessionSize>(25);
  const [randomLimit, setRandomLimit] = useState<SessionSize>(25);
  const [packLimit, setPackLimit] = useState<SessionSize>(25);
  const [mistakesLimit, setMistakesLimit] = useState<SessionSize>(25);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      const fetchPacks = async () => {
        setIsLoadingPacks(true);
        
        const { data: wordsData } = await supabase
          .from("user_word_settings")
          .select(`words_dim(theme)`)
          .eq("user_id", userId)
          .eq("is_archived", false);

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
          is_auto: true
        }));

        const { data } = await supabase
          .from("word_packs")
          .select("id, name, is_smart")
          .eq("author_id", userId)
          .order("ts_created", { ascending: false });
        
        setPacks([...autoPacks, ...(data || [])]);
        setIsLoadingPacks(false);
      };
      
      fetchPacks();
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Start Practice</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Smart Shuffle */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Smart Shuffle</h3>
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-green-700">
                  <Play className="w-4 h-4" />
                  Smart Shuffle
                </div>
                <div className="flex gap-1">
                  {SESSION_SIZES.map(n => (
                    <button
                      key={n}
                      onClick={() => setSmartLimit(n)}
                      className={`px-2 py-0.5 rounded text-xs font-semibold border transition ${smartLimit === n ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-300 hover:border-green-500"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-green-600/80 mb-3">
                Top {smartLimit} words selected by your priority rules (Heat › Success › Frequency).
              </p>
              <button
                onClick={() => router.push(`/practice?mode=smart&limit=${smartLimit}`)}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition"
              >
                Start
              </button>
            </div>
          </div>

          {/* Random */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Random</h3>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-purple-700">
                  <Shuffle className="w-4 h-4" />
                  Random
                </div>
                <div className="flex gap-1">
                  {SESSION_SIZES.map(n => (
                    <button
                      key={n}
                      onClick={() => setRandomLimit(n)}
                      className={`px-2 py-0.5 rounded text-xs font-semibold border transition ${randomLimit === n ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-700 border-purple-300 hover:border-purple-500"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-purple-600/80 mb-3">
                {randomLimit} words picked at random from your library.
              </p>
              <button
                onClick={() => router.push(`/practice?mode=random&limit=${randomLimit}`)}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition"
              >
                Start
              </button>
            </div>
          </div>

          {/* Practice a word pack */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Practice a Word Pack</h3>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-bold text-blue-700">
                  <Play className="w-4 h-4" />
                  Select Pack
                </div>
                <div className="flex gap-1">
                  {SESSION_SIZES.map(n => (
                    <button
                      key={n}
                      onClick={() => setPackLimit(n)}
                      className={`px-2 py-0.5 rounded text-xs font-semibold border transition ${packLimit === n ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-700 border-blue-300 hover:border-blue-500"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {isLoadingPacks ? (
                <div className="py-4 flex justify-center">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : packs.length === 0 ? (
                <div className="text-sm text-blue-600/70 py-2">
                  No packs found. Create one in the Vault.
                </div>
              ) : (
                <select
                  value={selectedPackId || ""}
                  onChange={(e) => setSelectedPackId(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-gray-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a word pack...</option>
                  {packs.map(pack => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name} {pack.is_smart ? "(Smart)" : "(Static)"}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-sm text-blue-600/80 mt-3 mb-3">
                {packLimit} words from your selected pack (ordered by priority: Heat › Success › Frequency).
              </p>
              <button
                onClick={() => {
                  if (selectedPackId) {
                    router.push(`/practice?pack_id=${selectedPackId}&limit=${packLimit}`);
                  }
                }}
                disabled={!selectedPackId || isLoadingPacks}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
              >
                Start
              </button>
            </div>
          </div>

          {/* Mistakes Repair */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Mistakes Repair</h3>
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-orange-700">
                  <AlertCircle className="w-4 h-4" />
                  Repair Mistakes
                </div>
                <div className="flex gap-1">
                  {SESSION_SIZES.map(n => (
                    <button
                      key={n}
                      onClick={() => setMistakesLimit(n)}
                      className={`px-2 py-0.5 rounded text-xs font-semibold border transition ${mistakesLimit === n ? "bg-orange-600 text-white border-orange-600" : "bg-white text-orange-700 border-orange-300 hover:border-orange-500"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-orange-600/80 mb-3">
                Review words marked 'forgot' in the last 7 days that haven't been reviewed today (ordered by mistake count, then by Heat › Success › Frequency).
              </p>
              <button
                onClick={() => router.push(`/practice?mode=mistakes&limit=${mistakesLimit}`)}
                className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

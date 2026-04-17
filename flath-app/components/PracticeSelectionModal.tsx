import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { X, Play } from "lucide-react";

interface PracticeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function PracticeSelectionModal({ isOpen, onClose, userId }: PracticeSelectionModalProps) {
  const router = useRouter();
  const [packs, setPacks] = useState<any[]>([]);
  const [isLoadingPacks, setIsLoadingPacks] = useState(false);

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
          {/* Choice B: Smart Shuffle */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Choice B: Default</h3>
            <button
              onClick={() => router.push("/practice?mode=smart")}
              className="w-full flex flex-col items-start p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 hover:border-green-300 transition text-left"
            >
              <div className="flex items-center gap-2 font-bold text-green-700 mb-1">
                <Play className="w-4 h-4" />
                Smart Shuffle
              </div>
              <p className="text-sm text-green-600/80">
                A dynamic session of 50 words selected by your priority rules (Heat &gt; Success &gt; Frequency).
              </p>
            </button>
          </div>

          {/* Choice A: Select Word Pack */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Choice A: Select Pack</h3>
            {isLoadingPacks ? (
              <div className="py-8 flex justify-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : packs.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4 border border-dashed rounded-xl">
                No packs found. Create one in the Vault.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {packs.map(pack => (
                  <button
                    key={pack.id}
                    onClick={() => router.push(`/practice?pack_id=${pack.id}`)}
                    className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition text-left"
                  >
                    <span className="font-semibold text-gray-800">{pack.name}</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
                      {pack.is_smart ? "Smart" : "Static"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

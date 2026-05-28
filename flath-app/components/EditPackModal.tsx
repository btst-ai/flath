import { useState, useEffect, useMemo } from "react";
import { normalizeForSearch } from "@/lib/normalize";
import { supabase } from "@/lib/supabase";
import { X, Search, Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

interface EditPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  pack: any;
  onSuccess: () => void;
  userId: string;
}

export function EditPackModal({ isOpen, onClose, pack, onSuccess, userId }: EditPackModalProps) {
  const [name, setName] = useState("");
  const [isFav, setIsFav] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Static pack specific
  const [packWords, setPackWords] = useState<any[]>([]);
  const [allWords, setAllWords] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingWords, setIsLoadingWords] = useState(false);

  useEffect(() => {
    if (isOpen && pack) {
      setName(pack.name || "");
      setIsFav(pack.is_fav || false);

      if (!pack.is_smart && !pack.is_auto) {
        // Fetch words for static packs
        const fetchWords = async () => {
          setIsLoadingWords(true);
          
          // Get all user words
          const { data: wordsData } = await supabase
            .from("user_word_settings")
            .select(`
              word_id,
              words_dim(greek_text, french_text, theme)
            `)
            .eq("user_id", userId)
            .eq("is_archived", false);

          const allUserWords = wordsData || [];
          setAllWords(allUserWords);

          // Get items in this pack
          const { data: items } = await supabase
            .from("word_pack_items")
            .select("word_id")
            .eq("pack_id", pack.id);

          const packWordIds = new Set(items?.map(i => i.word_id) || []);
          
          setPackWords(allUserWords.filter(w => packWordIds.has(w.word_id)));
          setIsLoadingWords(false);
        };
        fetchWords();
      }
    }
  }, [isOpen, pack, userId]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !allWords.length) return [];
    const q = normalizeForSearch(searchQuery);
    const currentPackIds = new Set(packWords.map(w => w.word_id));

    return allWords
      .filter(w => !currentPackIds.has(w.word_id))
      .filter(w =>
        normalizeForSearch(w.words_dim?.greek_text || "").includes(q) ||
        normalizeForSearch(w.words_dim?.french_text || "").includes(q)
      )
      .slice(0, 10); // Show max 10 results
  }, [searchQuery, allWords, packWords]);

  const handleAddWord = (word: any) => {
    setPackWords([...packWords, word]);
    setSearchQuery(""); // Clear search after adding
  };

  const handleRemoveWord = (wordId: string) => {
    setPackWords(packWords.filter(w => w.word_id !== wordId));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setIsSaving(true);
    
    // 1. Update Pack details
    const { error: packError } = await supabase
      .from("word_packs")
      .update({ name: name.trim(), is_fav: isFav })
      .eq("id", pack.id);

    if (packError) {
      toast.error("Failed to update pack");
      setIsSaving(false);
      return;
    }

    // 2. If static, sync word_pack_items
    if (!pack.is_smart && !pack.is_auto) {
      // Delete old items
      await supabase.from("word_pack_items").delete().eq("pack_id", pack.id);
      
      // Insert new items
      if (packWords.length > 0) {
        const newItems = packWords.map(w => ({
          pack_id: pack.id,
          word_id: w.word_id
        }));
        await supabase.from("word_pack_items").insert(newItems);
      }
    }

    setIsSaving(false);
    toast.success("Pack updated!");
    onSuccess();
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this pack?")) return;
    
    setIsSaving(true);
    const { error } = await supabase.from("word_packs").delete().eq("id", pack.id);
    setIsSaving(false);

    if (error) {
      toast.error("Failed to delete pack");
    } else {
      toast.success("Pack deleted");
      onSuccess();
      onClose();
    }
  };

  if (!isOpen || !pack) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Edit Pack</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Name & Fav */}
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Pack Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
            <div className="flex flex-col items-center">
              <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Favorite</label>
              <button
                onClick={() => setIsFav(!isFav)}
                className={`p-3 rounded-xl border transition ${isFav ? "bg-yellow-50 border-yellow-200 text-yellow-500" : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"}`}
              >
                <Star className="w-6 h-6" fill={isFav ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          {/* Static Pack Words Management */}
          {!pack.is_smart && !pack.is_auto && (
            <div className="space-y-4">
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Manage Words</label>
                
                {/* Search and Add */}
                <div className="relative mb-4">
                  <div className="relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search to add words..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  
                  {/* Search Results Dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      <ul className="max-h-48 overflow-y-auto">
                        {searchResults.map(w => (
                          <li key={w.word_id} className="flex items-center justify-between px-4 py-2 hover:bg-blue-50 transition border-b border-gray-50 last:border-0">
                            <div>
                              <span className="font-semibold text-gray-900 mr-2">{w.words_dim.greek_text}</span>
                              <span className="text-gray-500 text-sm">{w.words_dim.french_text}</span>
                            </div>
                            <button
                              onClick={() => handleAddWord(w)}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-full transition"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Current Words List */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 min-h-[150px] max-h-[300px] overflow-y-auto">
                  {isLoadingWords ? (
                    <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                  ) : packWords.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 text-sm">No words in this pack yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {packWords.map(w => (
                        <li key={w.word_id} className="flex items-center justify-between bg-white px-3 py-2 rounded-md border border-gray-100 shadow-sm">
                          <div className="truncate pr-2">
                            <span className="font-semibold text-gray-900 mr-2">{w.words_dim.greek_text}</span>
                            <span className="text-gray-500 text-xs">{w.words_dim.french_text}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveWord(w.word_id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-right text-xs text-gray-500 mt-2 font-medium">Total: {packWords.length} words</div>
              </div>
            </div>
          )}

          {pack.is_smart && !pack.is_auto && (
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm border border-blue-100">
              <p className="font-semibold mb-1">Smart Pack</p>
              <p>Words are dynamically matched based on the filters you set during creation. You cannot manually add or remove individual words here.</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-between items-center">
          <button
            onClick={handleDelete}
            disabled={isSaving}
            className="px-4 py-2 text-red-600 font-semibold hover:bg-red-50 rounded-lg transition"
          >
            Delete Pack
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 font-semibold bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 text-white font-semibold bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-2 shadow-sm"
            >
              {isSaving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
              ) : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
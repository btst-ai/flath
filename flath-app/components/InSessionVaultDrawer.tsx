"use client";

import { useEffect, useState, useCallback } from "react";
import { X, AlertTriangle, Edit2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { markWordAsMistake } from "@/app/actions/session";
import { normalizeForSearch } from "@/lib/normalize";
import { EditWordModal } from "@/components/EditWordModal";

interface InSessionVaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

interface LibraryRow {
  word_id: string;
  words_dim: {
    id: string;
    greek_text: string;
    french_text: string;
    theme: string | null;
    part_of_speech: string | null;
    frequency_rank: number;
  };
}

export function InSessionVaultDrawer({ isOpen, onClose, userId }: InSessionVaultDrawerProps) {
  const [library, setLibrary] = useState<LibraryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingWord, setEditingWord] = useState<any | null>(null);
  const [mistakeInFlight, setMistakeInFlight] = useState<string | null>(null);

  const fetchLibrary = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from("user_word_settings")
      .select("word_id, words_dim (*)")
      .eq("user_id", userId)
      .eq("is_archived", false);

    if (error) {
      console.error("[InSessionVaultDrawer] fetch failed", error);
      toast.error(`Could not load library: ${error.message}`);
    } else {
      // Supabase typed client returns words_dim as an array for to-one joins;
      // cast through unknown and normalise to a flat object per row.
      const rows: LibraryRow[] = ((data || []) as unknown as any[])
        .map((r: any) => ({
          word_id: r.word_id,
          words_dim: Array.isArray(r.words_dim) ? r.words_dim[0] : r.words_dim,
        }))
        .filter((r: any) => r.words_dim != null);
      setLibrary(rows);
    }

    setIsLoading(false);
  }, [userId]);

  // Fetch when drawer opens; clear search on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      fetchLibrary();
    }
  }, [isOpen, fetchLibrary]);

  const handleMarkMistake = async (row: LibraryRow) => {
    if (!userId) return;
    setMistakeInFlight(row.word_id);
    const result = await markWordAsMistake(userId, row.word_id, "rec");
    setMistakeInFlight(null);
    if ("error" in result) {
      toast.error(`Could not mark as mistake: ${result.error}`);
    } else {
      toast.success(`"${row.words_dim.greek_text}" marked as a mistake`);
      // No refetch needed: markWordAsMistake does not change is_archived, and
      // the drawer rows display only greek_text/french_text/theme — none of which
      // are updated by a mistake tag. EditWordModal's onSuccess still calls
      // fetchLibrary() because edits can change displayed fields.
    }
  };

  // Filter list client-side
  const normalizedQuery = normalizeForSearch(searchQuery.trim());
  const filteredLibrary = normalizedQuery
    ? library.filter((row) => {
        const g = normalizeForSearch(row.words_dim.greek_text ?? "");
        const f = normalizeForSearch(row.words_dim.french_text ?? "");
        return g.includes(normalizedQuery) || f.includes(normalizedQuery);
      })
    : library;

  // Prevent background scroll while drawer is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Translucent backdrop — click to close */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Slide-over panel — full-width on mobile, max-w-md on desktop */}
      <div
        className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="In-session vault"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">My Library</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Close vault drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Greek or French…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredLibrary.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {normalizedQuery ? "No words match your search." : "Your library is empty."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredLibrary.map((row) => (
                <li
                  key={row.word_id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {/* Word info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 font-serif text-base">
                        {row.words_dim.greek_text}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">·</span>
                      <span className="text-gray-600 dark:text-gray-300 text-sm truncate">
                        {row.words_dim.french_text}
                      </span>
                    </div>
                    {row.words_dim.theme && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {row.words_dim.theme}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Edit */}
                    <button
                      onClick={() => setEditingWord(row.words_dim)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                      title="Edit word"
                      aria-label={`Edit ${row.words_dim.greek_text}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Add a Mistake */}
                    <button
                      onClick={() => handleMarkMistake(row)}
                      disabled={mistakeInFlight === row.word_id}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-full transition-colors disabled:opacity-40"
                      title="Add a Mistake"
                      aria-label={`Mark ${row.words_dim.greek_text} as a mistake`}
                    >
                      {mistakeInFlight === row.word_id ? (
                        <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer — word count */}
        {!isLoading && filteredLibrary.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 shrink-0">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              {filteredLibrary.length} word{filteredLibrary.length !== 1 ? "s" : ""}
              {normalizedQuery ? " matching" : " in your library"}
            </p>
          </div>
        )}
      </div>

      {/* EditWordModal — drawer owns its own instance */}
      <EditWordModal
        isOpen={!!editingWord}
        onClose={() => setEditingWord(null)}
        word={editingWord}
        onSuccess={() => {
          setEditingWord(null);
          fetchLibrary();
        }}
      />
    </>
  );
}

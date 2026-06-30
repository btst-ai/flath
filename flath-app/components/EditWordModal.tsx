"use client";

import { useState, useEffect, useRef } from "react";
import { X, Lock } from "lucide-react";
import { toast } from "sonner";
import { TickButton } from "@/components/TickButton";
import { supabase } from "@/lib/supabase";
import { POS_VALUES, PosValue, coercePos, normalizeForSearch } from "@/lib/normalize";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export function getDifficultyFromRank(rank: number) {
  if (rank >= 1 && rank <= 1000) return "easy";
  if (rank >= 1001 && rank <= 3000) return "medium";
  if (rank >= 3001 && rank <= 6000) return "hard";
  return "niche";
}

export function getRankFromDifficulty(diff: string) {
  if (diff === "easy") return 500;
  if (diff === "medium") return 2000;
  if (diff === "hard") return 4500;
  return 8000;
}

interface EditWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  word: any | null; // words_dim object
  onSuccess: () => void;
}

export function EditWordModal({ isOpen, onClose, word, onSuccess }: EditWordModalProps) {
  const [greekText, setGreekText] = useState("");
  const [frenchText, setFrenchText] = useState("");
  const [theme, setTheme] = useState("");
  const [pos, setPos] = useState<PosValue>("Nom");
  const [difficulty, setDifficulty] = useState<string>("");

  const [availableThemes, setAvailableThemes] = useState<string[]>([]);
  const [showThemeSuggestions, setShowThemeSuggestions] = useState(false);
  const themeInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { isAdmin } = useIsAdmin();

  useFocusTrap(panelRef, isOpen);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (isOpen) {
      supabase.from("words_dim").select("theme").not("theme", "is", null).neq("theme", "").then(({ data }) => {
        if (data) {
          setAvailableThemes(Array.from(new Set(data.map(d => d.theme))).sort() as string[]);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (word && isOpen) {
      setGreekText(word.greek_text || "");
      setFrenchText(word.french_text || "");
      setTheme(word.theme || "");
      setPos(coercePos(word.part_of_speech));
      setDifficulty(getDifficultyFromRank(word.frequency_rank ?? 8001));
    }
  }, [word, isOpen]);

  if (!isOpen || !word) return null;

  // A user can edit if they own the word or are an admin.
  // Global system words have created_by_user_id = null — only admins can edit them.
  const canEdit = isAdmin || (currentUserId !== null && word.created_by_user_id === currentUserId);

  const handleSave = async (): Promise<boolean> => {
    const { error, data } = await supabase
      .from("words_dim")
      .update({
        greek_text: greekText.trim(),
        french_text: frenchText.trim(),
        theme: theme.trim(),
        part_of_speech: pos.trim(),
        frequency_rank: getRankFromDifficulty(difficulty),
      })
      .eq("id", word.id)
      .select();

    if (error) {
      toast.error(`Failed to save: ${error.message}`);
      return false;
    } else if (!data || data.length === 0) {
      toast.error(`Failed to save. You may not have permission to edit this word.`);
      return false;
    }
    return true;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit word"
        className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">Edit Word</h2>
            {!canEdit && (
              <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                <Lock className="w-3 h-3" /> Read-only
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition" aria-label="Close dialog">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div lang="el">
            <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Greek Word</label>
            <input
              type="text"
              lang="el"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={greekText}
              onChange={(e) => setGreekText(e.target.value)}
              disabled={!canEdit}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-serif text-lg disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="e.g., η γυναίκα"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Translation</label>
            <input
              type="text"
              lang="fr"
              value={frenchText}
              onChange={(e) => setFrenchText(e.target.value)}
              disabled={!canEdit}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="e.g., voter"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Theme</label>
              <input
                ref={themeInputRef}
                type="text"
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value);
                  setShowThemeSuggestions(true);
                }}
                onFocus={() => setShowThemeSuggestions(true)}
                onBlur={() => {
                  // Delay hiding so clicks on suggestions register
                  setTimeout(() => setShowThemeSuggestions(false), 200);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    const filtered = availableThemes.filter(t => normalizeForSearch(t).includes(normalizeForSearch(theme)) && normalizeForSearch(t) !== normalizeForSearch(theme));
                    if (filtered.length > 0 && theme.length > 0) {
                      e.preventDefault();
                      setTheme(filtered[0]);
                      setShowThemeSuggestions(false);
                    }
                  }
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder="e.g., Geopolitics"
              />
              {showThemeSuggestions && (
                (() => {
                  const filtered = theme.length === 0
                    ? availableThemes
                    : availableThemes.filter(t => normalizeForSearch(t).includes(normalizeForSearch(theme)) && normalizeForSearch(t) !== normalizeForSearch(theme));
                  if (filtered.length === 0) return null;
                  return (
                    <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filtered.map(t => (
                        <li 
                          key={t}
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevent input blur
                            setTheme(t);
                            setShowThemeSuggestions(false);
                          }}
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-gray-700 text-sm transition"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                  );
                })()
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Part of Speech</label>
              <select
                value={pos}
                onChange={(e) => setPos(e.target.value as PosValue)}
                disabled={!canEdit}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {POS_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              disabled={!canEdit}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="easy">Easy (Top 1–1,000)</option>
              <option value="medium">Medium (1,001–3,000)</option>
              <option value="hard">Hard (3,001–6,000)</option>
              <option value="niche">Niche (&gt;6,000)</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Cancel
            </button>
            {canEdit ? (
              <TickButton
                onAction={handleSave}
                onDone={() => { onSuccess(); onClose(); }}
                className="px-5 py-2.5 text-white font-semibold bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center justify-center gap-2"
                spinnerClassName="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
              >
                Save Changes
              </TickButton>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-gray-400">
                <Lock className="w-4 h-4" /> Only the owner or an admin can edit this word
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

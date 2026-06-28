"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAddWord } from "@/hooks/useAddWord";
import { ConflictResolutionModal } from "@/components/ConflictResolutionModal";
import { POS_VALUES, normalizeForSearch } from "@/lib/normalize";
import { markWordAsMistake } from "@/app/actions/session";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface AddWordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddWordModal({ isOpen, onClose }: AddWordModalProps) {
  const [greekText, setGreekText] = useState("");
  const [frenchText, setFrenchText] = useState("");
  const [theme, setTheme] = useState("");
  const [pos, setPos] = useState("Nom");
  const [addMistake, setAddMistake] = useState(true);
  const [availableThemes, setAvailableThemes] = useState<string[]>([]);
  const [showThemeSuggestions, setShowThemeSuggestions] = useState(false);
  const themeInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { addWords, isAdding, conflictState } = useAddWord();

  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (isOpen) {
      supabase.from("words_dim").select("theme").not("theme", "is", null).neq("theme", "").then(({ data }) => {
        if (data) {
          setAvailableThemes(Array.from(new Set(data.map(d => d.theme))).sort() as string[]);
        }
      });
    }
  }, [isOpen]);

  const handleClose = () => {
    setGreekText("");
    setFrenchText("");
    setTheme("");
    setPos("Nom");
    setAddMistake(true);
    onClose();
  };

  const handleSave = async () => {
    if (!greekText.trim() || !frenchText.trim()) return;
    const result = await addWords([{
      greek_text: greekText.trim(),
      french_text: frenchText.trim(),
      theme: theme.trim() || "General",
      part_of_speech: pos.trim(),
    }]);
    if (addMistake && result && result.stats.length > 0) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (userId) {
        for (const stat of result.stats) {
          const res = await markWordAsMistake(userId, stat.id);
          if ("error" in res) {
            toast.error(`Could not tag as mistake: ${res.error}`);
          }
        }
      }
    }
    handleClose();
  };

  if (!isOpen) return null;

  const themeSuggestions = theme.length === 0
    ? availableThemes
    : availableThemes.filter(t => normalizeForSearch(t).includes(normalizeForSearch(theme)) && normalizeForSearch(t) !== normalizeForSearch(theme));

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Add a word"
          className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200"
        >
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900">Add Word</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition" aria-label="Close dialog">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div lang="el">
              <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Greek Word *</label>
              <input
                autoFocus
                type="text"
                lang="el"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={greekText}
                onChange={(e) => setGreekText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-serif text-lg"
                placeholder="e.g., η γυναίκα"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Translation *</label>
              <input
                type="text"
                lang="fr"
                value={frenchText}
                onChange={(e) => setFrenchText(e.target.value.toLowerCase())}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder="e.g., la femme"
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
                  onBlur={() => setTimeout(() => setShowThemeSuggestions(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === "Tab") {
                      const filtered = availableThemes.filter(t => normalizeForSearch(t).includes(normalizeForSearch(theme)) && normalizeForSearch(t) !== normalizeForSearch(theme));
                      if (filtered.length > 0 && theme.length > 0) {
                        e.preventDefault();
                        setTheme(filtered[0]);
                        setShowThemeSuggestions(false);
                      }
                    }
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="General"
                />
                {showThemeSuggestions && themeSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {themeSuggestions.map(t => (
                      <li
                        key={t}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setTheme(t);
                          setShowThemeSuggestions(false);
                        }}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-gray-700 text-sm transition"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Part of Speech</label>
                <select
                  value={pos}
                  onChange={(e) => setPos(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white"
                >
                  {POS_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="add-mistake-checkbox"
                type="checkbox"
                checked={addMistake}
                onChange={(e) => setAddMistake(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="add-mistake-checkbox" className="text-sm text-gray-700 cursor-pointer select-none">
                Add a mistake
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-5 py-2.5 text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isAdding || !greekText.trim() || !frenchText.trim()}
                className="px-5 py-2.5 text-white font-semibold bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Word"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConflictResolutionModal
        isOpen={conflictState.isOpen}
        existingWord={conflictState.existingWord}
        newWord={conflictState.newWord}
        onResolve={conflictState.onResolve}
        onClose={conflictState.onClose}
      />
    </>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getRankFromDifficulty } from "./EditWordModal";

interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWordIds: string[];
  onSuccess: () => void;
}

export function BatchEditModal({ isOpen, onClose, selectedWordIds, onSuccess }: BatchEditModalProps) {
  const [theme, setTheme] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const [availableThemes, setAvailableThemes] = useState<string[]>([]);
  const [showThemeSuggestions, setShowThemeSuggestions] = useState(false);
  const themeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTheme("");
      setDifficulty("");
      supabase.from("words_dim").select("theme").not("theme", "is", null).neq("theme", "").then(({ data }) => {
        if (data) {
          setAvailableThemes(Array.from(new Set(data.map(d => d.theme))).sort() as string[]);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen || selectedWordIds.length === 0) return null;

  const handleSave = async () => {
    if (!theme && !difficulty) {
      toast.error("Please enter a new theme or difficulty to update.");
      return;
    }

    setIsSaving(true);
    const updates: any = {};
    if (theme) updates.theme = theme.trim();
    if (difficulty) updates.frequency_rank = getRankFromDifficulty(difficulty);

    const { error, data } = await supabase
      .from("words_dim")
      .update(updates)
      .in("id", selectedWordIds)
      .select();

    setIsSaving(false);

    if (error) {
      toast.error(`Failed to update words: ${error.message}`);
    } else if (!data || data.length === 0) {
      toast.error(`Update failed. You may not have permission to edit these words.`);
    } else {
      toast.success(`${data.length} words updated successfully!`);
      if (data.length < selectedWordIds.length) {
        toast.info(`${selectedWordIds.length - data.length} words were not updated due to permissions.`);
      }
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Batch Edit ({selectedWordIds.length} words)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500 mb-4">
            Leave a field empty if you do not want to change it.
          </p>

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
                setTimeout(() => setShowThemeSuggestions(false), 200);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  const filtered = availableThemes.filter(t => t.toLowerCase().includes(theme.toLowerCase()) && t.toLowerCase() !== theme.toLowerCase());
                  if (filtered.length > 0 && theme.length > 0) {
                    e.preventDefault();
                    setTheme(filtered[0]);
                    setShowThemeSuggestions(false);
                  }
                }
              }}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="e.g., Geopolitics (leave empty to keep current)"
            />
            {showThemeSuggestions && (
              (() => {
                const filtered = theme.length === 0
                  ? availableThemes
                  : availableThemes.filter(t => t.toLowerCase().includes(theme.toLowerCase()) && t.toLowerCase() !== theme.toLowerCase());
                if (filtered.length === 0) return null;
                return (
                  <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filtered.map(t => (
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
                );
              })()
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Difficulty (Frequency)</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white"
            >
              <option value="">(Leave empty to keep current)</option>
              <option value="easy">Easy (Top 1-1,000)</option>
              <option value="medium">Medium (1,001-3,000)</option>
              <option value="hard">Hard (3,001-6,000)</option>
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
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 text-white font-semibold bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Words"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { TickButton } from "@/components/TickButton";
import { supabase } from "@/lib/supabase";
import { POS_VALUES, coercePos } from "@/lib/normalize";
import { renameOrMergeTheme } from "@/app/actions/words";
import { getDifficultyFromRank } from "@/components/EditWordModal";

export interface ImportedWord {
  id: string;
  greek_text: string;
  french_text: string;
  theme: string;
  part_of_speech: string;
  frequency_rank: number;
}

interface ImportSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  words: ImportedWord[];
  onRefresh: () => void;
}

const DIFF_LABELS: Record<string, string> = {
  easy: "Débutant",
  medium: "Intermédiaire",
  hard: "Avancé",
  niche: "Niche",
};
const DIFF_ORDER = ["easy", "medium", "hard", "niche"];

function buildMatrix(words: ImportedWord[], themes: string[]) {
  const matrix: Record<string, Record<string, ImportedWord[]>> = {};
  for (const diff of DIFF_ORDER) {
    matrix[diff] = {};
    for (const theme of themes) {
      matrix[diff][theme] = [];
    }
  }
  for (const w of words) {
    const diff = getDifficultyFromRank(w.frequency_rank > 0 ? w.frequency_rank : 99999);
    const theme = w.theme || "No Theme";
    if (!matrix[diff]) matrix[diff] = {};
    if (!matrix[diff][theme]) matrix[diff][theme] = [];
    matrix[diff][theme].push(w);
  }
  return matrix;
}

export function ImportSummaryModal({ isOpen, onClose, words, onRefresh }: ImportSummaryModalProps) {
  const [localWords, setLocalWords] = useState<ImportedWord[]>(words);
  const [expandedCell, setExpandedCell] = useState<{ diff: string; theme: string } | null>(null);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, Partial<ImportedWord>>>({});

  // Theme rename/merge
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");

  // Re-sync local state when words prop changes (e.g. on open)
  const syncedWords = localWords.length === 0 && words.length > 0 ? words : localWords;

  const themes = Array.from(new Set(syncedWords.map(w => w.theme || "No Theme"))).sort();
  const matrix = buildMatrix(syncedWords, themes);

  if (!isOpen) return null;

  const toggleCell = (diff: string, theme: string) => {
    if (expandedCell?.diff === diff && expandedCell?.theme === theme) {
      setExpandedCell(null);
    } else {
      setExpandedCell({ diff, theme });
    }
  };

  const startEdit = (word: ImportedWord) => {
    setEditingWordId(word.id);
    setEditState(prev => ({ ...prev, [word.id]: { ...word } }));
  };

  const saveEdit = async (wordId: string): Promise<boolean> => {
    const updates = editState[wordId];
    if (!updates) return false;

    const { error } = await supabase
      .from("words_dim")
      .update({
        greek_text: updates.greek_text?.trim(),
        french_text: updates.french_text?.trim(),
        part_of_speech: coercePos(updates.part_of_speech),
        theme: updates.theme?.trim() || "General",
      })
      .eq("id", wordId);

    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return false;
    }

    setLocalWords(prev => prev.map(w =>
      w.id === wordId
        ? { ...w, ...updates, part_of_speech: coercePos(updates.part_of_speech), theme: updates.theme?.trim() || "General" }
        : w
    ));
    onRefresh();
    return true;
  };

  const handleRenameTheme = async (): Promise<boolean> => {
    if (!renameFrom || !renameTo.trim()) return false;
    const ids = syncedWords.filter(w => (w.theme || "No Theme") === renameFrom).map(w => w.id);
    if (ids.length === 0) return false;
    const result = await renameOrMergeTheme(ids, renameFrom, renameTo.trim());
    if ("error" in result) {
      toast.error(`Rename failed: ${result.error}`);
      return false;
    }
    setLocalWords(prev => prev.map(w => w.theme === renameFrom ? { ...w, theme: renameTo.trim() } : w));
    setRenameFrom("");
    setRenameTo("");
    onRefresh();
    return true;
  };

  const handleMergeTheme = async (): Promise<boolean> => {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) return false;
    const ids = syncedWords.filter(w => (w.theme || "No Theme") === mergeFrom).map(w => w.id);
    if (ids.length === 0) return false;
    const result = await renameOrMergeTheme(ids, mergeFrom, mergeTo);
    if ("error" in result) {
      toast.error(`Merge failed: ${result.error}`);
      return false;
    }
    setLocalWords(prev => prev.map(w => w.theme === mergeFrom ? { ...w, theme: mergeTo } : w));
    setMergeFrom("");
    setMergeTo("");
    onRefresh();
    return true;
  };

  const unmatched = syncedWords.filter(w => w.frequency_rank >= 8000 && w.greek_text);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">
            Import Complete — {syncedWords.length} words
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Theme management toolbar */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Rename theme</p>
              <div className="flex gap-2 items-center">
                <select
                  value={renameFrom}
                  onChange={e => setRenameFrom(e.target.value)}
                  className="flex-1 p-2 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Select theme...</option>
                  {themes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-gray-400 text-sm">→</span>
                <input
                  type="text"
                  value={renameTo}
                  onChange={e => setRenameTo(e.target.value)}
                  placeholder="New name"
                  className="flex-1 p-2 text-sm border border-gray-300 rounded-lg"
                />
                <TickButton
                  onAction={handleRenameTheme}
                  disabled={!renameFrom || !renameTo.trim()}
                  className="px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center"
                >
                  Apply
                </TickButton>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Merge theme into another</p>
              <div className="flex gap-2 items-center">
                <select
                  value={mergeFrom}
                  onChange={e => setMergeFrom(e.target.value)}
                  className="flex-1 p-2 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Source...</option>
                  {themes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-gray-400 text-sm">→</span>
                <select
                  value={mergeTo}
                  onChange={e => setMergeTo(e.target.value)}
                  className="flex-1 p-2 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Target...</option>
                  {themes.filter(t => t !== mergeFrom).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <TickButton
                  onAction={handleMergeTheme}
                  disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo}
                  className="px-3 py-2 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center"
                >
                  Merge
                </TickButton>
              </div>
            </div>
          </div>

          {/* Matrix */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-3 bg-gray-50 border border-gray-200 text-gray-500 font-semibold text-xs uppercase tracking-wider w-32">
                    Level
                  </th>
                  {themes.map(theme => (
                    <th key={theme} className="p-3 bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-xs text-center max-w-[120px] truncate">
                      {theme}
                    </th>
                  ))}
                  <th className="p-3 bg-gray-50 border border-gray-200 text-gray-500 font-semibold text-xs text-center">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {DIFF_ORDER.map(diff => {
                  const rowTotal = themes.reduce((s, t) => s + (matrix[diff]?.[t]?.length ?? 0), 0);
                  if (rowTotal === 0) return null;
                  return [
                    <tr key={diff}>
                      <td className="p-3 border border-gray-200 font-semibold text-gray-700 bg-gray-50">
                        {DIFF_LABELS[diff]}
                      </td>
                      {themes.map(theme => {
                        const cellWords = matrix[diff]?.[theme] ?? [];
                        const count = cellWords.length;
                        const isExpanded = expandedCell?.diff === diff && expandedCell?.theme === theme;
                        return (
                          <td
                            key={theme}
                            onClick={() => count > 0 && toggleCell(diff, theme)}
                            className={`p-3 border border-gray-200 text-center ${count > 0 ? "cursor-pointer hover:bg-blue-50" : "text-gray-300"} ${isExpanded ? "bg-blue-50" : ""}`}
                          >
                            {count > 0 ? (
                              <span className="flex items-center justify-center gap-1">
                                <span className="font-semibold">{count}</span>
                                {isExpanded
                                  ? <ChevronDown className="w-3 h-3 text-blue-500" />
                                  : <ChevronRight className="w-3 h-3 text-gray-400" />}
                              </span>
                            ) : "—"}
                          </td>
                        );
                      })}
                      <td className="p-3 border border-gray-200 text-center font-semibold text-gray-600 bg-gray-50">
                        {rowTotal}
                      </td>
                    </tr>,
                    // Expanded drawer row
                    expandedCell?.diff === diff ? (
                      <tr key={`${diff}-drawer`}>
                        <td colSpan={themes.length + 2} className="p-0 border border-gray-200 bg-blue-50/40">
                          <div className="p-4">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-200">
                                  <th className="text-left pb-2 pr-3">Greek</th>
                                  <th className="text-left pb-2 pr-3">French</th>
                                  <th className="text-left pb-2 pr-3">PoS</th>
                                  <th className="text-left pb-2 pr-3">Theme</th>
                                  <th className="pb-2"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {(matrix[expandedCell.diff]?.[expandedCell.theme] ?? []).map(w => {
                                  const isEditing = editingWordId === w.id;
                                  const draft = editState[w.id] ?? w;
                                  return (
                                    <tr key={w.id} className="border-b border-gray-100 last:border-0">
                                      <td className="py-1.5 pr-3">
                                        {isEditing ? (
                                          <input
                                            lang="el"
                                            value={draft.greek_text ?? ""}
                                            onChange={e => setEditState(p => ({ ...p, [w.id]: { ...p[w.id], greek_text: e.target.value } }))}
                                            className="w-full p-1 border border-blue-300 rounded text-xs font-serif"
                                          />
                                        ) : (
                                          <span className="font-serif">{w.greek_text}</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-3">
                                        {isEditing ? (
                                          <input
                                            lang="fr"
                                            value={draft.french_text ?? ""}
                                            onChange={e => setEditState(p => ({ ...p, [w.id]: { ...p[w.id], french_text: e.target.value } }))}
                                            className="w-full p-1 border border-blue-300 rounded text-xs"
                                          />
                                        ) : (
                                          w.french_text
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-3">
                                        {isEditing ? (
                                          <select
                                            value={draft.part_of_speech ?? "Autre"}
                                            onChange={e => setEditState(p => ({ ...p, [w.id]: { ...p[w.id], part_of_speech: e.target.value } }))}
                                            className="p-1 border border-blue-300 rounded text-xs bg-white"
                                          >
                                            {POS_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                                          </select>
                                        ) : (
                                          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{w.part_of_speech || "Autre"}</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-3">
                                        {isEditing ? (
                                          <input
                                            value={draft.theme ?? ""}
                                            onChange={e => setEditState(p => ({ ...p, [w.id]: { ...p[w.id], theme: e.target.value } }))}
                                            className="w-full p-1 border border-blue-300 rounded text-xs"
                                          />
                                        ) : (
                                          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{w.theme || "—"}</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 text-right whitespace-nowrap">
                                        {isEditing ? (
                                          <div className="flex gap-1 justify-end">
                                            <TickButton
                                              onAction={() => saveEdit(w.id)}
                                              onDone={() => setEditingWordId(null)}
                                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 flex items-center justify-center"
                                            >
                                              Save
                                            </TickButton>
                                            <button
                                              onClick={() => setEditingWordId(null)}
                                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => startEdit(w)}
                                            className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                                          >
                                            Edit
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null
                  ];
                })}
                {/* Column totals */}
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200 font-semibold text-gray-500 text-xs uppercase">Total</td>
                  {themes.map(theme => {
                    const total = DIFF_ORDER.reduce((s, d) => s + (matrix[d]?.[theme]?.length ?? 0), 0);
                    return (
                      <td key={theme} className="p-3 border border-gray-200 text-center font-semibold text-gray-700">
                        {total || "—"}
                      </td>
                    );
                  })}
                  <td className="p-3 border border-gray-200 text-center font-bold text-gray-900">
                    {syncedWords.length}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Unmatched frequency footnote */}
          {unmatched.length > 0 && (
            <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <strong>{unmatched.length} word(s)</strong> were not found in the frequency list and defaulted to rank 8000 (Niche).
              {unmatched.length <= 10 && (
                <span> Words: {unmatched.map(w => w.greek_text).join(", ")}</span>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-center">
            <button
              onClick={onClose}
              className="px-8 py-2.5 text-white font-semibold bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

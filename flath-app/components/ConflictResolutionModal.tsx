"use client";

import { X } from "lucide-react";

interface WordData {
  greek_text: string;
  french_text: string;
  part_of_speech: string;
  theme: string;
}

interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingWord: WordData | null;
  newWord: WordData | null;
  onResolve: (decision: "keep" | "overwrite") => void;
}

export function ConflictResolutionModal({
  isOpen,
  onClose,
  existingWord,
  newWord,
  onResolve,
}: ConflictModalProps) {
  if (!isOpen || !existingWord || !newWord) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Word Already Exists</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-6">
            The word <span className="font-semibold text-gray-900">"{newWord.greek_text}"</span> already exists in the global dictionary. Do you want to keep the existing translation and theme, or overwrite them with yours?
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Existing Data */}
            <div className="border rounded-xl p-4 bg-gray-50 border-gray-200">
              <div className="text-xs font-bold text-gray-500 uppercase mb-3">Existing (Global)</div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-gray-400">Translation</div>
                  <div className="font-medium">{existingWord.french_text}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Theme</div>
                  <div className="font-medium">{existingWord.theme || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Part of Speech</div>
                  <div className="font-medium">{existingWord.part_of_speech || "—"}</div>
                </div>
              </div>
              <button
                onClick={() => onResolve("keep")}
                className="mt-6 w-full py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Keep Existing
              </button>
            </div>

            {/* New Data */}
            <div className="border rounded-xl p-4 bg-white border-gray-200 shadow-sm">
              <div className="text-xs font-bold text-blue-500 uppercase mb-3">Your Version</div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-gray-400">Translation</div>
                  <div className="font-medium">{newWord.french_text}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Theme</div>
                  <div className="font-medium">{newWord.theme || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Part of Speech</div>
                  <div className="font-medium">{newWord.part_of_speech || "—"}</div>
                </div>
              </div>
              <button
                onClick={() => onResolve("overwrite")}
                className="mt-6 w-full py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                Overwrite Global
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { X } from "lucide-react";

interface ImportSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  byTheme: Record<string, number>;
  byDifficulty: Record<string, number>;
}

export function ImportSummaryModal({ isOpen, onClose, total, byTheme, byDifficulty }: ImportSummaryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Import Complete</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
              <span className="text-2xl font-bold">{total}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Words Successfully Added</h3>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Theme Breakdown */}
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">By Theme</h4>
              <ul className="space-y-2">
                {Object.entries(byTheme).sort((a, b) => b[1] - a[1]).map(([theme, count]) => (
                  <li key={theme} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 truncate pr-2">{theme}</span>
                    <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{count}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Difficulty Breakdown */}
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">By Difficulty</h4>
              <ul className="space-y-2">
                {["easy", "medium", "hard", "niche"].map(diff => {
                  const count = byDifficulty[diff];
                  if (!count) return null;
                  
                  let badgeClass = "bg-gray-100 text-gray-700";
                  if (diff === 'easy') badgeClass = "bg-green-100 text-green-700";
                  if (diff === 'medium') badgeClass = "bg-yellow-100 text-yellow-700";
                  if (diff === 'hard') badgeClass = "bg-orange-100 text-orange-700";
                  if (diff === 'niche') badgeClass = "bg-red-100 text-red-700";

                  return (
                    <li key={diff} className="flex justify-between items-center text-sm">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${badgeClass}`}>
                        {diff}
                      </span>
                      <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="pt-4 flex justify-center">
            <button
              onClick={onClose}
              className="w-full px-5 py-2.5 text-white font-semibold bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              Awesome!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
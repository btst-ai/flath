// Frequency lookup table built from /public/datasets/el_50k.txt.
// File format: one "<word> <raw_count>" per line, ordered by frequency.
// Line N (1-indexed) = rank N.
//
// For CSV import with "Frequency Rank = Matched":
//   1. Strip a leading Greek article from the cell value (η γυναίκα -> γυναίκα).
//   2. Split on whitespace/comma/slash and take the first token
//      (handles verb pairs like "τρώω, έφαγα" — we only look up the present form).
//   3. Look up the token in this map; use the rank if found, fall back to 8000.

const GREEK_ARTICLES = new Set([
  "ο","η","το","οι","τα","τον","την","τους","τις","του","της","των"
]);

let cached: Promise<Map<string, number>> | null = null;

export function loadFrequencyMap(): Promise<Map<string, number>> {
  if (cached) return cached;
  cached = (async () => {
    const res = await fetch("/datasets/el_50k.txt");
    if (!res.ok) throw new Error(`Failed to load frequency list: ${res.status}`);
    const text = await res.text();
    const map = new Map<string, number>();
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const word = lines[i].split(/\s+/)[0]?.trim().toLowerCase();
      if (word) map.set(word, i + 1);
    }
    return map;
  })();
  return cached;
}

export function extractLookupToken(greekText: string): string {
  const trimmed = greekText.trim().toLowerCase();
  // Split on whitespace, comma, or slash
  const tokens = trimmed.split(/[\s,/]+/).filter(Boolean);
  // Strip a leading article if present
  if (tokens.length >= 2 && GREEK_ARTICLES.has(tokens[0])) {
    return tokens[1];
  }
  return tokens[0] ?? trimmed;
}

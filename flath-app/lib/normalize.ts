export function normalizeForSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export const POS_VALUES = [
  "Nom",
  "Verbe",
  "Adjectif",
  "Adverbe",
  "Pronom",
  "Preposition",
  "Conjonction",
  "Interjection",
  "Phrase",
  "Autre",
] as const;

export type PosValue = typeof POS_VALUES[number];

export function coercePos(value: string | null | undefined): PosValue {
  const trimmed = (value ?? "").trim();
  if ((POS_VALUES as readonly string[]).includes(trimmed)) return trimmed as PosValue;
  return "Autre";
}

import { distance } from "fastest-levenshtein";

const DIACRITICS_RE = /[̀-ͯ]/g;
const COMMON_SUFFIXES = /\b(LTDA|ME|EIRELI|S\/?A|MEI|EPP)\.?\b/g;

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toUpperCase()
    .replace(COMMON_SUFFIXES, "")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns a similarity score in [0, 1], where 1 means identical after normalization. */
export function nameSimilarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const maxLength = Math.max(normA.length, normB.length);
  const editDistance = distance(normA, normB);
  return Math.max(0, 1 - editDistance / maxLength);
}

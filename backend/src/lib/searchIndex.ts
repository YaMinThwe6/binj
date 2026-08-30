// Local-first movie search index (hld.md §18's implementation note, api-contracts.md
// §1's GET /search/movies). Generates the Firestore-queryable search terms for a
// movie title at *index time* (movies.service.ts, refreshRecentMovies.ts,
// seedSearchCatalog.ts) — not recomputed per search — so a plain
// `titleSearchTerms array-contains-any <query words>` query can catch both
// exact/prefix matches and single-typo misspellings in one read.

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Titles are matched word-by-word, not as one long string — "The Dark Knight"
// is searchable by "dark" or "knight" alone, not just from the very start.
export function significantWords(title: string): string[] {
  return title
    .split(/\s+/)
    .map(normalizeWord)
    .filter((w) => w.length > 0);
}

export function wordPrefixes(word: string): string[] {
  const prefixes: string[] = [];
  for (let i = 1; i <= word.length; i++) prefixes.push(word.slice(0, i));
  return prefixes;
}

// Single-edit ("one typo") variants of a word: a missing letter (deletion), a
// wrong letter (substitution), or two adjacent letters swapped (transposition)
// — the three mistake shapes this was scoped to cover. Extra-letter (insertion)
// variants are deliberately left out: ~26x more variants per word for
// comparatively less real-world payoff, per the cost/complexity trade-off this
// was sized against before building.
export function typoVariants(word: string): string[] {
  if (word.length < 2) return [];
  const variants = new Set<string>();

  for (let i = 0; i < word.length; i++) {
    variants.add(word.slice(0, i) + word.slice(i + 1)); // deletion
  }
  for (let i = 0; i < word.length; i++) {
    for (const letter of ALPHABET) {
      if (letter === word[i]) continue;
      variants.add(word.slice(0, i) + letter + word.slice(i + 1)); // substitution
    }
  }
  for (let i = 0; i < word.length - 1; i++) {
    if (word[i] === word[i + 1]) continue; // swapping identical letters is a no-op
    variants.add(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)); // transposition
  }

  variants.delete(word); // the correct spelling itself is wordPrefixes' job, not this
  return [...variants];
}

// The full set of search terms stored on a movie doc's `titleSearchTerms`
// field: every word's real prefixes unioned with every word's single-typo
// variants, deduped into one flat array. One field, one array-contains-any
// query (movies.service.ts) catches both exact and typo'd queries at once —
// ranking which tier a given match came from happens afterward, in code,
// by checking whether the query word is a real prefix of the matched title.
export function buildSearchTerms(title: string): string[] {
  const terms = new Set<string>();
  for (const word of significantWords(title)) {
    for (const p of wordPrefixes(word)) terms.add(p);
    for (const v of typoVariants(word)) terms.add(v);
  }
  return [...terms];
}

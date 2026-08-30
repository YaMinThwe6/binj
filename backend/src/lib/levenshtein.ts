// Standard Levenshtein (edit) distance, classic O(n*m) DP table — small and
// well-known enough not to need a dependency for it (same "self-contained,
// no external library" call already made for geohash.ts). Used only as
// GET /search/movies' third-tier fallback (movies.service.ts): the rare case
// where neither the exact-prefix nor the precomputed-typo-variant Firestore
// lookups (searchIndex.ts) found anything — real-time scoring is fine there
// specifically because it only runs when the cheaper tiers already came up
// empty, not on every search.
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const currRow = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow.push(Math.min(currRow[j - 1] + 1, prevRow[j] + 1, prevRow[j - 1] + cost));
    }
    prevRow = currRow;
  }
  return prevRow[n];
}

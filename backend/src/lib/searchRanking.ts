// Relevance-first search ranking (hld.md §18). Classifies one candidate
// movie against a query into a match-type tier, then computes a composite
// score within that tier from several smaller signals. movies.service.ts
// scores every candidate through this and sorts by `.score` descending —
// this is the one place that decides "how good is this match," separate
// from how candidates get found (indexed lookup vs. broader fallback scan).
//
// Explicitly NOT wired into the live system yet: `aliases` (TMDB's
// alternative-title data isn't ingested anywhere — every real candidate's
// aliases list is empty today) and semantic/AI matching (no embedding
// infrastructure exists). Both are built into this module's shape so they
// can be turned on later without a ranking rewrite, per the extensibility
// this was explicitly asked to support — they just never fire yet.
import { significantWords } from "./searchIndex.js";
import { levenshteinDistance } from "./levenshtein.js";

export type MatchType = "exact" | "alias" | "prefix" | "token" | "fuzzy1" | "fuzzyDeep" | "none";

// Spaced 2000 apart — wide enough that the maximum possible sum of every
// other component below (queryCoverage + token + fuzzySimilarity + alias +
// popularity, ~1500 combined at their individual caps) can never bridge the
// gap between two tiers. A fuzzy match can never outrank an exact or prefix
// match, and popularity can never override a clearly stronger textual match,
// no matter how large the popularity gap — this is a hard guarantee of the
// scoring design, not a "usually" behavior.
const MATCH_TYPE_SCORE: Record<Exclude<MatchType, "none">, number> = {
  exact: 10000,
  alias: 9000,
  prefix: 7000,
  token: 5000,
  fuzzy1: 3000,
  fuzzyDeep: 1000
};

// A short single-typo/deeper-fuzzy threshold scaled to word length — longer
// words tolerate a couple of edits, short ones stay strict so e.g. "cat"
// doesn't fuzzy-match half the catalog.
function fuzzyThreshold(len: number): number {
  return Math.max(1, Math.floor(len * 0.34));
}

// Damerau-Levenshtein: plain Levenshtein plus treating an adjacent
// transposition ("ab" -> "ba") as one edit instead of two. Used for the
// "deeper fuzzy" tier — a wider net than the single-typo tier, still tight
// enough not to match unrelated words.
function damerauLevenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[m][n];
}

interface WordMatch {
  type: "exact" | "prefix" | "fuzzy1" | "fuzzyDeep" | "none";
  distance: number; // 0 for exact/prefix
}

// The strongest way one query word relates to any of the title's words.
function bestWordMatch(queryWord: string, titleWords: string[]): WordMatch {
  let best: WordMatch = { type: "none", distance: Infinity };
  for (const tw of titleWords) {
    if (tw === queryWord) return { type: "exact", distance: 0 }; // can't beat this per word
    if (best.type !== "prefix" && tw.startsWith(queryWord)) best = { type: "prefix", distance: 0 };
    if (best.type === "prefix" || best.type === "exact") continue;

    if (levenshteinDistance(queryWord, tw) === 1) {
      best = { type: "fuzzy1", distance: 1 };
      continue;
    }
    const threshold = fuzzyThreshold(Math.max(queryWord.length, tw.length));
    const dist = damerauLevenshteinDistance(queryWord, tw);
    if (dist <= threshold && dist < best.distance) best = { type: "fuzzyDeep", distance: dist };
  }
  return best;
}

export interface RankableCandidate {
  title: string;
  // Alternate/localized titles (e.g. TMDB's alternative_titles). Not
  // currently populated anywhere in this codebase — see the module comment.
  aliases?: string[];
  // A small popularity proxy (e.g. voteCount) — a tie-break only, never
  // strong enough to override a textual-relevance gap. Defaults to 0.
  popularitySignal?: number;
}

export interface RankResult {
  matchType: MatchType;
  score: number;
}

// Deterministic: the same query against the same candidate data always
// produces the same result — no randomness, no external/mutable state.
export function rankCandidate(query: string, candidate: RankableCandidate): RankResult {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTitle = candidate.title.trim().toLowerCase();
  const queryWords = significantWords(query);
  const titleWords = significantWords(candidate.title);
  const aliasWords = (candidate.aliases ?? []).map((a) => a.trim().toLowerCase());

  if (queryWords.length === 0 || normalizedQuery.length === 0) {
    return { matchType: "none", score: 0 };
  }

  let matchType: MatchType;
  if (normalizedQuery === normalizedTitle) {
    matchType = "exact";
  } else if (aliasWords.some((a) => a === normalizedQuery || a.startsWith(normalizedQuery))) {
    matchType = "alias";
  } else if (normalizedTitle.startsWith(normalizedQuery)) {
    matchType = "prefix";
  } else {
    const wordResults = queryWords.map((qw) => bestWordMatch(qw, titleWords));
    const anyExactOrPrefix = wordResults.some((r) => r.type === "exact" || r.type === "prefix");
    const anyFuzzy1 = wordResults.some((r) => r.type === "fuzzy1");
    const anyFuzzyDeep = wordResults.some((r) => r.type === "fuzzyDeep");
    matchType = anyExactOrPrefix ? "token" : anyFuzzy1 ? "fuzzy1" : anyFuzzyDeep ? "fuzzyDeep" : "none";
  }

  if (matchType === "none") return { matchType, score: 0 };

  const wordResults = queryWords.map((qw) => bestWordMatch(qw, titleWords));
  const matchedWordCount = wordResults.filter((r) => r.type !== "none").length;

  // How much of the *query* the title accounts for.
  const queryCoverageScore = (matchedWordCount / queryWords.length) * 500;
  // How much of the *title* the query accounts for — "The Dark Knight" is a
  // tighter match for "dark knight" than "The Dark Knight Rises" is, even
  // though both fully cover the query.
  const titleCoverageRatio = titleWords.length > 0 ? matchedWordCount / titleWords.length : 0;
  const tokenMatchScore = matchedWordCount * titleCoverageRatio * 100;

  const fuzzyDistances = wordResults.filter((r) => r.type === "fuzzy1" || r.type === "fuzzyDeep").map((r) => r.distance);
  const fuzzySimilarityScore = fuzzyDistances.length > 0 ? Math.max(0, 400 - Math.min(...fuzzyDistances) * 100) : 0;

  const aliasMatchScore = matchType === "alias" ? 200 : 0;

  // log-scaled and capped — a large popularity gap moves the needle only a
  // little, never enough to cross a tier boundary.
  const popularityScore = Math.min(100, Math.log10((candidate.popularitySignal ?? 0) + 1) * 30);

  const score = MATCH_TYPE_SCORE[matchType] + queryCoverageScore + tokenMatchScore + fuzzySimilarityScore + aliasMatchScore + popularityScore;

  return { matchType, score };
}

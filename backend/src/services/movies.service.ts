import type { MovieDetail, MovieSummary } from "@binj/shared-types";
import { db } from "../lib/firebaseAdmin.js";
import { fetchMovieDetails, searchMovies as tmdbSearchMovies, getRecentMovies as tmdbGetRecentMovies, type TmdbMovie } from "../lib/tmdb.js";
import { buildSearchTerms, significantWords } from "../lib/searchIndex.js";
import { rankCandidate } from "../lib/searchRanking.js";
import { AppError } from "../utils/AppError.js";

// A movie that's never been rated/liked has no reason to have binjRating/likeCount
// actually written in Firestore — this normalizes the response so the client never
// has to special-case "field is missing" vs. "field is zero".
function withRatingDefaults(data: FirebaseFirestore.DocumentData): MovieDetail {
  return {
    ...data,
    binjRating: data.binjRating ?? { sum: 0, count: 0 },
    likeCount: data.likeCount ?? 0
  } as MovieDetail;
}

// cache (not yet built, see docs/schema.md §28) → Firestore → TMDB, hld.md §2
export async function getMovieDetail(movieId: string): Promise<MovieDetail> {
  try {
    if (db) {
      const snap = await db.collection("movies").doc(movieId).get();
      if (snap.exists) {
        return withRatingDefaults(snap.data()!);
      }
    }

    const movie: TmdbMovie = await fetchMovieDetails(movieId);
    const { credits, ...movieDoc } = movie;

    if (db) {
      await db.collection("movies").doc(movieId).set({
        ...movieDoc,
        binjRating: { sum: 0, count: 0 },
        streamingLastFetched: new Date(),
        lastFetched: new Date(),
        // A movie discovered via detail view (someone opened it directly, not
        // via search) becomes locally searchable too — hld.md §18's local
        // index isn't only populated by searching.
        titleSearchTerms: buildSearchTerms(movieDoc.title)
      });

      // Upsert people/{personId} for everyone credited on this movie — lazy
      // "create on first need" ingestion, same as the movie itself (schema.md §1).
      const batch = db.batch();
      for (const person of credits) {
        const ref = db.collection("people").doc(person.personId);
        batch.set(
          ref,
          {
            name: person.name,
            photo: person.photo,
            knownForDepartment: person.knownForDepartment,
            popularity: person.popularity,
            lastFetched: new Date()
          },
          { merge: true }
        );
      }
      if (credits.length > 0) await batch.commit();
    }

    return withRatingDefaults(movieDoc);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("TMDB_UPSTREAM_ERROR", "Failed to fetch movie details", 502);
  }
}

// GET /movies/recent — powers the public Discover page's "recently released"
// section (the default browse-without-a-query view).
//
// Reads discover/recentMovies, refreshed periodically by
// scripts/refreshRecentMovies.ts (a real Cloud Scheduler job is the eventual
// upgrade path, same shortcut as §5b's taste matches) — falls back to a live
// TMDB call when that cache doc doesn't exist yet (before the script has ever
// run) or Firestore isn't configured, so this endpoint works either way
// rather than depending on the script having been run first.
export async function getRecentMoviesService(): Promise<{ items: MovieSummary[] }> {
  try {
    if (db) {
      const snap = await db.collection("discover").doc("recentMovies").get();
      if (snap.exists) {
        return { items: (snap.data()?.items as MovieSummary[] | undefined) ?? [] };
      }
    }
    const items = await tmdbGetRecentMovies();
    return { items };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("TMDB_UPSTREAM_ERROR", "Failed to fetch recent movies", 502);
  }
}

const MAX_QUERY_WORDS = 30; // Firestore's array-contains-any cap
const FALLBACK_CANDIDATE_LIMIT = 2000; // bounds the broader-scan tier at prototype scale
const RESULTS_TOP_N = 20;

function toMovieSummary(id: string, data: FirebaseFirestore.DocumentData): MovieSummary {
  return { movieId: id, title: data.title as string, poster: (data.poster as string | null) ?? null, year: (data.year as number | null) ?? null };
}

// Scores every candidate doc through searchRanking.ts's rankCandidate,
// drops non-matches (matchType "none" — a doc that only matched the
// Firestore array-contains-any lookup by coincidence, or a broader-scan
// candidate too far from the query to count), and sorts by score descending.
// The one ranking pass both tiers below share — only *how candidates get
// found* differs between them, not how good a match is judged to be.
function rankAndSort(query: string, docs: { id: string; data: FirebaseFirestore.DocumentData }[]): MovieSummary[] {
  return docs
    .map(({ id, data }) => ({
      id,
      data,
      // voteCount (present once a movie's been fully detail-ingested) stands
      // in for a popularity signal — a tie-break only, per searchRanking.ts's
      // own weighting, so a coarser proxy here doesn't skew results.
      ...rankCandidate(query, { title: data.title as string, popularitySignal: (data.voteCount as number | undefined) ?? 0 })
    }))
    .filter((r) => r.matchType !== "none")
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULTS_TOP_N)
    .map(({ id, data }) => toMovieSummary(id, data));
}

// Writes TMDB's live-search results into Firestore (lightweight — title/
// poster/year/titleSearchTerms, not a full detail-ingestion) so the same
// query resolves locally next time, without waiting for someone to open
// each result's detail page first.
async function upsertSearchable(items: MovieSummary[]): Promise<void> {
  if (!db || items.length === 0) return;
  const batch = db.batch();
  for (const item of items) {
    const ref = db.collection("movies").doc(item.movieId);
    batch.set(ref, { title: item.title, poster: item.poster, year: item.year, titleSearchTerms: buildSearchTerms(item.title) }, { merge: true });
  }
  await batch.commit();
}

// GET /search/movies — hld.md §18's local-first search index. Cheapest tier
// first, each one only runs if the previous tier found nothing, and both
// Firestore tiers rank candidates through the same searchRanking.ts pass
// (rankAndSort above):
//   1. Firestore titleSearchTerms array-contains-any <query words> — one
//      indexed lookup, catches exact/prefix/token matches and precomputed
//      single-typo variants (searchIndex.ts unions both into that field).
//   2. A broader scan of the local catalog (bounded — FALLBACK_CANDIDATE_LIMIT),
//      scored the same way — catches deeper-fuzzy matches the indexed lookup's
//      precomputed terms didn't cover. Only runs when tier 1 found nothing,
//      not on every search.
//   3. Live TMDB — only when even the local catalog has nothing close;
//      results get upserted into Firestore so this same query resolves
//      locally (tier 1) next time.
export async function searchMoviesService(query: string): Promise<{ items: MovieSummary[]; nextCursor: null }> {
  if (!query) {
    throw new AppError("MISSING_QUERY", "q query param is required", 400);
  }

  try {
    if (db) {
      const queryWords = significantWords(query).slice(0, MAX_QUERY_WORDS);
      if (queryWords.length > 0) {
        const snap = await db.collection("movies").where("titleSearchTerms", "array-contains-any", queryWords).get();
        if (!snap.empty) {
          const items = rankAndSort(
            query,
            snap.docs.map((d) => ({ id: d.id, data: d.data() }))
          );
          if (items.length > 0) return { items, nextCursor: null };
        }

        const broadSnap = await db.collection("movies").limit(FALLBACK_CANDIDATE_LIMIT).get();
        const fuzzyItems = rankAndSort(
          query,
          broadSnap.docs.map((d) => ({ id: d.id, data: d.data() }))
        );
        if (fuzzyItems.length > 0) {
          return { items: fuzzyItems, nextCursor: null };
        }
      }
    }

    const items = await tmdbSearchMovies(query);
    await upsertSearchable(items);
    return { items, nextCursor: null };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("TMDB_UPSTREAM_ERROR", "Failed to search movies", 502);
  }
}

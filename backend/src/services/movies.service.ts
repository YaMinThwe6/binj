import type { MovieDetail, MovieSummary } from "@binj/shared-types";
import { db } from "../lib/firebaseAdmin.js";
import { fetchMovieDetails, searchMovies as tmdbSearchMovies, getRecentMovies as tmdbGetRecentMovies, type TmdbMovie } from "../lib/tmdb.js";
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
        lastFetched: new Date()
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

// TMDB live search for now; §18's Vertex AI Search / Firestore word-prefix
// index is deferred until the movie-experience slice is stable.
export async function searchMoviesService(query: string): Promise<{ items: MovieSummary[]; nextCursor: null }> {
  if (!query) {
    throw new AppError("MISSING_QUERY", "q query param is required", 400);
  }

  try {
    const items = await tmdbSearchMovies(query);
    return { items, nextCursor: null };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("TMDB_UPSTREAM_ERROR", "Failed to search movies", 502);
  }
}

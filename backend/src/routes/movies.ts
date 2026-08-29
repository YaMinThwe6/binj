import { Router } from "express";
import type { MovieDetail } from "@binj/shared-types";
import { db } from "../lib/firebaseAdmin.js";
import { fetchMovieDetails, searchMovies, type TmdbMovie } from "../lib/tmdb.js";
import { logger } from "../lib/logger.js";

export const moviesRouter = Router();

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

// GET /movies/:movieId — cache (not yet built, see docs/schema.md §28) → Firestore → TMDB, hld.md §2
moviesRouter.get("/movies/:movieId", async (req, res) => {
  const { movieId } = req.params;

  try {
    if (db) {
      const snap = await db.collection("movies").doc(movieId).get();
      if (snap.exists) {
        return res.json(withRatingDefaults(snap.data()!));
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

    return res.json(withRatingDefaults(movieDoc));
  } catch (err) {
    logger.error(`[GET /movies/${movieId}]`, err);
    return res.status(502).json({
      error: { code: "TMDB_UPSTREAM_ERROR", message: "Failed to fetch movie details" }
    });
  }
});

// GET /search/movies?q=... — TMDB live search for now; §18's Vertex AI Search /
// Firestore word-prefix index is deferred until the movie-experience slice is stable.
moviesRouter.get("/search/movies", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) {
    return res.status(400).json({
      error: { code: "MISSING_QUERY", message: "q query param is required" }
    });
  }

  try {
    const items = await searchMovies(q);
    return res.json({ items, nextCursor: null });
  } catch (err) {
    logger.error(`[GET /search/movies?q=${q}]`, err);
    return res.status(502).json({
      error: { code: "TMDB_UPSTREAM_ERROR", message: "Failed to search movies" }
    });
  }
});

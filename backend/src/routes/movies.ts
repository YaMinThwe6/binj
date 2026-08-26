import { Router } from "express";
import { db } from "../lib/firebaseAdmin.js";
import { fetchMovieDetails, searchMovies, type TmdbMovie } from "../lib/tmdb.js";

export const moviesRouter = Router();

// GET /movies/:movieId — cache (not yet built, see docs/schema.md §28) → Firestore → TMDB, hld.md §2
moviesRouter.get("/movies/:movieId", async (req, res) => {
  const { movieId } = req.params;

  try {
    if (db) {
      const snap = await db.collection("movies").doc(movieId).get();
      if (snap.exists) {
        return res.json(snap.data());
      }
    }

    const movie: TmdbMovie = await fetchMovieDetails(movieId);

    if (db) {
      await db.collection("movies").doc(movieId).set({
        ...movie,
        binjRating: { sum: 0, count: 0 },
        streamingLastFetched: new Date(),
        lastFetched: new Date()
      });
    }

    return res.json(movie);
  } catch (err) {
    console.error(`[GET /movies/${movieId}]`, err);
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
    console.error(`[GET /search/movies?q=${q}]`, err);
    return res.status(502).json({
      error: { code: "TMDB_UPSTREAM_ERROR", message: "Failed to search movies" }
    });
  }
});

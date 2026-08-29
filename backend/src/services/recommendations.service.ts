import type { RecommendationItem } from "@binj/shared-types";
import { requireDb } from "../lib/firebaseAdmin.js";

const CANDIDATE_POOL = 30;
const RESULT_LIMIT = 10;
const MAX_GENRES = 10; // Firestore array-contains-any caps at 10 values

// Heuristic, not a learned model: 70% weight on how much of the caller's preferred
// genres this movie covers, 30% weight on its own TMDB rating. Only meaningful when
// there's an actual preference signal — the trending/cold-start fallback has nothing
// to score against, so those items carry matchScore: null (frontend shows the rating
// alone in that case, no "% match" badge).
function computeMatchScore(movieGenres: string[], voteAverage: number, preferredGenres: string[]): number | null {
  if (preferredGenres.length === 0) return null;
  const preferredSet = new Set(preferredGenres);
  const overlap = movieGenres.filter((g) => preferredSet.has(g)).length;
  const genreRatio = Math.min(1, overlap / preferredGenres.length);
  return Math.round(genreRatio * 70 + (voteAverage / 10) * 30);
}

function toSummary(id: string, data: FirebaseFirestore.DocumentData, preferredGenres: string[]): RecommendationItem {
  const genres = (data.genres as string[] | undefined) ?? [];
  const voteAverage = data.voteAverage ?? 0;
  return {
    movieId: id,
    title: data.title,
    poster: data.poster ?? null,
    year: data.year ?? null,
    genres,
    voteAverage,
    matchScore: computeMatchScore(genres, voteAverage, preferredGenres)
  };
}

// GET /recommendations — hld.md §6: content-based, live request-time computation,
// cold-start users get a trending fallback transparently. api-contracts.md §6.
export async function getRecommendations(uid: string): Promise<{ items: RecommendationItem[] }> {
  const db = requireDb();
  const userRef = db.collection("users").doc(uid);
  const [watchedSnap, watchlistSnap, userSnap] = await Promise.all([
    userRef.collection("watched").get(),
    userRef.collection("watchlist").get(),
    userRef.get()
  ]);

  const excludeIds = new Set<string>([
    ...watchedSnap.docs.map((d) => d.id),
    ...watchlistSnap.docs.map((d) => d.id)
  ]);

  // Preferred-genre signal: frequency across watched movies first (hld.md §6's
  // "highly-rated/watched" — reviews don't exist yet, so watched history is the
  // available proxy); falls back to onboarding's favoriteGenres when there's no
  // watch history yet, before finally falling back to trending (true cold start).
  let preferredGenres: string[] = [];
  if (watchedSnap.docs.length > 0) {
    const watchedMovies = await Promise.all(watchedSnap.docs.map((d) => db.collection("movies").doc(d.id).get()));
    const genreCounts = new Map<string, number>();
    for (const snap of watchedMovies) {
      for (const genre of (snap.data()?.genres as string[] | undefined) ?? []) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }
    preferredGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_GENRES)
      .map(([genre]) => genre);
  } else {
    preferredGenres = ((userSnap.data()?.favoriteGenres as string[] | null) ?? []).slice(0, MAX_GENRES);
  }

  let candidates: FirebaseFirestore.QuerySnapshot;
  if (preferredGenres.length > 0) {
    candidates = await db
      .collection("movies")
      .where("genres", "array-contains-any", preferredGenres)
      .orderBy("voteAverage", "desc")
      .limit(CANDIDATE_POOL)
      .get();
  } else {
    // True cold start — no watch history and no favoriteGenres — trending fallback.
    candidates = await db.collection("movies").orderBy("voteAverage", "desc").limit(CANDIDATE_POOL).get();
  }

  const items = candidates.docs
    .filter((d) => !excludeIds.has(d.id))
    .slice(0, RESULT_LIMIT)
    .map((d) => toSummary(d.id, d.data(), preferredGenres));

  return { items };
}

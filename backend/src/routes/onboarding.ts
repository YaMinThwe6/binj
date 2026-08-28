import { Router } from "express";
import { db } from "../lib/firebaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";

export const onboardingRouter = Router();

const CANDIDATE_LIMIT = 30;
const MAX_ARRAY_CONTAINS_ANY = 10; // Firestore's cap

function parseListParam(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_ARRAY_CONTAINS_ANY);
}

// GET /onboarding/watched-candidates — api-contracts.md §11, hld.md §13.
// Filtered by the genres/languages the user just picked in the prior onboarding
// steps; trending fallback when neither is given. Unlike /recommendations (§6),
// nothing gets excluded — the whole point is candidates *to* mark as watched.
onboardingRouter.get("/onboarding/watched-candidates", requireAuth, async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  }

  const genres = parseListParam(req.query.genres);
  const languages = parseListParam(req.query.languages);

  try {
    let candidates: FirebaseFirestore.QuerySnapshot;

    if (genres.length > 0) {
      candidates = await db
        .collection("movies")
        .where("genres", "array-contains-any", genres)
        .orderBy("voteAverage", "desc")
        .limit(CANDIDATE_LIMIT)
        .get();
    } else if (languages.length > 0) {
      candidates = await db
        .collection("movies")
        .where("originalLanguage", "in", languages)
        .orderBy("voteAverage", "desc")
        .limit(CANDIDATE_LIMIT)
        .get();
    } else {
      candidates = await db.collection("movies").orderBy("voteAverage", "desc").limit(CANDIDATE_LIMIT).get();
    }

    let items = candidates.docs.map((d) => {
      const data = d.data();
      return {
        movieId: d.id,
        title: data.title,
        poster: data.poster ?? null,
        year: data.year ?? null,
        genres: data.genres ?? [],
        originalLanguage: data.originalLanguage ?? null,
        voteAverage: data.voteAverage ?? 0
      };
    });

    // When both genres and languages were given, the language filter is applied
    // in-app on top of the genre query — Firestore can't combine array-contains-any
    // with an `in` filter on a different field in one query.
    if (genres.length > 0 && languages.length > 0) {
      items = items.filter((m) => languages.includes(m.originalLanguage as string));
    }

    return res.json({ items });
  } catch (err) {
    console.error("[GET /onboarding/watched-candidates]", err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to load watched candidates" } });
  }
});

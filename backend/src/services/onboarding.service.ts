import type { MovieCandidate, CelebritySuggestion } from "@binj/shared-types";
import { requireDb } from "../lib/firebaseAdmin.js";

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
export async function getWatchedCandidates(rawGenres: unknown, rawLanguages: unknown): Promise<{ items: MovieCandidate[] }> {
  const db = requireDb();
  const genres = parseListParam(rawGenres);
  const languages = parseListParam(rawLanguages);

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

  let items: MovieCandidate[] = candidates.docs.map((d) => {
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

  return { items };
}

// GET /onboarding/celebrity-suggestions — api-contracts.md §5, hld.md §13.
// Ranks cast/crew from the caller's already-saved watched movies by how many of
// those movies they appear in, then by TMDB popularity. No fallback when watch
// history is empty — this onboarding step is skippable, unlike Watched's trending
// fallback which exists because that step isn't.
export async function getCelebritySuggestions(uid: string): Promise<{ items: CelebritySuggestion[] }> {
  const db = requireDb();
  const watchedSnap = await db.collection("users").doc(uid).collection("watched").get();
  if (watchedSnap.docs.length === 0) {
    return { items: [] };
  }

  const movieSnaps = await Promise.all(watchedSnap.docs.map((d) => db.collection("movies").doc(d.id).get()));

  const appearances = new Map<string, number>();
  const personInfo = new Map<string, { name: string; photo: string | null }>();
  for (const movieSnap of movieSnaps) {
    const credited = [...(movieSnap.data()?.cast ?? []), ...(movieSnap.data()?.crew ?? [])] as {
      personId: string;
      name: string;
      photo: string | null;
    }[];
    const uniquePersonIds = new Set(credited.map((c) => c.personId));
    for (const personId of uniquePersonIds) {
      appearances.set(personId, (appearances.get(personId) ?? 0) + 1);
      if (!personInfo.has(personId)) {
        const c = credited.find((x) => x.personId === personId)!;
        personInfo.set(personId, { name: c.name, photo: c.photo });
      }
    }
  }

  const ranked = [...appearances.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const items: CelebritySuggestion[] = ranked.map(([personId, appearsIn]) => ({
    personId,
    name: personInfo.get(personId)!.name,
    photo: personInfo.get(personId)!.photo,
    appearsIn
  }));

  return { items };
}

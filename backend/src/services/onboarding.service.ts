import type { MovieCandidate, CelebritySuggestion, MovieDetail } from "@binj/shared-types";
import { requireDb } from "../lib/firebaseAdmin.js";
import { discoverMovies } from "../lib/tmdb.js";
import { getMovieDetail } from "./movies.service.js";

const CANDIDATE_LIMIT = 30;
const MAX_ARRAY_CONTAINS_ANY = 10; // Firestore's cap

function parseListParam(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_ARRAY_CONTAINS_ANY);
}

// A page number cursor for the genre/language-filtered TMDB Discover paging
// below — opaque to the frontend (it just round-trips whatever nextCursor it
// was handed), but it's literally the next /discover/movie page to fetch.
function parseCursor(raw: unknown): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Shared by both watched-candidates and celebrity-suggestions' "keep growing
// as you scroll" paging (hld.md §13, redesigned for infinite scroll): the
// local Firestore index only ever has genre/language/cast/crew for a movie
// once someone's individually opened its detail page, so it can't grow on
// its own past whatever's been incidentally viewed. /discover/movie is TMDB's
// one endpoint that's natively paginated by genre+language, so each scroll
// page here is a real Discover page, with full detail (genres, cast/crew)
// backfilled via getMovieDetail's existing fetch-and-upsert path — reused
// as-is rather than duplicated, so a movie discovered this way becomes
// exactly as locally-cached and search-indexed as one someone opened by hand.
async function fetchGenreLanguagePage(
  genres: string[],
  languages: string[],
  page: number
): Promise<{ movies: MovieDetail[]; hasMore: boolean }> {
  const { items, totalPages } = await discoverMovies(genres, languages, page);

  const detailed = await Promise.all(
    items.map((item) =>
      getMovieDetail(item.movieId).catch(() => null) // one bad movie shouldn't fail the whole page
    )
  );
  let movies = detailed.filter((m): m is MovieDetail => m !== null);

  // TMDB's with_original_language only accepts a single code (discoverMovies
  // skips it entirely when more than one language was chosen) — cross-check
  // the full set here instead, same "genre query, language filtered in-app"
  // convention the local candidate query below already uses.
  if (languages.length > 1) {
    movies = movies.filter((m) => languages.includes(m.originalLanguage));
  }

  return { movies, hasMore: page < totalPages };
}

// GET /onboarding/watched-candidates — api-contracts.md §11, hld.md §13.
// Filtered by the genres/languages the user just picked in the prior onboarding
// steps; trending fallback when neither is given. Unlike /recommendations (§6),
// nothing gets excluded — the whole point is candidates *to* mark as watched.
//
// Paging (redesigned for infinite scroll): the first page (no cursor) is the
// original fast local-index query below, untouched. Every page after that
// comes from fetchGenreLanguagePage's live TMDB Discover paging instead —
// the local index alone can't grow past whatever's incidentally been viewed,
// so scrolling further needs a source that's actually inexhaustible.
export async function getWatchedCandidates(
  rawGenres: unknown,
  rawLanguages: unknown,
  rawCursor?: unknown
): Promise<{ items: MovieCandidate[]; nextCursor: string | null }> {
  const genres = parseListParam(rawGenres);
  const languages = parseListParam(rawLanguages);
  const cursor = parseCursor(rawCursor);

  if (cursor !== null) {
    const { movies, hasMore } = await fetchGenreLanguagePage(genres, languages, cursor);
    const items: MovieCandidate[] = movies.map((m) => ({
      movieId: m.movieId,
      title: m.title,
      poster: m.poster,
      year: m.year,
      genres: m.genres,
      originalLanguage: m.originalLanguage,
      voteAverage: m.voteAverage
    }));
    return { items, nextCursor: hasMore ? String(cursor + 1) : null };
  }

  const db = requireDb();
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

  // Always offer to keep scrolling: /discover/movie works fine unfiltered too
  // (page 2 is thus a genuine paginated fallback even in the "trending, no
  // genre/language chosen" case), and its catalog is large enough that
  // checking totalPages up front here isn't worth another round-trip.
  return { items, nextCursor: "2" };
}

interface CreditedMovie {
  cast?: { personId: string; name: string; photo: string | null }[];
  crew?: { personId: string; name: string; photo: string | null }[];
}

// Shared by both the watch-history ranking below and the genre/language
// discover-page ranking — same "how many of these movies do they appear in"
// scoring either way, just fed a different source movie list.
function rankPeopleFromMovies(movies: CreditedMovie[]): CelebritySuggestion[] {
  const appearances = new Map<string, number>();
  const personInfo = new Map<string, { name: string; photo: string | null }>();
  for (const movie of movies) {
    const credited = [...(movie.cast ?? []), ...(movie.crew ?? [])];
    const uniquePersonIds = new Set(credited.map((c) => c.personId));
    for (const personId of uniquePersonIds) {
      appearances.set(personId, (appearances.get(personId) ?? 0) + 1);
      if (!personInfo.has(personId)) {
        const c = credited.find((x) => x.personId === personId)!;
        personInfo.set(personId, { name: c.name, photo: c.photo });
      }
    }
  }
  return [...appearances.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([personId, appearsIn]) => ({ personId, name: personInfo.get(personId)!.name, photo: personInfo.get(personId)!.photo, appearsIn }));
}

// GET /onboarding/celebrity-suggestions — api-contracts.md §5, hld.md §13.
// Page 1 (no cursor) ranks cast/crew from the caller's already-saved watched
// movies, unchanged — the strongest, most personalized signal when it exists.
// Every page after that comes from the same genre/language Discover paging
// watched-candidates uses (fetchGenreLanguagePage) — not just for "keep
// scrolling", but because watch history being thin or empty (Watched is
// skippable, and this step used to have zero fallback for that) previously
// meant this whole step rendered nothing; genre/language gives it something
// to suggest regardless of watch history.
export async function getCelebritySuggestions(
  uid: string,
  rawGenres: unknown,
  rawLanguages: unknown,
  rawCursor?: unknown
): Promise<{ items: CelebritySuggestion[]; nextCursor: string | null }> {
  const genres = parseListParam(rawGenres);
  const languages = parseListParam(rawLanguages);
  const cursor = parseCursor(rawCursor);

  if (cursor !== null) {
    const { movies, hasMore } = await fetchGenreLanguagePage(genres, languages, cursor);
    return { items: rankPeopleFromMovies(movies), nextCursor: hasMore ? String(cursor + 1) : null };
  }

  const db = requireDb();
  const watchedSnap = await db.collection("users").doc(uid).collection("watched").get();

  let items: CelebritySuggestion[] = [];
  if (watchedSnap.docs.length > 0) {
    const movieSnaps = await Promise.all(watchedSnap.docs.map((d) => db.collection("movies").doc(d.id).get()));
    items = rankPeopleFromMovies(movieSnaps.map((s) => (s.data() ?? {}) as CreditedMovie)).slice(0, 20);
  }

  // Discover-page 1 (cursor="1") is next regardless of whether watch-history
  // produced anything — see the comment above.
  return { items, nextCursor: "1" };
}

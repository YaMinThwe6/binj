import type { MovieSummary } from "@binj/shared-types";
import { env } from "./env.js";

const TMDB_BASE = "https://api.themoviedb.org/3";
const STREAMING_REGION = "IN"; // hardcoded for the prototype — hld.md §8

export interface TmdbPersonCredit {
  personId: string;
  name: string;
  photo: string | null;
  knownForDepartment: string | null;
  popularity: number;
}

export interface TmdbMovie {
  movieId: string;
  title: string;
  year: number | null;
  runtime: number | null;
  genres: string[];
  originalLanguage: string; // ISO 639-1, e.g. "en", "ta", "ko" — TMDB's original_language
  synopsis: string | null;
  poster: string | null;
  cast: { personId: string; name: string; character: string; photo: string | null }[];
  crew: { personId: string; name: string; role: string; photo: string | null }[];
  isAdult: boolean;
  voteAverage: number;
  voteCount: number;
  trailerKey: string | null; // YouTube video id, e.g. https://www.youtube.com/watch?v={trailerKey}
  streamingProviders: { name: string; type: "subscription" | "rent" | "buy"; logo: string }[];
  credits: TmdbPersonCredit[]; // full person-doc-shape data for everyone in cast/crew above, for upserting people/{personId} (schema.md)
}

async function tmdbFetch(path: string): Promise<any> {
  const res = await fetch(`${TMDB_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`,
      accept: "application/json"
    }
  });
  if (!res.ok) {
    throw new Error(`TMDB request failed: ${res.status} ${res.statusText} (${path})`);
  }
  return res.json();
}

function pickTrailer(videosResponse: any): string | null {
  const results: any[] = videosResponse?.results ?? [];
  const youtubeTrailers = results.filter((v) => v.site === "YouTube" && v.type === "Trailer");
  const official = youtubeTrailers.find((v) => v.official);
  return (official ?? youtubeTrailers[0])?.key ?? null;
}

function mapProviders(providersResponse: any): TmdbMovie["streamingProviders"] {
  const region = providersResponse?.results?.[STREAMING_REGION];
  if (!region) return [];

  const buckets: [string, "subscription" | "rent" | "buy"][] = [
    ["flatrate", "subscription"],
    ["rent", "rent"],
    ["buy", "buy"]
  ];

  const out: TmdbMovie["streamingProviders"] = [];
  for (const [key, type] of buckets) {
    for (const p of region[key] ?? []) {
      out.push({ name: p.provider_name, type, logo: p.logo_path ?? "" });
    }
  }
  return out;
}

export async function fetchMovieDetails(tmdbId: string): Promise<TmdbMovie> {
  const data = await tmdbFetch(
    `/movie/${encodeURIComponent(tmdbId)}?append_to_response=credits,watch/providers,videos`
  );

  const cast = (data.credits?.cast ?? [])
    .slice(0, 10)
    .map((c: any) => ({ personId: String(c.id), name: c.name, character: c.character ?? "", photo: c.profile_path || null }));

  const crew = (data.credits?.crew ?? [])
    .filter((c: any) => c.job === "Director" || c.job === "Writer")
    .map((c: any) => ({ personId: String(c.id), name: c.name, role: c.job, photo: c.profile_path || null }));

  // Every credited person gets a people/{personId} record (schema.md) — not just the
  // top-10 cast + Director/Writer subset the movie page itself displays above. Small
  // roles and full crew are followable celebrities too, per explicit product direction.
  const creditedRaw = [...(data.credits?.cast ?? []), ...(data.credits?.crew ?? [])];
  const creditsById = new Map<string, TmdbPersonCredit>();
  for (const c of creditedRaw) {
    const personId = String(c.id);
    if (!creditsById.has(personId)) {
      creditsById.set(personId, {
        personId,
        name: c.name,
        photo: c.profile_path || null,
        knownForDepartment: c.known_for_department ?? null,
        popularity: c.popularity ?? 0
      });
    }
  }

  return {
    movieId: String(data.id),
    title: data.title,
    year: data.release_date ? Number(data.release_date.slice(0, 4)) : null,
    runtime: data.runtime ?? null,
    genres: (data.genres ?? []).map((g: any) => g.name),
    originalLanguage: data.original_language ?? "en",
    synopsis: data.overview || null,
    poster: data.poster_path || null,
    cast,
    crew,
    isAdult: Boolean(data.adult),
    voteAverage: data.vote_average ?? 0,
    voteCount: data.vote_count ?? 0,
    trailerKey: pickTrailer(data.videos),
    streamingProviders: mapProviders(data["watch/providers"]),
    credits: [...creditsById.values()]
  };
}

// GET /movies/recent — TMDB's "now playing" list (theatrical releases
// currently in cinemas), region-scoped to match STREAMING_REGION's existing
// hardcoded-India convention (hld.md §8). Same MovieSummary shape as search
// results — the frontend's Discover page renders both with the same card.
export async function getRecentMovies(): Promise<MovieSummary[]> {
  const data = await tmdbFetch(`/movie/now_playing?region=${STREAMING_REGION}`);
  return (data.results ?? []).map((r: any) => ({
    movieId: String(r.id),
    title: r.title,
    poster: r.poster_path || null,
    year: r.release_date ? Number(r.release_date.slice(0, 4)) : null
  }));
}

// scripts/seedSearchCatalog.ts — bulk-seeds the local search index (hld.md
// §18) with a broad slice of well-known titles, not just whatever's been
// incidentally viewed or searched. TMDB's `/movie/popular`, paginated (20
// movies/page); `pages` is the caller's choice of how much catalog breadth
// to pull in one run.
export async function getPopularMovies(pages: number): Promise<MovieSummary[]> {
  const results: MovieSummary[] = [];
  for (let page = 1; page <= pages; page++) {
    const data = await tmdbFetch(`/movie/popular?region=${STREAMING_REGION}&page=${page}`);
    for (const r of data.results ?? []) {
      results.push({
        movieId: String(r.id),
        title: r.title,
        poster: r.poster_path || null,
        year: r.release_date ? Number(r.release_date.slice(0, 4)) : null
      });
    }
  }
  return results;
}

// hld.md §18 — the local index + live TMDB are merged and ranked together
// on every search (movies.service.ts's searchMoviesService), so TMDB's
// results need a popularity signal for that shared ranking to break ties
// with, not just the bare MovieSummary shape the frontend renders.
export interface TmdbSearchResult extends MovieSummary {
  voteCount: number;
}

export async function searchMovies(query: string): Promise<TmdbSearchResult[]> {
  const data = await tmdbFetch(`/search/movie?query=${encodeURIComponent(query)}`);
  return (data.results ?? []).map((r: any) => ({
    movieId: String(r.id),
    title: r.title,
    poster: r.poster_path || null,
    year: r.release_date ? Number(r.release_date.slice(0, 4)) : null,
    voteCount: r.vote_count ?? 0
  }));
}

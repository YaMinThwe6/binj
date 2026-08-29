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

export async function searchMovies(query: string): Promise<MovieSummary[]> {
  const data = await tmdbFetch(`/search/movie?query=${encodeURIComponent(query)}`);
  return (data.results ?? []).map((r: any) => ({
    movieId: String(r.id),
    title: r.title,
    poster: r.poster_path || null,
    year: r.release_date ? Number(r.release_date.slice(0, 4)) : null
  }));
}

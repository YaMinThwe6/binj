import { env } from "./env.js";

const TMDB_BASE = "https://api.themoviedb.org/3";
const STREAMING_REGION = "IN"; // hardcoded for the prototype — hld.md §8

export interface TmdbMovie {
  movieId: string;
  title: string;
  year: number | null;
  runtime: number | null;
  genres: string[];
  synopsis: string | null;
  poster: string | null;
  cast: { name: string; character: string }[];
  crew: { name: string; role: string }[];
  isAdult: boolean;
  voteAverage: number;
  streamingProviders: { name: string; type: "subscription" | "rent" | "buy"; logo: string }[];
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
    `/movie/${encodeURIComponent(tmdbId)}?append_to_response=credits,watch/providers`
  );

  const cast = (data.credits?.cast ?? [])
    .slice(0, 10)
    .map((c: any) => ({ name: c.name, character: c.character ?? "" }));

  const crew = (data.credits?.crew ?? [])
    .filter((c: any) => c.job === "Director" || c.job === "Writer")
    .map((c: any) => ({ name: c.name, role: c.job }));

  return {
    movieId: String(data.id),
    title: data.title,
    year: data.release_date ? Number(data.release_date.slice(0, 4)) : null,
    runtime: data.runtime ?? null,
    genres: (data.genres ?? []).map((g: any) => g.name),
    synopsis: data.overview || null,
    poster: data.poster_path || null,
    cast,
    crew,
    isAdult: Boolean(data.adult),
    voteAverage: data.vote_average ?? 0,
    streamingProviders: mapProviders(data["watch/providers"])
  };
}

export async function searchMovies(query: string): Promise<
  { movieId: string; title: string; poster: string | null; year: number | null }[]
> {
  const data = await tmdbFetch(`/search/movie?query=${encodeURIComponent(query)}`);
  return (data.results ?? []).map((r: any) => ({
    movieId: String(r.id),
    title: r.title,
    poster: r.poster_path || null,
    year: r.release_date ? Number(r.release_date.slice(0, 4)) : null
  }));
}

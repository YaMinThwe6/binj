const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:6501'

export interface MovieSummary {
  movieId: string
  title: string
  poster: string | null
  year: number | null
}

export interface MovieDetail extends MovieSummary {
  runtime: number | null
  genres: string[]
  synopsis: string | null
  cast: { name: string; character: string }[]
  crew: { name: string; role: string }[]
  voteAverage: number
  streamingProviders: { name: string; type: string; logo: string }[]
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function searchMovies(query: string): Promise<{ items: MovieSummary[] }> {
  return apiFetch(`/search/movies?q=${encodeURIComponent(query)}`)
}

export function getMovie(movieId: string): Promise<MovieDetail> {
  return apiFetch(`/movies/${encodeURIComponent(movieId)}`)
}

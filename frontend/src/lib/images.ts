// TMDB's own public image CDN — no API key/credentials involved (unlike the
// TMDB *data* API, which stays backend-only per hld.md's "frontend never
// calls TMDB directly" principle), so rendering these directly from the
// browser doesn't cross that line. `poster`/`backdrop` fields from the
// backend are TMDB's raw relative path (e.g. "/abc123.jpg") — this is the
// one place that turns that into an actual loadable URL.
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export type PosterSize = 'w185' | 'w342' | 'w500'

export function posterUrl(path: string | null, size: PosterSize = 'w342'): string | null {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null
}

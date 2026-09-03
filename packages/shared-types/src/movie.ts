// Wire shapes for movie data across `GET /movies/:movieId`, `GET /search/movies`,
// `GET /recommendations`, and `GET /onboarding/watched-candidates`
// (api-contracts.md §1, §6, §11).

export interface MovieSummary {
  movieId: string
  title: string
  poster: string | null
  year: number | null
}

export interface CastMember {
  personId: string
  name: string
  character: string
  photo: string | null
}

export interface CrewMember {
  personId: string
  name: string
  role: string
  photo: string | null
}

export interface StreamingProvider {
  name: string
  type: 'subscription' | 'rent' | 'buy'
  logo: string
}

export interface MovieDetail extends MovieSummary {
  runtime: number | null
  genres: string[]
  originalLanguage: string // ISO 639-1, e.g. "en" — always written by getMovieDetail's full-detail fetch, defaults to "en" if TMDB omits it
  synopsis: string | null
  cast: CastMember[]
  crew: CrewMember[]
  voteAverage: number
  voteCount: number
  trailerKey: string | null
  streamingProviders: StreamingProvider[]
  // BINJ's own aggregate rating (hld.md §20) and like count — always present in
  // the response, defaulting to zero when absent from storage (a movie that's
  // never been rated/liked yet has no reason to have written these fields).
  binjRating: { sum: number; count: number }
  likeCount: number
}

// GET /recommendations item — matchScore is a heuristic (0-100), null for the
// trending/cold-start fallback which has no preference signal to score against.
export interface RecommendationItem {
  movieId: string
  title: string
  poster: string | null
  year: number | null
  genres: string[]
  voteAverage: number
  matchScore: number | null
}

// GET /onboarding/watched-candidates item — filtered by the genres/languages
// picked earlier in onboarding, no exclusion (unlike RecommendationItem).
export interface MovieCandidate {
  movieId: string
  title: string
  poster: string | null
  year: number | null
  genres: string[]
  originalLanguage?: string | null
  voteAverage: number
}

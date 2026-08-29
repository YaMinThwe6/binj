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
  synopsis: string | null
  cast: CastMember[]
  crew: CrewMember[]
  voteAverage: number
  voteCount: number
  trailerKey: string | null
  streamingProviders: StreamingProvider[]
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

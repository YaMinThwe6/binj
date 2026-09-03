// Wire shapes for the people/social-discovery endpoints (api-contracts.md §5).

export interface CelebritySuggestion {
  personId: string
  name: string
  photo: string | null
  appearsIn: number
}

// GET /people/search item — a plain by-name lookup (api-contracts.md §5),
// distinct from CelebritySuggestion: no appearsIn, since this isn't ranked
// against the caller's own watch history the way suggestions are.
export interface PersonSummary {
  personId: string
  name: string
  photo: string | null
}

// GET /users/me/tasteMatches item — relationship is joined live against the
// Follow collections (api-contracts.md §4) so a "Connect" button can render
// the right state without a second round-trip.
export interface TasteMatch {
  uid: string
  displayName: string
  score: number
  relationship: 'following' | 'pending' | 'none'
}

// GET /movies/:movieId/watchedBy item — hld.md §5a. Scoped to the caller's
// own `following` list, both list-level (users.listVisible) and per-entry
// (watched.visibility) privacy checks applied server-side.
export interface WatchedByEntry {
  uid: string
  displayName: string
  watchedAt: string | null
}

// GET /users/:uid item — a public-profile watched entry, movie details
// already joined in so the frontend doesn't need a second round-trip per movie.
export interface PublicProfileWatchedEntry {
  movieId: string
  title: string | null
  poster: string | null
  watchedAt: string | null
}

// GET /users/:uid (api-contracts.md §11b) — the public-facing counterpart to
// UserProfile (GET /users/me): only what's meant to be visible to other
// users, privacy-filtered server-side the same way as watchedBy above.
// `relationship` is "self" when the caller requests their own uid — the
// watched list still gets the same privacy filter in that case (a user
// wanting their own unfiltered list already has GET /users/me/watched).
export interface PublicProfile {
  uid: string
  displayName: string
  username: string | null
  photoURL: string | null
  favoriteGenres: string[] | null
  preferredLanguages: string[] | null
  followerCount: number
  followingCount: number
  relationship: 'self' | 'following' | 'pending' | 'none'
  watchedListVisible: boolean
  watched: PublicProfileWatchedEntry[]
}

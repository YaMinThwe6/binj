// Wire shapes for the people/social-discovery endpoints (api-contracts.md §5).

export interface CelebritySuggestion {
  personId: string
  name: string
  photo: string | null
  appearsIn: number
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

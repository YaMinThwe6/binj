// GET /home/greeting (api-contracts.md §7b) — the movie-dialogue greeting on
// Home's hero card. `source` is "watched" when the quote was matched against
// something the caller actually watched, "random" otherwise.
export interface Greeting {
  quote: string
  attribution: string
  source: 'watched' | 'random'
}

// GET /home/friends-recommendations item (api-contracts.md §7b) — "Because your
// friends watched these". Same movie-summary shape as RecommendationItem, but the
// ranking signal is social (how many people the caller follows watched it) rather
// than genre-preference, so it carries `watchedByCount` instead of `matchScore`.
export interface FriendsRecommendationItem {
  movieId: string
  title: string
  poster: string | null
  year: number | null
  genres: string[]
  voteAverage: number
  watchedByCount: number
}

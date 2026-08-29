// GET /home/greeting (api-contracts.md §7b) — the movie-dialogue greeting on
// Home's hero card. `source` is "watched" when the quote was matched against
// something the caller actually watched, "random" otherwise.
export interface Greeting {
  quote: string
  attribution: string
  source: 'watched' | 'random'
}

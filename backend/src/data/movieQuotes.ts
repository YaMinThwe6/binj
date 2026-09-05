// Curated movie-dialogue quotes for Home's greeting hero (hld.md §13's "Watched →
// first Home greeting" note, hld.md §6's sibling feature). TMDB doesn't provide
// quote data, so this is a small hand-picked set tagged with the movie's real
// TMDB id — when the id also happens to be in the caller's watched list, that
// quote is preferred; otherwise one is picked at random from the full pool.
// Extending this list (more movies, more quotes per movie) is just data entry.
export interface MovieQuote {
  movieId: string; // TMDB id, matches movies/{movieId} when that movie has been cached
  quote: string;
  attribution: string;
}

export const MOVIE_QUOTES: MovieQuote[] = [
  {
    movieId: "120",
    quote: "All we have to decide is what to do with the time that is given to us.",
    attribution: "The Lord of the Rings: The Fellowship of the Ring"
  },
  {
    movieId: "27205",
    quote: "You mustn't be afraid to dream a little bigger, darling.",
    attribution: "Inception"
  },
  {
    movieId: "157336",
    quote: "Love is the one thing we're capable of perceiving that transcends time and space.",
    attribution: "Interstellar"
  },
  {
    movieId: "155",
    quote: "Why so serious?",
    attribution: "The Dark Knight"
  },
  {
    movieId: "550",
    quote: "The things you own end up owning you.",
    attribution: "Fight Club"
  },
  {
    movieId: "278",
    quote: "Get busy living, or get busy dying.",
    attribution: "The Shawshank Redemption"
  },
  {
    movieId: "680",
    quote: "Say 'what' again. I dare you, I double dare you.",
    attribution: "Pulp Fiction"
  },
  {
    movieId: "603",
    quote: "There is no spoon.",
    attribution: "The Matrix"
  },
  {
    movieId: "13",
    quote: "Life is like a box of chocolates. You never know what you're gonna get.",
    attribution: "Forrest Gump"
  },
  {
    movieId: "313369",
    quote: "Here's to the ones who dream, foolish as they may seem.",
    attribution: "La La Land"
  },
  {
    movieId: "496243",
    quote: "You know what plan never fails? No plan.",
    attribution: "Parasite"
  },
  {
    movieId: "244786",
    quote: "There are no two words in the English language more harmful than 'good job.'",
    attribution: "Whiplash"
  },
  {
    movieId: "1124",
    quote: "Are you watching closely?",
    attribution: "The Prestige"
  },
  {
    movieId: "324857",
    quote: "A hero can be anyone.",
    attribution: "Spider-Man: Into the Spider-Verse"
  },
  {
    movieId: "372058",
    quote: "If you can do something right, why do it any other way?",
    attribution: "Your Name."
  }
];

export function pickQuoteForMovieIds(watchedMovieIds: string[]): MovieQuote | null {
  const watchedSet = new Set(watchedMovieIds);
  const matches = MOVIE_QUOTES.filter((q) => watchedSet.has(q.movieId));
  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}

export function pickRandomQuote(): MovieQuote {
  return MOVIE_QUOTES[Math.floor(Math.random() * MOVIE_QUOTES.length)];
}

// App-wide movie taxonomy — TMDB's own genre names and original-language
// codes. Onboarding picks from this, and search's "Browse Korean films" /
// "Browse Horror movies" chip resolves a typed word against it. Kept here
// (not in a feature folder) because more than one feature now depends on it.
// The backend keeps its own copy (backend/src/services/movies.service.ts,
// tmdb.ts) — same "hardcoded, practically never changes" call made there.

// TMDB's actual genre names (not stylized labels) — matched against real
// movie.genres arrays, so they must be the exact strings TMDB uses.
export const GENRE_OPTIONS = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'History',
  'Horror',
  'Music',
  'Mystery',
  'Romance',
  'Science Fiction',
  'Thriller',
  'War',
  'Western'
]

// ISO 639-1 codes matching TMDB's original_language field — major Indian
// regional cinema alongside major global cinema.
export const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'kn', label: 'Kannada' },
  { code: 'bn', label: 'Bengali' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ko', label: 'Korean' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'th', label: 'Thai' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'ru', label: 'Russian' }
]

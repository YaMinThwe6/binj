import { GENRE_OPTIONS, LANGUAGE_OPTIONS } from '../../lib/catalog'

// A typed search word that names a whole category rather than a title —
// "korean", "horror", "sci-fi movies". Search still runs it as a normal text
// query (there may genuinely be a movie called "Horror"), but when this
// matches, MovieSearch also offers a "Browse Korean films" chip that swaps in
// the discover-by-facet grid.
export interface FacetMatch {
  kind: 'genre' | 'language'
  // TMDB genre name (kind:'genre') or ISO 639-1 code (kind:'language') — the
  // canonical value the /discover/movies endpoint expects.
  value: string
  // Chip text, e.g. "Browse Korean films" / "Browse Science Fiction movies".
  chipLabel: string
  // Heading for the browse view once the chip is tapped.
  headingLabel: string
}

const GENRE_ALIASES: Record<string, string> = {
  'sci fi': 'Science Fiction',
  'sci-fi': 'Science Fiction',
  scifi: 'Science Fiction',
  'science fiction': 'Science Fiction',
  docu: 'Documentary',
  documentaries: 'Documentary',
  romcom: 'Romance',
  'rom com': 'Romance',
  thrillers: 'Thriller',
  westerns: 'Western'
}

// "korean movies" / "horror films" / "comedy cinema" → drop the trailing noun
const TRAILING = /\s+(movies?|films?|cinema|flicks?)$/

function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(TRAILING, '').trim()
}

export function matchFacet(query: string): FacetMatch | null {
  const q = normalize(query)
  if (q.length < 3) return null

  const genreByName = GENRE_OPTIONS.find((g) => g.toLowerCase() === q)
  const genre = genreByName ?? GENRE_ALIASES[q] ?? null
  if (genre) {
    return {
      kind: 'genre',
      value: genre,
      chipLabel: `Browse ${genre} movies`,
      headingLabel: `${genre} movies`
    }
  }

  // Language labels here double as the adjective ("Korean", "Japanese", …).
  const lang = LANGUAGE_OPTIONS.find((l) => l.label.toLowerCase() === q)
  if (lang) {
    return {
      kind: 'language',
      value: lang.code,
      chipLabel: `Browse ${lang.label} films`,
      headingLabel: `${lang.label} films`
    }
  }

  return null
}

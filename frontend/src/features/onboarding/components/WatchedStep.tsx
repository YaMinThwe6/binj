import { useEffect, useRef, useState } from 'react'
import { getWatchedCandidates, type MovieCandidate } from '../services/onboardingApi'
import { markWatched, unmarkWatched, searchMovies, type MovieSummary } from '../../movie/services/movieApi'
import { posterUrl } from '../../../lib/images'
import { OnboardingShell } from './OnboardingShell'

interface Props {
  genres: string[]
  languages: string[]
  onContinue: (watched: MovieCandidate[]) => void
  onSkip: () => void
  onBack?: () => void
}

// Matches MovieSearch.tsx's own search-as-you-type pacing — a real API call
// (movies.service.ts's local-index+TMDB merge), not a cheap local read.
const DEBOUNCE_MS = 1000
const MIN_QUERY_LENGTH = 2

// A search result (MovieSummary) is missing the fields a candidate carries
// (genres/originalLanguage/voteAverage — /onboarding/watched-candidates
// returns those, plain search doesn't) — defaulted here so a movie found
// via search can still be marked watched and included in onContinue's
// payload just like a suggested candidate. voteAverage defaults to 0
// (greeting.ts's "pick the highest-rated watched movie" only degrades if
// every watched movie came from search, never breaks).
function toCandidate(movie: MovieCandidate | MovieSummary): MovieCandidate {
  if ('voteAverage' in movie) return movie
  return { ...movie, genres: [], originalLanguage: null, voteAverage: 0 }
}

export function WatchedStep({ genres, languages, onContinue, onSkip, onBack }: Props) {
  const [candidates, setCandidates] = useState<MovieCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MovieSummary[]>([])
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keyed by movieId, valued with the full candidate shape — not just a
  // Set<movieId> — so a movie marked watched from search results (which
  // aren't in `candidates`) still has something real to hand back via
  // onContinue, not just an id with nothing behind it.
  const [watchedMovies, setWatchedMovies] = useState<Map<string, MovieCandidate>>(new Map())

  useEffect(() => {
    getWatchedCandidates(genres, languages)
      .then((res) => setCandidates(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load movies'))
      .finally(() => setLoading(false))
    // Intentionally runs once on mount — genres/languages are the selections from
    // the prior steps, already final by the time this step is reached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([])
      setSearchStatus('idle')
      return
    }
    debounceTimerRef.current = setTimeout(() => {
      setSearchStatus('loading')
      searchMovies(trimmed)
        .then((res) => {
          setResults(res.items)
          setSearchStatus('idle')
        })
        .catch(() => setSearchStatus('error'))
    }, DEBOUNCE_MS)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [query])

  async function toggle(movie: MovieCandidate | MovieSummary) {
    const full = toCandidate(movie)
    const wasWatched = watchedMovies.has(full.movieId)
    setWatchedMovies((prev) => {
      const next = new Map(prev)
      if (wasWatched) next.delete(full.movieId)
      else next.set(full.movieId, full)
      return next
    })
    try {
      if (wasWatched) await unmarkWatched(full.movieId)
      else await markWatched(full.movieId)
    } catch (err) {
      // roll back the optimistic toggle on failure
      setWatchedMovies((prev) => {
        const next = new Map(prev)
        if (wasWatched) next.set(full.movieId, full)
        else next.delete(full.movieId)
        return next
      })
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const isSearching = query.trim().length >= MIN_QUERY_LENGTH
  const displayed: (MovieCandidate | MovieSummary)[] = isSearching ? results : candidates

  return (
    <OnboardingShell
      step={4}
      onBack={onBack}
      desktopTitle="Every rating starts somewhere."
      desktopSubtitle="Tell us what you've already seen and we'll start building your taste profile from day one."
    >
      <div className="flex flex-1 flex-col px-7 pt-8 pb-8">
        <h1 className="font-serif text-[26px] font-semibold text-white">Movies you&rsquo;ve watched</h1>
        <p className="mt-2 mb-5 text-[13.5px] text-text-muted">This helps us build your taste profile (optional)</p>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a movie…"
          aria-label="Search for a movie"
          className="mb-4 rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm text-text outline-none focus:border-accent"
        />

        {loading && !isSearching && <p className="text-sm text-text-muted">Loading…</p>}
        {isSearching && searchStatus === 'loading' && <p className="text-sm text-text-muted">Searching…</p>}
        {isSearching && searchStatus === 'error' && <p role="alert" className="text-sm text-red-400">Search failed</p>}
        {isSearching && searchStatus === 'idle' && results.length === 0 && (
          <p className="text-sm text-text-muted">No results for &ldquo;{query.trim()}&rdquo;.</p>
        )}
        {error && (
          <p role="alert" className="mb-4 text-[13px] text-red-400">
            {error}
          </p>
        )}

        <ul className="grid grid-cols-3 gap-3">
          {displayed.map((movie) => {
            const isWatched = watchedMovies.has(movie.movieId)
            const poster = posterUrl(movie.poster)
            return (
              <li key={movie.movieId}>
                <button
                  type="button"
                  aria-pressed={isWatched}
                  onClick={() => toggle(movie)}
                  className="block w-full text-left"
                >
                  <div
                    className={`relative aspect-[2/3] w-full overflow-hidden rounded-[10px] bg-surface-alt ${isWatched ? 'border-2 border-accent' : 'border border-border'}`}
                  >
                    {poster ? (
                      <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-text-faint">No poster</div>
                    )}
                    {isWatched && (
                      <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0E0D10" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-center text-[10.5px] text-text-secondary">
                    {movie.title} {movie.year ? `(${movie.year})` : ''}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>

        {/* A fixed gap, not a flex-1 spacer — see MultiSelectStep.tsx for
            why: flex-1 collapses to nothing once the form is vertically
            centered instead of stretched (OnboardingShell's desktop
            layout), so however many candidates came back, there's still a
            real gap here rather than the button touching the grid. */}
        <p className="mt-8 mb-3 text-center text-[11.5px] text-text-muted">{watchedMovies.size} selected</p>
        <button
          type="button"
          onClick={() => onContinue([...watchedMovies.values()])}
          className="flex items-center justify-center rounded-xl bg-accent py-3.5 text-sm font-bold text-bg"
        >
          Continue
        </button>
        <button type="button" onClick={onSkip} className="mt-4 text-center text-[13px] font-semibold text-text-muted">
          Skip for now
        </button>
      </div>
    </OnboardingShell>
  )
}

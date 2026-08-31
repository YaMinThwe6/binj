import { useEffect, useRef, useState } from 'react'
import { searchMovies, getRecentMovies, type MovieSummary } from '../services/movieApi'
import { posterUrl } from '../../../lib/images'
import { MovieDetail } from './MovieDetail'

const DEBOUNCE_MS = 350
const MIN_QUERY_LENGTH = 2 // below this, a query is mostly noise against a broad catalog

interface Props {
  // Signed-in usage (via Home): go back to Home.
  onBack?: () => void
  // Guest usage (public Discover, root "/" for a signed-out visitor):
  // opens the Welcome/auth entry instead of a Home there's no signed-in
  // session to go back to. Exactly one of onBack/onRequireAuth is passed —
  // which one decides which header renders.
  onRequireAuth?: () => void
}

function MovieCard({ movie, onOpen }: { movie: MovieSummary; onOpen: () => void }) {
  const poster = posterUrl(movie.poster)
  return (
    <li>
      <button type="button" onClick={onOpen} className="w-full overflow-hidden rounded-xl border border-border bg-surface text-left">
        <div className="aspect-[2/3] w-full bg-surface-alt">
          {poster ? (
            <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-text-faint">No poster</div>
          )}
        </div>
        <div className="p-3">
          <div className="text-[13px] font-semibold text-text">{movie.title}</div>
          {movie.year && <div className="mt-0.5 text-[11.5px] text-text-muted">({movie.year})</div>}
        </div>
      </button>
    </li>
  )
}

export function MovieSearch({ onBack, onRequireAuth }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MovieSummary[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // "Recently released" — the default, browse-without-a-query view (api-contracts.md
  // §1's GET /movies/recent), shown below the search bar until the caller actually
  // searches for something.
  const [recent, setRecent] = useState<MovieSummary[]>([])
  const [recentStatus, setRecentStatus] = useState<'loading' | 'idle' | 'error'>('loading')

  useEffect(() => {
    getRecentMovies()
      .then((res) => {
        setRecent(res.items)
        setRecentStatus('idle')
      })
      .catch(() => setRecentStatus('error')) // non-critical section — fails quietly, search still works
  }, [])

  // Bumped on every search kickoff so a slow, superseded response can't
  // overwrite a newer one that already came back — a real risk once search
  // fires per keystroke instead of once per submit.
  const requestIdRef = useRef(0)

  async function runSearch(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    const thisRequestId = ++requestIdRef.current
    setStatus('loading')
    setSelectedMovieId(null)
    try {
      const { items } = await searchMovies(trimmed)
      if (requestIdRef.current !== thisRequestId) return // a newer search already superseded this one
      setResults(items)
      setHasSearched(true)
      setStatus('idle')
    } catch (err) {
      if (requestIdRef.current !== thisRequestId) return
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Search failed')
    }
  }

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Search-as-you-type: debounced so typing "Dune" fires one request, not
  // four — most of those resolve against the local Firestore index (movies
  // service.ts's tier 1/2), not TMDB live, which is what makes firing per
  // keystroke reasonable rather than wasteful. Below MIN_QUERY_LENGTH, or
  // once the box is cleared, this steps back to the recently-released view
  // instead of searching.
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    const trimmed = query.trim()
    if (trimmed.length === 0) {
      requestIdRef.current++ // invalidate any in-flight search — its result should never land now
      setHasSearched(false)
      setResults([])
      setStatus('idle')
      return
    }
    if (trimmed.length < MIN_QUERY_LENGTH) return

    debounceTimerRef.current = setTimeout(() => {
      void runSearch(trimmed)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    // An explicit submit (Enter/Search button) shouldn't leave a debounced
    // call still pending to fire again a moment later.
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    await runSearch(query)
  }

  if (selectedMovieId) {
    return <MovieDetail movieId={selectedMovieId} onBack={() => setSelectedMovieId(null)} onRequireAuth={onRequireAuth} />
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-bg text-text">
      <header className="flex items-center justify-between border-b border-border-soft px-5 py-4">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm font-semibold text-text-secondary">
            ← Home
          </button>
        ) : (
          <>
            <span className="font-serif text-lg font-bold text-accent">BINJ</span>
            <button type="button" onClick={onRequireAuth} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-bold text-bg">
              Get Started
            </button>
          </>
        )}
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        {!onBack && (
          <div className="mb-6">
            <h1 className="font-serif text-[26px] font-semibold text-white">Discover movies</h1>
            <p className="mt-1 text-[13.5px] text-text-muted">Search, browse, and see what BINJ's community thinks — sign in to rate, save, and connect.</p>
          </div>
        )}

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a movie…"
            aria-label="Search for a movie"
            className="flex-1 rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm text-text outline-none focus:border-accent"
          />
          <button type="submit" className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-bg">
            Search
          </button>
        </form>

        {status === 'loading' && <p className="mt-6 text-sm text-text-muted">Loading…</p>}
        {status === 'error' && (
          <p role="alert" className="mt-6 text-sm text-red-400">
            {errorMessage}
          </p>
        )}

        {hasSearched && status !== 'loading' ? (
          <>
            {results.length === 0 && status === 'idle' && <p className="mt-8 text-center text-sm text-text-muted">No results for "{query}".</p>}
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {results.map((movie) => (
                <MovieCard key={movie.movieId} movie={movie} onOpen={() => setSelectedMovieId(movie.movieId)} />
              ))}
            </ul>
          </>
        ) : (
          <section className="mt-8">
            <h2 className="text-[15px] font-semibold text-text">Recently released</h2>
            {recentStatus === 'loading' && <p className="mt-3 text-sm text-text-muted">Loading…</p>}
            {recentStatus === 'error' && <p className="mt-3 text-sm text-text-muted">Couldn't load recent releases right now.</p>}
            {recentStatus === 'idle' && recent.length === 0 && <p className="mt-3 text-sm text-text-muted">Nothing new to show right now.</p>}
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {recent.map((movie) => (
                <MovieCard key={movie.movieId} movie={movie} onOpen={() => setSelectedMovieId(movie.movieId)} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}

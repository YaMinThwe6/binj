import { useState } from 'react'
import { searchMovies, type MovieSummary } from '../services/movieApi'
import { MovieDetail } from './MovieDetail'

interface Props {
  // Signed-in usage (via Home): go back to Home.
  onBack?: () => void
  // Guest usage (public Discover, root "/" for a signed-out visitor):
  // opens the Welcome/auth entry instead of a Home there's no signed-in
  // session to go back to. Exactly one of onBack/onRequireAuth is passed —
  // which one decides which header renders.
  onRequireAuth?: () => void
}

export function MovieSearch({ onBack, onRequireAuth }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MovieSummary[]>([])
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setStatus('loading')
    setSelectedMovieId(null)
    try {
      const { items } = await searchMovies(query.trim())
      setResults(items)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Search failed')
    }
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
        {status === 'idle' && results.length === 0 && query === '' && (
          <p className="mt-8 text-center text-sm text-text-muted">Search for a title to get started.</p>
        )}

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {results.map((movie) => (
            <li key={movie.movieId}>
              <button
                type="button"
                onClick={() => setSelectedMovieId(movie.movieId)}
                className="w-full rounded-xl border border-border bg-surface p-3 text-left"
              >
                <div className="text-[13px] font-semibold text-text">{movie.title}</div>
                {movie.year && <div className="mt-0.5 text-[11.5px] text-text-muted">({movie.year})</div>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

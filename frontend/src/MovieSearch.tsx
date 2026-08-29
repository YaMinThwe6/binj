import { useState } from 'react'
import { searchMovies, type MovieSummary } from './lib/api'
import { MovieDetail } from './MovieDetail'

interface Props {
  onBack: () => void
}

export function MovieSearch({ onBack }: Props) {
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
    return <MovieDetail movieId={selectedMovieId} onBack={() => setSelectedMovieId(null)} />
  }

  return (
    <main className="app">
      <header className="app-header">
        <button type="button" onClick={onBack}>
          ← Home
        </button>
      </header>

      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a movie…"
          aria-label="Search for a movie"
        />
        <button type="submit">Search</button>
      </form>

      {status === 'loading' && <p>Loading…</p>}
      {status === 'error' && <p role="alert">{errorMessage}</p>}

      <ul className="results">
        {results.map((movie) => (
          <li key={movie.movieId}>
            <button type="button" onClick={() => setSelectedMovieId(movie.movieId)}>
              {movie.title} {movie.year ? `(${movie.year})` : ''}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

import { useState } from 'react'
import { searchMovies, getMovie, type MovieSummary, type MovieDetail } from './lib/api'
import './App.css'

function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MovieSummary[]>([])
  const [selected, setSelected] = useState<MovieDetail | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setStatus('loading')
    setSelected(null)
    try {
      const { items } = await searchMovies(query.trim())
      setResults(items)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Search failed')
    }
  }

  async function handleSelect(movieId: string) {
    setStatus('loading')
    try {
      const movie = await getMovie(movieId)
      setSelected(movie)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load movie')
    }
  }

  return (
    <main className="app">
      <h1>BINJ</h1>

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

      {selected ? (
        <article className="movie-detail">
          <button type="button" onClick={() => setSelected(null)}>
            ← Back to results
          </button>
          <h2>
            {selected.title} {selected.year ? `(${selected.year})` : ''}
          </h2>
          <p>{selected.synopsis}</p>
          <p>Genres: {selected.genres.join(', ')}</p>
          <p>TMDB rating: {selected.voteAverage.toFixed(1)}</p>
          {selected.cast.length > 0 && (
            <p>Cast: {selected.cast.slice(0, 5).map((c) => c.name).join(', ')}</p>
          )}
        </article>
      ) : (
        <ul className="results">
          {results.map((movie) => (
            <li key={movie.movieId}>
              <button type="button" onClick={() => handleSelect(movie.movieId)}>
                {movie.title} {movie.year ? `(${movie.year})` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default App

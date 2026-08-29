import { useEffect, useState } from 'react'
import { getRecommendations, type RecommendationItem } from '../services/homeApi'
import { markWatched, addToWatchlist } from '../../movie/services/movieApi'

export function TopPicks() {
  const [items, setItems] = useState<RecommendationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)
  const [added, setAdded] = useState<Record<string, 'watched' | 'watchlist'>>({})

  useEffect(() => {
    getRecommendations()
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load recommendations'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(movieId: string, kind: 'watched' | 'watchlist') {
    setOpenPopoverId(null)
    try {
      if (kind === 'watched') await markWatched(movieId)
      else await addToWatchlist(movieId)
      setAdded((prev) => ({ ...prev, [movieId]: kind }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  if (loading) return <section className="home-section"><h2>Top picks for you</h2><p>Loading…</p></section>
  if (error) return <section className="home-section"><h2>Top picks for you</h2><p role="alert">{error}</p></section>
  if (items.length === 0) return null

  return (
    <section className="home-section">
      <h2>Top picks for you</h2>
      <ul className="card-row">
        {items.map((movie) => (
          <li key={movie.movieId} className="movie-card">
            {movie.matchScore !== null && <span className="match-badge">{movie.matchScore}% match</span>}
            <button
              type="button"
              className="quick-add-toggle"
              aria-label={`Add ${movie.title}`}
              aria-expanded={openPopoverId === movie.movieId}
              onClick={() => setOpenPopoverId(openPopoverId === movie.movieId ? null : movie.movieId)}
            >
              +
            </button>
            {openPopoverId === movie.movieId && (
              <div className="quick-add-popover">
                <button type="button" onClick={() => handleAdd(movie.movieId, 'watched')}>Watched</button>
                <button type="button" onClick={() => handleAdd(movie.movieId, 'watchlist')}>Watchlist</button>
              </div>
            )}
            <div className="movie-title">{movie.title}</div>
            <div className="movie-meta">
              {movie.year ?? ''} {movie.genres.length > 0 ? `· ${movie.genres.slice(0, 2).join(', ')}` : ''}
            </div>
            <div className="movie-rating">★ {movie.voteAverage.toFixed(1)}</div>
            {added[movie.movieId] && <div className="added-badge">Added to {added[movie.movieId]}</div>}
          </li>
        ))}
      </ul>
    </section>
  )
}

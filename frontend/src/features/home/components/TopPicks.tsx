import { useEffect, useState } from 'react'
import { getRecommendations, type RecommendationItem } from '../services/homeApi'
import { markWatched, addToWatchlist } from '../../movie/services/movieApi'
import { posterUrl } from '../../../lib/images'

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

  if (loading)
    return (
      <section>
        <h2 className="mb-3 px-5 text-[15px] font-bold text-text">Top picks for you</h2>
        <p className="px-5 text-sm text-text-muted">Loading…</p>
      </section>
    )
  if (error)
    return (
      <section>
        <h2 className="mb-3 px-5 text-[15px] font-bold text-text">Top picks for you</h2>
        <p role="alert" className="px-5 text-sm text-red-400">
          {error}
        </p>
      </section>
    )
  if (items.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 px-5 text-[15px] font-bold text-text">Top picks for you</h2>
      <ul className="flex gap-3 overflow-x-auto px-5 pb-1">
        {items.map((movie) => {
          const poster = posterUrl(movie.poster)
          return (
            <li key={movie.movieId} className="w-32 flex-none">
              <div className="relative h-46 w-32 overflow-hidden rounded-xl bg-surface-alt">
                {poster ? (
                  <img src={poster} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-text-faint">No poster</div>
                )}
                {movie.matchScore !== null && (
                  <span className="absolute top-2 left-2 rounded-[7px] border border-[rgba(var(--accent-rgb),0.5)] bg-black/70 px-2 py-0.5 text-[10px] font-bold text-accent">
                    {movie.matchScore}% match
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Add ${movie.title}`}
                  aria-expanded={openPopoverId === movie.movieId}
                  onClick={() => setOpenPopoverId(openPopoverId === movie.movieId ? null : movie.movieId)}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-black/75 text-sm font-bold text-text"
                >
                  +
                </button>
                {openPopoverId === movie.movieId && (
                  <div className="absolute top-9 right-2 w-[106px] overflow-hidden rounded-[10px] border border-border bg-input shadow-[0_10px_22px_rgba(0,0,0,0.55)]">
                    <button
                      type="button"
                      onClick={() => handleAdd(movie.movieId, 'watched')}
                      className="flex w-full items-center gap-1.5 border-b border-border px-2.5 py-2 text-left text-[10.5px] font-semibold text-text"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3DDC84" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      Watched
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdd(movie.movieId, 'watchlist')}
                      className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[10.5px] font-semibold text-text"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
                        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                      </svg>
                      Watchlist
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-2 text-[12.5px] font-semibold text-text">{movie.title}</div>
              <div className="mt-0.5 text-[10.5px] text-text-muted">
                {movie.year ?? ''} {movie.genres.length > 0 ? `· ${movie.genres.slice(0, 2).join(', ')}` : ''}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10.5px] font-bold text-text">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-accent" aria-hidden="true">
                  <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6 6.1 20.6l1.3-6.6-4.9-4.6 6.6-.8z" />
                </svg>
                {movie.voteAverage.toFixed(1)}
              </div>
              {added[movie.movieId] && <div className="mt-1 text-[10px] font-semibold text-accent">Added to {added[movie.movieId]}</div>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFriendsRecommendations, type FriendsRecommendationItem } from '../services/homeApi'
import { markWatched, addToWatchlist } from '../../movie/services/movieApi'
import { posterUrl } from '../../../lib/images'

function watchedByLabel(count: number): string {
  return count === 1 ? '1 friend watched' : `${count} friends watched`
}

// Right-rail-only in the design (HomeDesktop.dc.html's "connected" state) — sits
// under PeopleYouMightVibeWith there. Deliberately has no empty/cold-start state
// of its own: getFriendsRecommendations already returns [] for anyone with no
// connections yet (home.service.ts), so this only ever renders once following
// someone actually produces a recommendation, same "gate, don't fabricate" choice
// PeopleYouMightVibeWith makes for taste matches.
export function BecauseYourFriendsWatched() {
  const navigate = useNavigate()
  const [items, setItems] = useState<FriendsRecommendationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)
  const [added, setAdded] = useState<Record<string, 'watched' | 'watchlist'>>({})

  useEffect(() => {
    let cancelled = false
    getFriendsRecommendations()
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load recommendations')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
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

  if (loading) return null
  if (error)
    return (
      <section>
        <h2 className="mb-3 px-5 text-[15px] font-bold text-text lg:px-0 lg:text-[13.5px]">Because your friends watched these</h2>
        <p role="alert" className="px-5 text-sm text-red-400 lg:px-0">
          {error}
        </p>
      </section>
    )
  if (items.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 px-5 text-[15px] font-bold text-text lg:px-0 lg:text-[13.5px]">Because your friends watched these</h2>
      <ul className="flex gap-3 overflow-x-auto px-5 pb-1 lg:flex-wrap lg:gap-2.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {items.map((movie) => {
          const poster = posterUrl(movie.poster)
          return (
            <li key={movie.movieId} className="w-32 flex-none lg:w-[92px]">
              {/* Whole card navigates to the movie's detail page — see TopPicks.tsx
                  for why this is a role="button" div (wraps other real buttons)
                  rather than a <button>, and why those nested buttons stopPropagation. */}
              <div
                role="button"
                tabIndex={0}
                aria-label={`Open ${movie.title}`}
                onClick={() => navigate(`/movie/${movie.movieId}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/movie/${movie.movieId}`)
                  }
                }}
                className="relative aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-xl bg-surface-alt lg:rounded-[10px]"
              >
                {poster ? (
                  <img src={poster} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-text-faint">No poster</div>
                )}
                <button
                  type="button"
                  aria-label={`Add ${movie.title}`}
                  aria-expanded={openPopoverId === movie.movieId}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenPopoverId(openPopoverId === movie.movieId ? null : movie.movieId)
                  }}
                  className="absolute top-1.5 right-1.5 flex h-5.5 w-5.5 items-center justify-center rounded-full border border-white/25 bg-black/75 text-xs font-bold text-text lg:h-5 lg:w-5"
                >
                  +
                </button>
                {openPopoverId === movie.movieId && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-7 right-1.5 w-[106px] overflow-hidden rounded-[10px] border border-border bg-input shadow-[0_10px_22px_rgba(0,0,0,0.55)]"
                  >
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
              <div className="mt-2 text-[12.5px] font-semibold text-text lg:mt-1.5 lg:text-[10.5px]">{movie.title}</div>
              <div className="mt-0.5 text-[10.5px] text-text-muted lg:text-[9.5px]">{watchedByLabel(movie.watchedByCount)}</div>
              {added[movie.movieId] && <div className="mt-1 text-[10px] font-semibold text-accent">Added to {added[movie.movieId]}</div>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

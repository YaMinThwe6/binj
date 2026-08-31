import { useEffect, useState } from 'react'
import {
  getMovie,
  getMovieStatus,
  getMovieReviews,
  submitReview,
  deleteReview,
  addToWatchlist,
  removeFromWatchlist,
  markWatched,
  unmarkWatched,
  likeMovie,
  unlikeMovie,
  type MovieDetail as MovieDetailData,
  type MovieStatus,
  type Review
} from '../services/movieApi'
import { WatchedByFriends } from './WatchedByFriends'
import { Profile } from '../../profile/components/Profile'
import { useAuth } from '../../../lib/AuthContext'
import { posterUrl } from '../../../lib/images'

interface Props {
  movieId: string
  onBack: () => void
  // Present only when MovieDetail is reached by a signed-out visitor
  // (the public Discover flow, hld.md §3's "public search/browse does not
  // require auth" extended to detail view) — lets a guest opt into signing
  // in from here instead of the action bar/review form just failing.
  onRequireAuth?: () => void
}

const EMPTY_STATUS: MovieStatus = { watchlisted: false, watched: false, liked: false, review: null }

function formatRuntime(minutes: number | null): string {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m (${minutes} min)` : `${minutes} min`
}

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6 6.1 20.6l1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  )
}

function ActionButton({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick?: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span
        className={`flex h-[46px] w-[46px] items-center justify-center rounded-full border ${
          active ? 'border-accent bg-input text-accent' : 'border-border bg-input text-text-secondary'
        }`}
      >
        {icon}
      </span>
      <span className={`text-[10.5px] font-semibold ${active ? 'text-accent' : 'text-text-secondary'}`}>{label}</span>
    </button>
  )
}

export function MovieDetail({ movieId, onBack, onRequireAuth }: Props) {
  const { user } = useAuth()
  const isGuest = !user
  const [movie, setMovie] = useState<MovieDetailData | null>(null)
  const [movieError, setMovieError] = useState('')

  const [status, setStatus] = useState<MovieStatus>(EMPTY_STATUS)
  const [statusError, setStatusError] = useState('')
  const [actionError, setActionError] = useState('')

  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsError, setReviewsError] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [formError, setFormError] = useState('')
  const [openProfileUid, setOpenProfileUid] = useState<string | null>(null)

  function loadReviews() {
    return getMovieReviews(movieId)
      .then((res) => setReviews(res.items))
      .catch((err) => setReviewsError(err instanceof Error ? err.message : 'Failed to load reviews'))
  }

  function loadStatus() {
    return getMovieStatus(movieId)
      .then(setStatus)
      .catch((err) => setStatusError(err instanceof Error ? err.message : 'Failed to load status'))
  }

  // Separate from the initial-mount fetch below so submit/delete can refresh
  // just the rating aggregate without re-triggering the "Loading…" full-page
  // state — the movie's own binjRating changes every time a review is posted
  // or removed, so it can't just be fetched once on mount.
  function loadMovie() {
    return getMovie(movieId)
      .then(setMovie)
      .catch((err) => setMovieError(err instanceof Error ? err.message : 'Failed to load movie'))
  }

  useEffect(() => {
    loadMovie()
    if (!isGuest) loadStatus() // status/review-ownership is per-caller — nothing to fetch signed out
    loadReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId])

  async function toggle(kind: 'watchlisted' | 'watched' | 'liked') {
    const previous = status[kind]
    setActionError('')
    setStatus((prev) => ({ ...prev, [kind]: !previous }))
    try {
      if (kind === 'watchlisted') await (previous ? removeFromWatchlist(movieId) : addToWatchlist(movieId))
      else if (kind === 'watched') await (previous ? unmarkWatched(movieId) : markWatched(movieId))
      else await (previous ? unlikeMovie(movieId) : likeMovie(movieId))
    } catch (err) {
      setStatus((prev) => ({ ...prev, [kind]: previous }))
      setActionError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  function openForm() {
    if (status.review) {
      setRating(status.review.rating)
      setReviewText(status.review.reviewText ?? '')
      setIsAnonymous(status.review.isAnonymous)
    } else {
      setRating(0)
      setReviewText('')
      setIsAnonymous(false)
    }
    setFormError('')
    setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating < 1) return
    setFormError('')
    try {
      await submitReview(movieId, { rating, reviewText: reviewText.trim() || null, isAnonymous })
      setFormOpen(false)
      await Promise.all([loadReviews(), loadStatus(), loadMovie()])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save review')
    }
  }

  async function handleDelete() {
    setFormError('')
    try {
      await deleteReview(movieId)
      setFormOpen(false)
      await Promise.all([loadReviews(), loadStatus(), loadMovie()])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete review')
    }
  }

  if (openProfileUid) {
    return <Profile uid={openProfileUid} onBack={() => setOpenProfileUid(null)} />
  }

  if (movieError) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-bg px-6 text-text">
        <button type="button" onClick={onBack} className="self-start text-sm font-semibold text-text-secondary">
          ← Back
        </button>
        <p role="alert" className="text-sm text-red-400">
          {movieError}
        </p>
      </main>
    )
  }

  if (!movie) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-bg text-text">
        <p className="text-sm text-text-muted">Loading…</p>
      </main>
    )
  }

  const binjAverage = movie.binjRating.count > 0 ? (movie.binjRating.sum / movie.binjRating.count).toFixed(1) : null
  const poster = posterUrl(movie.poster, 'w500')

  return (
    <main className="min-h-svh bg-bg text-text">
      {/* Hero backdrop */}
      <div
        className="relative h-[224px] w-full overflow-hidden"
        style={{
          background:
            'radial-gradient(120% 90% at 85% 5%, rgba(150,170,200,0.14), transparent 55%), radial-gradient(100% 80% at 5% 95%, rgba(var(--accent-rgb),0.18), transparent 55%), linear-gradient(180deg, #1B1720 0%, #100E12 100%)'
        }}
      >
        <div className="absolute inset-x-0 top-0 h-[90px] bg-gradient-to-b from-black/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-b from-transparent to-bg" />
        <div className="absolute top-4 left-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/10 bg-black/55"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#F3F1ED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Poster + title glass card, overlapping the hero */}
      <div className="relative mx-5 -mt-14 flex items-end gap-3.5 rounded-[20px] border border-white/10 bg-surface/55 p-4 shadow-[0_14px_34px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="h-36 w-[100px] flex-none overflow-hidden rounded-xl bg-surface-alt shadow-[0_6px_16px_rgba(0,0,0,0.4)]">
          {poster && <img src={poster} alt="" className="poster h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1 pb-0.5">
          <h1 className="font-serif text-[21px] leading-tight font-semibold text-white">{movie.title}</h1>
          <p className="mt-1.5 mb-2.5 text-[11.5px] text-text-secondary">
            {movie.year} · {movie.genres.join(', ')} · {formatRuntime(movie.runtime)}
          </p>
          <div className="flex items-center gap-3 text-[13px] font-bold">
            <span className="flex items-center gap-1 text-text">
              <StarIcon filled className="text-text" />
              {movie.voteAverage.toFixed(1)}
            </span>
            {binjAverage ? (
              <span className="flex items-center gap-1 text-accent">
                <StarIcon filled className="text-[#FFC107]" />
                {binjAverage}
              </span>
            ) : (
              <span className="text-[11.5px] font-semibold text-text-muted">No ratings yet</span>
            )}
          </div>
        </div>
      </div>

      {statusError && (
        <p role="alert" className="mt-4 px-5 text-[13px] text-red-400">
          {statusError}
        </p>
      )}
      {actionError && (
        <p role="alert" className="mt-2 px-5 text-[13px] text-red-400">
          {actionError}
        </p>
      )}

      {isGuest ? (
        <div className="px-5 pt-5">
          <button type="button" onClick={onRequireAuth} className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-bg">
            Sign in to save, rate &amp; review
          </button>
        </div>
      ) : (
        <div className="flex justify-around px-4 pt-5">
          <ActionButton
            label="Watchlist"
            active={status.watchlisted}
            onClick={() => toggle('watchlisted')}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
              </svg>
            }
          />
          <ActionButton
            label="Watched"
            active={status.watched}
            onClick={() => toggle('watched')}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 12.5l2.3 2.3 4.7-5.1" />
              </svg>
            }
          />
          <ActionButton
            label="Like"
            active={status.liked}
            onClick={() => toggle('liked')}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
              </svg>
            }
          />
        </div>
      )}

      <div className="flex flex-col gap-7 px-5 py-7">
        {!isGuest && <WatchedByFriends movieId={movieId} onOpenProfile={setOpenProfileUid} />}

        {movie.streamingProviders.length > 0 && (
          <section>
            <h2 className="mb-3 text-[15px] font-bold text-text">Where can I watch?</h2>
            <ul className="flex flex-wrap gap-2.5">
              {movie.streamingProviders.map((p, i) => (
                // TMDB can list the same provider more than once under different
                // offer types (e.g. "Apple TV Store" as both rent and buy) — name
                // alone isn't a unique key, so index disambiguates duplicates.
                <li key={`${p.name}-${i}`} className="rounded-full border border-border bg-input px-3.5 py-2 text-[12.5px] font-semibold text-text">
                  {p.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2.5 text-[15px] font-bold text-text">About</h2>
          <p className="text-sm leading-relaxed text-text-secondary">{movie.synopsis}</p>
        </section>

        {movie.cast.length > 0 && (
          <section>
            <h2 className="mb-3 text-[15px] font-bold text-text">Cast</h2>
            <ul className="flex gap-4 overflow-x-auto pb-0.5">
              {movie.cast.map((c) => (
                <li key={c.personId} className="w-16 flex-none text-center">
                  <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(124,140,166,0.32)] bg-[rgba(124,140,166,0.14)] font-serif text-base text-[#9BABC4]">
                    {c.name.charAt(0)}
                  </div>
                  <div className="text-[11px] font-semibold text-text">{c.name}</div>
                  <div className="text-[10px] text-text-muted">{c.character}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-[15px] font-bold text-text">Reviews</h2>
          {reviewsError && (
            <p role="alert" className="mb-3 text-[13px] text-red-400">
              {reviewsError}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {reviews.map((r, i) => (
              <li key={r.authorId ?? `anon-${i}`} className="rounded-2xl border border-border bg-input p-3.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-text">{r.isAnonymous ? 'Anonymous' : r.displayName}</span>
                  <span className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <StarIcon key={n} filled={n <= r.rating} className={n <= r.rating ? 'text-[#FFC107]' : 'text-border'} />
                    ))}
                  </span>
                </div>
                {r.reviewText && <p className="text-[13.5px] leading-relaxed text-text-secondary">{r.reviewText}</p>}
              </li>
            ))}
          </ul>

          {isGuest ? (
            <button type="button" onClick={onRequireAuth} className="mt-3 w-full rounded-xl border border-border bg-surface-alt py-3 text-[13.5px] font-bold text-text">
              Sign in to write a review
            </button>
          ) : (
            <button type="button" onClick={openForm} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-[13.5px] font-bold text-bg">
              {status.review ? 'Edit your review' : 'Write a review'}
            </button>
          )}

          {!isGuest && formOpen && (
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5 rounded-2xl border border-border bg-surface-alt p-4">
              <div role="group" aria-label="Rating" className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-pressed={star <= rating}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    onClick={() => setRating(star)}
                    className={star <= rating ? 'text-2xl text-accent' : 'text-2xl text-border'}
                  >
                    ★
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="review-text" className="mb-1.5 block text-xs font-semibold text-text-secondary">
                  Review
                </label>
                <textarea
                  id="review-text"
                  aria-label="Review"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share your thoughts (optional)…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-input px-3.5 py-3 text-sm text-text outline-none focus:border-accent"
                />
              </div>

              <label className="flex items-center gap-2 text-[13px] text-text-secondary">
                <input
                  type="checkbox"
                  aria-label="Post anonymously"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Post anonymously
              </label>

              {formError && (
                <p role="alert" className="text-[13px] text-red-400">
                  {formError}
                </p>
              )}

              <button type="submit" disabled={rating < 1} className="rounded-xl bg-accent py-3 text-sm font-bold text-bg disabled:opacity-40">
                Post Review
              </button>
              {status.review && (
                <button type="button" onClick={handleDelete} className="text-[13px] font-semibold text-red-400">
                  Delete review
                </button>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  )
}

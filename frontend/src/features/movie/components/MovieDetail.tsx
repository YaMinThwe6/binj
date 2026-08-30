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
      <main className="movie-detail-page">
        <button type="button" onClick={onBack}>← Back</button>
        <p role="alert">{movieError}</p>
      </main>
    )
  }

  if (!movie) {
    return (
      <main className="movie-detail-page">
        <p>Loading…</p>
      </main>
    )
  }

  const binjAverage = movie.binjRating.count > 0 ? (movie.binjRating.sum / movie.binjRating.count).toFixed(1) : null

  return (
    <main className="movie-detail-page">
      <button type="button" onClick={onBack}>← Back</button>

      <header>
        {posterUrl(movie.poster) && <img src={posterUrl(movie.poster, 'w500')!} alt="" className="poster" />}
        <h1>{movie.title}</h1>
        <p>
          {movie.year} · {movie.genres.join(', ')} · {formatRuntime(movie.runtime)}
        </p>
        <div className="ratings">
          <span>{movie.voteAverage.toFixed(1)}</span>
          {binjAverage ? <span>{binjAverage}</span> : <span>No ratings yet</span>}
        </div>
      </header>

      {statusError && <p role="alert">{statusError}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      {isGuest ? (
        <div className="action-bar">
          <button type="button" onClick={onRequireAuth}>
            Sign in to save, rate &amp; review
          </button>
        </div>
      ) : (
        <div className="action-bar">
          <button type="button" aria-pressed={status.watchlisted} onClick={() => toggle('watchlisted')}>
            Watchlist
          </button>
          <button type="button" aria-pressed={status.watched} onClick={() => toggle('watched')}>
            Watched
          </button>
          <button type="button" aria-pressed={status.liked} onClick={() => toggle('liked')}>
            Like
          </button>
        </div>
      )}

      {!isGuest && <WatchedByFriends movieId={movieId} onOpenProfile={setOpenProfileUid} />}

      {movie.streamingProviders.length > 0 && (
        <section>
          <h2>Where can I watch?</h2>
          <ul>
            {movie.streamingProviders.map((p, i) => (
              // TMDB can list the same provider more than once under different
              // offer types (e.g. "Apple TV Store" as both rent and buy) — name
              // alone isn't a unique key, so index disambiguates duplicates.
              <li key={`${p.name}-${i}`}>{p.name}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>About</h2>
        <p>{movie.synopsis}</p>
      </section>

      {movie.cast.length > 0 && (
        <section>
          <h2>Cast</h2>
          <ul>
            {movie.cast.map((c) => (
              <li key={c.personId}>
                <div>{c.name}</div>
                <div>{c.character}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Reviews</h2>
        {reviewsError && <p role="alert">{reviewsError}</p>}
        <ul className="review-list">
          {reviews.map((r, i) => (
            <li key={r.authorId ?? `anon-${i}`}>
              <div>{r.isAnonymous ? 'Anonymous' : r.displayName}</div>
              <div>{'★'.repeat(r.rating)}</div>
              {r.reviewText && <p>{r.reviewText}</p>}
            </li>
          ))}
        </ul>

        {isGuest ? (
          <button type="button" onClick={onRequireAuth}>
            Sign in to write a review
          </button>
        ) : (
          <button type="button" onClick={openForm}>
            {status.review ? 'Edit your review' : 'Write a review'}
          </button>
        )}

        {!isGuest && formOpen && (
          <form onSubmit={handleSubmit} className="review-form">
            <div role="group" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-pressed={star <= rating}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  onClick={() => setRating(star)}
                >
                  ★
                </button>
              ))}
            </div>

            <label htmlFor="review-text">Review</label>
            <textarea
              id="review-text"
              aria-label="Review"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your thoughts (optional)…"
            />

            <label>
              <input
                type="checkbox"
                aria-label="Post anonymously"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              Post anonymously
            </label>

            {formError && <p role="alert">{formError}</p>}

            <button type="submit" disabled={rating < 1}>
              Post Review
            </button>
            {status.review && (
              <button type="button" onClick={handleDelete}>
                Delete review
              </button>
            )}
          </form>
        )}
      </section>
    </main>
  )
}

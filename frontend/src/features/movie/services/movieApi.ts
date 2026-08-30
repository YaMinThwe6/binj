import { apiFetch } from '../../../lib/api'
export type { MovieSummary, MovieDetail, MovieStatus, Review, MyReview, WatchedByEntry } from '@binj/shared-types'
import type { MovieSummary, MovieDetail, MovieStatus, Review, MyReview, WatchedByEntry } from '@binj/shared-types'

export function searchMovies(query: string): Promise<{ items: MovieSummary[] }> {
  return apiFetch(`/search/movies?q=${encodeURIComponent(query)}`)
}

export function getRecentMovies(): Promise<{ items: MovieSummary[] }> {
  return apiFetch('/movies/recent')
}

export function getMovie(movieId: string): Promise<MovieDetail> {
  return apiFetch(`/movies/${encodeURIComponent(movieId)}`)
}

export function getMovieStatus(movieId: string): Promise<MovieStatus> {
  return apiFetch(`/users/me/movies/${encodeURIComponent(movieId)}`, { auth: true })
}

export function getMovieReviews(movieId: string, cursor?: string): Promise<{ items: Review[]; nextCursor: string | null }> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
  return apiFetch(`/movies/${encodeURIComponent(movieId)}/reviews${qs}`)
}

export function submitReview(
  movieId: string,
  review: { rating: number; reviewText: string | null; isAnonymous: boolean }
): Promise<MyReview> {
  return apiFetch(`/movies/${encodeURIComponent(movieId)}/reviews/me`, { method: 'PUT', body: review, auth: true })
}

export function deleteReview(movieId: string): Promise<void> {
  return apiFetch(`/movies/${encodeURIComponent(movieId)}/reviews/me`, { method: 'DELETE', auth: true })
}

export function likeMovie(movieId: string): Promise<void> {
  return apiFetch(`/users/me/likes/${encodeURIComponent(movieId)}`, { method: 'PUT', auth: true })
}

export function unlikeMovie(movieId: string): Promise<void> {
  return apiFetch(`/users/me/likes/${encodeURIComponent(movieId)}`, { method: 'DELETE', auth: true })
}

export function addToWatchlist(movieId: string): Promise<void> {
  return apiFetch(`/users/me/watchlist/${encodeURIComponent(movieId)}`, { method: 'PUT', auth: true })
}

export function removeFromWatchlist(movieId: string): Promise<void> {
  return apiFetch(`/users/me/watchlist/${encodeURIComponent(movieId)}`, { method: 'DELETE', auth: true })
}

export function markWatched(movieId: string): Promise<void> {
  return apiFetch(`/users/me/watched/${encodeURIComponent(movieId)}`, { method: 'PUT', auth: true })
}

export function unmarkWatched(movieId: string): Promise<void> {
  return apiFetch(`/users/me/watched/${encodeURIComponent(movieId)}`, { method: 'DELETE', auth: true })
}

export function getMovieWatchedBy(movieId: string): Promise<{ items: WatchedByEntry[]; nextCursor: string | null }> {
  return apiFetch(`/movies/${encodeURIComponent(movieId)}/watchedBy`, { auth: true })
}

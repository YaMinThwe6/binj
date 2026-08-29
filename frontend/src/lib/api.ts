import { auth } from './firebase'
// Request/response shapes live in @binj/shared-types, the single source of
// truth both frontend and backend import from (packages/shared-types) — see
// [[feedback_monorepo_shared_packages_solid]]. Re-exported here so every
// existing `import type { X } from '../lib/api'` across the app keeps working
// unchanged; `Me` is this file's own name for the shared `UserProfile`.
export type {
  MovieSummary,
  MovieDetail,
  MovieCandidate,
  CelebritySuggestion,
  RecommendationItem,
  TasteMatch,
  UpcomingEvent,
  ActivityItem,
  Greeting,
  NotificationItem,
  Review,
  MyReview,
  MovieStatus
} from '@binj/shared-types'
export type { UserProfile as Me } from '@binj/shared-types'

import type {
  MovieSummary,
  MovieDetail,
  MovieCandidate,
  CelebritySuggestion,
  RecommendationItem,
  TasteMatch,
  UpcomingEvent,
  ActivityItem,
  Greeting,
  NotificationItem,
  Review,
  MyReview,
  MovieStatus,
  UserProfile as Me
} from '@binj/shared-types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:6501'

interface ApiFetchOptions {
  method?: string
  body?: unknown
  auth?: boolean
}

async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (options.auth) {
    const token = await auth.currentUser?.getIdToken()
    if (!token) {
      throw new Error('Not signed in')
    }
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  })

  if (!res.ok) {
    const responseBody = await res.json().catch(() => null)
    throw new Error(responseBody?.error?.message ?? `Request failed: ${res.status}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json()
}

export function searchMovies(query: string): Promise<{ items: MovieSummary[] }> {
  return apiFetch(`/search/movies?q=${encodeURIComponent(query)}`)
}

export function getMovie(movieId: string): Promise<MovieDetail> {
  return apiFetch(`/movies/${encodeURIComponent(movieId)}`)
}

export function getMe(): Promise<Me> {
  return apiFetch('/users/me', { auth: true })
}

export function startEmailAuth(email: string): Promise<void> {
  return apiFetch('/auth/email/start', { method: 'POST', body: { email } })
}

export function verifyEmailAuth(email: string, code: string): Promise<{ customToken: string }> {
  return apiFetch('/auth/email/verify', { method: 'POST', body: { email, code } })
}

export function updateMe(patch: Partial<Pick<Me, 'displayName' | 'username' | 'listVisible' | 'followRequiresApproval' | 'favoriteGenres' | 'preferredLanguages' | 'onboardingComplete' | 'themePreference' | 'accentTheme'>>): Promise<Me> {
  return apiFetch('/users/me', { method: 'PATCH', body: patch, auth: true })
}

export function checkUsernameAvailable(username: string): Promise<{ available: boolean }> {
  return apiFetch(`/users/username-available?username=${encodeURIComponent(username)}`)
}

export function getWatchedCandidates(genres: string[], languages: string[]): Promise<{ items: MovieCandidate[] }> {
  const params = new URLSearchParams()
  if (genres.length > 0) params.set('genres', genres.join(','))
  if (languages.length > 0) params.set('languages', languages.join(','))
  const qs = params.toString()
  return apiFetch(`/onboarding/watched-candidates${qs ? `?${qs}` : ''}`, { auth: true })
}

export function markWatched(movieId: string): Promise<void> {
  return apiFetch(`/users/me/watched/${encodeURIComponent(movieId)}`, { method: 'PUT', auth: true })
}

export function unmarkWatched(movieId: string): Promise<void> {
  return apiFetch(`/users/me/watched/${encodeURIComponent(movieId)}`, { method: 'DELETE', auth: true })
}

export function getCelebritySuggestions(): Promise<{ items: CelebritySuggestion[] }> {
  return apiFetch('/onboarding/celebrity-suggestions', { auth: true })
}

export function followCelebrity(personId: string): Promise<void> {
  return apiFetch(`/users/me/followedCelebrities/${encodeURIComponent(personId)}`, { method: 'PUT', auth: true })
}

export function unfollowCelebrity(personId: string): Promise<void> {
  return apiFetch(`/users/me/followedCelebrities/${encodeURIComponent(personId)}`, { method: 'DELETE', auth: true })
}

export function addToWatchlist(movieId: string): Promise<void> {
  return apiFetch(`/users/me/watchlist/${encodeURIComponent(movieId)}`, { method: 'PUT', auth: true })
}

export function removeFromWatchlist(movieId: string): Promise<void> {
  return apiFetch(`/users/me/watchlist/${encodeURIComponent(movieId)}`, { method: 'DELETE', auth: true })
}

export function getRecommendations(): Promise<{ items: RecommendationItem[] }> {
  return apiFetch('/recommendations', { auth: true })
}

export function getTasteMatches(): Promise<{ items: TasteMatch[] }> {
  return apiFetch('/users/me/tasteMatches', { auth: true })
}

export function followUser(uid: string): Promise<{ status: 'following' | 'pending' }> {
  return apiFetch(`/users/${encodeURIComponent(uid)}/follow`, { method: 'PUT', auth: true })
}

export function unfollowUser(uid: string): Promise<void> {
  return apiFetch(`/users/${encodeURIComponent(uid)}/follow`, { method: 'DELETE', auth: true })
}

export function getUpcomingEvents(): Promise<{ items: UpcomingEvent[] }> {
  return apiFetch('/events/upcoming', { auth: true })
}

export function joinEvent(eventId: string): Promise<{ status: 'joined' | 'pending' }> {
  return apiFetch(`/events/${encodeURIComponent(eventId)}/join`, { method: 'PUT', auth: true })
}

export function leaveEvent(eventId: string): Promise<void> {
  return apiFetch(`/events/${encodeURIComponent(eventId)}/join`, { method: 'DELETE', auth: true })
}

export function getHomeGreeting(): Promise<Greeting> {
  return apiFetch('/home/greeting', { auth: true })
}

export function getHomeActivity(): Promise<{ items: ActivityItem[] }> {
  return apiFetch('/home/activity', { auth: true })
}

export function getNotifications(unreadOnly = false): Promise<{ items: NotificationItem[] }> {
  return apiFetch(`/users/me/notifications${unreadOnly ? '?unreadOnly=true' : ''}`, { auth: true })
}

export function markNotificationRead(id: string): Promise<void> {
  return apiFetch(`/users/me/notifications/${encodeURIComponent(id)}`, { method: 'PATCH', body: { read: true }, auth: true })
}

export function likeMovie(movieId: string): Promise<void> {
  return apiFetch(`/users/me/likes/${encodeURIComponent(movieId)}`, { method: 'PUT', auth: true })
}

export function unlikeMovie(movieId: string): Promise<void> {
  return apiFetch(`/users/me/likes/${encodeURIComponent(movieId)}`, { method: 'DELETE', auth: true })
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

import { auth } from './firebase'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:6501'

export interface MovieSummary {
  movieId: string
  title: string
  poster: string | null
  year: number | null
}

export interface MovieDetail extends MovieSummary {
  runtime: number | null
  genres: string[]
  synopsis: string | null
  cast: { name: string; character: string; photo: string | null }[]
  crew: { name: string; role: string; photo: string | null }[]
  voteAverage: number
  voteCount: number
  trailerKey: string | null
  streamingProviders: { name: string; type: string; logo: string }[]
}

export interface Me {
  uid: string
  displayName: string
  username: string | null
  email: string
  photoURL: string | null
  listVisible: boolean
  followRequiresApproval: boolean
  status: 'active' | 'restricted' | 'suspended'
  favoriteGenres: string[] | null
  preferredLanguages: string[] | null
  onboardingComplete: boolean
  notificationPrefs: { emailEnabled: boolean }
  themePreference: 'dark' | 'light' | 'system'
  accentTheme: 'emerald' | 'cyan' | 'purple' | 'pink' | 'amber' | 'red'
  isNewUser: boolean
}

export interface MovieCandidate {
  movieId: string
  title: string
  poster: string | null
  year: number | null
  genres: string[]
  originalLanguage?: string | null
  voteAverage: number
}

export interface CelebritySuggestion {
  personId: string
  name: string
  photo: string | null
  appearsIn: number
}

export interface RecommendationItem {
  movieId: string
  title: string
  poster: string | null
  year: number | null
  genres: string[]
  voteAverage: number
  matchScore: number | null
}

export interface TasteMatch {
  uid: string
  displayName: string
  score: number
  relationship: 'following' | 'pending' | 'none'
}

export interface UpcomingEvent {
  eventId: string
  hostId: string
  movieId: string
  title: string | null
  datetime: string | null
  mode: 'online' | 'in-person'
  location: { address: string; lat: number; lng: number } | null
  visibility: 'public' | 'private'
  participantLimit: number
  participantCount: number
  requiresApproval: boolean
  movieTitle: string | null
  moviePoster: string | null
}

export interface ActivityItem {
  activityId: string
  uid: string
  displayName: string
  type: 'watched' | 'watchlist_added'
  movieId: string
  movieTitle: string | null
  moviePoster: string | null
  createdAt: string | null
}

export interface Greeting {
  quote: string
  attribution: string
  source: 'watched' | 'random'
}

export interface NotificationItem {
  id: string
  type: string
  fromUserId: string | null
  targetType: string | null
  targetId: string | null
  read: boolean
  createdAt: string | null
}

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

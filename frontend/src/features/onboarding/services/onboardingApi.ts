import { apiFetch } from '../../../lib/api'
export type { MovieCandidate, CelebritySuggestion } from '@binj/shared-types'
import type { MovieCandidate, CelebritySuggestion } from '@binj/shared-types'

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

export function getCelebritySuggestions(): Promise<{ items: CelebritySuggestion[] }> {
  return apiFetch('/onboarding/celebrity-suggestions', { auth: true })
}

export function followCelebrity(personId: string): Promise<void> {
  return apiFetch(`/users/me/followedCelebrities/${encodeURIComponent(personId)}`, { method: 'PUT', auth: true })
}

export function unfollowCelebrity(personId: string): Promise<void> {
  return apiFetch(`/users/me/followedCelebrities/${encodeURIComponent(personId)}`, { method: 'DELETE', auth: true })
}

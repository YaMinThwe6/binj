import { apiFetch } from '../../../lib/api'
export type { RecommendationItem, TasteMatch, UpcomingEvent, ActivityItem, Greeting, NotificationItem, NearbyEvent } from '@binj/shared-types'
import type { RecommendationItem, TasteMatch, UpcomingEvent, ActivityItem, Greeting, NotificationItem, NearbyEvent } from '@binj/shared-types'

export function getHomeGreeting(): Promise<Greeting> {
  return apiFetch('/home/greeting', { auth: true })
}

export function getHomeActivity(): Promise<{ items: ActivityItem[] }> {
  return apiFetch('/home/activity', { auth: true })
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

export function getNearbyEvents(lat: number, lng: number, radiusKm: number): Promise<{ items: NearbyEvent[] }> {
  return apiFetch(`/events/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`, { auth: true })
}

export function joinEvent(eventId: string): Promise<{ status: 'joined' | 'pending' }> {
  return apiFetch(`/events/${encodeURIComponent(eventId)}/join`, { method: 'PUT', auth: true })
}

export function leaveEvent(eventId: string): Promise<void> {
  return apiFetch(`/events/${encodeURIComponent(eventId)}/join`, { method: 'DELETE', auth: true })
}

export function getNotifications(unreadOnly = false): Promise<{ items: NotificationItem[] }> {
  return apiFetch(`/users/me/notifications${unreadOnly ? '?unreadOnly=true' : ''}`, { auth: true })
}

export function markNotificationRead(id: string): Promise<void> {
  return apiFetch(`/users/me/notifications/${encodeURIComponent(id)}`, { method: 'PATCH', body: { read: true }, auth: true })
}

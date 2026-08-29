import { useState } from 'react'
import { getNearbyEvents, joinEvent, type NearbyEvent } from '../services/homeApi'
import { NearbyEventsMap } from './NearbyEventsMap'
import { mapsConfigured } from '../../../lib/maps'

const DEFAULT_RADIUS_KM = 25

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

type Status = 'idle' | 'locating' | 'loading' | 'loaded' | 'denied' | 'error'

// hld.md §9 — explicit opt-in (button, not auto-requested on mount) rather
// than prompting for location on every Home visit: matches PRD §30.7's
// no-location-without-consent principle, and the browser's own permission
// prompt only fires once findNearby() actually calls getCurrentPosition.
interface Props {
  onOpenChat: (roomId: string) => void
}

export function NearbyEvents({ onOpenChat }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [items, setItems] = useState<NearbyEvent[]>([])
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')
  const [joinStatus, setJoinStatus] = useState<Record<string, 'joined' | 'pending'>>({})

  function findNearby() {
    if (!navigator.geolocation) {
      setStatus('error')
      setError('Location is not available in this browser')
      return
    }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus('loading')
        setCenter({ lat: position.coords.latitude, lng: position.coords.longitude })
        getNearbyEvents(position.coords.latitude, position.coords.longitude, DEFAULT_RADIUS_KM)
          .then((res) => {
            setItems(res.items)
            setStatus('loaded')
          })
          .catch((err) => {
            setStatus('error')
            setError(err instanceof Error ? err.message : 'Failed to load nearby events')
          })
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) setStatus('denied')
        else {
          setStatus('error')
          setError('Could not determine your location')
        }
      }
    )
  }

  async function handleJoin(eventId: string) {
    try {
      const { status: joined } = await joinEvent(eventId)
      setJoinStatus((prev) => ({ ...prev, [eventId]: joined }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join event')
    }
  }

  return (
    <section className="home-section">
      <h2>Watch parties near you</h2>

      {status === 'idle' && (
        <button type="button" onClick={findNearby}>Find events near me</button>
      )}
      {status === 'locating' && <p>Getting your location…</p>}
      {status === 'loading' && <p>Loading…</p>}
      {status === 'denied' && <p>Enable location access to see watch parties near you.</p>}
      {status === 'error' && <p role="alert">{error}</p>}
      {status === 'loaded' && items.length === 0 && <p>No watch parties nearby right now.</p>}

      {status === 'loaded' && mapsConfigured && center && items.length > 0 && (
        <NearbyEventsMap center={center} items={items} joinStatus={joinStatus} onJoin={handleJoin} />
      )}

      {status === 'loaded' && items.length > 0 && (
        <ul className="event-list">
          {items.map((event) => {
            const joined = joinStatus[event.eventId]
            return (
              <li key={event.eventId} className="event-card">
                <span className={`mode-badge mode-${event.mode}`}>{event.mode === 'online' ? 'Online' : 'In-person'}</span>
                <div className="event-title">{event.title ?? event.movieTitle ?? 'Watch party'}</div>
                <div className="event-meta">{formatDate(event.datetime)}</div>
                <div className="event-meta">{event.distanceKm} km away</div>
                <button type="button" disabled={!!joined} onClick={() => handleJoin(event.eventId)}>
                  {joined === 'joined' ? 'Joined' : joined === 'pending' ? 'Requested' : 'Join'}
                </button>
                {joined === 'joined' && (
                  <button type="button" onClick={() => onOpenChat(event.roomId)}>Chat</button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

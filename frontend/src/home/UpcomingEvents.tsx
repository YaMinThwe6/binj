import { useEffect, useState } from 'react'
import { getUpcomingEvents, joinEvent, type UpcomingEvent } from '../lib/api'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function UpcomingEvents() {
  const [items, setItems] = useState<UpcomingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joinStatus, setJoinStatus] = useState<Record<string, 'joined' | 'pending'>>({})

  useEffect(() => {
    getUpcomingEvents()
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load events'))
      .finally(() => setLoading(false))
  }, [])

  async function handleJoin(eventId: string) {
    try {
      const { status } = await joinEvent(eventId)
      setJoinStatus((prev) => ({ ...prev, [eventId]: status }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join event')
    }
  }

  if (loading) return <section className="home-section"><h2>Upcoming watch events</h2><p>Loading…</p></section>
  if (error) return <section className="home-section"><h2>Upcoming watch events</h2><p role="alert">{error}</p></section>

  return (
    <section className="home-section">
      <h2>Upcoming watch events</h2>
      {items.length === 0 && <p>No public events coming up yet — be the first to host one.</p>}
      <ul className="event-list">
        {items.map((event) => {
          const status = joinStatus[event.eventId];
          return (
            <li key={event.eventId} className="event-card">
              <span className={`mode-badge mode-${event.mode}`}>{event.mode === 'online' ? 'Online' : 'In-person'}</span>
              <div className="event-title">{event.title ?? event.movieTitle ?? 'Watch party'}</div>
              <div className="event-meta">{formatDate(event.datetime)}</div>
              <div className="event-meta">{event.participantCount}/{event.participantLimit} going</div>
              <button type="button" disabled={!!status} onClick={() => handleJoin(event.eventId)}>
                {status === 'joined' ? 'Joined' : status === 'pending' ? 'Requested' : 'Join'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { getHomeActivity, type ActivityItem } from '../lib/api'

function verbFor(type: ActivityItem['type']): string {
  return type === 'watched' ? 'watched' : 'added to watchlist'
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function FriendsAreWatching() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getHomeActivity()
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load activity'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <section className="home-section"><h2>Friends are watching</h2><p>Loading…</p></section>
  if (error) return <section className="home-section"><h2>Friends are watching</h2><p role="alert">{error}</p></section>
  if (items.length === 0) return null

  return (
    <section className="home-section">
      <h2>Friends are watching</h2>
      <ul className="card-row">
        {items.map((item) => (
          <li key={item.activityId} className="activity-card">
            <div className="activity-who">{item.displayName} {verbFor(item.type)}</div>
            <div className="movie-title">{item.movieTitle ?? 'a movie'}</div>
            <div className="movie-meta">{timeAgo(item.createdAt)}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}

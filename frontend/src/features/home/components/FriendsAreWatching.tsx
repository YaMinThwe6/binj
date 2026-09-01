import { useEffect, useState } from 'react'
import { getHomeActivity, type ActivityItem } from '../services/homeApi'
import { posterUrl } from '../../../lib/images'

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

interface Props {
  onOpenProfile: (uid: string) => void
}

export function FriendsAreWatching({ onOpenProfile }: Props) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getHomeActivity()
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load activity'))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <section>
        <h2 className="mb-3 px-5 text-[15px] font-bold text-text">Friends are watching</h2>
        <p className="px-5 text-sm text-text-muted">Loading…</p>
      </section>
    )
  if (error)
    return (
      <section>
        <h2 className="mb-3 px-5 text-[15px] font-bold text-text">Friends are watching</h2>
        <p role="alert" className="px-5 text-sm text-red-400">
          {error}
        </p>
      </section>
    )
  if (items.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 px-5 text-[15px] font-bold text-text">Friends are watching</h2>
      <ul className="flex gap-3 overflow-x-auto px-5 pb-1">
        {items.map((item) => {
          const poster = posterUrl(item.moviePoster)
          return (
            <li key={item.activityId} className="w-33 flex-none">
              <div className="h-20.5 w-33 overflow-hidden rounded-[11px] bg-surface-alt">
                {poster && <img src={poster} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full border border-[rgba(124,140,166,0.32)] bg-[rgba(124,140,166,0.16)] text-[8px] font-bold text-[#9BABC4]">
                  {item.displayName.charAt(0)}
                </span>
                <span className="text-[10.5px] text-text-secondary">
                  <button type="button" onClick={() => onOpenProfile(item.uid)} className="font-semibold text-text-secondary">
                    {item.displayName}
                  </button>{' '}
                  {verbFor(item.type)}
                </span>
              </div>
              <div className="mt-0.5 text-[12px] font-semibold text-text">{item.movieTitle ?? 'a movie'}</div>
              <div className="mt-0.5 text-[10px] text-text-muted">{timeAgo(item.createdAt)}</div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

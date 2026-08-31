import { useEffect, useState } from 'react'
import { getMovieWatchedBy, type WatchedByEntry } from '../services/movieApi'

interface Props {
  movieId: string
  onOpenProfile: (uid: string) => void
}

// hld.md §5a — only people the caller follows, never a global "everyone who
// watched this" list. Renders nothing when the caller follows no one, none of
// them watched it, or their watched-list privacy hides it — same "just don't
// show the section" pattern as Home's other social sections.
export function WatchedByFriends({ movieId, onOpenProfile }: Props) {
  const [items, setItems] = useState<WatchedByEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getMovieWatchedBy(movieId)
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [movieId])

  if (loading || error || items.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-[15px] font-bold text-text">People you follow who watched this</h2>
      <ul className="flex gap-4 overflow-x-auto pb-0.5">
        {items.map((person) => (
          <li key={person.uid} className="w-16 flex-none text-center">
            <button type="button" onClick={() => onOpenProfile(person.uid)} className="flex w-full flex-col items-center gap-1.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(124,140,166,0.32)] bg-[rgba(124,140,166,0.14)] text-[13px] font-bold text-[#9BABC4]">
                {person.displayName.charAt(0)}
              </span>
              <span className="text-[11px] font-semibold text-text">{person.displayName}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

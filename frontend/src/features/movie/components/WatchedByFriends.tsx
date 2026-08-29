import { useEffect, useState } from 'react'
import { getMovieWatchedBy, type WatchedByEntry } from '../services/movieApi'

interface Props {
  movieId: string
}

// hld.md §5a — only people the caller follows, never a global "everyone who
// watched this" list. Renders nothing when the caller follows no one, none of
// them watched it, or their watched-list privacy hides it — same "just don't
// show the section" pattern as Home's other social sections.
export function WatchedByFriends({ movieId }: Props) {
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
    <section className="watched-by-friends">
      <h2>People you follow who watched this</h2>
      <ul>
        {items.map((person) => (
          <li key={person.uid}>{person.displayName}</li>
        ))}
      </ul>
    </section>
  )
}

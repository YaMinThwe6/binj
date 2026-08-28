import { useEffect, useState } from 'react'
import { getTasteMatches, followUser, unfollowUser, type TasteMatch } from '../lib/api'

function connectLabel(relationship: TasteMatch['relationship']): string {
  if (relationship === 'following') return 'Following'
  if (relationship === 'pending') return 'Requested'
  return 'Connect'
}

export function PeopleYouMightVibeWith() {
  const [items, setItems] = useState<TasteMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getTasteMatches()
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load matches'))
      .finally(() => setLoading(false))
  }, [])

  async function toggleConnect(uid: string) {
    const current = items.find((i) => i.uid === uid)
    if (!current) return

    if (current.relationship === 'none') {
      setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, relationship: 'pending' } : i)))
      try {
        const { status } = await followUser(uid)
        setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, relationship: status } : i)))
      } catch (err) {
        setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, relationship: 'none' } : i)))
        setError(err instanceof Error ? err.message : 'Failed to connect')
      }
    } else {
      const previous = current.relationship
      setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, relationship: 'none' } : i)))
      try {
        await unfollowUser(uid)
      } catch (err) {
        setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, relationship: previous } : i)))
        setError(err instanceof Error ? err.message : 'Failed to update')
      }
    }
  }

  if (loading) return <section className="home-section"><h2>People you might vibe with</h2><p>Loading…</p></section>
  if (error) return <section className="home-section"><h2>People you might vibe with</h2><p role="alert">{error}</p></section>
  if (items.length === 0) return null

  return (
    <section className="home-section">
      <h2>People you might vibe with</h2>
      <ul className="card-row">
        {items.map((person) => (
          <li key={person.uid} className="person-card">
            <div className="avatar">{person.displayName.charAt(0).toUpperCase()}</div>
            <div className="person-name">{person.displayName}</div>
            <div className="match-score">{person.score}% match</div>
            <button type="button" onClick={() => toggleConnect(person.uid)}>
              {connectLabel(person.relationship)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

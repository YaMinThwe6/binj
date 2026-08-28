import { useEffect, useState } from 'react'
import { getCelebritySuggestions, followCelebrity, unfollowCelebrity, type CelebritySuggestion } from '../lib/api'

interface Props {
  onContinue: () => void
  onSkip: () => void
}

export function CelebritiesStep({ onContinue, onSkip }: Props) {
  const [suggestions, setSuggestions] = useState<CelebritySuggestion[]>([])
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getCelebritySuggestions()
      .then((res) => setSuggestions(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load suggestions'))
      .finally(() => setLoading(false))
  }, [])

  async function toggle(personId: string) {
    const wasFollowed = followedIds.has(personId)
    setFollowedIds((prev) => {
      const next = new Set(prev)
      if (wasFollowed) next.delete(personId)
      else next.add(personId)
      return next
    })
    try {
      if (wasFollowed) await unfollowCelebrity(personId)
      else await followCelebrity(personId)
    } catch (err) {
      // roll back the optimistic toggle on failure
      setFollowedIds((prev) => {
        const next = new Set(prev)
        if (wasFollowed) next.add(personId)
        else next.delete(personId)
        return next
      })
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  return (
    <div className="onboarding-step">
      <h2>Follow celebrities</h2>
      <p>Based on what you've watched — actors, directors, and crew alike (optional)</p>

      {loading && <p>Loading…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && suggestions.length === 0 && <p>No suggestions yet — you can follow people from their pages later.</p>}

      <ul className="celebrity-grid">
        {suggestions.map((person) => (
          <li key={person.personId}>
            <button
              type="button"
              aria-pressed={followedIds.has(person.personId)}
              onClick={() => toggle(person.personId)}
            >
              {person.name}
              {followedIds.has(person.personId) ? ' ✓' : ''}
            </button>
          </li>
        ))}
      </ul>

      <button type="button" onClick={onContinue}>
        Continue
      </button>
      <button type="button" onClick={onSkip}>
        Skip for now
      </button>
    </div>
  )
}

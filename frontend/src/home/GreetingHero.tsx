import { useEffect, useState } from 'react'
import { getHomeGreeting, type Greeting } from '../lib/api'

interface Props {
  displayName: string
}

export function GreetingHero({ displayName }: Props) {
  const [greeting, setGreeting] = useState<Greeting | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getHomeGreeting()
      .then(setGreeting)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load greeting'))
  }, [])

  return (
    <section className="greeting-hero">
      {error && <p role="alert">{error}</p>}
      {greeting && (
        <blockquote>
          <p>&ldquo;{greeting.quote}&rdquo;</p>
          <cite>&mdash; {greeting.attribution}</cite>
        </blockquote>
      )}
      <p className="welcome-back">Welcome back, {displayName}</p>
    </section>
  )
}

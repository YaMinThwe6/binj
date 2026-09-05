import { useEffect, useState } from 'react'
import { getHomeGreeting, type Greeting } from '../services/homeApi'

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
    <section className="mx-5">
      <div
        className="relative flex min-h-[172px] flex-col justify-between overflow-hidden rounded-2xl border border-border-soft p-4.5"
        style={{
          background:
            'radial-gradient(90% 100% at 88% 20%, rgba(150,170,200,0.16), transparent 55%), radial-gradient(70% 90% at 10% 90%, rgba(var(--accent-rgb),0.2), transparent 60%), linear-gradient(120deg, #1B1720 0%, #100E12 60%, #0A090B 100%)'
        }}
      >
        {error && (
          <p role="alert" className="text-[13px] text-red-400">
            {error}
          </p>
        )}
        {greeting && (
          <blockquote className="m-0">
            <svg width="20" height="16" viewBox="0 0 32 24" className="text-accent" fill="currentColor" aria-hidden="true">
              <path d="M0 24V13.5C0 6 4.8 1 12 0l1.5 4.5C8.5 5.8 6 8.5 6 13h6v11H0zm18 0V13.5C18 6 22.8 1 30 0l1.5 4.5c-5 1.3-7.5 4-7.5 8.5h6v11H18z" />
            </svg>
            <p className="mt-2 font-serif text-[19px] leading-snug font-semibold text-white">&ldquo;{greeting.quote}&rdquo;</p>
            <cite className="mt-1.5 block text-[11.5px] text-text-muted not-italic">&mdash; {greeting.attribution}</cite>
          </blockquote>
        )}
        <p className="welcome-back mt-4 flex items-center gap-1.5 text-[12.5px] font-bold text-accent">
          Welcome back, {displayName}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4z" />
          </svg>
        </p>
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { getCelebritySuggestions, followCelebrity, unfollowCelebrity, type CelebritySuggestion } from '../services/onboardingApi'
import { OnboardingShell } from './OnboardingShell'

interface Props {
  onContinue: () => void
  onSkip: () => void
  onBack?: () => void
}

export function CelebritiesStep({ onContinue, onSkip, onBack }: Props) {
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
    <OnboardingShell
      step={5}
      onBack={onBack}
      desktopTitle="Follow the people behind the films."
      desktopSubtitle="Actors and directors you follow show up first when they're in something new."
    >
      <div className="flex flex-1 flex-col px-7 pt-8 pb-8">
        <h1 className="font-serif text-[26px] font-semibold text-white">Follow celebrities</h1>
        <p className="mt-2 mb-6 text-[13.5px] text-text-muted">
          Based on what you&rsquo;ve watched — actors, directors, and crew alike (optional)
        </p>

        {loading && <p className="text-sm text-text-muted">Loading…</p>}
        {error && (
          <p role="alert" className="mb-4 text-[13px] text-red-400">
            {error}
          </p>
        )}
        {!loading && suggestions.length === 0 && (
          <p className="text-sm text-text-muted">No suggestions yet — you can follow people from their pages later.</p>
        )}

        <ul className="grid grid-cols-3 gap-x-3 gap-y-5">
          {suggestions.map((person) => {
            const isFollowed = followedIds.has(person.personId)
            return (
              <li key={person.personId}>
                <button type="button" aria-pressed={isFollowed} onClick={() => toggle(person.personId)} className="flex w-full flex-col items-center">
                  <div
                    className={`relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-surface-alt ${isFollowed ? 'border-2 border-accent' : 'border border-border'}`}
                  >
                    {person.photo ? (
                      <img src={person.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold text-text-faint">{person.name.charAt(0)}</span>
                    )}
                    {isFollowed && (
                      <span className="absolute right-0 bottom-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0E0D10" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-center text-[11.5px] font-medium text-text-secondary">{person.name}</div>
                </button>
              </li>
            )
          })}
        </ul>

        {/* A fixed gap, not a flex-1 spacer — see MultiSelectStep.tsx for
            why: flex-1 collapses to nothing once the form is vertically
            centered instead of stretched (OnboardingShell's desktop
            layout), so however many suggestions came back, there's still a
            real gap here rather than the button touching the list. */}
        <button
          type="button"
          onClick={onContinue}
          className="mt-8 flex items-center justify-center rounded-xl bg-accent py-3.5 text-sm font-bold text-bg"
        >
          Continue
        </button>
        <button type="button" onClick={onSkip} className="mt-4 text-center text-[13px] font-semibold text-text-muted">
          Skip for now
        </button>
      </div>
    </OnboardingShell>
  )
}

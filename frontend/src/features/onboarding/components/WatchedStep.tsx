import { useEffect, useState } from 'react'
import { getWatchedCandidates, type MovieCandidate } from '../services/onboardingApi'
import { markWatched, unmarkWatched } from '../../movie/services/movieApi'
import { posterUrl } from '../../../lib/images'
import { OnboardingShell } from './OnboardingShell'

interface Props {
  genres: string[]
  languages: string[]
  onContinue: (watched: MovieCandidate[]) => void
  onSkip: () => void
  onBack?: () => void
}

export function WatchedStep({ genres, languages, onContinue, onSkip, onBack }: Props) {
  const [candidates, setCandidates] = useState<MovieCandidate[]>([])
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getWatchedCandidates(genres, languages)
      .then((res) => setCandidates(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load movies'))
      .finally(() => setLoading(false))
    // Intentionally runs once on mount — genres/languages are the selections from
    // the prior steps, already final by the time this step is reached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggle(movieId: string) {
    const wasWatched = watchedIds.has(movieId)
    setWatchedIds((prev) => {
      const next = new Set(prev)
      if (wasWatched) next.delete(movieId)
      else next.add(movieId)
      return next
    })
    try {
      if (wasWatched) await unmarkWatched(movieId)
      else await markWatched(movieId)
    } catch (err) {
      // roll back the optimistic toggle on failure
      setWatchedIds((prev) => {
        const next = new Set(prev)
        if (wasWatched) next.add(movieId)
        else next.delete(movieId)
        return next
      })
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  return (
    <OnboardingShell
      step={4}
      onBack={onBack}
      desktopTitle="Every rating starts somewhere."
      desktopSubtitle="Tell us what you've already seen and we'll start building your taste profile from day one."
    >
      <div className="flex flex-1 flex-col px-7 pt-8 pb-8">
        <h1 className="font-serif text-[26px] font-semibold text-white">Movies you&rsquo;ve watched</h1>
        <p className="mt-2 mb-6 text-[13.5px] text-text-muted">This helps us build your taste profile (optional)</p>

        {loading && <p className="text-sm text-text-muted">Loading…</p>}
        {error && (
          <p role="alert" className="mb-4 text-[13px] text-red-400">
            {error}
          </p>
        )}

        <ul className="grid grid-cols-3 gap-3">
          {candidates.map((movie) => {
            const isWatched = watchedIds.has(movie.movieId)
            const poster = posterUrl(movie.poster)
            return (
              <li key={movie.movieId}>
                <button
                  type="button"
                  aria-pressed={isWatched}
                  onClick={() => toggle(movie.movieId)}
                  className="block w-full text-left"
                >
                  <div
                    className={`relative aspect-[2/3] w-full overflow-hidden rounded-[10px] bg-surface-alt ${isWatched ? 'border-2 border-accent' : 'border border-border'}`}
                  >
                    {poster ? (
                      <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-text-faint">No poster</div>
                    )}
                    {isWatched && (
                      <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0E0D10" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-center text-[10.5px] text-text-secondary">
                    {movie.title} {movie.year ? `(${movie.year})` : ''}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>

        {/* A fixed gap, not a flex-1 spacer — see MultiSelectStep.tsx for
            why: flex-1 collapses to nothing once the form is vertically
            centered instead of stretched (OnboardingShell's desktop
            layout), so however many candidates came back, there's still a
            real gap here rather than the button touching the grid. */}
        <p className="mt-8 mb-3 text-center text-[11.5px] text-text-muted">{watchedIds.size} selected</p>
        <button
          type="button"
          onClick={() => onContinue(candidates.filter((c) => watchedIds.has(c.movieId)))}
          className="flex items-center justify-center rounded-xl bg-accent py-3.5 text-sm font-bold text-bg"
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

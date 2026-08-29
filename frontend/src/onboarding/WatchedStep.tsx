import { useEffect, useState } from 'react'
import { getWatchedCandidates, markWatched, unmarkWatched, type MovieCandidate } from '../lib/api'

interface Props {
  genres: string[]
  languages: string[]
  onContinue: (watched: MovieCandidate[]) => void
  onSkip: () => void
}

export function WatchedStep({ genres, languages, onContinue, onSkip }: Props) {
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
    <div className="onboarding-step">
      <h2>Movies you&rsquo;ve watched</h2>
      <p>This helps us build your taste profile (optional)</p>

      {loading && <p>Loading…</p>}
      {error && <p role="alert">{error}</p>}

      <ul className="movie-grid">
        {candidates.map((movie) => (
          <li key={movie.movieId}>
            <button
              type="button"
              aria-pressed={watchedIds.has(movie.movieId)}
              onClick={() => toggle(movie.movieId)}
            >
              {movie.title} {movie.year ? `(${movie.year})` : ''}
              {watchedIds.has(movie.movieId) ? ' ✓' : ''}
            </button>
          </li>
        ))}
      </ul>

      <p>{watchedIds.size} selected</p>

      <button
        type="button"
        onClick={() => onContinue(candidates.filter((c) => watchedIds.has(c.movieId)))}
      >
        Continue
      </button>
      <button type="button" onClick={onSkip}>
        Skip for now
      </button>
    </div>
  )
}

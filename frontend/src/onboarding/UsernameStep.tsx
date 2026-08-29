import { useEffect, useRef, useState } from 'react'
import { checkUsernameAvailable, updateMe } from '../lib/api'
import { generateUsernameSuggestions } from './usernameSuggestions'

const USERNAME_RE = /^[a-z0-9._]{3,20}$/
const DEBOUNCE_MS = 400
const MAX_SUGGESTIONS = 4

interface Props {
  initialDisplayName: string
  email: string
  onDone: () => void
}

type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export function UsernameStep({ initialDisplayName, email, onDone }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [username, setUsername] = useState('')
  const [availability, setAvailability] = useState<AvailabilityState>('idle')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const candidates = generateUsernameSuggestions(initialDisplayName, email)

    Promise.all(
      candidates.map(async (candidate) => {
        try {
          const { available } = await checkUsernameAvailable(candidate)
          return available ? candidate : null
        } catch {
          return null
        }
      })
    ).then((results) => {
      if (cancelled) return
      setSuggestions(results.filter((c): c is string => c !== null).slice(0, MAX_SUGGESTIONS))
      setSuggestionsLoading(false)
    })

    return () => {
      cancelled = true
    }
    // Suggestions are derived once from the name/email this step was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const normalized = username.trim().toLowerCase()
    if (!normalized) {
      setAvailability('idle')
      return
    }
    if (!USERNAME_RE.test(normalized)) {
      setAvailability('invalid')
      return
    }

    setAvailability('checking')
    const thisRequestId = ++requestIdRef.current
    debounceRef.current = setTimeout(async () => {
      try {
        const { available } = await checkUsernameAvailable(normalized)
        if (requestIdRef.current !== thisRequestId) return // stale response, a newer check superseded it
        setAvailability(available ? 'available' : 'taken')
      } catch {
        if (requestIdRef.current !== thisRequestId) return
        setAvailability('idle')
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [username])

  function pickSuggestion(candidate: string) {
    setUsername(candidate)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (availability !== 'available' || !displayName.trim()) return
    setError('')
    setSubmitting(true)
    try {
      await updateMe({ displayName: displayName.trim(), username: username.trim().toLowerCase() })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = availability === 'available' && displayName.trim().length > 0 && !submitting

  return (
    <form onSubmit={handleSubmit} className="onboarding-step">
      <h2>Create your profile</h2>
      <p>This is how people on BINJ will find and recognize you.</p>

      <label htmlFor="onboarding-name">Full name</label>
      <input
        id="onboarding-name"
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Your name"
      />

      <label htmlFor="onboarding-username">Username</label>
      <input
        id="onboarding-username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="username"
      />
      {availability === 'checking' && <p>Checking…</p>}
      {availability === 'available' && <p>This username is available</p>}
      {availability === 'taken' && <p role="alert">That username is taken</p>}
      {availability === 'invalid' && (
        <p role="alert">3-20 characters: lowercase letters, numbers, dots, underscores</p>
      )}

      {suggestionsLoading && <p>Finding suggestions…</p>}
      {!suggestionsLoading && suggestions.length > 0 && (
        <div className="username-suggestions">
          <p>Suggestions:</p>
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => pickSuggestion(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={!canSubmit}>
        {submitting ? 'Saving…' : 'Continue'}
      </button>
    </form>
  )
}

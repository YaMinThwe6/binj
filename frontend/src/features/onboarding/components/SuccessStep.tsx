import { useEffect, useState } from 'react'
import { updateMe } from '../../../lib/api'

interface Props {
  greeting: string | null
  onComplete: () => void
}

export function SuccessStep({ greeting, onComplete }: Props) {
  const [error, setError] = useState('')

  useEffect(() => {
    updateMe({ onboardingComplete: true })
      .then(() => onComplete())
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to finish setup'))
    // Runs once on mount to persist onboarding completion, then hands control back to the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="onboarding-step">
      <h2>You&rsquo;re all set!</h2>
      {greeting ? <p>{greeting}</p> : <p>Welcome to BINJ — let's find what to watch next.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

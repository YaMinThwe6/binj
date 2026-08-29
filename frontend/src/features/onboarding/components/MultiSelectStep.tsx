import { useState } from 'react'

interface Option {
  value: string
  label: string
}

interface Props {
  title: string
  subtitle: string
  options: Option[]
  onContinue: (selected: string[]) => Promise<void>
  onSkip: () => void
}

export function MultiSelectStep({ title, subtitle, options, onContinue, onSkip }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  async function handleContinue() {
    setError('')
    setSubmitting(true)
    try {
      await onContinue([...selected])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="onboarding-step">
      <h2>{title}</h2>
      <p>{subtitle}</p>

      <div className="chip-grid">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected.has(opt.value)}
            onClick={() => toggle(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="button" onClick={handleContinue} disabled={submitting}>
        {submitting ? 'Saving…' : 'Continue'}
      </button>
      <button type="button" onClick={onSkip} disabled={submitting}>
        Skip for now
      </button>
    </div>
  )
}

import { useState } from 'react'
import { OnboardingShell } from './OnboardingShell'

interface Option {
  value: string
  label: string
}

interface Props {
  step: number
  title: string
  subtitle: string
  options: Option[]
  initialSelected?: string[]
  onContinue: (selected: string[]) => Promise<void>
  onSkip: () => void
  onBack?: (selected: string[]) => void
  desktopTitle?: string
  desktopSubtitle?: string
}

export function MultiSelectStep({ step, title, subtitle, options, initialSelected, onContinue, onSkip, onBack, desktopTitle, desktopSubtitle }: Props) {
  // Seeded from the wizard's own state so re-visiting this step (Back from
  // the next one) shows what was already chosen instead of starting blank.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected ?? []))
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
    <OnboardingShell
      step={step}
      // Wrapped so Back reports the current selection too, not just
      // Continue/Skip — otherwise clicking Back without confirming first
      // loses whatever was toggled on this visit.
      onBack={onBack ? () => onBack([...selected]) : undefined}
      desktopTitle={desktopTitle}
      desktopSubtitle={desktopSubtitle}
    >
      <div className="flex flex-1 flex-col px-7 pt-8 pb-10">
        <h1 className="font-serif text-[26px] font-semibold text-white">{title}</h1>
        <p className="mt-2 mb-6 text-[13.5px] text-text-muted">{subtitle}</p>

        <div className="flex flex-wrap gap-2.5">
          {options.map((opt) => {
            const isSelected = selected.has(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(opt.value)}
                className={
                  isSelected
                    ? 'rounded-full bg-accent px-4 py-2.5 text-[13px] font-bold text-bg'
                    : 'rounded-full border border-border bg-surface-alt px-4 py-2.5 text-[13px] font-semibold text-text-secondary'
                }
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-red-400">
            {error}
          </p>
        )}

        {/* A fixed gap, not a flex-1 spacer — flex-1 only pushes this button
            to the bottom when the form is stretched to fill the viewport
            (mobile); on desktop it's vertically centered instead
            (OnboardingShell), so flex-1 has no room to grow and the button
            ends up touching whatever's above it, however many options or
            candidates that is. */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={submitting}
          className="mt-8 flex items-center justify-center rounded-xl bg-accent py-3.5 text-sm font-bold text-bg disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Continue'}
        </button>
        <button type="button" onClick={onSkip} disabled={submitting} className="mt-4 text-center text-[13px] font-semibold text-text-muted">
          Skip for now
        </button>
      </div>
    </OnboardingShell>
  )
}

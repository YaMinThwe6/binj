import type { ReactNode } from 'react'

const TOTAL_STEPS = 6

interface Props {
  step: number // 1-indexed
  onBack?: () => void
  children: ReactNode
}

// Shared header (back arrow + "Step N of 6" + progress bar) across every
// onboarding step (design canvas's SignupDetails/Genres/Watched.dc.html) —
// one place instead of duplicating this scaffold in six components.
export function OnboardingShell({ step, onBack, children }: Props) {
  return (
    <main className="flex min-h-svh flex-1 flex-col bg-bg text-text">
      <div className="flex items-center justify-between px-6 pt-5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-border-soft bg-surface-alt"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <span />
        )}
        <span className="text-[11.5px] font-bold tracking-wide text-text-muted">
          Step {step} of {TOTAL_STEPS}
        </span>
      </div>

      <div className="flex gap-1.5 px-6 pt-4" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-accent' : 'bg-border'}`} />
        ))}
      </div>

      {children}
    </main>
  )
}

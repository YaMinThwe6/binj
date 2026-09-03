import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MultiSelectStep } from '../../../../src/features/onboarding/components/MultiSelectStep'

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' }
]

// OnboardingShell renders its children twice — a mobile copy and a desktop
// copy, CSS-toggled per breakpoint (same pattern as Welcome.tsx) — so every
// query here picks [0], same convention used throughout this app's tests
// wherever a component has its own responsive dual-render.
describe('MultiSelectStep', () => {
  it('toggles chip selection and passes selected values to onContinue', async () => {
    const onContinue = vi.fn().mockResolvedValue(undefined)
    render(<MultiSelectStep step={2} title="T" subtitle="S" options={options} onContinue={onContinue} onSkip={vi.fn()} />)

    fireEvent.click(screen.getAllByText('Alpha')[0])
    expect(screen.getAllByText('Alpha')[0]).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getAllByRole('button', { name: /continue/i })[0])
    await waitFor(() => expect(onContinue).toHaveBeenCalledWith(['a']))
  })

  it('deselects a chip on second click', () => {
    render(<MultiSelectStep step={2} title="T" subtitle="S" options={options} onContinue={vi.fn()} onSkip={vi.fn()} />)

    const alpha = screen.getAllByText('Alpha')[0]
    fireEvent.click(alpha)
    fireEvent.click(alpha)
    expect(alpha).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSkip without requiring a selection', () => {
    const onSkip = vi.fn()
    render(<MultiSelectStep step={2} title="T" subtitle="S" options={options} onContinue={vi.fn()} onSkip={onSkip} />)

    fireEvent.click(screen.getAllByRole('button', { name: /skip/i })[0])
    expect(onSkip).toHaveBeenCalled()
  })

  it('shows an error message when onContinue rejects', async () => {
    const onContinue = vi.fn().mockRejectedValue(new Error('boom'))
    render(<MultiSelectStep step={2} title="T" subtitle="S" options={options} onContinue={onContinue} onSkip={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button', { name: /continue/i })[0])
    await waitFor(() => expect(screen.getAllByRole('alert')[0]).toHaveTextContent('boom'))
  })
})

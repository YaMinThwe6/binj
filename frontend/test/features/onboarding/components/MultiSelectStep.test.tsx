import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MultiSelectStep } from '../../../../src/features/onboarding/components/MultiSelectStep'

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' }
]

describe('MultiSelectStep', () => {
  it('toggles chip selection and passes selected values to onContinue', async () => {
    const onContinue = vi.fn().mockResolvedValue(undefined)
    render(<MultiSelectStep step={2} title="T" subtitle="S" options={options} onContinue={onContinue} onSkip={vi.fn()} />)

    fireEvent.click(screen.getByText('Alpha'))
    expect(screen.getByText('Alpha')).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(onContinue).toHaveBeenCalledWith(['a']))
  })

  it('deselects a chip on second click', () => {
    render(<MultiSelectStep step={2} title="T" subtitle="S" options={options} onContinue={vi.fn()} onSkip={vi.fn()} />)

    const alpha = screen.getByText('Alpha')
    fireEvent.click(alpha)
    fireEvent.click(alpha)
    expect(alpha).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSkip without requiring a selection', () => {
    const onSkip = vi.fn()
    render(<MultiSelectStep step={2} title="T" subtitle="S" options={options} onContinue={vi.fn()} onSkip={onSkip} />)

    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(onSkip).toHaveBeenCalled()
  })

  it('shows an error message when onContinue rejects', async () => {
    const onContinue = vi.fn().mockRejectedValue(new Error('boom'))
    render(<MultiSelectStep step={2} title="T" subtitle="S" options={options} onContinue={onContinue} onSkip={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'))
  })
})

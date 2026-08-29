import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const updateMe = vi.fn()
vi.mock('../../src/lib/api', () => ({ updateMe }))

const { SuccessStep } = await import('../../src/onboarding/SuccessStep')

afterEach(() => updateMe.mockReset())

describe('SuccessStep', () => {
  it('persists onboardingComplete and calls onComplete', async () => {
    updateMe.mockResolvedValue({})
    const onComplete = vi.fn()
    render(<SuccessStep greeting={null} onComplete={onComplete} />)

    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ onboardingComplete: true }))
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
  })

  it('shows the seeded greeting when provided', async () => {
    updateMe.mockResolvedValue({})
    render(<SuccessStep greeting="Since you've watched Inception…" onComplete={vi.fn()} />)

    expect(screen.getByText(/Inception/)).toBeInTheDocument()
  })

  it('shows an error if saving fails', async () => {
    updateMe.mockRejectedValue(new Error('save failed'))
    render(<SuccessStep greeting={null} onComplete={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('save failed'))
  })
})

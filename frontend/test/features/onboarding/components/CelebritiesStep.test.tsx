import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getCelebritySuggestions = vi.fn()
const followCelebrity = vi.fn()
const unfollowCelebrity = vi.fn()

vi.mock('../../../../src/features/onboarding/services/onboardingApi', () => ({ getCelebritySuggestions, followCelebrity, unfollowCelebrity }))

const { CelebritiesStep } = await import('../../../../src/features/onboarding/components/CelebritiesStep')

const suggestions = [
  { personId: 'p1', name: 'Jane Doe', photo: null, appearsIn: 2 },
  { personId: 'p2', name: 'Small Role Actor', photo: null, appearsIn: 1 }
]

afterEach(() => {
  getCelebritySuggestions.mockReset()
  followCelebrity.mockReset()
  unfollowCelebrity.mockReset()
})

// OnboardingShell renders its children twice — a mobile copy and a desktop
// copy, CSS-toggled per breakpoint (same pattern as Welcome.tsx) — so every
// query here picks [0].
describe('CelebritiesStep', () => {
  it('loads and shows suggestions including minor-role people', async () => {
    getCelebritySuggestions.mockResolvedValue({ items: suggestions })
    render(<CelebritiesStep onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Small Role Actor').length).toBeGreaterThan(0)
  })

  it('shows an empty-state message when there are no suggestions', async () => {
    getCelebritySuggestions.mockResolvedValue({ items: [] })
    render(<CelebritiesStep onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText(/no suggestions yet/i).length).toBeGreaterThan(0))
  })

  it('follows a celebrity on click', async () => {
    getCelebritySuggestions.mockResolvedValue({ items: suggestions })
    followCelebrity.mockResolvedValue(undefined)
    render(<CelebritiesStep onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Jane Doe')[0])

    await waitFor(() => expect(followCelebrity).toHaveBeenCalledWith('p1'))
  })

  it('calls onContinue/onSkip directly', async () => {
    getCelebritySuggestions.mockResolvedValue({ items: [] })
    const onContinue = vi.fn()
    render(<CelebritiesStep onContinue={onContinue} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText(/no suggestions/i).length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByRole('button', { name: /^continue$/i })[0])
    expect(onContinue).toHaveBeenCalled()
  })
})

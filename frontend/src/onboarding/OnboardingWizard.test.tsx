import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const checkUsernameAvailable = vi.fn()
const updateMe = vi.fn()
const getWatchedCandidates = vi.fn()
const markWatched = vi.fn()
const unmarkWatched = vi.fn()
const getCelebritySuggestions = vi.fn()
const followCelebrity = vi.fn()
const unfollowCelebrity = vi.fn()

vi.mock('../lib/api', () => ({
  checkUsernameAvailable,
  updateMe,
  getWatchedCandidates,
  markWatched,
  unmarkWatched,
  getCelebritySuggestions,
  followCelebrity,
  unfollowCelebrity
}))

const { OnboardingWizard } = await import('./OnboardingWizard')

afterEach(() => {
  checkUsernameAvailable.mockReset()
  updateMe.mockReset()
  getWatchedCandidates.mockReset()
  markWatched.mockReset()
  unmarkWatched.mockReset()
  getCelebritySuggestions.mockReset()
  followCelebrity.mockReset()
  unfollowCelebrity.mockReset()
})

describe('OnboardingWizard', () => {
  it('walks the full step sequence and completes onboarding', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    updateMe.mockResolvedValue({})
    getWatchedCandidates.mockResolvedValue({ items: [] })
    getCelebritySuggestions.mockResolvedValue({ items: [] })

    const onComplete = vi.fn()
    render(<OnboardingWizard initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onComplete={onComplete} />)

    // Username step (not skippable)
    await waitFor(() => expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'arjunk' } })
    await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    // Genres step — skip
    await waitFor(() => expect(screen.getByText(/what are you into/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))

    // Language step — skip
    await waitFor(() => expect(screen.getByText(/what do you watch/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))

    // Watched step — skip
    await waitFor(() => expect(screen.getByText(/movies you.*watched/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))

    // Celebrities step — skip
    await waitFor(() => expect(screen.getByText(/follow celebrities/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))

    // Success step persists onboardingComplete and calls onComplete
    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ onboardingComplete: true }))
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
  })

  it('threads genre/language selections into the watched-candidates request', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    updateMe.mockResolvedValue({})
    getWatchedCandidates.mockResolvedValue({ items: [] })
    getCelebritySuggestions.mockResolvedValue({ items: [] })

    render(<OnboardingWizard initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onComplete={vi.fn()} />)

    await waitFor(() => expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'arjunk' } })
    await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(screen.getByText('Comedy')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Comedy'))
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))

    await waitFor(() => expect(screen.getByText('Korean')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Korean'))
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))

    await waitFor(() => expect(getWatchedCandidates).toHaveBeenCalledWith(['Comedy'], ['ko']))
  })
})

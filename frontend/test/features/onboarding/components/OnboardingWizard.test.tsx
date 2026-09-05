import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const checkUsernameAvailable = vi.fn()
const getWatchedCandidates = vi.fn()
const getCelebritySuggestions = vi.fn()
const followCelebrity = vi.fn()
const unfollowCelebrity = vi.fn()
const updateMe = vi.fn()
const markWatched = vi.fn()
const unmarkWatched = vi.fn()
const likeMovie = vi.fn()
const unlikeMovie = vi.fn()

vi.mock('../../../../src/features/onboarding/services/onboardingApi', () => ({
  checkUsernameAvailable,
  getWatchedCandidates,
  getCelebritySuggestions,
  followCelebrity,
  unfollowCelebrity
}))
vi.mock('../../../../src/lib/api', () => ({ updateMe }))
vi.mock('../../../../src/features/movie/services/movieApi', () => ({ markWatched, unmarkWatched, likeMovie, unlikeMovie }))

const { OnboardingWizard } = await import('../../../../src/features/onboarding/components/OnboardingWizard')

afterEach(() => {
  checkUsernameAvailable.mockReset()
  updateMe.mockReset()
  getWatchedCandidates.mockReset()
  markWatched.mockReset()
  unmarkWatched.mockReset()
  likeMovie.mockReset()
  unlikeMovie.mockReset()
  getCelebritySuggestions.mockReset()
  followCelebrity.mockReset()
  unfollowCelebrity.mockReset()
})

// Every step goes through OnboardingShell, which renders its children twice
// — a mobile copy and a desktop copy, CSS-toggled per breakpoint (same
// pattern as Welcome.tsx) — so every query here picks [0].
describe('OnboardingWizard', () => {
  it('walks the full step sequence and completes onboarding', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    updateMe.mockResolvedValue({})
    getWatchedCandidates.mockResolvedValue({ items: [] })
    getCelebritySuggestions.mockResolvedValue({ items: [] })

    const onComplete = vi.fn()
    render(<OnboardingWizard initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onComplete={onComplete} />)

    // Username step (not skippable)
    await waitFor(() => expect(screen.getAllByLabelText(/^username$/i)[0]).toBeInTheDocument())
    fireEvent.change(screen.getAllByLabelText(/^username$/i)[0], { target: { value: 'arjunk' } })
    await waitFor(() => expect(screen.getAllByRole('button', { name: /continue/i })[0]).not.toBeDisabled())
    fireEvent.click(screen.getAllByRole('button', { name: /continue/i })[0])

    // Genres step — skip
    await waitFor(() => expect(screen.getAllByText(/what are you into/i)[0]).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /skip/i })[0])

    // Language step — skip
    await waitFor(() => expect(screen.getAllByText(/what do you watch/i)[0]).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /skip/i })[0])

    // Watched step — skip
    await waitFor(() => expect(screen.getAllByText(/movies you.*watched/i)[0]).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /skip/i })[0])

    // Celebrities step — skip
    await waitFor(() => expect(screen.getAllByText(/follow celebrities/i)[0]).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /skip/i })[0])

    // Success step (not wrapped in OnboardingShell, so it's a single copy) —
    // persists onboardingComplete and calls onComplete
    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ onboardingComplete: true }))
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
  })

  it('threads genre/language selections into the watched-candidates request', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    updateMe.mockResolvedValue({})
    getWatchedCandidates.mockResolvedValue({ items: [] })
    getCelebritySuggestions.mockResolvedValue({ items: [] })

    render(<OnboardingWizard initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onComplete={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByLabelText(/^username$/i)[0]).toBeInTheDocument())
    fireEvent.change(screen.getAllByLabelText(/^username$/i)[0], { target: { value: 'arjunk' } })
    await waitFor(() => expect(screen.getAllByRole('button', { name: /continue/i })[0]).not.toBeDisabled())
    fireEvent.click(screen.getAllByRole('button', { name: /continue/i })[0])

    await waitFor(() => expect(screen.getAllByText('Comedy')[0]).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Comedy')[0])
    fireEvent.click(screen.getAllByRole('button', { name: /^continue$/i })[0])

    await waitFor(() => expect(screen.getAllByText('Korean')[0]).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Korean')[0])
    fireEvent.click(screen.getAllByRole('button', { name: /^continue$/i })[0])

    await waitFor(() => expect(getWatchedCandidates).toHaveBeenCalledWith(['Comedy'], ['ko'], null))
  })

  it('keeps the saved username filled in and available after navigating back to it', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    updateMe.mockResolvedValue({})

    render(<OnboardingWizard initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onComplete={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByLabelText(/^username$/i)[0]).toBeInTheDocument())
    fireEvent.change(screen.getAllByLabelText(/^username$/i)[0], { target: { value: 'arjunk' } })
    await waitFor(() => expect(screen.getAllByRole('button', { name: /continue/i })[0]).not.toBeDisabled())
    fireEvent.click(screen.getAllByRole('button', { name: /continue/i })[0])

    await waitFor(() => expect(screen.getAllByText(/what are you into/i)[0]).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /^back$/i })[0])

    // Back on the username step: the previously saved value is pre-filled,
    // not blank, and it resolves as available rather than falsely "taken".
    await waitFor(() => expect(screen.getAllByLabelText(/^username$/i)[0]).toHaveValue('arjunk'))
    await waitFor(() => expect(screen.getAllByText('This username is available').length).toBeGreaterThan(0))
    expect(screen.getAllByRole('button', { name: /continue/i })[0]).not.toBeDisabled()
  })

  it('keeps genre, language, watched and followed selections after navigating back to each step', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    updateMe.mockResolvedValue({})
    const candidates = [{ movieId: 'm1', title: 'Movie One', poster: null, year: 2020, genres: ['Drama'], voteAverage: 7 }]
    getWatchedCandidates.mockResolvedValue({ items: candidates })
    markWatched.mockResolvedValue(undefined)
    const suggestions = [{ personId: 'p1', name: 'Jane Doe', photo: null, appearsIn: 2 }]
    getCelebritySuggestions.mockResolvedValue({ items: suggestions })
    followCelebrity.mockResolvedValue(undefined)

    render(<OnboardingWizard initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onComplete={vi.fn()} />)

    // Username -> Genres
    await waitFor(() => expect(screen.getAllByLabelText(/^username$/i)[0]).toBeInTheDocument())
    fireEvent.change(screen.getAllByLabelText(/^username$/i)[0], { target: { value: 'arjunk' } })
    await waitFor(() => expect(screen.getAllByRole('button', { name: /continue/i })[0]).not.toBeDisabled())
    fireEvent.click(screen.getAllByRole('button', { name: /continue/i })[0])

    // Genres: pick Comedy, continue
    await waitFor(() => expect(screen.getAllByText('Comedy')[0]).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Comedy')[0])
    fireEvent.click(screen.getAllByRole('button', { name: /^continue$/i })[0])

    // Language: pick Korean, continue
    await waitFor(() => expect(screen.getAllByText('Korean')[0]).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Korean')[0])
    fireEvent.click(screen.getAllByRole('button', { name: /^continue$/i })[0])

    // Watched: mark Movie One, continue
    await waitFor(() => expect(screen.getAllByText(/Movie One/)[0]).toBeInTheDocument())
    fireEvent.click(screen.getAllByText(/Movie One/)[0])
    await waitFor(() => expect(markWatched).toHaveBeenCalledWith('m1'))
    fireEvent.click(screen.getAllByRole('button', { name: /^continue$/i })[0])

    // Celebrities: follow Jane Doe, then go all the way back to Genres
    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Jane Doe')[0])
    await waitFor(() => expect(followCelebrity).toHaveBeenCalledWith('p1'))

    fireEvent.click(screen.getAllByRole('button', { name: /^back$/i })[0]) // -> Watched
    await waitFor(() => expect(screen.getAllByText('1 selected').length).toBeGreaterThan(0))

    fireEvent.click(screen.getAllByRole('button', { name: /^back$/i })[0]) // -> Language
    await waitFor(() => expect(screen.getAllByText('Korean')[0]).toHaveAttribute('aria-pressed', 'true'))

    fireEvent.click(screen.getAllByRole('button', { name: /^back$/i })[0]) // -> Genres
    await waitFor(() => expect(screen.getAllByText('Comedy')[0]).toHaveAttribute('aria-pressed', 'true'))

    // Forward again all the way to Celebrities: the earlier follow is still reflected
    fireEvent.click(screen.getAllByRole('button', { name: /^continue$/i })[0])
    await waitFor(() => expect(screen.getAllByText('Korean')[0]).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /^continue$/i })[0])
    await waitFor(() => expect(screen.getAllByText('1 selected').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByRole('button', { name: /^continue$/i })[0])
    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0))
    expect(screen.getAllByRole('button', { name: /jane doe/i })[0]).toHaveAttribute('aria-pressed', 'true')
  })
})

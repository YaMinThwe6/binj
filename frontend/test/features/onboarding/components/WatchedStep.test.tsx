import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getWatchedCandidates = vi.fn()
const markWatched = vi.fn()
const unmarkWatched = vi.fn()

vi.mock('../../../../src/features/onboarding/services/onboardingApi', () => ({ getWatchedCandidates }))
vi.mock('../../../../src/features/movie/services/movieApi', () => ({ markWatched, unmarkWatched }))

const { WatchedStep } = await import('../../../../src/features/onboarding/components/WatchedStep')

const candidates = [
  { movieId: 'm1', title: 'Movie One', poster: null, year: 2020, genres: ['Drama'], voteAverage: 7 },
  { movieId: 'm2', title: 'Movie Two', poster: null, year: 2021, genres: ['Comedy'], voteAverage: 8 }
]

afterEach(() => {
  getWatchedCandidates.mockReset()
  markWatched.mockReset()
  unmarkWatched.mockReset()
})

// OnboardingShell renders its children twice — a mobile copy and a desktop
// copy, CSS-toggled per breakpoint (same pattern as Welcome.tsx) — so every
// query here picks [0].
describe('WatchedStep', () => {
  it('fetches candidates filtered by the chosen genres/languages', async () => {
    getWatchedCandidates.mockResolvedValue({ items: candidates })
    render(<WatchedStep genres={['Drama']} languages={['en']} onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText(/Movie One/).length).toBeGreaterThan(0))
    expect(getWatchedCandidates).toHaveBeenCalledWith(['Drama'], ['en'])
  })

  it('optimistically marks watched, calling markWatched', async () => {
    getWatchedCandidates.mockResolvedValue({ items: candidates })
    markWatched.mockResolvedValue(undefined)
    render(<WatchedStep genres={[]} languages={[]} onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText(/Movie One/).length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText(/Movie One/)[0])

    await waitFor(() => expect(markWatched).toHaveBeenCalledWith('m1'))
    expect(screen.getAllByText('1 selected').length).toBeGreaterThan(0)
  })

  it('rolls back the toggle when markWatched fails', async () => {
    getWatchedCandidates.mockResolvedValue({ items: candidates })
    markWatched.mockRejectedValue(new Error('nope'))
    render(<WatchedStep genres={[]} languages={[]} onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText(/Movie One/).length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText(/Movie One/)[0])

    await waitFor(() => expect(screen.getAllByRole('alert')[0]).toHaveTextContent('nope'))
    expect(screen.getAllByText('0 selected').length).toBeGreaterThan(0)
  })

  it('passes only the watched movies to onContinue', async () => {
    getWatchedCandidates.mockResolvedValue({ items: candidates })
    markWatched.mockResolvedValue(undefined)
    const onContinue = vi.fn()
    render(<WatchedStep genres={[]} languages={[]} onContinue={onContinue} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText(/Movie One/).length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText(/Movie One/)[0])
    await waitFor(() => expect(markWatched).toHaveBeenCalled())

    fireEvent.click(screen.getAllByRole('button', { name: /^continue$/i })[0])
    expect(onContinue).toHaveBeenCalledWith([candidates[0]])
  })
})

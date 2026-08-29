import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getWatchedCandidates = vi.fn()
const markWatched = vi.fn()
const unmarkWatched = vi.fn()

vi.mock('../../src/lib/api', () => ({ getWatchedCandidates, markWatched, unmarkWatched }))

const { WatchedStep } = await import('../../src/onboarding/WatchedStep')

const candidates = [
  { movieId: 'm1', title: 'Movie One', poster: null, year: 2020, genres: ['Drama'], voteAverage: 7 },
  { movieId: 'm2', title: 'Movie Two', poster: null, year: 2021, genres: ['Comedy'], voteAverage: 8 }
]

afterEach(() => {
  getWatchedCandidates.mockReset()
  markWatched.mockReset()
  unmarkWatched.mockReset()
})

describe('WatchedStep', () => {
  it('fetches candidates filtered by the chosen genres/languages', async () => {
    getWatchedCandidates.mockResolvedValue({ items: candidates })
    render(<WatchedStep genres={['Drama']} languages={['en']} onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/Movie One/)).toBeInTheDocument())
    expect(getWatchedCandidates).toHaveBeenCalledWith(['Drama'], ['en'])
  })

  it('optimistically marks watched, calling markWatched', async () => {
    getWatchedCandidates.mockResolvedValue({ items: candidates })
    markWatched.mockResolvedValue(undefined)
    render(<WatchedStep genres={[]} languages={[]} onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/Movie One/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Movie One/))

    await waitFor(() => expect(markWatched).toHaveBeenCalledWith('m1'))
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('rolls back the toggle when markWatched fails', async () => {
    getWatchedCandidates.mockResolvedValue({ items: candidates })
    markWatched.mockRejectedValue(new Error('nope'))
    render(<WatchedStep genres={[]} languages={[]} onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/Movie One/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Movie One/))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('nope'))
    expect(screen.getByText('0 selected')).toBeInTheDocument()
  })

  it('passes only the watched movies to onContinue', async () => {
    getWatchedCandidates.mockResolvedValue({ items: candidates })
    markWatched.mockResolvedValue(undefined)
    const onContinue = vi.fn()
    render(<WatchedStep genres={[]} languages={[]} onContinue={onContinue} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/Movie One/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Movie One/))
    await waitFor(() => expect(markWatched).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(onContinue).toHaveBeenCalledWith([candidates[0]])
  })
})

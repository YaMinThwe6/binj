import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getCelebritySuggestions = vi.fn()
const followCelebrity = vi.fn()
const unfollowCelebrity = vi.fn()

vi.mock('../../src/lib/api', () => ({ getCelebritySuggestions, followCelebrity, unfollowCelebrity }))

const { CelebritiesStep } = await import('../../src/onboarding/CelebritiesStep')

const suggestions = [
  { personId: 'p1', name: 'Jane Doe', photo: null, appearsIn: 2 },
  { personId: 'p2', name: 'Small Role Actor', photo: null, appearsIn: 1 }
]

afterEach(() => {
  getCelebritySuggestions.mockReset()
  followCelebrity.mockReset()
  unfollowCelebrity.mockReset()
})

describe('CelebritiesStep', () => {
  it('loads and shows suggestions including minor-role people', async () => {
    getCelebritySuggestions.mockResolvedValue({ items: suggestions })
    render(<CelebritiesStep onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText('Small Role Actor')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no suggestions', async () => {
    getCelebritySuggestions.mockResolvedValue({ items: [] })
    render(<CelebritiesStep onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/no suggestions yet/i)).toBeInTheDocument())
  })

  it('follows a celebrity on click', async () => {
    getCelebritySuggestions.mockResolvedValue({ items: suggestions })
    followCelebrity.mockResolvedValue(undefined)
    render(<CelebritiesStep onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Jane Doe'))

    await waitFor(() => expect(followCelebrity).toHaveBeenCalledWith('p1'))
  })

  it('calls onContinue/onSkip directly', async () => {
    getCelebritySuggestions.mockResolvedValue({ items: [] })
    const onContinue = vi.fn()
    render(<CelebritiesStep onContinue={onContinue} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/no suggestions/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(onContinue).toHaveBeenCalled()
  })
})

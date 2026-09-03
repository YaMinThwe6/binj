import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getCelebritySuggestions = vi.fn()
const followCelebrity = vi.fn()
const unfollowCelebrity = vi.fn()
const searchPeople = vi.fn()

vi.mock('../../../../src/features/onboarding/services/onboardingApi', () => ({ getCelebritySuggestions, followCelebrity, unfollowCelebrity, searchPeople }))

const { CelebritiesStep } = await import('../../../../src/features/onboarding/components/CelebritiesStep')

const suggestions = [
  { personId: 'p1', name: 'Jane Doe', photo: null, appearsIn: 2 },
  { personId: 'p2', name: 'Small Role Actor', photo: null, appearsIn: 1 }
]

afterEach(() => {
  getCelebritySuggestions.mockReset()
  followCelebrity.mockReset()
  unfollowCelebrity.mockReset()
  searchPeople.mockReset()
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

  it('renders a photo via the TMDB image CDN, not the bare relative path', async () => {
    getCelebritySuggestions.mockResolvedValue({ items: [{ personId: 'p1', name: 'Jane Doe', photo: '/abc123.jpg', appearsIn: 2 }] })
    render(<CelebritiesStep onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0))
    const img = document.querySelector('img') as HTMLImageElement
    expect(img.src).toBe('https://image.tmdb.org/t/p/w185/abc123.jpg')
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

  it('pre-follows people from initialFollowedIds when the step is revisited', async () => {
    getCelebritySuggestions.mockResolvedValue({ items: suggestions })
    render(<CelebritiesStep initialFollowedIds={['p1']} onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0))
    expect(screen.getAllByRole('button', { name: /jane doe/i })[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('searches for a person beyond the suggestion list and can follow them too', async () => {
    getCelebritySuggestions.mockResolvedValue({ items: suggestions })
    searchPeople.mockResolvedValue({ items: [{ personId: 'p9', name: 'Searched Person', photo: null }] })
    followCelebrity.mockResolvedValue(undefined)
    render(<CelebritiesStep onContinue={vi.fn()} onSkip={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0))
    fireEvent.change(screen.getAllByLabelText(/search for a person/i)[0], { target: { value: 'searched' } })

    // The component's own debounce (1000ms) is right at waitFor's default
    // timeout — give it real headroom instead of racing it.
    await waitFor(() => expect(searchPeople).toHaveBeenCalledWith('searched'), { timeout: 2000 })
    await waitFor(() => expect(screen.getAllByText('Searched Person').length).toBeGreaterThan(0))
    // The suggestion grid is replaced while searching, not shown alongside it.
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByText('Searched Person')[0])
    await waitFor(() => expect(followCelebrity).toHaveBeenCalledWith('p9'))
  })
})

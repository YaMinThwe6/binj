import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const getUpcomingEvents = vi.fn()
vi.mock('../../../../src/features/home/services/homeApi', () => ({ getUpcomingEvents }))

const { DiscoverEventsTeaser } = await import('../../../../src/features/movie/components/DiscoverEventsTeaser')

const onlineEvent = {
  eventId: 'evt-1',
  hostId: 'host-1',
  movieId: 'm1',
  title: 'Interstellar Watch Party',
  datetime: '2099-06-01T20:00:00.000Z',
  mode: 'online' as const,
  location: null,
  preciseLocation: null,
  visibility: 'public' as const,
  participantLimit: 5,
  participantCount: 2,
  requiresApproval: false,
  roomId: 'room-1',
  movieTitle: 'Interstellar',
  moviePoster: null
}

afterEach(() => {
  getUpcomingEvents.mockReset()
})

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DiscoverEventsTeaser />} />
        <Route path="/get-started" element={<p>Get started page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('DiscoverEventsTeaser', () => {
  it('renders nothing when there are no public events', async () => {
    getUpcomingEvents.mockResolvedValue({ items: [] })
    const { container } = renderWithRouter()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('renders nothing when the fetch fails — non-critical, fails quietly', async () => {
    getUpcomingEvents.mockRejectedValue(new Error('boom'))
    const { container } = renderWithRouter()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('shows real public event info, area/city for an in-person event, no join button', async () => {
    getUpcomingEvents.mockResolvedValue({
      items: [{ ...onlineEvent, mode: 'in-person' as const, location: { area: 'Bandra West', city: 'Mumbai' } }]
    })
    renderWithRouter()

    expect(await screen.findByText('Interstellar Watch Party')).toBeInTheDocument()
    expect(screen.getByText(/Bandra West, Mumbai/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^join$/i })).not.toBeInTheDocument()
  })

  it('navigates to Get Started when "Sign in to join" is clicked', async () => {
    getUpcomingEvents.mockResolvedValue({ items: [onlineEvent] })
    renderWithRouter()

    fireEvent.click(await screen.findByRole('button', { name: /sign in to join/i }))
    expect(await screen.findByText('Get started page')).toBeInTheDocument()
  })
})

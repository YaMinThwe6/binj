import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getUpcomingEvents = vi.fn()
const joinEvent = vi.fn()
vi.mock('../../src/lib/api', () => ({ getUpcomingEvents, joinEvent }))

const { UpcomingEvents } = await import('../../src/home/UpcomingEvents')

const event = {
  eventId: 'evt-1',
  hostId: 'host-1',
  movieId: 'm1',
  title: 'Interstellar Watch Party',
  datetime: '2099-06-01T20:00:00.000Z',
  mode: 'online' as const,
  location: null,
  visibility: 'public' as const,
  participantLimit: 5,
  participantCount: 2,
  requiresApproval: false,
  movieTitle: 'Interstellar',
  moviePoster: null
}

afterEach(() => {
  getUpcomingEvents.mockReset()
  joinEvent.mockReset()
})

describe('UpcomingEvents', () => {
  it('shows an empty-state message when there are no public events', async () => {
    getUpcomingEvents.mockResolvedValue({ items: [] })
    render(<UpcomingEvents />)
    await waitFor(() => expect(screen.getByText(/no public events/i)).toBeInTheDocument())
  })

  it('renders an event and joins it on click', async () => {
    getUpcomingEvents.mockResolvedValue({ items: [event] })
    joinEvent.mockResolvedValue({ status: 'joined' })
    render(<UpcomingEvents />)

    await waitFor(() => expect(screen.getByText('Interstellar Watch Party')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /join/i }))

    await waitFor(() => expect(joinEvent).toHaveBeenCalledWith('evt-1'))
    expect(await screen.findByRole('button', { name: 'Joined' })).toBeDisabled()
  })

  it('shows Requested when the event requires approval', async () => {
    getUpcomingEvents.mockResolvedValue({ items: [event] })
    joinEvent.mockResolvedValue({ status: 'pending' })
    render(<UpcomingEvents />)

    await waitFor(() => expect(screen.getByText('Interstellar Watch Party')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /join/i }))

    expect(await screen.findByRole('button', { name: 'Requested' })).toBeDisabled()
  })
})

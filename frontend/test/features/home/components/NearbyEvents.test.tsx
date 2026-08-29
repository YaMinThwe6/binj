import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getNearbyEvents = vi.fn()
const joinEvent = vi.fn()
vi.mock('../../../../src/features/home/services/homeApi', () => ({ getNearbyEvents, joinEvent }))

const { NearbyEvents } = await import('../../../../src/features/home/components/NearbyEvents')

const event = {
  eventId: 'evt-1',
  hostId: 'host-1',
  movieId: 'm1',
  title: 'Rooftop Watch Party',
  datetime: '2099-06-01T20:00:00.000Z',
  mode: 'in-person' as const,
  location: { address: 'MG Road', lat: 12.9716, lng: 77.5946 },
  visibility: 'public' as const,
  participantLimit: 5,
  participantCount: 2,
  requiresApproval: false,
  roomId: 'room-1',
  movieTitle: 'Interstellar',
  moviePoster: null,
  distanceKm: 1.2
}

const originalGeolocation = navigator.geolocation

afterEach(() => {
  getNearbyEvents.mockReset()
  joinEvent.mockReset()
  Object.defineProperty(navigator, 'geolocation', { value: originalGeolocation, configurable: true })
})

describe('NearbyEvents', () => {
  it('shows a "Find events near me" button before any location is requested', () => {
    render(<NearbyEvents onOpenChat={vi.fn()} />)
    expect(screen.getByRole('button', { name: /find events near me/i })).toBeInTheDocument()
    expect(getNearbyEvents).not.toHaveBeenCalled()
  })

  it('fetches and renders nearby events after location is granted', async () => {
    getNearbyEvents.mockResolvedValue({ items: [event] })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (onSuccess: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
          onSuccess({ coords: { latitude: 12.9716, longitude: 77.5946 } })
        }
      }
    })

    render(<NearbyEvents onOpenChat={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /find events near me/i }))

    await waitFor(() => expect(getNearbyEvents).toHaveBeenCalledWith(12.9716, 77.5946, 25))
    expect(await screen.findByText('Rooftop Watch Party')).toBeInTheDocument()
    expect(screen.getByText('1.2 km away')).toBeInTheDocument()
  })

  it('joins a nearby event on click', async () => {
    getNearbyEvents.mockResolvedValue({ items: [event] })
    joinEvent.mockResolvedValue({ status: 'joined' })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (onSuccess: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
          onSuccess({ coords: { latitude: 12.9716, longitude: 77.5946 } })
        }
      }
    })

    render(<NearbyEvents onOpenChat={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /find events near me/i }))
    await screen.findByText('Rooftop Watch Party')

    fireEvent.click(screen.getByRole('button', { name: /^join$/i }))
    await waitFor(() => expect(joinEvent).toHaveBeenCalledWith('evt-1'))
    expect(await screen.findByRole('button', { name: 'Joined' })).toBeDisabled()
  })

  it('offers a Chat button once joined, opening the event\'s room', async () => {
    getNearbyEvents.mockResolvedValue({ items: [event] })
    joinEvent.mockResolvedValue({ status: 'joined' })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (onSuccess: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
          onSuccess({ coords: { latitude: 12.9716, longitude: 77.5946 } })
        }
      }
    })
    const onOpenChat = vi.fn()

    render(<NearbyEvents onOpenChat={onOpenChat} />)
    fireEvent.click(screen.getByRole('button', { name: /find events near me/i }))
    await screen.findByText('Rooftop Watch Party')

    fireEvent.click(screen.getByRole('button', { name: /^join$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^chat$/i }))

    expect(onOpenChat).toHaveBeenCalledWith('room-1')
  })

  it('shows a gentle message, not an error, when location permission is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (
          _onSuccess: unknown,
          onError: (err: { code: number; PERMISSION_DENIED: number }) => void
        ) => {
          onError({ code: 1, PERMISSION_DENIED: 1 })
        }
      }
    })

    render(<NearbyEvents onOpenChat={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /find events near me/i }))

    await waitFor(() => expect(screen.getByText(/enable location access/i)).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getNearbyEvents).not.toHaveBeenCalled()
  })

  it('shows an error when the browser has no geolocation support at all', () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined })
    render(<NearbyEvents onOpenChat={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /find events near me/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/not available/i)
  })

  it('shows an empty-state message when nothing is nearby', async () => {
    getNearbyEvents.mockResolvedValue({ items: [] })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (onSuccess: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
          onSuccess({ coords: { latitude: 12.9716, longitude: 77.5946 } })
        }
      }
    })

    render(<NearbyEvents onOpenChat={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /find events near me/i }))

    await waitFor(() => expect(screen.getByText(/no watch parties nearby/i)).toBeInTheDocument())
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getNotifications = vi.fn()
const getHomeGreeting = vi.fn()
const getRecommendations = vi.fn()
const getTasteMatches = vi.fn()
const getUpcomingEvents = vi.fn()
const getHomeActivity = vi.fn()

vi.mock('../../src/lib/api', () => ({
  getNotifications,
  getHomeGreeting,
  getRecommendations,
  getTasteMatches,
  getUpcomingEvents,
  getHomeActivity
}))

const { Home } = await import('../../src/home/Home')

const me = {
  uid: 'uid-1',
  displayName: 'Arjun',
  username: 'arjun',
  email: 'arjun@example.com',
  photoURL: null,
  listVisible: true,
  followRequiresApproval: false,
  status: 'active' as const,
  favoriteGenres: null,
  preferredLanguages: null,
  onboardingComplete: true,
  notificationPrefs: { emailEnabled: true },
  themePreference: 'dark' as const,
  accentTheme: 'emerald' as const,
  isNewUser: false
}

afterEach(() => {
  getNotifications.mockReset()
  getHomeGreeting.mockReset()
  getRecommendations.mockReset()
  getTasteMatches.mockReset()
  getUpcomingEvents.mockReset()
  getHomeActivity.mockReset()
})

function mockAllEmpty() {
  getNotifications.mockResolvedValue({ items: [] })
  getHomeGreeting.mockResolvedValue({ quote: 'Q', attribution: 'A', source: 'random' })
  getRecommendations.mockResolvedValue({ items: [] })
  getTasteMatches.mockResolvedValue({ items: [] })
  getUpcomingEvents.mockResolvedValue({ items: [] })
  getHomeActivity.mockResolvedValue({ items: [] })
}

describe('Home', () => {
  it('shows the unread notification count as a badge', async () => {
    mockAllEmpty()
    getNotifications.mockResolvedValue({ items: [{ id: 'n1' }, { id: 'n2' }] })
    render(<Home me={me} onSignOut={vi.fn()} onNavigateSearch={vi.fn()} />)

    await waitFor(() => expect(getNotifications).toHaveBeenCalledWith(true))
    expect(await screen.findByText('2')).toBeInTheDocument()
  })

  it('calls onNavigateSearch when the Search button is clicked', async () => {
    mockAllEmpty()
    const onNavigateSearch = vi.fn()
    render(<Home me={me} onSignOut={vi.fn()} onNavigateSearch={onNavigateSearch} />)

    fireEvent.click(screen.getAllByRole('button', { name: /^search$/i })[0])
    expect(onNavigateSearch).toHaveBeenCalled()
  })

  it('calls onSignOut when Sign out is clicked', async () => {
    mockAllEmpty()
    const onSignOut = vi.fn()
    render(<Home me={me} onSignOut={onSignOut} onNavigateSearch={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(onSignOut).toHaveBeenCalled()
  })
})

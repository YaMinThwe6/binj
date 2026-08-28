import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getTasteMatches = vi.fn()
const followUser = vi.fn()
const unfollowUser = vi.fn()
vi.mock('../lib/api', () => ({ getTasteMatches, followUser, unfollowUser }))

const { PeopleYouMightVibeWith } = await import('./PeopleYouMightVibeWith')

afterEach(() => {
  getTasteMatches.mockReset()
  followUser.mockReset()
  unfollowUser.mockReset()
})

describe('PeopleYouMightVibeWith', () => {
  it('renders each person with a Connect button reflecting their relationship', async () => {
    getTasteMatches.mockResolvedValue({
      items: [
        { uid: 'u1', displayName: 'Rohan', score: 84, relationship: 'none' },
        { uid: 'u2', displayName: 'Meera', score: 81, relationship: 'following' },
        { uid: 'u3', displayName: 'Kabir', score: 79, relationship: 'pending' }
      ]
    })
    render(<PeopleYouMightVibeWith />)

    await waitFor(() => expect(screen.getByText('Rohan')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Requested' })).toBeInTheDocument()
  })

  it('clicking Connect on a non-followed person calls followUser and updates the label', async () => {
    getTasteMatches.mockResolvedValue({ items: [{ uid: 'u1', displayName: 'Rohan', score: 84, relationship: 'none' }] })
    followUser.mockResolvedValue({ status: 'following' })
    render(<PeopleYouMightVibeWith />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(followUser).toHaveBeenCalledWith('u1'))
    expect(await screen.findByRole('button', { name: 'Following' })).toBeInTheDocument()
  })

  it('clicking Following unfollows and reverts to Connect', async () => {
    getTasteMatches.mockResolvedValue({ items: [{ uid: 'u1', displayName: 'Rohan', score: 84, relationship: 'following' }] })
    unfollowUser.mockResolvedValue(undefined)
    render(<PeopleYouMightVibeWith />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Following' }))

    await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith('u1'))
    expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument()
  })
})

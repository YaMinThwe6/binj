import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getFriendsRecommendations = vi.fn()
const markWatched = vi.fn()
const addToWatchlist = vi.fn()
vi.mock('../../../../src/features/home/services/homeApi', () => ({ getFriendsRecommendations }))
vi.mock('../../../../src/features/movie/services/movieApi', () => ({ markWatched, addToWatchlist }))

const { BecauseYourFriendsWatched } = await import('../../../../src/features/home/components/BecauseYourFriendsWatched')

const items = [
  { movieId: 'm1', title: 'Whiplash', poster: null, year: 2014, genres: ['Drama'], voteAverage: 8.5, watchedByCount: 2 },
  { movieId: 'm2', title: 'The Prestige', poster: null, year: 2006, genres: ['Mystery'], voteAverage: 8.1, watchedByCount: 1 }
]

afterEach(() => {
  getFriendsRecommendations.mockReset()
  markWatched.mockReset()
  addToWatchlist.mockReset()
})

describe('BecauseYourFriendsWatched', () => {
  it('renders nothing when the caller has no connections yet (empty items)', async () => {
    getFriendsRecommendations.mockResolvedValue({ items: [] })
    const { container } = render(<BecauseYourFriendsWatched />)
    await waitFor(() => expect(getFriendsRecommendations).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('renders each recommended movie with how many friends watched it', async () => {
    getFriendsRecommendations.mockResolvedValue({ items })
    render(<BecauseYourFriendsWatched />)

    await waitFor(() => expect(screen.getByText('Whiplash')).toBeInTheDocument())
    expect(screen.getByText('The Prestige')).toBeInTheDocument()
    expect(screen.getByText('2 friends watched')).toBeInTheDocument()
    expect(screen.getByText('1 friend watched')).toBeInTheDocument()
  })

  it('marks a movie watched via the quick-add button', async () => {
    getFriendsRecommendations.mockResolvedValue({ items })
    markWatched.mockResolvedValue(undefined)
    render(<BecauseYourFriendsWatched />)

    await waitFor(() => expect(screen.getByText('Whiplash')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Add Whiplash'))
    fireEvent.click(screen.getByText('Watched'))

    await waitFor(() => expect(markWatched).toHaveBeenCalledWith('m1'))
  })
})

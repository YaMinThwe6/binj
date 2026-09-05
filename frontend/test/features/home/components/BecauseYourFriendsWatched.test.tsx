import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

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

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<BecauseYourFriendsWatched />} />
        <Route path="/movie/:movieId" element={<p>Movie page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('BecauseYourFriendsWatched', () => {
  it('renders nothing when the caller has no connections yet (empty items)', async () => {
    getFriendsRecommendations.mockResolvedValue({ items: [] })
    const { container } = renderWithRouter()
    await waitFor(() => expect(getFriendsRecommendations).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('renders each recommended movie with how many friends watched it', async () => {
    getFriendsRecommendations.mockResolvedValue({ items })
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Whiplash')).toBeInTheDocument())
    expect(screen.getByText('The Prestige')).toBeInTheDocument()
    expect(screen.getByText('2 friends watched')).toBeInTheDocument()
    expect(screen.getByText('1 friend watched')).toBeInTheDocument()
  })

  it('marks a movie watched via the quick-add button', async () => {
    getFriendsRecommendations.mockResolvedValue({ items })
    markWatched.mockResolvedValue(undefined)
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Whiplash')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Add Whiplash'))
    fireEvent.click(screen.getByText('Watched'))

    await waitFor(() => expect(markWatched).toHaveBeenCalledWith('m1'))
  })

  it('opens the movie detail page when the card is clicked', async () => {
    getFriendsRecommendations.mockResolvedValue({ items })
    renderWithRouter()

    fireEvent.click(await screen.findByLabelText('Open Whiplash'))
    expect(await screen.findByText('Movie page')).toBeInTheDocument()
  })

  it('does not navigate when the quick-add button is clicked', async () => {
    getFriendsRecommendations.mockResolvedValue({ items })
    renderWithRouter()

    fireEvent.click(await screen.findByLabelText('Add Whiplash'))
    expect(screen.getByText('Watched')).toBeInTheDocument()
    expect(screen.queryByText('Movie page')).not.toBeInTheDocument()
  })
})

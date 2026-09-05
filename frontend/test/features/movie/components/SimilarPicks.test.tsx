import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const getSimilarMovies = vi.fn()
const markWatched = vi.fn()
const addToWatchlist = vi.fn()
vi.mock('../../../../src/features/movie/services/movieApi', () => ({ getSimilarMovies, markWatched, addToWatchlist }))

const { SimilarPicks } = await import('../../../../src/features/movie/components/SimilarPicks')

const items = [
  { movieId: 'm1', title: 'Arrival', poster: null, year: 2016, voteAverage: 8.0 },
  { movieId: 'm2', title: 'Dune: Part Two', poster: null, year: 2024, voteAverage: 8.9 }
]

afterEach(() => {
  getSimilarMovies.mockReset()
  markWatched.mockReset()
  addToWatchlist.mockReset()
})

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/movie/m0']}>
      <Routes>
        <Route path="/movie/m0" element={<SimilarPicks movieId="m0" />} />
        <Route path="/movie/:movieId" element={<p>Movie page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SimilarPicks', () => {
  it('renders nothing when there are no similar movies', async () => {
    getSimilarMovies.mockResolvedValue({ items: [] })
    const { container } = renderWithRouter()
    await waitFor(() => expect(getSimilarMovies).toHaveBeenCalledWith('m0'))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders each similar movie with its title and rating', async () => {
    getSimilarMovies.mockResolvedValue({ items })
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Arrival')).toBeInTheDocument())
    expect(screen.getByText('Dune: Part Two')).toBeInTheDocument()
    expect(screen.getByText('★ 8.0')).toBeInTheDocument()
    expect(screen.getByText('★ 8.9')).toBeInTheDocument()
  })

  it('opens the movie detail page when a card is clicked', async () => {
    getSimilarMovies.mockResolvedValue({ items })
    renderWithRouter()

    fireEvent.click(await screen.findByLabelText('Open Arrival'))
    expect(await screen.findByText('Movie page')).toBeInTheDocument()
  })

  it('marks a movie watched via the quick-add button without navigating', async () => {
    getSimilarMovies.mockResolvedValue({ items })
    markWatched.mockResolvedValue(undefined)
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Arrival')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Add Arrival'))
    fireEvent.click(screen.getByText('Watched'))

    await waitFor(() => expect(markWatched).toHaveBeenCalledWith('m1'))
    expect(screen.queryByText('Movie page')).not.toBeInTheDocument()
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const getRecommendations = vi.fn()
const markWatched = vi.fn()
const addToWatchlist = vi.fn()
vi.mock('../../../../src/features/home/services/homeApi', () => ({ getRecommendations }))
vi.mock('../../../../src/features/movie/services/movieApi', () => ({ markWatched, addToWatchlist }))

const { TopPicks } = await import('../../../../src/features/home/components/TopPicks')

const items = [
  { movieId: 'm1', title: 'Dune: Part Two', poster: null, year: 2024, genres: ['Sci-Fi'], voteAverage: 8.4, matchScore: 92 },
  { movieId: 'm2', title: 'Interstellar', poster: null, year: 2014, genres: ['Sci-Fi'], voteAverage: 8.6, matchScore: null }
]

afterEach(() => {
  getRecommendations.mockReset()
  markWatched.mockReset()
  addToWatchlist.mockReset()
})

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<TopPicks />} />
        <Route path="/movie/:movieId" element={<p>Movie page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TopPicks', () => {
  it('renders match badges only when matchScore is present', async () => {
    getRecommendations.mockResolvedValue({ items })
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Dune: Part Two')).toBeInTheDocument())
    expect(screen.getByText('92% match')).toBeInTheDocument()
    expect(screen.queryByText('null% match')).not.toBeInTheDocument()
  });

  it('opens the quick-add popover and marks a movie watched', async () => {
    getRecommendations.mockResolvedValue({ items });
    markWatched.mockResolvedValue(undefined);
    renderWithRouter();

    await waitFor(() => expect(screen.getByText('Dune: Part Two')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Add Dune: Part Two'));
    fireEvent.click(screen.getByText('Watched'));

    await waitFor(() => expect(markWatched).toHaveBeenCalledWith('m1'));
    expect(screen.getByText('Added to watched')).toBeInTheDocument();
  });

  it('adds a movie to the watchlist via the popover', async () => {
    getRecommendations.mockResolvedValue({ items });
    addToWatchlist.mockResolvedValue(undefined);
    renderWithRouter();

    await waitFor(() => expect(screen.getByText('Interstellar')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Add Interstellar'));
    fireEvent.click(screen.getByText('Watchlist'));

    await waitFor(() => expect(addToWatchlist).toHaveBeenCalledWith('m2'));
  });

  it('opens the movie detail page when the card is clicked', async () => {
    getRecommendations.mockResolvedValue({ items });
    renderWithRouter();

    fireEvent.click(await screen.findByLabelText('Open Dune: Part Two'));
    expect(await screen.findByText('Movie page')).toBeInTheDocument();
  });

  it('does not navigate when the quick-add button is clicked', async () => {
    getRecommendations.mockResolvedValue({ items });
    renderWithRouter();

    fireEvent.click(await screen.findByLabelText('Add Dune: Part Two'));
    expect(screen.getByText('Watched')).toBeInTheDocument();
    expect(screen.queryByText('Movie page')).not.toBeInTheDocument();
  });
});

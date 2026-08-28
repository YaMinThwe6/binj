import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getRecommendations = vi.fn()
const markWatched = vi.fn()
const addToWatchlist = vi.fn()
vi.mock('../lib/api', () => ({ getRecommendations, markWatched, addToWatchlist }))

const { TopPicks } = await import('./TopPicks')

const items = [
  { movieId: 'm1', title: 'Dune: Part Two', poster: null, year: 2024, genres: ['Sci-Fi'], voteAverage: 8.4, matchScore: 92 },
  { movieId: 'm2', title: 'Interstellar', poster: null, year: 2014, genres: ['Sci-Fi'], voteAverage: 8.6, matchScore: null }
]

afterEach(() => {
  getRecommendations.mockReset()
  markWatched.mockReset()
  addToWatchlist.mockReset()
})

describe('TopPicks', () => {
  it('renders match badges only when matchScore is present', async () => {
    getRecommendations.mockResolvedValue({ items })
    render(<TopPicks />)

    await waitFor(() => expect(screen.getByText('Dune: Part Two')).toBeInTheDocument())
    expect(screen.getByText('92% match')).toBeInTheDocument()
    expect(screen.queryByText('null% match')).not.toBeInTheDocument()
  });

  it('opens the quick-add popover and marks a movie watched', async () => {
    getRecommendations.mockResolvedValue({ items });
    markWatched.mockResolvedValue(undefined);
    render(<TopPicks />);

    await waitFor(() => expect(screen.getByText('Dune: Part Two')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Add Dune: Part Two'));
    fireEvent.click(screen.getByText('Watched'));

    await waitFor(() => expect(markWatched).toHaveBeenCalledWith('m1'));
    expect(screen.getByText('Added to watched')).toBeInTheDocument();
  });

  it('adds a movie to the watchlist via the popover', async () => {
    getRecommendations.mockResolvedValue({ items });
    addToWatchlist.mockResolvedValue(undefined);
    render(<TopPicks />);

    await waitFor(() => expect(screen.getByText('Interstellar')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Add Interstellar'));
    fireEvent.click(screen.getByText('Watchlist'));

    await waitFor(() => expect(addToWatchlist).toHaveBeenCalledWith('m2'));
  });
});

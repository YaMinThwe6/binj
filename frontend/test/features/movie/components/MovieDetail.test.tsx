import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const getMovie = vi.fn()
const getMovieStatus = vi.fn()
const getMovieReviews = vi.fn()
const submitReview = vi.fn()
const deleteReview = vi.fn()
const addToWatchlist = vi.fn()
const removeFromWatchlist = vi.fn()
const markWatched = vi.fn()
const unmarkWatched = vi.fn()
const likeMovie = vi.fn()
const unlikeMovie = vi.fn()
// Not the focus of these tests — defaulted once so WatchedByFriends' own fetch
// doesn't need setup in every test (vi.clearAllMocks() below clears call
// history, not this mockResolvedValue).
const getMovieWatchedBy = vi.fn().mockResolvedValue({ items: [], nextCursor: null })

vi.mock('../../../../src/features/movie/services/movieApi', () => ({
  getMovie,
  getMovieStatus,
  getMovieReviews,
  submitReview,
  deleteReview,
  addToWatchlist,
  removeFromWatchlist,
  markWatched,
  unmarkWatched,
  likeMovie,
  unlikeMovie,
  getMovieWatchedBy
}))

const { MovieDetail } = await import('../../../../src/features/movie/components/MovieDetail')

const movie = {
  movieId: 'movie-1',
  title: 'Dune: Part Two',
  poster: null,
  year: 2024,
  runtime: 166,
  genres: ['Sci-Fi', 'Adventure'],
  synopsis: 'Paul Atreides unites with Chani and the Fremen.',
  cast: [{ personId: 'p1', name: 'Timothee Chalamet', character: 'Paul Atreides', photo: null }],
  crew: [{ personId: 'p2', name: 'Denis Villeneuve', role: 'Director', photo: null }],
  voteAverage: 8.3,
  voteCount: 4200,
  trailerKey: null,
  streamingProviders: [{ name: 'Netflix', type: 'subscription' as const, logo: '' }],
  binjRating: { sum: 0, count: 0 },
  likeCount: 0
}

const emptyStatus = { watchlisted: false, watched: false, liked: false, review: null }

function mockDefaults() {
  getMovie.mockResolvedValue(movie)
  getMovieStatus.mockResolvedValue(emptyStatus)
  getMovieReviews.mockResolvedValue({ items: [], nextCursor: null })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('MovieDetail', () => {
  it('renders hero info: title, year, genres, runtime, TMDB rating, and "No ratings yet" when binjRating.count is 0', async () => {
    mockDefaults()
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Dune: Part Two')).toBeInTheDocument())
    expect(screen.getByText(/2024/)).toBeInTheDocument()
    expect(screen.getByText(/Sci-Fi, Adventure/)).toBeInTheDocument()
    expect(screen.getByText(/166/)).toBeInTheDocument()
    expect(screen.getByText('8.3')).toBeInTheDocument()
    expect(screen.getByText(/no ratings yet/i)).toBeInTheDocument()
  })

  it('shows the BINJ average when binjRating.count > 0', async () => {
    getMovie.mockResolvedValue({ ...movie, binjRating: { sum: 18, count: 4 } }) // avg 4.5
    getMovieStatus.mockResolvedValue(emptyStatus)
    getMovieReviews.mockResolvedValue({ items: [], nextCursor: null })
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('4.5')).toBeInTheDocument())
  })

  it('reflects current status on load: watchlist/watched/like pressed state', async () => {
    getMovie.mockResolvedValue(movie)
    getMovieStatus.mockResolvedValue({ watchlisted: true, watched: false, liked: true, review: null })
    getMovieReviews.mockResolvedValue({ items: [], nextCursor: null })
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: /watchlist/i })).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('button', { name: /^watched$/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /^like$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggling watchlist calls addToWatchlist optimistically and updates pressed state', async () => {
    mockDefaults()
    addToWatchlist.mockResolvedValue(undefined)
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: /watchlist/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /watchlist/i }))

    expect(screen.getByRole('button', { name: /watchlist/i })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(addToWatchlist).toHaveBeenCalledWith('movie-1'))
  })

  it('rolls back the optimistic toggle when the API call fails', async () => {
    mockDefaults()
    addToWatchlist.mockRejectedValue(new Error('network error'))
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: /watchlist/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /watchlist/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /watchlist/i })).toHaveAttribute('aria-pressed', 'false'))
    expect(screen.getByRole('alert')).toHaveTextContent('network error')
  })

  it('toggling watched calls markWatched, toggling like calls likeMovie', async () => {
    mockDefaults()
    markWatched.mockResolvedValue(undefined)
    likeMovie.mockResolvedValue(undefined)
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: /^watched$/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^watched$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^like$/i }))

    await waitFor(() => expect(markWatched).toHaveBeenCalledWith('movie-1'))
    await waitFor(() => expect(likeMovie).toHaveBeenCalledWith('movie-1'))
  })

  it('renders streaming providers, synopsis, and cast', async () => {
    mockDefaults()
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Netflix')).toBeInTheDocument())
    expect(screen.getByText(/Paul Atreides unites/)).toBeInTheDocument()
    expect(screen.getByText('Timothee Chalamet')).toBeInTheDocument()
    expect(screen.getByText('Paul Atreides')).toBeInTheDocument()
  })

  it('renders the reviews list with reviewer name, stars, and text', async () => {
    getMovie.mockResolvedValue(movie)
    getMovieStatus.mockResolvedValue(emptyStatus)
    getMovieReviews.mockResolvedValue({
      items: [
        { authorId: 'u2', displayName: 'Meera', rating: 5, reviewText: 'Incredible film', isAnonymous: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { authorId: null, displayName: null, rating: 3, reviewText: 'It was fine', isAnonymous: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ],
      nextCursor: null
    })
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Meera')).toBeInTheDocument())
    expect(screen.getByText('Incredible film')).toBeInTheDocument()
    expect(screen.getByText('Anonymous')).toBeInTheDocument()
    expect(screen.getByText('It was fine')).toBeInTheDocument()
  })

  it('"Write a review" opens a blank form when the caller has no existing review', async () => {
    mockDefaults()
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: /write a review/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /write a review/i }))

    expect(screen.getByRole('textbox', { name: /review/i })).toHaveValue('')
    expect(screen.queryByRole('button', { name: /delete review/i })).not.toBeInTheDocument()
  })

  it('"Write a review" pre-fills and offers Delete when the caller already has a review', async () => {
    getMovie.mockResolvedValue(movie)
    getMovieStatus.mockResolvedValue({
      watchlisted: false, watched: false, liked: false,
      review: { rating: 4, reviewText: 'Pretty good', isAnonymous: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    })
    getMovieReviews.mockResolvedValue({ items: [], nextCursor: null })
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: /edit your review/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /edit your review/i }))

    expect(screen.getByRole('textbox', { name: /review/i })).toHaveValue('Pretty good')
    const stars = within(screen.getByRole('group', { name: /rating/i })).getAllByRole('button')
    expect(stars[3]).toHaveAttribute('aria-pressed', 'true') // 4th star = rating 4
    expect(screen.getByRole('checkbox', { name: /anonymous/i })).toBeChecked()
    expect(screen.getByRole('button', { name: /delete review/i })).toBeInTheDocument()
  })

  it('submitting the review form calls submitReview and refreshes the list and status', async () => {
    mockDefaults()
    submitReview.mockResolvedValue({ rating: 5, reviewText: 'Amazing', isAnonymous: false, createdAt: '', updatedAt: '' })
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: /write a review/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /write a review/i }))

    const stars = within(screen.getByRole('group', { name: /rating/i })).getAllByRole('button')
    fireEvent.click(stars[4]) // 5th star = rating 5
    fireEvent.change(screen.getByRole('textbox', { name: /review/i }), { target: { value: 'Amazing' } })
    fireEvent.click(screen.getByRole('button', { name: /^post review$/i }))

    await waitFor(() => expect(submitReview).toHaveBeenCalledWith('movie-1', { rating: 5, reviewText: 'Amazing', isAnonymous: false }))
    await waitFor(() => expect(getMovieReviews).toHaveBeenCalledTimes(2)) // initial load + refresh after submit
  })

  it('refreshes the movie itself after submitting, so a newly-changed BINJ average shows without a reload', async () => {
    mockDefaults()
    submitReview.mockResolvedValue({ rating: 5, reviewText: 'Amazing', isAnonymous: false, createdAt: '', updatedAt: '' })
    getMovie.mockResolvedValueOnce(movie).mockResolvedValueOnce({ ...movie, binjRating: { sum: 5, count: 1 } })
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: /write a review/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /write a review/i }))
    const stars = within(screen.getByRole('group', { name: /rating/i })).getAllByRole('button')
    fireEvent.click(stars[4])
    fireEvent.click(screen.getByRole('button', { name: /^post review$/i }))

    await waitFor(() => expect(getMovie).toHaveBeenCalledTimes(2)) // initial load + refresh after submit
    expect(await screen.findByText('5.0')).toBeInTheDocument()
  })

  it('deleting a review calls deleteReview and refreshes', async () => {
    getMovie.mockResolvedValue(movie)
    getMovieStatus.mockResolvedValue({
      watchlisted: false, watched: false, liked: false,
      review: { rating: 2, reviewText: null, isAnonymous: false, createdAt: '', updatedAt: '' }
    })
    getMovieReviews.mockResolvedValue({ items: [], nextCursor: null })
    deleteReview.mockResolvedValue(undefined)
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: /edit your review/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /edit your review/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete review/i }))

    await waitFor(() => expect(deleteReview).toHaveBeenCalledWith('movie-1'))
    await waitFor(() => expect(getMovieStatus).toHaveBeenCalledTimes(2))
  })

  it('shows independent loading/error states per section', async () => {
    getMovie.mockResolvedValue(movie)
    getMovieStatus.mockRejectedValue(new Error('status failed'))
    getMovieReviews.mockResolvedValue({ items: [], nextCursor: null })
    render(<MovieDetail movieId="movie-1" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Dune: Part Two')).toBeInTheDocument())
    // Movie itself and reviews still render fine even though status failed independently.
    expect(screen.queryByText(/status failed/i)).toBeInTheDocument()
  })
})

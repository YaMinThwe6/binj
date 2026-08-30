import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const searchMovies = vi.fn()
vi.mock('../../../../src/features/movie/services/movieApi', () => ({ searchMovies }))

let authUser: { uid: string } | null = { uid: 'uid-1' }
vi.mock('../../../../src/lib/AuthContext', () => ({
  useAuth: () => ({ user: authUser, loading: false, signInWithGoogle: vi.fn(), signInWithMicrosoft: vi.fn(), signInWithToken: vi.fn(), signOutUser: vi.fn() })
}))

const { MovieSearch } = await import('../../../../src/features/movie/components/MovieSearch')

afterEach(() => {
  searchMovies.mockReset()
  authUser = { uid: 'uid-1' }
})

describe('MovieSearch — signed-in usage (via Home)', () => {
  it('shows a "← Home" back button, not the guest header', () => {
    render(<MovieSearch onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: /← home/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^get started$/i })).not.toBeInTheDocument()
  })

  it('calls onBack when "← Home" is clicked', () => {
    const onBack = vi.fn()
    render(<MovieSearch onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /← home/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('MovieSearch — guest usage (public Discover)', () => {
  it('shows the BINJ brand and a Get Started button instead of a back button', () => {
    render(<MovieSearch onRequireAuth={vi.fn()} />)
    expect(screen.getByText('BINJ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^get started$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /← home/i })).not.toBeInTheDocument()
  })

  it('calls onRequireAuth when Get Started is clicked', () => {
    const onRequireAuth = vi.fn()
    render(<MovieSearch onRequireAuth={onRequireAuth} />)
    fireEvent.click(screen.getByRole('button', { name: /^get started$/i }))
    expect(onRequireAuth).toHaveBeenCalledTimes(1)
  })
})

describe('MovieSearch — search', () => {
  it('searches and renders results, then opens MovieDetail on click', async () => {
    searchMovies.mockResolvedValue({ items: [{ movieId: 'm1', title: 'Dune: Part Two', poster: null, year: 2024 }] })
    render(<MovieSearch onRequireAuth={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/search for a movie/i), { target: { value: 'Dune' } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() => expect(searchMovies).toHaveBeenCalledWith('Dune'))
    expect(await screen.findByText('Dune: Part Two')).toBeInTheDocument()
  })

  it('shows an error message when search fails', async () => {
    searchMovies.mockRejectedValue(new Error('Search failed'))
    render(<MovieSearch onRequireAuth={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/search for a movie/i), { target: { value: 'Dune' } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Search failed'))
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const getHomeGreeting = vi.fn()
vi.mock('../lib/api', () => ({ getHomeGreeting }))

const { GreetingHero } = await import('./GreetingHero')

afterEach(() => getHomeGreeting.mockReset())

describe('GreetingHero', () => {
  it('renders the fetched quote, attribution, and a welcome message with the display name', async () => {
    getHomeGreeting.mockResolvedValue({ quote: 'Why so serious?', attribution: 'The Dark Knight', source: 'random' })
    render(<GreetingHero displayName="Arjun" />)

    await waitFor(() => expect(screen.getByText(/Why so serious\?/)).toBeInTheDocument())
    expect(screen.getByText(/The Dark Knight/)).toBeInTheDocument()
    expect(screen.getByText(/Welcome back, Arjun/)).toBeInTheDocument()
  })

  it('shows an error if the greeting fails to load', async () => {
    getHomeGreeting.mockRejectedValue(new Error('boom'))
    render(<GreetingHero displayName="Arjun" />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'))
  })
})

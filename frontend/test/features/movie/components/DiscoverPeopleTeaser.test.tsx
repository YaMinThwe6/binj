import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const { DiscoverPeopleTeaser } = await import('../../../../src/features/movie/components/DiscoverPeopleTeaser')

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DiscoverPeopleTeaser />} />
        <Route path="/get-started" element={<p>Get started page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('DiscoverPeopleTeaser', () => {
  it('shows no fabricated names or match percentages — a loading-style skeleton only', () => {
    renderWithRouter()
    expect(screen.getByText('People you might vibe with')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('navigates to Get Started when its CTA is clicked', async () => {
    renderWithRouter()
    fireEvent.click(screen.getByRole('button', { name: /sign up \/ sign in to view/i }))
    expect(await screen.findByText('Get started page')).toBeInTheDocument()
  })
})

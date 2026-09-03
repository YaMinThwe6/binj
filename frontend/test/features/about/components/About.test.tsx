import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const { About } = await import('../../../../src/features/about/components/About')

// Seeds two history entries so the "Back" button's navigate(-1) has
// somewhere real to go — a bare single-entry history can't go back further.
function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/', '/story']} initialIndex={1}>
      <Routes>
        <Route path="/" element={<p>Previous page</p>} />
        <Route path="/story" element={<About />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('About', () => {
  it('shows the required TMDB attribution notice and logo', () => {
    renderWithRouter()
    expect(screen.getByText(/this product uses the tmdb api but is not endorsed or certified by tmdb/i)).toBeInTheDocument()
    expect(screen.getByAltText('TMDB')).toBeInTheDocument()
  })

  it('credits JustWatch for streaming availability data', () => {
    renderWithRouter()
    expect(screen.getByText(/justwatch/i)).toBeInTheDocument()
  })

  it('navigates back when Back is clicked', async () => {
    renderWithRouter()
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(await screen.findByText('Previous page')).toBeInTheDocument()
  })
})

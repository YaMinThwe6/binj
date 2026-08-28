import { describe, it, expect } from 'vitest'
import { buildFirstGreeting } from './greeting'
import type { MovieCandidate } from '../lib/api'

function movie(overrides: Partial<MovieCandidate>): MovieCandidate {
  return {
    movieId: 'm1',
    title: 'Movie',
    poster: null,
    year: 2020,
    genres: [],
    voteAverage: 5,
    ...overrides
  }
}

describe('buildFirstGreeting', () => {
  it('returns null when nothing was marked watched', () => {
    expect(buildFirstGreeting([])).toBeNull()
  })

  it('anchors on the single watched movie', () => {
    const result = buildFirstGreeting([movie({ movieId: '1', title: 'Inception', voteAverage: 8.4 })])
    expect(result).toContain('Inception')
  })

  it('anchors on the highest-rated watched movie and mentions the rest', () => {
    const result = buildFirstGreeting([
      movie({ movieId: '1', title: 'Low Rated', voteAverage: 4 }),
      movie({ movieId: '2', title: 'Inception', voteAverage: 8.4 }),
      movie({ movieId: '3', title: 'Mid Rated', voteAverage: 6 })
    ])
    expect(result).toContain('Inception')
    expect(result).toContain('2 other movies')
  })
})

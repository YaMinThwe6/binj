import { describe, it, expect } from 'vitest'
import { matchFacet } from '../../../src/features/movie/genreLanguageMatch'

describe('matchFacet', () => {
  it('matches a language name to its ISO code', () => {
    expect(matchFacet('korean')).toMatchObject({ kind: 'language', value: 'ko', chipLabel: 'Browse Korean films' })
    expect(matchFacet('Japanese')).toMatchObject({ kind: 'language', value: 'ja' })
  })

  it('matches a genre name', () => {
    expect(matchFacet('horror')).toMatchObject({ kind: 'genre', value: 'Horror', chipLabel: 'Browse Horror movies' })
    expect(matchFacet('Science Fiction')).toMatchObject({ kind: 'genre', value: 'Science Fiction' })
  })

  it('strips a trailing "movies" / "films" / "cinema"', () => {
    expect(matchFacet('korean movies')).toMatchObject({ value: 'ko' })
    expect(matchFacet('horror films')).toMatchObject({ value: 'Horror' })
    expect(matchFacet('comedy cinema')).toMatchObject({ value: 'Comedy' })
  })

  it('resolves common genre aliases', () => {
    expect(matchFacet('sci-fi')).toMatchObject({ value: 'Science Fiction' })
    expect(matchFacet('scifi movies')).toMatchObject({ value: 'Science Fiction' })
  })

  it('is case- and whitespace-insensitive', () => {
    expect(matchFacet('  KoReAn   ')).toMatchObject({ value: 'ko' })
  })

  it('returns null for an ordinary title query or too-short input', () => {
    expect(matchFacet('Dune')).toBeNull()
    expect(matchFacet('the dark knight')).toBeNull()
    expect(matchFacet('ko')).toBeNull()
  })
})

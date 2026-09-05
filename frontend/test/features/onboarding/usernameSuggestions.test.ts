import { describe, it, expect } from 'vitest'
import { generateUsernameSuggestions } from '../../../src/features/onboarding/usernameSuggestions'

describe('generateUsernameSuggestions', () => {
  it('combines first/last name and the email local-part into candidates', () => {
    const result = generateUsernameSuggestions('Arjun Kumar', 'arjun.kumar@gmail.com')
    expect(result).toContain('arjun.kumar')
    expect(result).toContain('arjunkumar')
    expect(result).toContain('arjun_kumar')
    expect(result).toContain('arjunk')
  })

  it('handles a single-word name', () => {
    const result = generateUsernameSuggestions('Cher', 'cher@example.com')
    expect(result).toContain('cher')
  })

  it('lowercases and strips characters outside the allowed set', () => {
    const result = generateUsernameSuggestions("O'Brien Smith", 'obrien+test@example.com')
    for (const candidate of result) {
      expect(candidate).toMatch(/^[a-z0-9._]{3,30}$/)
    }
  })

  it('adds numbered fallbacks derived from the first candidate', () => {
    const result = generateUsernameSuggestions('Arjun Kumar', 'arjun.kumar@gmail.com')
    expect(result.some((c) => c.startsWith('arjun.kumar') && /\d$/.test(c))).toBe(true)
  })

  it('never produces duplicate candidates', () => {
    const result = generateUsernameSuggestions('Arjun Kumar', 'arjun.kumar@gmail.com')
    expect(new Set(result).size).toBe(result.length)
  })

  it('returns an empty list for empty inputs', () => {
    expect(generateUsernameSuggestions('', '')).toEqual([])
  })
})

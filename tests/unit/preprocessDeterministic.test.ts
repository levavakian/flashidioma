import { describe, it, expect } from 'vitest'
import { conjugateVerb } from '../../scripts/spanish-conjugator'

describe('Preprocessing output determinism', () => {
  it('conjugateVerb returns identical output for the same input', () => {
    // Run conjugation multiple times and verify identical results
    const result1 = conjugateVerb('hablar')!
    const result2 = conjugateVerb('hablar')!

    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2))
  })

  it('conjugateVerb is deterministic for irregular verbs', () => {
    const result1 = conjugateVerb('ser')!
    const result2 = conjugateVerb('ser')!

    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2))
  })

  it('conjugation engine produces consistent output across multiple verbs', () => {
    const verbs = ['hablar', 'comer', 'vivir', 'ser', 'ir', 'tener', 'hacer']
    const run1 = verbs.map((v) => JSON.stringify(conjugateVerb(v)))
    const run2 = verbs.map((v) => JSON.stringify(conjugateVerb(v)))

    for (let i = 0; i < verbs.length; i++) {
      expect(run1[i]).toBe(run2[i])
    }
  })
})

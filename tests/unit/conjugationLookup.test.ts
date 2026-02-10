import { describe, it, expect } from 'vitest'
import { lookupConjugation, hasConjugation } from '../../src/services/conjugationLookup'

describe('Static conjugation DB lookup', () => {
  it('returns conjugation data for known verbs', async () => {
    const result = await lookupConjugation('hablar')
    expect(result).not.toBeNull()
    expect(result!.infinitive).toBe('hablar')
    expect(result!.language).toBe('spanish')
    expect(result!.tenses.length).toBeGreaterThan(0)

    const present = result!.tenses.find((t) => t.tenseId === 'present')!
    expect(present.conjugations[0].form).toBe('hablo')
    expect(present.conjugations[0].person).toBe('yo')
    expect(present.conjugations[0].miniTranslation).toBe('')
  })

  it('returns null for unknown verbs', async () => {
    const result = await lookupConjugation('xyzverbar')
    expect(result).toBeNull()
  })

  it('hasConjugation returns true for known verbs', async () => {
    expect(await hasConjugation('hablar')).toBe(true)
    expect(await hasConjugation('ser')).toBe(true)
    expect(await hasConjugation('comer')).toBe(true)
  })

  it('hasConjugation returns false for unknown verbs', async () => {
    expect(await hasConjugation('xyzverbar')).toBe(false)
    expect(await hasConjugation('notaverb')).toBe(false)
  })

  it('returns correct data for irregular verbs', async () => {
    const ser = await lookupConjugation('ser')
    expect(ser).not.toBeNull()
    expect(ser!.infinitive).toBe('ser')

    const present = ser!.tenses.find((t) => t.tenseId === 'present')!
    const forms = present.conjugations.map((c) => c.form)
    expect(forms).toEqual(['soy', 'eres', 'es', 'somos', 'sois', 'son'])
  })

  it('returns all 16 tenses for a verb', async () => {
    const result = await lookupConjugation('hablar')
    expect(result!.tenses).toHaveLength(16)

    const tenseIds = result!.tenses.map((t) => t.tenseId)
    expect(tenseIds).toContain('present')
    expect(tenseIds).toContain('preterite')
    expect(tenseIds).toContain('imperfect')
    expect(tenseIds).toContain('future')
    expect(tenseIds).toContain('conditional')
    expect(tenseIds).toContain('present-subjunctive')
    expect(tenseIds).toContain('imperfect-subjunctive')
    expect(tenseIds).toContain('imperative')
    expect(tenseIds).toContain('present-perfect')
    expect(tenseIds).toContain('pluperfect')
    expect(tenseIds).toContain('future-perfect')
    expect(tenseIds).toContain('conditional-perfect')
    expect(tenseIds).toContain('present-progressive')
    expect(tenseIds).toContain('imperfect-progressive')
    expect(tenseIds).toContain('poder-present')
    expect(tenseIds).toContain('deber-present')
  })

  it('compound tenses include haber forms', async () => {
    const result = await lookupConjugation('hablar')
    const pp = result!.tenses.find((t) => t.tenseId === 'present-perfect')!
    expect(pp.conjugations[0].form).toBe('he hablado')
    expect(pp.conjugations[5].form).toBe('han hablado')
  })
})

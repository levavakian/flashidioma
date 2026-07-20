import { describe, it, expect } from 'vitest'
import deckData from '../../src/data/spanish-deck.json'
import conjugationData from '../../src/data/spanish-conjugations.json'

describe('Preprocessing script output', () => {
  describe('deck data structure', () => {
    it('has correct top-level structure', () => {
      expect(deckData.id).toBe('spanish-frequency')
      expect(deckData.name).toBeTruthy()
      expect(deckData.language).toBe('spanish')
      expect(deckData.generatedAt).toBeTruthy()
      expect(Array.isArray(deckData.cards)).toBe(true)
      expect(deckData.cards.length).toBeGreaterThan(1000)
    })

    it('cards are in frequency order (descending)', () => {
      for (let i = 1; i < Math.min(100, deckData.cards.length); i++) {
        expect(deckData.cards[i - 1].frequency).toBeGreaterThanOrEqual(
          deckData.cards[i].frequency
        )
      }
    })

    it('cards have required fields', () => {
      const card = deckData.cards[0]
      expect(card.word).toBeTruthy()
      expect(card.pos).toBeTruthy()
      expect(typeof card.frequency).toBe('number')
      expect(card.translation).toBeTruthy()
      expect(Array.isArray(card.forms)).toBe(true)
    })

    it('includes common POS tags', () => {
      const posSet = new Set(deckData.cards.map((c) => c.pos))
      expect(posSet.has('v')).toBe(true)
      expect(posSet.has('n')).toBe(true)
      expect(posSet.has('adj')).toBe(true)
    })
  })

  describe('conjugation data structure', () => {
    it('has correct top-level structure', () => {
      expect(conjugationData.language).toBe('spanish')
      expect(conjugationData.generatedAt).toBeTruthy()
      expect(conjugationData.verbCount).toBeGreaterThan(2000)
      expect(Array.isArray(conjugationData.tenses)).toBe(true)
      expect(conjugationData.tenses).toHaveLength(21)
      expect(typeof conjugationData.verbs).toBe('object')
    })

    it('tense metadata includes all required tenses', () => {
      const tenseIds = conjugationData.tenses.map((t) => t.tenseId)
      expect(tenseIds).toContain('present')
      expect(tenseIds).toContain('preterite')
      expect(tenseIds).toContain('imperfect')
      expect(tenseIds).toContain('future')
      expect(tenseIds).toContain('conditional')
      expect(tenseIds).toContain('present-subjunctive')
      expect(tenseIds).toContain('imperfect-subjunctive')
      expect(tenseIds).toContain('perfect-subjunctive')
      expect(tenseIds).toContain('pluperfect-subjunctive')
      expect(tenseIds).toContain('imperative')
      expect(tenseIds).toContain('negative-imperative')
      expect(tenseIds).toContain('present-perfect')
      expect(tenseIds).toContain('pluperfect')
      expect(tenseIds).toContain('future-perfect')
      expect(tenseIds).toContain('conditional-perfect')
      expect(tenseIds).toContain('present-progressive')
      expect(tenseIds).toContain('preterite-progressive')
      expect(tenseIds).toContain('imperfect-progressive')
      expect(tenseIds).toContain('future-progressive')
    })

    it('tense metadata includes persons', () => {
      const present = conjugationData.tenses.find((t) => t.tenseId === 'present')!
      expect(present.persons).toContain('yo')
      expect(present.persons).toContain('tú')
      expect(present.persons.length).toBe(6)
    })
  })

  describe('known verbs have conjugation tables', () => {
    it('ser has correct conjugations', () => {
      const ser = conjugationData.verbs['ser' as keyof typeof conjugationData.verbs] as string[][]
      expect(ser).toBeDefined()
      // Present tense is index 0
      expect(ser[0]).toEqual(['soy', 'eres', 'es', 'somos', 'sois', 'son'])
    })

    it('estar has correct conjugations', () => {
      const estar = conjugationData.verbs['estar' as keyof typeof conjugationData.verbs] as string[][]
      expect(estar).toBeDefined()
      expect(estar[0]).toEqual(['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'])
    })

    it('tener has correct conjugations', () => {
      const tener = conjugationData.verbs['tener' as keyof typeof conjugationData.verbs] as string[][]
      expect(tener).toBeDefined()
      expect(tener[0]).toEqual(['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'])
      // Future (index 3) should use irregular stem
      expect(tener[3][0]).toBe('tendré')
    })

    it('haber has correct conjugations', () => {
      const haber = conjugationData.verbs['haber' as keyof typeof conjugationData.verbs] as string[][]
      expect(haber).toBeDefined()
      expect(haber[0]).toEqual(['he', 'has', 'ha', 'hemos', 'habéis', 'han'])
      expect(haber[3][0]).toBe('habré')
      expect(haber[6][0]).toBe('hubiera')
    })

    it('fallback-only irregular verbs are still conjugated correctly', () => {
      const asir = conjugationData.verbs['asir' as keyof typeof conjugationData.verbs] as string[][]
      expect(asir).toBeDefined()
      expect(asir[0]).toEqual(['asgo', 'ases', 'ase', 'asimos', 'asís', 'asen'])

      const soltar = conjugationData.verbs['soltar' as keyof typeof conjugationData.verbs] as string[][]
      expect(soltar).toBeDefined()
      expect(soltar[0]).toEqual(['suelto', 'sueltas', 'suelta', 'soltamos', 'soltáis', 'sueltan'])

      const sostener = conjugationData.verbs['sostener' as keyof typeof conjugationData.verbs] as string[][]
      expect(sostener).toBeDefined()
      expect(sostener[0]).toEqual([
        'sostengo',
        'sostienes',
        'sostiene',
        'sostenemos',
        'sostenéis',
        'sostienen',
      ])
      expect(sostener[3][0]).toBe('sostendré')
    })

    it('hablar has perfect and pluperfect subjunctive forms', () => {
      const hablar = conjugationData.verbs['hablar' as keyof typeof conjugationData.verbs] as string[][]
      // Perfect subjunctive (index 7) and pluperfect subjunctive (index 8),
      // right after imperfect subjunctive at index 6
      expect(hablar[7][0]).toBe('haya hablado')
      expect(hablar[8][0]).toBe('hubiera hablado')
    })

    it('hablar has negative imperative forms', () => {
      const hablar = conjugationData.verbs['hablar' as keyof typeof conjugationData.verbs] as string[][]
      // Negative imperative (index 10, right after affirmative imperative at index 9)
      expect(hablar[10]).toEqual([
        'no hables', 'no hable', 'no hablemos', 'no habléis', 'no hablen',
      ])
    })

    it('hablar has compound tenses', () => {
      const hablar = conjugationData.verbs['hablar' as keyof typeof conjugationData.verbs] as string[][]
      expect(hablar).toBeDefined()
      // Present perfect (index 11)
      expect(hablar[11][0]).toBe('he hablado')
      // Pluperfect (index 12)
      expect(hablar[12][0]).toBe('había hablado')
    })

    it('hablar has preterite progressive forms', () => {
      const hablar = conjugationData.verbs['hablar' as keyof typeof conjugationData.verbs] as string[][]
      expect(hablar[16]).toEqual([
        'estuve hablando',
        'estuviste hablando',
        'estuvo hablando',
        'estuvimos hablando',
        'estuvisteis hablando',
        'estuvieron hablando',
      ])
    })
  })
})

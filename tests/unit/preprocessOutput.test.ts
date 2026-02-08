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
      expect(conjugationData.tenses).toHaveLength(12)
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
      expect(tenseIds).toContain('imperative')
      expect(tenseIds).toContain('present-perfect')
      expect(tenseIds).toContain('pluperfect')
      expect(tenseIds).toContain('future-perfect')
      expect(tenseIds).toContain('conditional-perfect')
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

    it('hablar has compound tenses', () => {
      const hablar = conjugationData.verbs['hablar' as keyof typeof conjugationData.verbs] as string[][]
      expect(hablar).toBeDefined()
      // Present perfect (index 8)
      expect(hablar[8][0]).toBe('he hablado')
      // Pluperfect (index 9)
      expect(hablar[9][0]).toBe('había hablado')
    })
  })
})

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Full pipeline integration', () => {
  it('preprocessed deck artifact exists and is valid JSON', () => {
    const deckPath = path.resolve(__dirname, '../../../src/data/spanish-deck.json')
    expect(fs.existsSync(deckPath)).toBe(true)

    const raw = fs.readFileSync(deckPath, 'utf-8')
    const deck = JSON.parse(raw)

    expect(deck.name).toBeDefined()
    expect(deck.language).toBe('spanish')
    expect(Array.isArray(deck.cards)).toBe(true)
    expect(deck.cards.length).toBeGreaterThan(100)
  })

  it('preprocessed conjugation artifact exists and is valid JSON', () => {
    const conjPath = path.resolve(__dirname, '../../../src/data/spanish-conjugations.json')
    expect(fs.existsSync(conjPath)).toBe(true)

    const raw = fs.readFileSync(conjPath, 'utf-8')
    const data = JSON.parse(raw)

    expect(data.language).toBe('spanish')
    expect(data.verbCount).toBeGreaterThan(100)
    expect(Array.isArray(data.tenses)).toBe(true)
    expect(data.tenses.length).toBeGreaterThan(0)
    expect(typeof data.verbs).toBe('object')

    // Verify a known verb exists
    expect(data.verbs['hablar']).toBeDefined()
    expect(data.verbs['ser']).toBeDefined()
    expect(data.verbs['tener']).toBeDefined()
  })

  it('deck cards can be imported into the app database', async () => {
    const { db } = await import('../../../src/db')
    const { importPrebuiltDeck } = await import('../../../src/services/importDeck')

    await db.decks.clear()
    await db.cards.clear()
    await db.sideDeckCards.clear()

    // Create a target deck
    const { createDeck } = await import('../../../src/services/deck')
    const deck = await createDeck('Import Test')

    // Import a small number of cards from the artifact
    const result = await importPrebuiltDeck('spanish-frequency', deck.id, 10)

    // Some cards might share translations causing dedup, so imported + skipped = 10
    expect(result.imported + result.skipped).toBe(10)
    expect(result.imported).toBeGreaterThan(0)

    // Verify cards are in DB — each imported word creates 2 cards (both directions)
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    expect(cards).toHaveLength(result.imported * 2)

    // Verify both directions exist
    const s2t = cards.filter(c => c.direction === 'source-to-target')
    const t2s = cards.filter(c => c.direction === 'target-to-source')
    expect(s2t.length).toBe(result.imported)
    expect(t2s.length).toBe(result.imported)

    // Verify cards have required fields
    for (const card of cards) {
      expect(card.frontText).toBeTruthy()
      expect(card.backText).toBeTruthy()
      expect(card.direction).toBeDefined()
      expect(card.deckId).toBe(deck.id)
    }
  })

  it('conjugation data is loadable through the lookup service', async () => {
    const { lookupConjugation } = await import('../../../src/services/conjugationLookup')

    const hablar = await lookupConjugation('hablar')
    expect(hablar).not.toBeNull()
    expect(hablar!.infinitive).toBe('hablar')
    expect(hablar!.tenses.length).toBeGreaterThan(0)

    // Verify a specific conjugation form
    const present = hablar!.tenses.find((t) => t.tenseId === 'present')
    expect(present).toBeDefined()

    const yo = present!.conjugations.find((c) => c.person === 'yo')
    expect(yo).toBeDefined()
    expect(yo!.form).toBe('hablo')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { db, getSettings } from '../../src/db'
import { createDeck } from '../../src/services/deck'
import { createCard } from '../../src/services/card'
import { reviewCard } from '../../src/services/review'
import { exportAppState, importAppState, validateImport } from '../../src/services/exportImport'

beforeEach(async () => {
  await db.settings.clear()
  await db.decks.clear()
  await db.cards.clear()
  await db.reviewHistory.clear()
  await db.practiceSentences.clear()
  await db.sideDeckCards.clear()
})

describe('Export', () => {
  it('produces valid JSON containing all app state', async () => {
    await getSettings() // Initialize settings
    const deck = await createDeck('Test Deck')
    const card = await createCard({
      deckId: deck.id,
      frontText: 'hello',
      backText: 'hola',
      direction: 'source-to-target',
      tags: ['greeting'],
    })
    await reviewCard(card.id, 3)

    const exported = await exportAppState()

    expect(exported.version).toBe(1)
    expect(exported.exportedAt).toBeTruthy()
    expect(exported.settings.id).toBe('settings')
    expect(exported.decks).toHaveLength(1)
    expect(exported.decks[0].name).toBe('Test Deck')
    expect(exported.cards).toHaveLength(1)
    expect(exported.cards[0].frontText).toBe('hello')
    expect(exported.cards[0].tags).toEqual(['greeting'])
    expect(exported.reviewHistory).toHaveLength(1)
    expect(exported.practiceSentences).toHaveLength(0)
    expect(exported.sideDeckCards).toHaveLength(0)
  })
})

describe('Import validation', () => {
  it('rejects non-object', () => {
    expect(validateImport('not an object')).toBe(false)
    expect(validateImport(null)).toBe(false)
    expect(validateImport(42)).toBe(false)
  })

  it('rejects missing required fields', () => {
    expect(validateImport({})).toBe(false)
    expect(validateImport({ version: 1 })).toBe(false)
    expect(
      validateImport({
        version: 1,
        exportedAt: '2024-01-01',
        settings: {},
        decks: [],
        cards: [],
        reviewHistory: [],
      })
    ).toBe(false) // Missing practiceSentences and sideDeckCards
  })

  it('rejects deck with missing id', () => {
    expect(
      validateImport({
        version: 1,
        exportedAt: '2024-01-01',
        settings: { id: 'settings', llmProvider: 'anthropic' },
        decks: [{ name: 'no id' }], // Missing id
        cards: [],
        reviewHistory: [],
        practiceSentences: [],
        sideDeckCards: [],
      })
    ).toBe(false)
  })

  it('rejects card with missing required fields', () => {
    expect(
      validateImport({
        version: 1,
        exportedAt: '2024-01-01',
        settings: { id: 'settings', llmProvider: 'anthropic' },
        decks: [],
        cards: [{ id: 'c1' }], // Missing deckId, frontText, backText
        reviewHistory: [],
        practiceSentences: [],
        sideDeckCards: [],
      })
    ).toBe(false)
  })

  it('accepts valid import data', () => {
    expect(
      validateImport({
        version: 1,
        exportedAt: '2024-01-01',
        settings: { id: 'settings', llmProvider: 'anthropic' },
        decks: [{ id: 'd1', name: 'Deck' }],
        cards: [{ id: 'c1', deckId: 'd1', frontText: 'hi', backText: 'hola' }],
        reviewHistory: [],
        practiceSentences: [],
        sideDeckCards: [],
      })
    ).toBe(true)
  })
})

describe('Import', () => {
  it('throws on malformed data', async () => {
    await expect(importAppState('not valid')).rejects.toThrow('Invalid import data')
    await expect(importAppState(null)).rejects.toThrow('Invalid import data')
    await expect(importAppState({})).rejects.toThrow('Invalid import data')
  })

  it('does not crash on partially valid data', async () => {
    await expect(
      importAppState({
        version: 1,
        exportedAt: '2024-01-01',
        settings: { id: 'settings', llmProvider: 'anthropic' },
        decks: 'not an array',
        cards: [],
        reviewHistory: [],
        practiceSentences: [],
        sideDeckCards: [],
      })
    ).rejects.toThrow('Invalid import data')
  })
})

describe('Round-trip', () => {
  it('export then import restores identical state', async () => {
    // Create some data
    await getSettings()
    const deck = await createDeck('Round Trip Deck')
    const card1 = await createCard({
      deckId: deck.id,
      frontText: 'cat',
      backText: 'gato',
      direction: 'source-to-target',
      tags: ['animal'],
    })
    const card2 = await createCard({
      deckId: deck.id,
      frontText: 'dog',
      backText: 'perro',
      direction: 'target-to-source',
    })
    await reviewCard(card1.id, 4)

    // Export
    const exported = await exportAppState()

    // Clear all data
    await db.settings.clear()
    await db.decks.clear()
    await db.cards.clear()
    await db.reviewHistory.clear()
    await db.practiceSentences.clear()
    await db.sideDeckCards.clear()

    // Verify cleared
    expect(await db.decks.count()).toBe(0)
    expect(await db.cards.count()).toBe(0)

    // Import
    await importAppState(exported)

    // Verify restored
    const restoredDecks = await db.decks.toArray()
    expect(restoredDecks).toHaveLength(1)
    expect(restoredDecks[0].name).toBe('Round Trip Deck')

    const restoredCards = await db.cards.toArray()
    expect(restoredCards).toHaveLength(2)

    const restoredCard1 = restoredCards.find((c) => c.frontText === 'cat')!
    expect(restoredCard1.tags).toEqual(['animal'])
    expect(restoredCard1.fsrs.state).not.toBe('new') // Was reviewed

    const restoredCard2 = restoredCards.find((c) => c.frontText === 'dog')!
    expect(restoredCard2.direction).toBe('target-to-source')
    expect(restoredCard2.fsrs.state).toBe('new') // Was not reviewed

    const history = await db.reviewHistory.toArray()
    expect(history).toHaveLength(1)
    expect(history[0].grade).toBe(4)
  })
})

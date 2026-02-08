import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/db'
import { createDeck, getDeck, getAllDecks, updateDeck, deleteDeck } from '../../src/services/deck'
import { createCard } from '../../src/services/card'

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.reviewHistory.clear()
  await db.practiceSentences.clear()
})

describe('Deck CRUD', () => {
  it('creates a deck with default settings', async () => {
    const deck = await createDeck('Test Deck')
    expect(deck.name).toBe('Test Deck')
    expect(deck.targetLanguage).toBe('spanish')
    expect(deck.id).toBeTruthy()
    expect(deck.newCardBatchSize).toBe(5)
    expect(deck.constructChecklist.present).toBe(true)
    expect(deck.constructChecklist.preterite).toBe(false)
  })

  it('reads a deck by id', async () => {
    const created = await createDeck('My Deck')
    const fetched = await getDeck(created.id)
    expect(fetched).toEqual(created)
  })

  it('lists all decks', async () => {
    await createDeck('Deck A')
    await createDeck('Deck B')
    const all = await getAllDecks()
    expect(all).toHaveLength(2)
  })

  it('updates a deck', async () => {
    const deck = await createDeck('Old Name')
    const updated = await updateDeck(deck.id, { name: 'New Name' })
    expect(updated.name).toBe('New Name')
    expect(updated.id).toBe(deck.id)
  })

  it('throws when updating non-existent deck', async () => {
    await expect(updateDeck('nonexistent', { name: 'test' })).rejects.toThrow('Deck not found')
  })

  it('deletes a deck and its cards', async () => {
    const deck = await createDeck('To Delete')
    await createCard({
      deckId: deck.id,
      frontText: 'hello',
      backText: 'hola',
      direction: 'source-to-target',
    })

    await deleteDeck(deck.id)

    const fetched = await getDeck(deck.id)
    expect(fetched).toBeUndefined()

    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    expect(cards).toHaveLength(0)
  })
})

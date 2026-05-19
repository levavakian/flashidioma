import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/db'
import { createDeck, getDeck, getAllDecks, updateDeck, deleteDeck, repairDeckSchema } from '../../src/services/deck'
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

  it('repairs older decks with missing schema fields', async () => {
    const legacyDeck = {
      id: 'legacy-deck',
      name: 'Legacy',
      targetLanguage: 'spanish',
      createdAt: new Date().toISOString(),
      constructChecklist: undefined,
    }
    await db.decks.put(legacyDeck as never)

    const result = await repairDeckSchema('legacy-deck')

    expect(result.changed).toBe(true)
    expect(result.changes).toContain('newCardsPerDay')
    expect(result.changes).toContain('currentBatchCardIds')
    expect(result.deck.newCardsPerDay).toBe(20)
    expect(result.deck.currentBatchCardIds).toEqual([])
    expect(result.deck.dayStartHour).toBe(9)
    expect(result.deck.constructChecklist.present).toBe(true)
  })

  it('resets and recomputes active daily sets from older queue bugs', async () => {
    const deck = await createDeck('Polluted')
    await updateDeck(deck.id, { newCardsPerDay: 2 })
    const cards = []
    for (let i = 0; i < 5; i++) {
      cards.push(await createCard({
        deckId: deck.id,
        frontText: `polluted ${i}`,
        backText: `contaminado ${i}`,
        direction: 'source-to-target',
        sortOrder: i,
      }))
    }
    await db.decks.update(deck.id, {
      currentBatchCardIds: cards.slice(3).map((card) => card.id),
      newCardsIntroducedToday: 5,
    })

    const result = await repairDeckSchema(deck.id)

    expect(result.changed).toBe(true)
    expect(result.changes).toContain('currentBatchCardIds')
    expect(result.changes).toContain('newCardsIntroducedToday')
    expect(result.changes).toContain('lastNewCardDate')
    expect(result.deck.currentBatchCardIds).toEqual([cards[0].id, cards[1].id])
    expect(result.deck.newCardsIntroducedToday).toBe(2)
  })

  it('reports no changes when deck schema is already current', async () => {
    const deck = await createDeck('Current')

    const result = await repairDeckSchema(deck.id)

    expect(result.changed).toBe(false)
    expect(result.changes).toEqual([])
  })
})

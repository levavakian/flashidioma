import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/db'
import { createDeck } from '../../src/services/deck'
import {
  createCard,
  createCardBothDirections,
  getCard,
  getCardsByDeck,
  updateCard,
  deleteCard,
  searchCards,
} from '../../src/services/card'

let deckId: string

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.reviewHistory.clear()

  const deck = await createDeck('Test Deck')
  deckId = deck.id
})

describe('Card CRUD', () => {
  it('creates a card with default FSRS state', async () => {
    const card = await createCard({
      deckId,
      frontText: 'hello',
      backText: 'hola',
      direction: 'source-to-target',
    })

    expect(card.id).toBeTruthy()
    expect(card.frontText).toBe('hello')
    expect(card.backText).toBe('hola')
    expect(card.direction).toBe('source-to-target')
    expect(card.fsrs.state).toBe('new')
    expect(card.tags).toEqual([])
    expect(card.source).toBe('manual')
  })

  it('creates two independent cards for both directions', async () => {
    const [card1, card2] = await createCardBothDirections({
      deckId,
      frontText: 'hello',
      backText: 'hola',
    })

    expect(card1.direction).toBe('source-to-target')
    expect(card2.direction).toBe('target-to-source')
    expect(card1.id).not.toBe(card2.id)
    // Both should be new with identical state (except dueDate may differ by ms)
    expect(card1.fsrs.state).toBe(card2.fsrs.state)
    expect(card1.fsrs.stability).toBe(card2.fsrs.stability)
    expect(card1.fsrs.difficulty).toBe(card2.fsrs.difficulty)
  })

  it('reads a card by id', async () => {
    const created = await createCard({
      deckId,
      frontText: 'cat',
      backText: 'gato',
      direction: 'source-to-target',
    })
    const fetched = await getCard(created.id)
    expect(fetched).toEqual(created)
  })

  it('lists cards by deck', async () => {
    await createCard({ deckId, frontText: 'a', backText: 'b', direction: 'source-to-target' })
    await createCard({ deckId, frontText: 'c', backText: 'd', direction: 'source-to-target' })

    const cards = await getCardsByDeck(deckId)
    expect(cards).toHaveLength(2)
  })

  it('updates a card', async () => {
    const card = await createCard({
      deckId,
      frontText: 'old',
      backText: 'viejo',
      direction: 'source-to-target',
    })

    const updated = await updateCard(card.id, {
      frontText: 'new',
      tags: ['adjective'],
    })

    expect(updated.frontText).toBe('new')
    expect(updated.tags).toEqual(['adjective'])
    expect(updated.backText).toBe('viejo') // Unchanged
  })

  it('throws when updating non-existent card', async () => {
    await expect(updateCard('nonexistent', { frontText: 'test' })).rejects.toThrow('Card not found')
  })

  it('deletes a card', async () => {
    const card = await createCard({
      deckId,
      frontText: 'delete me',
      backText: 'borrar',
      direction: 'source-to-target',
    })

    await deleteCard(card.id)
    const fetched = await getCard(card.id)
    expect(fetched).toBeUndefined()
  })
})

describe('Card search', () => {
  it('searches by content', async () => {
    await createCard({ deckId, frontText: 'hello world', backText: 'hola mundo', direction: 'source-to-target' })
    await createCard({ deckId, frontText: 'goodbye', backText: 'adiós', direction: 'source-to-target' })

    const results = await searchCards(deckId, 'hello')
    expect(results).toHaveLength(1)
    expect(results[0].frontText).toBe('hello world')
  })

  it('searches back text', async () => {
    await createCard({ deckId, frontText: 'hello', backText: 'hola', direction: 'source-to-target' })
    const results = await searchCards(deckId, 'hola')
    expect(results).toHaveLength(1)
  })

  it('filters by tags', async () => {
    await createCard({ deckId, frontText: 'run', backText: 'correr', direction: 'source-to-target', tags: ['verb'] })
    await createCard({ deckId, frontText: 'red', backText: 'rojo', direction: 'source-to-target', tags: ['adjective'] })

    const results = await searchCards(deckId, '', ['verb'])
    expect(results).toHaveLength(1)
    expect(results[0].frontText).toBe('run')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/db'
import { removeAccents, checkDuplicate } from '../../src/services/deduplication'
import { createCard } from '../../src/services/card'
import { createDeck } from '../../src/services/deck'

describe('removeAccents', () => {
  it('removes accents from Spanish characters', () => {
    expect(removeAccents('está')).toBe('esta')
    expect(removeAccents('café')).toBe('cafe')
    expect(removeAccents('ñoño')).toBe('nono')
    expect(removeAccents('fácil')).toBe('facil')
    expect(removeAccents('león')).toBe('leon')
  })

  it('handles text without accents', () => {
    expect(removeAccents('hello')).toBe('hello')
    expect(removeAccents('perro')).toBe('perro')
  })

  it('is case-insensitive', () => {
    expect(removeAccents('ESTÁ')).toBe('esta')
    expect(removeAccents('Café')).toBe('cafe')
  })
})

describe('checkDuplicate', () => {
  let deckId: string

  beforeEach(async () => {
    await db.decks.clear()
    await db.cards.clear()
    await db.reviewHistory.clear()

    const deck = await createDeck('Test')
    deckId = deck.id
  })

  it('detects duplicate target text (accent-insensitive)', async () => {
    await createCard({
      deckId,
      frontText: 'is',
      backText: 'está',
      direction: 'source-to-target',
    })

    const dups = await checkDuplicate(deckId, 'esta')
    expect(dups).toHaveLength(1)
  })

  it('does not trigger for same English with different Spanish', async () => {
    await createCard({
      deckId,
      frontText: 'bank',
      backText: 'banco',
      direction: 'source-to-target',
    })

    // Same English word but different Spanish translation
    const dups = await checkDuplicate(deckId, 'orilla')
    expect(dups).toHaveLength(0)
  })

  it('checks frontText for target-to-source cards', async () => {
    await createCard({
      deckId,
      frontText: 'gato',
      backText: 'cat',
      direction: 'target-to-source',
    })

    // The target text in a target-to-source card is frontText
    const dups = await checkDuplicate(deckId, 'gato')
    expect(dups).toHaveLength(1)
  })

  it('returns empty for no duplicates', async () => {
    await createCard({
      deckId,
      frontText: 'hello',
      backText: 'hola',
      direction: 'source-to-target',
    })

    const dups = await checkDuplicate(deckId, 'adiós')
    expect(dups).toHaveLength(0)
  })
})

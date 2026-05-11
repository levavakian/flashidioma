import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/db'
import { createDeck } from '../../src/services/deck'
import {
  getImportableDecks,
  getPrebuiltDeckCards,
  importPrebuiltDeck,
} from '../../src/services/importDeck'

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.sideDeckCards.clear()
})

describe('irregular lesson import decks', () => {
  it('exposes one importable deck for each conjugation lesson with irregulars', async () => {
    const decks = await getImportableDecks()
    const deckIds = decks.map((deck) => deck.id)

    expect(deckIds).toContain('spanish-frequency')
    expect(deckIds).toContain('spanish-irregular-infinitives-present')
    expect(deckIds).toContain('spanish-irregular-infinitives-preterite')
    expect(deckIds).toContain('spanish-irregular-infinitives-imperfect')
    expect(deckIds).not.toContain('spanish-irregular-infinitives-poder-present')
    expect(deckIds).not.toContain('spanish-irregular-infinitives-deber-present')

    expect(decks.find((deck) => deck.id === 'spanish-irregular-infinitives-present')).toMatchObject({
      name: 'Spanish Irregular Infinitives: Present',
      language: 'spanish',
    })
    expect(decks.find((deck) => deck.id === 'spanish-irregular-infinitives-preterite')).toMatchObject({
      name: 'Spanish Irregular Infinitives: Preterite (Indefinido)',
      language: 'spanish',
    })
  })

  it('builds unique verb cards from a lesson irregular list', async () => {
    const cards = await getPrebuiltDeckCards('spanish-irregular-infinitives-preterite')
    const words = cards.map((card) => card.word)

    expect(cards.length).toBe(new Set(words).size)
    expect(words).toEqual(expect.arrayContaining(['tener', 'ser', 'ir', 'dar', 'leer']))
    expect(cards.every((card) => card.pos === 'v')).toBe(true)
    expect(cards.find((card) => card.word === 'tener')?.translation).toMatch(/have/)
  })

  it('imports irregular lesson infinitives with conjugation data and skips duplicates', async () => {
    const deck = await createDeck('Irregulars')

    const firstImport = await importPrebuiltDeck(
      'spanish-irregular-infinitives-imperfect',
      deck.id
    )
    expect(firstImport).toEqual({ imported: 3, skipped: 0 })

    const importedCards = await db.cards.where('deckId').equals(deck.id).toArray()
    expect(importedCards).toHaveLength(6)
    expect(importedCards.map((card) => card.backText)).toEqual(
      expect.arrayContaining(['ser', 'ir', 'ver'])
    )
    expect(importedCards.every((card) => card.verbData?.language === 'spanish')).toBe(true)

    const secondImport = await importPrebuiltDeck(
      'spanish-irregular-infinitives-imperfect',
      deck.id
    )
    expect(secondImport).toEqual({ imported: 0, skipped: 3 })
    expect(await db.cards.where('deckId').equals(deck.id).count()).toBe(6)
  })
})

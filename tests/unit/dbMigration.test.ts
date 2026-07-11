import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import type { Card } from '../../src/types'

const NESTED_LABEL =
  'you commented [to comment (tú preterite)] [to you commented [to comment (tú preterite)] (ellos/ellas/ustedes present subjunctive)]'

function makeCard(id: string, frontText: string, source: Card['source']): Card {
  return {
    id,
    deckId: 'deck-1',
    frontText,
    backText: 'comenten',
    direction: 'source-to-target',
    tags: [],
    notes: '',
    fsrs: {
      stability: 0,
      difficulty: 0,
      dueDate: new Date().toISOString(),
      lastReview: null,
      reviewCount: 0,
      lapses: 0,
      state: 'new',
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      learningSteps: 0,
    },
    createdAt: new Date().toISOString(),
    source,
  }
}

describe('db v4 upgrade', () => {
  it('repairs nested auto-conjugation labels from a v3 database', async () => {
    // Seed a database at schema v3, as left behind by older app versions
    const seed = new Dexie('flashidioma')
    seed.version(3).stores({
      cards: 'id, deckId, *tags, [deckId+fsrs.state]',
      decks: 'id',
      settings: 'id',
      practiceSentences: 'id, deckId',
      sideDeckCards: 'id',
      reviewHistory: 'id, cardId, deckId, reviewedAt',
      conjugationAutoAdds: 'id, deckId, [deckId+verbInfinitive], [deckId+addedDate]',
      translationHistory: 'id, createdAt, deckId',
    })
    await seed.table('cards').bulkPut([
      makeCard('nested', NESTED_LABEL, 'auto-conjugation'),
      makeCard('normal', 'they comment [to comment (ellos/ellas/ustedes present subjunctive)]', 'auto-conjugation'),
      makeCard('manual', NESTED_LABEL, 'manual'),
    ])
    seed.close()

    // Importing the app db opens it at v4, which runs the upgrade
    const { db, dbReady } = await import('../../src/db')
    expect(await dbReady).toBe(true)

    const nested = await db.cards.get('nested')
    expect(nested!.frontText).toBe('to comment [to comment (ellos/ellas/ustedes present subjunctive)]')

    const normal = await db.cards.get('normal')
    expect(normal!.frontText).toBe('they comment [to comment (ellos/ellas/ustedes present subjunctive)]')

    // Non-auto-conjugation cards are never rewritten
    const manual = await db.cards.get('manual')
    expect(manual!.frontText).toBe(NESTED_LABEL)
  })
})

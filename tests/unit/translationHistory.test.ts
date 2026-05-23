import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db'
import {
  addTranslationHistoryEntry,
  getTranslationHistoryEntries,
  MAX_TRANSLATION_HISTORY_ENTRIES,
} from '../../src/services/translationHistory'

beforeEach(async () => {
  await db.translationHistory.clear()
})

describe('translation history', () => {
  it('keeps only the 100 newest entries in newest-first order', async () => {
    const oldEntries = Array.from({ length: MAX_TRANSLATION_HISTORY_ENTRIES }, (_, i) => ({
      id: `history-${i}`,
      deckId: 'deck-1',
      deckName: 'Spanish Vocab',
      frontText: `front-${i}`,
      backText: `back-${i}`,
      direction: 'source-to-target' as const,
      cardIds: [`card-${i}`],
      createdAt: new Date(Date.UTC(2024, 0, 1, 0, 0, i)).toISOString(),
    }))
    await db.translationHistory.bulkPut(oldEntries)

    await addTranslationHistoryEntry({
      deckId: 'deck-1',
      deckName: 'Spanish Vocab',
      frontText: 'new-front',
      backText: 'new-back',
      direction: 'source-to-target',
      cardIds: ['new-card'],
    })

    expect(await db.translationHistory.count()).toBe(MAX_TRANSLATION_HISTORY_ENTRIES)

    const entries = await getTranslationHistoryEntries()
    expect(entries).toHaveLength(MAX_TRANSLATION_HISTORY_ENTRIES)
    expect(entries[0].frontText).toBe('new-front')
    expect(entries.at(-1)?.frontText).toBe('front-1')
    expect(entries.some((entry) => entry.frontText === 'front-0')).toBe(false)
  })
})

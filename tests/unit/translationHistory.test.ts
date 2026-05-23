import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../src/db'
import {
  addTranslationHistoryEntry,
  getTranslationHistoryEntries,
  MAX_TRANSLATION_HISTORY_ENTRIES,
} from '../../src/services/translationHistory'

beforeEach(async () => {
  await db.translationHistory.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('translation history', () => {
  it('keeps only the 100 newest entries in newest-first order', async () => {
    vi.useFakeTimers()

    for (let i = 0; i <= MAX_TRANSLATION_HISTORY_ENTRIES; i += 1) {
      vi.setSystemTime(new Date(Date.UTC(2024, 0, 1, 0, 0, i)))
      await addTranslationHistoryEntry({
        deckId: 'deck-1',
        deckName: 'Spanish Vocab',
        frontText: `front-${i}`,
        backText: `back-${i}`,
        direction: 'source-to-target',
        cardIds: [`card-${i}`],
      })
    }

    expect(await db.translationHistory.count()).toBe(MAX_TRANSLATION_HISTORY_ENTRIES)

    const entries = await getTranslationHistoryEntries()
    expect(entries).toHaveLength(MAX_TRANSLATION_HISTORY_ENTRIES)
    expect(entries[0].frontText).toBe('front-100')
    expect(entries.at(-1)?.frontText).toBe('front-1')
    expect(entries.some((entry) => entry.frontText === 'front-0')).toBe(false)
  })
})

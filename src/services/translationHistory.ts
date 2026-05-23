import { db } from '../db'
import type { TranslationHistoryDirection, TranslationHistoryEntry } from '../types'

export const MAX_TRANSLATION_HISTORY_ENTRIES = 100

interface AddTranslationHistoryInput {
  deckId: string
  deckName: string
  frontText: string
  backText: string
  direction: TranslationHistoryDirection
  cardIds: string[]
}

export async function addTranslationHistoryEntry(
  input: AddTranslationHistoryInput
): Promise<TranslationHistoryEntry> {
  const entry: TranslationHistoryEntry = {
    id: crypto.randomUUID(),
    deckId: input.deckId,
    deckName: input.deckName,
    frontText: input.frontText,
    backText: input.backText,
    direction: input.direction,
    cardIds: input.cardIds,
    createdAt: new Date().toISOString(),
  }

  await db.transaction('rw', db.translationHistory, async () => {
    await db.translationHistory.put(entry)

    const entries = await db.translationHistory.orderBy('createdAt').reverse().toArray()
    const staleEntries = entries.slice(MAX_TRANSLATION_HISTORY_ENTRIES)
    if (staleEntries.length > 0) {
      await db.translationHistory.bulkDelete(staleEntries.map((staleEntry) => staleEntry.id))
    }
  })

  return entry
}

export async function getTranslationHistoryEntries(): Promise<TranslationHistoryEntry[]> {
  return db.translationHistory
    .orderBy('createdAt')
    .reverse()
    .limit(MAX_TRANSLATION_HISTORY_ENTRIES)
    .toArray()
}

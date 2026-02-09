import { db, getSettings } from '../db'
import type { AppExport, Settings, Deck, Card, ReviewHistory, PracticeSentence, SideDeckCard, ConjugationAutoAdd } from '../types'

const EXPORT_VERSION = 1

export async function exportAppState(): Promise<AppExport> {
  const [settings, decks, cards, reviewHistory, practiceSentences, sideDeckCards, conjugationAutoAdds] =
    await Promise.all([
      getSettings(),
      db.decks.toArray(),
      db.cards.toArray(),
      db.reviewHistory.toArray(),
      db.practiceSentences.toArray(),
      db.sideDeckCards.toArray(),
      db.conjugationAutoAdds.toArray(),
    ])

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    decks,
    cards,
    reviewHistory,
    practiceSentences,
    sideDeckCards,
    conjugationAutoAdds,
  }
}

export function validateImport(data: unknown): data is AppExport {
  if (typeof data !== 'object' || data === null) return false

  const obj = data as Record<string, unknown>

  if (typeof obj.version !== 'number') return false
  if (typeof obj.exportedAt !== 'string') return false
  if (!obj.settings || typeof obj.settings !== 'object') return false
  if (!Array.isArray(obj.decks)) return false
  if (!Array.isArray(obj.cards)) return false
  if (!Array.isArray(obj.reviewHistory)) return false
  if (!Array.isArray(obj.practiceSentences)) return false
  if (!Array.isArray(obj.sideDeckCards)) return false

  // Validate settings has required fields
  const settings = obj.settings as Record<string, unknown>
  if (typeof settings.id !== 'string') return false
  if (typeof settings.llmProvider !== 'string') return false

  // Validate each deck has required fields
  for (const deck of obj.decks) {
    if (typeof deck !== 'object' || deck === null) return false
    const d = deck as Record<string, unknown>
    if (typeof d.id !== 'string') return false
    if (typeof d.name !== 'string') return false
  }

  // Validate each card has required fields
  for (const card of obj.cards) {
    if (typeof card !== 'object' || card === null) return false
    const c = card as Record<string, unknown>
    if (typeof c.id !== 'string') return false
    if (typeof c.deckId !== 'string') return false
    if (typeof c.frontText !== 'string') return false
    if (typeof c.backText !== 'string') return false
  }

  return true
}

export async function importAppState(data: unknown): Promise<void> {
  if (!validateImport(data)) {
    throw new Error('Invalid import data: missing or malformed required fields')
  }

  await db.transaction(
    'rw',
    [db.settings, db.decks, db.cards, db.reviewHistory, db.practiceSentences, db.sideDeckCards, db.conjugationAutoAdds],
    async () => {
      // Clear all existing data
      await Promise.all([
        db.settings.clear(),
        db.decks.clear(),
        db.cards.clear(),
        db.reviewHistory.clear(),
        db.practiceSentences.clear(),
        db.sideDeckCards.clear(),
        db.conjugationAutoAdds.clear(),
      ])

      // Import all data
      await db.settings.put(data.settings as Settings)
      if (data.decks.length > 0)
        await db.decks.bulkPut(data.decks as Deck[])
      if (data.cards.length > 0)
        await db.cards.bulkPut(data.cards as Card[])
      if (data.reviewHistory.length > 0)
        await db.reviewHistory.bulkPut(data.reviewHistory as ReviewHistory[])
      if (data.practiceSentences.length > 0)
        await db.practiceSentences.bulkPut(data.practiceSentences as PracticeSentence[])
      if (data.sideDeckCards.length > 0)
        await db.sideDeckCards.bulkPut(data.sideDeckCards as SideDeckCard[])
      if (data.conjugationAutoAdds && data.conjugationAutoAdds.length > 0)
        await db.conjugationAutoAdds.bulkPut(data.conjugationAutoAdds as ConjugationAutoAdd[])
    }
  )
}

export function downloadJson(data: AppExport, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

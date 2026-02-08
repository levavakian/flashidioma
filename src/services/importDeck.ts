import { db } from '../db'
import { createCard } from './card'
import { checkDuplicate } from './deduplication'
import type { ImportableDeck } from '../types'

interface ProcessedCard {
  word: string
  pos: string
  frequency: number
  translation: string
  forms: string[]
}

interface ProcessedDeck {
  id: string
  name: string
  description: string
  language: string
  generatedAt: string
  cards: ProcessedCard[]
}

let cachedDeckData: ProcessedDeck | null = null

async function loadDeckData(): Promise<ProcessedDeck> {
  if (cachedDeckData) return cachedDeckData
  const module = await import('../data/spanish-deck.json')
  cachedDeckData = module.default as ProcessedDeck
  return cachedDeckData
}

export async function getImportableDecks(): Promise<ImportableDeck[]> {
  const data = await loadDeckData()
  return [
    {
      id: data.id,
      name: data.name,
      description: data.description,
      language: data.language,
      cardCount: data.cards.length,
    },
  ]
}

export async function importPrebuiltDeck(
  importableDeckId: string,
  targetDeckId: string,
  limit?: number
): Promise<{ imported: number; skipped: number }> {
  const data = await loadDeckData()
  if (data.id !== importableDeckId) {
    throw new Error(`Unknown importable deck: ${importableDeckId}`)
  }

  const deck = await db.decks.get(targetDeckId)
  if (!deck) throw new Error(`Target deck not found: ${targetDeckId}`)

  const cardsToImport = limit ? data.cards.slice(0, limit) : data.cards
  let imported = 0
  let skipped = 0

  for (const card of cardsToImport) {
    // Check for duplicates
    const dups = await checkDuplicate(targetDeckId, card.word)
    if (dups.length > 0) {
      skipped++
      continue
    }

    await createCard({
      deckId: targetDeckId,
      frontText: card.translation,
      backText: card.word,
      direction: 'source-to-target',
      tags: [card.pos],
      source: 'imported',
    })
    imported++
  }

  return { imported, skipped }
}

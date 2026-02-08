import { db } from '../db'
import type { Card } from '../types'

/**
 * Normalize text by removing accents/diacritics for comparison.
 * "está" → "esta", "café" → "cafe", "ñoño" → "nono"
 */
export function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Check if a target language text already exists in the deck.
 * Comparison is accent-insensitive.
 * Deduplication checks the target language text across all existing cards.
 * Returns matching cards if duplicates are found.
 */
export async function checkDuplicate(
  deckId: string,
  targetText: string
): Promise<Card[]> {
  const normalizedTarget = removeAccents(targetText)
  const cards = await db.cards.where('deckId').equals(deckId).toArray()

  return cards.filter((card) => {
    // The "target language text" depends on the card direction:
    // source-to-target: backText is the target language
    // target-to-source: frontText is the target language
    const existingTargetText =
      card.direction === 'source-to-target' ? card.backText : card.frontText

    return removeAccents(existingTargetText) === normalizedTarget
  })
}

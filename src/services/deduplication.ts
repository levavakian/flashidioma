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
 * New cards are stored canonically with the deck target text in backText.
 * Keep a legacy fallback for older reversed translate cards that stored
 * the target text in frontText on target-to-source cards.
 * Returns matching cards if duplicates are found.
 */
export async function checkDuplicate(
  deckId: string,
  targetText: string
): Promise<Card[]> {
  const normalizedTarget = removeAccents(targetText)
  const cards = await db.cards.where('deckId').equals(deckId).toArray()

  return cards.filter((card) => {
    const candidateTargets = [card.backText]
    if (card.direction === 'target-to-source') {
      candidateTargets.push(card.frontText)
    }

    return candidateTargets.some((candidate) => removeAccents(candidate) === normalizedTarget)
  })
}

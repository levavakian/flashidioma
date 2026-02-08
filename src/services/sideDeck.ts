import { db } from '../db'
import type { SideDeckCard } from '../types'

export async function addToSideDeck(
  text: string,
  targetLanguage: string,
  targetDeckId: string | null = null
): Promise<SideDeckCard> {
  const card: SideDeckCard = {
    id: crypto.randomUUID(),
    text,
    targetLanguage,
    targetDeckId,
    createdAt: new Date().toISOString(),
  }
  await db.sideDeckCards.put(card)
  return card
}

export async function getSideDeckCards(): Promise<SideDeckCard[]> {
  return db.sideDeckCards.toArray()
}

export async function removeSideDeckCard(id: string): Promise<void> {
  await db.sideDeckCards.delete(id)
}

export async function clearSideDeck(): Promise<void> {
  await db.sideDeckCards.clear()
}

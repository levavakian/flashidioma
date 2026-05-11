import { db } from '../db'
import { createCard } from './card'
import { checkDuplicate } from './deduplication'
import { lookupConjugation } from './conjugationLookup'
import { getSpanishLessons } from './verbLessons'
import type { LessonData } from '../types'
import type { ImportableDeck } from '../types'

export type { ProcessedCard }

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
let cachedFrequencyCardsByWord: Map<string, ProcessedCard> | null = null

const IRREGULAR_LESSON_DECK_PREFIX = 'spanish-irregular-infinitives-'

async function loadDeckData(): Promise<ProcessedDeck> {
  if (cachedDeckData) return cachedDeckData
  const module = await import('../data/spanish-deck.json')
  cachedDeckData = module.default as ProcessedDeck
  return cachedDeckData
}

function normalizeForLookup(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function uniqueLessonInfinitives(lesson: LessonData): string[] {
  const seen = new Set<string>()
  const infinitives: string[] = []

  for (const category of lesson.irregularCategories) {
    for (const verb of category.verbs) {
      const key = normalizeForLookup(verb.infinitive)
      if (seen.has(key)) continue
      seen.add(key)
      infinitives.push(verb.infinitive)
    }
  }

  return infinitives
}

function lessonDeckId(lesson: LessonData): string {
  return `${IRREGULAR_LESSON_DECK_PREFIX}${lesson.tenseId}`
}

function displayLessonName(lesson: LessonData): string {
  if (lesson.tenseId === 'preterite') return 'Preterite (Indefinido)'
  return lesson.tenseName
}

function lessonFromDeckId(importableDeckId: string): LessonData | null {
  if (!importableDeckId.startsWith(IRREGULAR_LESSON_DECK_PREFIX)) return null
  const tenseId = importableDeckId.slice(IRREGULAR_LESSON_DECK_PREFIX.length)
  return getSpanishLessons().find((lesson) => lesson.tenseId === tenseId) ?? null
}

function getFrequencyCardsByWord(data: ProcessedDeck): Map<string, ProcessedCard> {
  if (cachedFrequencyCardsByWord) return cachedFrequencyCardsByWord

  cachedFrequencyCardsByWord = new Map()
  for (const card of data.cards) {
    const key = normalizeForLookup(card.word)
    const existing = cachedFrequencyCardsByWord.get(key)
    if (!existing || (existing.pos !== 'v' && card.pos === 'v')) {
      cachedFrequencyCardsByWord.set(key, card)
    }
  }

  return cachedFrequencyCardsByWord
}

function buildLessonDeckCards(lesson: LessonData, frequencyDeck: ProcessedDeck): ProcessedCard[] {
  const frequencyCards = getFrequencyCardsByWord(frequencyDeck)

  return uniqueLessonInfinitives(lesson).map((infinitive) => {
    const frequencyCard = frequencyCards.get(normalizeForLookup(infinitive))
    if (!frequencyCard) {
      throw new Error(`Missing frequency deck entry for lesson irregular: ${infinitive}`)
    }

    return {
      ...frequencyCard,
      word: infinitive,
      pos: 'v',
      forms: frequencyCard.forms.includes(infinitive)
        ? frequencyCard.forms
        : [infinitive, ...frequencyCard.forms],
    }
  })
}

function getLessonImportableDecks(): ImportableDeck[] {
  return getSpanishLessons()
    .map((lesson) => ({
      lesson,
      cardCount: uniqueLessonInfinitives(lesson).length,
    }))
    .filter(({ cardCount }) => cardCount > 0)
    .map(({ lesson, cardCount }) => ({
      id: lessonDeckId(lesson),
      name: `Spanish Irregular Infinitives: ${displayLessonName(lesson)}`,
      description: `Unique infinitives from the ${displayLessonName(lesson).toLowerCase()} lesson's irregular verb categories.`,
      language: 'spanish',
      cardCount,
    }))
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
    ...getLessonImportableDecks(),
  ]
}

export async function getPrebuiltDeckCards(
  importableDeckId: string,
): Promise<ProcessedCard[]> {
  const data = await loadDeckData()
  if (data.id === importableDeckId) {
    return data.cards
  }

  const lesson = lessonFromDeckId(importableDeckId)
  if (lesson) return buildLessonDeckCards(lesson, data)

  throw new Error(`Unknown importable deck: ${importableDeckId}`)
}

export async function importPrebuiltDeck(
  importableDeckId: string,
  targetDeckId: string,
  limit?: number
): Promise<{ imported: number; skipped: number }> {
  const cards = await getPrebuiltDeckCards(importableDeckId)

  const deck = await db.decks.get(targetDeckId)
  if (!deck) throw new Error(`Target deck not found: ${targetDeckId}`)

  const cardsToImport = limit ? cards.slice(0, limit) : cards
  let imported = 0
  let skipped = 0

  for (let i = 0; i < cardsToImport.length; i++) {
    const card = cardsToImport[i]
    // Check for duplicates
    const dups = await checkDuplicate(targetDeckId, card.word)
    if (dups.length > 0) {
      skipped++
      continue
    }

    // For verbs, look up conjugation data from static DB
    const verbData = card.pos === 'v' ? await lookupConjugation(card.word) : null

    // Create source-to-target card (English front → Spanish back)
    await createCard({
      deckId: targetDeckId,
      frontText: card.translation,
      backText: card.word,
      direction: 'source-to-target',
      tags: [card.pos],
      source: 'imported',
      sortOrder: i * 2,
      ...(verbData ? { verbData } : {}),
    })

    // Create target-to-source card (Spanish front → English back)
    await createCard({
      deckId: targetDeckId,
      frontText: card.translation,
      backText: card.word,
      direction: 'target-to-source',
      tags: [card.pos],
      source: 'imported',
      sortOrder: i * 2 + 1,
      ...(verbData ? { verbData } : {}),
    })

    imported++
  }

  return { imported, skipped }
}

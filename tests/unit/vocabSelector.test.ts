import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/db'
import { createDeck } from '../../src/services/deck'
import { createCard } from '../../src/services/card'
import { reviewCard } from '../../src/services/review'
import { spanishLanguageModule } from '../../src/languages/spanish'
import type { Card, Deck } from '../../src/types'

// Replicate the vocab selection logic from PracticeTab for testing
function getRandomElement<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

function selectVocab(
  cards: Card[],
  deck: Deck,
  verbProb = 0.7,
  adjProb = 0.5
) {
  const reviewedCards = cards.filter((c) => c.fsrs.state !== 'new')

  const verbs = reviewedCards.filter(
    (c) => c.tags.includes('v') || c.tags.includes('verb')
  )
  const selectedVerb = Math.random() < verbProb ? getRandomElement(verbs) : null

  const adjectives = reviewedCards.filter(
    (c) => c.tags.includes('adj') || c.tags.includes('adjective')
  )
  const selectedAdj = Math.random() < adjProb ? getRandomElement(adjectives) : null

  const enabledConstructs = spanishLanguageModule.constructs.filter(
    (c) => deck.constructChecklist[c.id]
  )
  const selectedConstruct = getRandomElement(enabledConstructs)

  return { selectedVerb, selectedAdj, selectedConstruct }
}

let deck: Deck

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.reviewHistory.clear()
  await db.practiceSentences.clear()
  deck = await createDeck('Test Deck')
})

describe('Vocab selector', () => {
  it('only selects from reviewed words, not unreviewed', async () => {
    // Create a verb card and leave it as 'new' (unreviewed)
    await createCard({
      deckId: deck.id,
      frontText: 'to speak',
      backText: 'hablar',
      direction: 'source-to-target',
      tags: ['v'],
    })

    const cards = await db.cards.where('deckId').equals(deck.id).toArray()

    // With all cards unreviewed, no verb should be selected even with 100% prob
    for (let i = 0; i < 20; i++) {
      const result = selectVocab(cards, deck, 1.0, 1.0)
      expect(result.selectedVerb).toBeNull()
      expect(result.selectedAdj).toBeNull()
    }
  })

  it('selects from reviewed words', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'to speak',
      backText: 'hablar',
      direction: 'source-to-target',
      tags: ['v'],
    })

    // Review the card to move it out of 'new' state
    await reviewCard(card.id, 3)

    const cards = await db.cards.where('deckId').equals(deck.id).toArray()

    // With 100% verb probability, should always select the verb
    let selectedCount = 0
    for (let i = 0; i < 20; i++) {
      const result = selectVocab(cards, deck, 1.0, 0)
      if (result.selectedVerb) selectedCount++
    }
    expect(selectedCount).toBe(20)
  })

  it('only selects from enabled constructs', () => {
    const cards: Card[] = []

    // Only present enabled
    const deckWithPresent = {
      ...deck,
      constructChecklist: { present: true, preterite: false, imperfect: false },
    }

    for (let i = 0; i < 50; i++) {
      const result = selectVocab(cards, deckWithPresent)
      if (result.selectedConstruct) {
        expect(result.selectedConstruct.id).toBe('present')
      }
    }
  })

  it('with no reviewed words, returns null for verb and adjective', async () => {
    const cards: Card[] = []
    const result = selectVocab(cards, deck, 1.0, 1.0)
    expect(result.selectedVerb).toBeNull()
    expect(result.selectedAdj).toBeNull()
  })

  it('with only one reviewed verb and one tense enabled, always selects that combination', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'to eat',
      backText: 'comer',
      direction: 'source-to-target',
      tags: ['v'],
    })

    await reviewCard(card.id, 3)
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()

    // Only present tense enabled
    const singleTenseDeck = {
      ...deck,
      constructChecklist: { present: true, preterite: false, imperfect: false },
    }

    for (let i = 0; i < 20; i++) {
      const result = selectVocab(cards, singleTenseDeck, 1.0, 0)
      expect(result.selectedVerb).not.toBeNull()
      expect(result.selectedVerb!.backText).toBe('comer')
      if (result.selectedConstruct) {
        expect(result.selectedConstruct.id).toBe('present')
      }
    }
  })
})

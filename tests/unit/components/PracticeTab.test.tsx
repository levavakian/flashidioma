import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PracticeTab from '../../../src/components/practice/PracticeTab'
import { db } from '../../../src/db'
import type { Deck, PracticeSentence } from '../../../src/types'

let deck: Deck

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.practiceSentences.clear()

  deck = {
    id: 'test-deck',
    name: 'Spanish Vocab',
    targetLanguage: 'spanish',
    createdAt: new Date().toISOString(),
    constructChecklist: { present: true },
    newCardBatchSize: 5,
    currentBatchCardIds: [],
  }
  await db.decks.put(deck)
})

describe('PracticeTab', () => {
  it('converts a practice sentence to a flashcard', async () => {
    const user = userEvent.setup()

    // Pre-populate a practice sentence in the DB
    const sentence: PracticeSentence = {
      id: 'sentence-1',
      deckId: deck.id,
      sourceText: 'I eat apples every day.',
      targetText: 'Yo como manzanas todos los días.',
      selectedVerb: 'comer',
      selectedAdjective: null,
      selectedConstruct: 'present',
      createdAt: new Date().toISOString(),
    }
    await db.practiceSentences.put(sentence)

    render(<PracticeTab deck={deck} />)

    // Wait for the sentence to load and display
    await waitFor(() => {
      expect(screen.getByText('I eat apples every day.')).toBeInTheDocument()
    })
    expect(screen.getByText('Yo como manzanas todos los días.')).toBeInTheDocument()

    // Click "Add as Card"
    await user.click(screen.getByText('Add as Card'))

    // Wait for the confirmation message
    await waitFor(() => {
      expect(screen.getByText('Added card: "I eat apples every day."')).toBeInTheDocument()
    })

    // Verify a card was created in the database
    const cards = await db.cards.toArray()
    expect(cards).toHaveLength(1)

    const card = cards[0]
    expect(card.deckId).toBe(deck.id)
    expect(card.frontText).toBe('I eat apples every day.')
    expect(card.backText).toBe('Yo como manzanas todos los días.')
    expect(card.direction).toBe('source-to-target')
    expect(card.source).toBe('practice')
  })
})

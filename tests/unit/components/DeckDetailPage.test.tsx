import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DeckDetailPage from '../../../src/components/decks/DeckDetailPage'
import { db } from '../../../src/db'
import { createDeck, updateDeck } from '../../../src/services/deck'
import { createCard } from '../../../src/services/card'

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.reviewHistory.clear()
  await db.practiceSentences.clear()
})

function renderDeckDetail(deckId: string) {
  return render(
    <MemoryRouter initialEntries={[`/deck/${deckId}`]}>
      <Routes>
        <Route path="/deck/:deckId" element={<DeckDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('DeckDetailPage', () => {
  it('shows a review badge that matches the review-session queue', async () => {
    const deck = await createDeck('Badge Counts')
    const dayStartHour = (new Date().getHours() + 2) % 24
    const updatedDeck = await updateDeck(deck.id, { newCardsPerDay: 1, newCardBatchSize: 1, dayStartHour })

    await createCard({
      deckId: updatedDeck.id,
      frontText: 'new hidden',
      backText: 'nuevo oculto',
      direction: 'source-to-target',
      source: 'imported',
    })

    await createCard({
      deckId: updatedDeck.id,
      frontText: 'new visible',
      backText: 'nuevo visible',
      direction: 'source-to-target',
      source: 'imported',
    })

    await db.cards.put({
      id: 'upcoming-review-card',
      deckId: updatedDeck.id,
      frontText: 'later today',
      backText: 'mas tarde',
      direction: 'source-to-target',
      tags: [],
      notes: '',
      fsrs: {
        stability: 5,
        difficulty: 5,
        dueDate: new Date(Date.now() + 60 * 1000).toISOString(),
        lastReview: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        reviewCount: 1,
        lapses: 0,
        state: 'review',
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        learningSteps: 0,
      },
      createdAt: new Date().toISOString(),
      source: 'manual',
    })

    renderDeckDetail(updatedDeck.id)

    await waitFor(() => {
      expect(screen.getByText('Badge Counts')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Review\s*2/i })).toBeInTheDocument()
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DecksPage from '../../../src/components/decks/DecksPage'
import { db } from '../../../src/db'

// Mock window.confirm
vi.spyOn(window, 'confirm').mockReturnValue(true)

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.reviewHistory.clear()
  await db.practiceSentences.clear()
})

function renderDecksPage() {
  return render(
    <MemoryRouter>
      <DecksPage />
    </MemoryRouter>
  )
}

describe('DecksPage', () => {
  it('shows empty state when no decks', async () => {
    renderDecksPage()
    await waitFor(() => {
      expect(screen.getByText('No decks yet. Create one to get started.')).toBeInTheDocument()
    })
  })

  it('creates a new deck', async () => {
    const user = userEvent.setup()
    renderDecksPage()

    await user.click(screen.getByText('+ New Deck'))
    await user.type(screen.getByPlaceholderText('Deck name'), 'Spanish Vocab')
    await user.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByText('Spanish Vocab')).toBeInTheDocument()
    })
  })

  it('shows card count for decks', async () => {
    // Pre-create a deck with cards
    const deck = {
      id: 'test-deck',
      name: 'Test Deck',
      targetLanguage: 'spanish',
      createdAt: new Date().toISOString(),
      constructChecklist: { present: true },
      newCardBatchSize: 5,
      currentBatchCardIds: [],
    }
    await db.decks.put(deck)
    await db.cards.put({
      id: 'card-1',
      deckId: 'test-deck',
      frontText: 'hello',
      backText: 'hola',
      direction: 'source-to-target',
      tags: [],
      notes: '',
      fsrs: {
        stability: 0, difficulty: 0, dueDate: new Date().toISOString(),
        lastReview: null, reviewCount: 0, lapses: 0, state: 'new',
        elapsedDays: 0, scheduledDays: 0, reps: 0,
      },
      createdAt: new Date().toISOString(),
      source: 'manual',
    })

    renderDecksPage()
    await waitFor(() => {
      expect(screen.getByText('1 cards')).toBeInTheDocument()
    })
  })

  it('renames a deck', async () => {
    const user = userEvent.setup()
    await db.decks.put({
      id: 'deck-rename',
      name: 'Old Name',
      targetLanguage: 'spanish',
      createdAt: new Date().toISOString(),
      constructChecklist: {},
      newCardBatchSize: 5,
      currentBatchCardIds: [],
    })

    renderDecksPage()
    await waitFor(() => {
      expect(screen.getByText('Old Name')).toBeInTheDocument()
    })

    // Click rename button
    await user.click(screen.getByTitle('Rename'))
    const input = screen.getByDisplayValue('Old Name')
    await user.clear(input)
    await user.type(input, 'New Name')
    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByText('New Name')).toBeInTheDocument()
    })
  })

  it('deletes a deck', async () => {
    const user = userEvent.setup()
    await db.decks.put({
      id: 'deck-delete',
      name: 'Delete Me',
      targetLanguage: 'spanish',
      createdAt: new Date().toISOString(),
      constructChecklist: {},
      newCardBatchSize: 5,
      currentBatchCardIds: [],
    })

    renderDecksPage()
    await waitFor(() => {
      expect(screen.getByText('Delete Me')).toBeInTheDocument()
    })

    await user.click(screen.getByTitle('Delete'))

    await waitFor(() => {
      expect(screen.queryByText('Delete Me')).not.toBeInTheDocument()
    })
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddCardForm from '../../../src/components/cards/AddCardForm'
import { db } from '../../../src/db'
import { createCard } from '../../../src/services/card'

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()

  await db.decks.put({
    id: 'test-deck',
    name: 'Test',
    targetLanguage: 'spanish',
    createdAt: new Date().toISOString(),
    constructChecklist: {},
    newCardBatchSize: 5,
    currentBatchCardIds: [],
  })
})

describe('AddCardForm deduplication', () => {
  it('shows warning when duplicate target text exists', async () => {
    const user = userEvent.setup()
    await createCard({
      deckId: 'test-deck',
      frontText: 'hello',
      backText: 'hola',
      direction: 'source-to-target',
    })

    render(<AddCardForm deckId="test-deck" onAdded={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('e.g. hello'), 'hi')
    await user.type(screen.getByPlaceholderText('e.g. hola'), 'hola')
    await user.click(screen.getByText('Add Card'))

    await waitFor(() => {
      expect(screen.getByText('Duplicate detected!')).toBeInTheDocument()
    })
  })

  it('allows adding anyway after dismissing duplicate warning', async () => {
    const user = userEvent.setup()
    const onAdded = vi.fn()

    await createCard({
      deckId: 'test-deck',
      frontText: 'hello',
      backText: 'hola',
      direction: 'source-to-target',
    })

    render(<AddCardForm deckId="test-deck" onAdded={onAdded} />)

    await user.type(screen.getByPlaceholderText('e.g. hello'), 'greetings')
    await user.type(screen.getByPlaceholderText('e.g. hola'), 'hola')
    await user.click(screen.getByText('Add Card'))

    await waitFor(() => {
      expect(screen.getByText('Duplicate detected!')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Add Anyway'))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalled()
    })

    // Verify two cards now exist
    const cards = await db.cards.toArray()
    expect(cards).toHaveLength(2)
  })
})

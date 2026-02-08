import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddCardForm from '../../../src/components/cards/AddCardForm'
import { db } from '../../../src/db'

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

describe('AddCardForm', () => {
  it('creates a card with valid data', async () => {
    const user = userEvent.setup()
    const onAdded = vi.fn()
    render(<AddCardForm deckId="test-deck" onAdded={onAdded} />)

    await user.type(screen.getByPlaceholderText('e.g. hello'), 'cat')
    await user.type(screen.getByPlaceholderText('e.g. hola'), 'gato')
    await user.click(screen.getByText('Add Card'))

    await waitFor(() => expect(onAdded).toHaveBeenCalled())

    const cards = await db.cards.toArray()
    expect(cards).toHaveLength(1)
    expect(cards[0].frontText).toBe('cat')
    expect(cards[0].backText).toBe('gato')
  })

  it('creates two cards when both directions selected', async () => {
    const user = userEvent.setup()
    const onAdded = vi.fn()
    render(<AddCardForm deckId="test-deck" onAdded={onAdded} />)

    await user.type(screen.getByPlaceholderText('e.g. hello'), 'dog')
    await user.type(screen.getByPlaceholderText('e.g. hola'), 'perro')
    await user.selectOptions(screen.getByRole('combobox'), 'both')
    await user.click(screen.getByText('Add Card'))

    await waitFor(async () => {
      const cards = await db.cards.toArray()
      expect(cards).toHaveLength(2)
      expect(cards.map((c) => c.direction).sort()).toEqual([
        'source-to-target',
        'target-to-source',
      ])
    })
  })

  it('shows validation error for empty fields', async () => {
    const user = userEvent.setup()
    const onAdded = vi.fn()
    render(<AddCardForm deckId="test-deck" onAdded={onAdded} />)

    await user.click(screen.getByText('Add Card'))

    expect(screen.getByText('Both front and back text are required.')).toBeInTheDocument()
    expect(onAdded).not.toHaveBeenCalled()
  })
})

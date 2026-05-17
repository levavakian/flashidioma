import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeckSettings from '../../../src/components/decks/DeckSettings'
import { db } from '../../../src/db'
import { createDeck, getDeck } from '../../../src/services/deck'
import type { Deck } from '../../../src/types'

beforeEach(async () => {
  await db.decks.clear()
})

describe('DeckSettings', () => {
  it('repairs a legacy deck and reports changed fields', async () => {
    const user = userEvent.setup()
    const legacyDeck = {
      id: 'legacy-settings',
      name: 'Legacy Settings',
      targetLanguage: 'spanish',
      createdAt: new Date().toISOString(),
      constructChecklist: undefined,
    } as unknown as Deck
    await db.decks.put(legacyDeck)

    render(<DeckSettings deck={legacyDeck} onUpdate={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Update Deck Schema' }))

    await waitFor(() => {
      expect(screen.getByText(/Updated deck schema:/)).toBeInTheDocument()
    })
    expect(await getDeck(legacyDeck.id)).toMatchObject({
      newCardsPerDay: 20,
      currentBatchCardIds: [],
      dayStartHour: 9,
    })
  })

  it('reports when the deck schema is already up to date', async () => {
    const user = userEvent.setup()
    const deck = await createDeck('Current Settings')

    render(<DeckSettings deck={deck} onUpdate={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Update Deck Schema' }))

    await waitFor(() => {
      expect(screen.getByText('Deck schema is already up to date.')).toBeInTheDocument()
    })
  })
})

import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import CardList from '../../../src/components/cards/CardList'
import { db } from '../../../src/db'
import { createDeck } from '../../../src/services/deck'
import { createCard } from '../../../src/services/card'
import type { Card, Deck } from '../../../src/types'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

let deck: Deck
let verbCard: Card

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.settings.clear()
  await db.reviewHistory.clear()

  deck = await createDeck('Test Deck')

  // Create a verb card WITHOUT verbData (eligible for hydration)
  // Use an uncommon verb not in the static conjugation DB
  verbCard = await createCard({
    deckId: deck.id,
    frontText: 'to xyz-ify',
    backText: 'xyzificar',
    direction: 'source-to-target',
    tags: ['v'],
  })

  // Configure LLM settings
  await db.settings.put({
    id: 'settings',
    llmProvider: 'anthropic',
    llmApiKey: 'test-key-123',
    llmModel: 'claude-sonnet-4-20250514',
    uiPreferences: {},
  })
})

const mockConjugationResponse = JSON.stringify({
  infinitive: 'xyzificar',
  tenses: [
    {
      tenseId: 'present',
      tenseName: 'Present',
      description: 'Actions happening now',
      conjugations: [
        { person: 'yo', form: 'xyzifico', miniTranslation: 'I xyz-ify' },
        { person: 'tú', form: 'xyzificas', miniTranslation: 'you xyz-ify' },
      ],
    },
  ],
})

/** Helper: expand the first card's dropdown by clicking the card row */
async function expandFirstCard(user: ReturnType<typeof userEvent.setup>) {
  // Card rows are buttons with the chevron arrow — click the first one
  const cardButtons = screen.getAllByRole('button')
  const expandButton = cardButtons.find(b => b.textContent?.includes('xyzificar') || b.textContent?.includes('casa') || b.textContent?.includes('house'))
  if (expandButton) {
    await user.click(expandButton)
  }
}

describe('Hydrate button', () => {
  it('clicking hydrate with mock LLM response populates conjugation data on the card', async () => {
    const user = userEvent.setup()

    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: mockConjugationResponse }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
        })
      })
    )

    const onUpdate = vi.fn()
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()

    const { rerender } = render(
      <CardList cards={cards} deckId={deck.id} onUpdate={onUpdate} />
    )

    // Expand the card to reveal action buttons
    await expandFirstCard(user)

    // The "Hydrate (LLM)" button should be visible (no verbData yet)
    expect(screen.getByText('Hydrate (LLM)')).toBeInTheDocument()

    // Click the hydrate button
    await user.click(screen.getByText('Hydrate (LLM)'))

    // Wait for hydration to complete
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled()
    })

    // Verify the card now has verbData in the database
    const updatedCard = await db.cards.get(verbCard.id)
    expect(updatedCard!.verbData).toBeDefined()
    expect(updatedCard!.verbData!.infinitive).toBe('xyzificar')
    expect(updatedCard!.verbData!.tenses).toHaveLength(1)
    expect(updatedCard!.verbData!.tenses[0].tenseId).toBe('present')

    // Re-render with updated cards — hydrate button should be gone
    const updatedCards = await db.cards.where('deckId').equals(deck.id).toArray()
    rerender(
      <CardList cards={updatedCards} deckId={deck.id} onUpdate={onUpdate} />
    )

    // Expand the card again
    await expandFirstCard(user)

    // The "Hydrate (LLM)" button should no longer appear since the card now has verbData
    expect(screen.queryByText('Hydrate (LLM)')).not.toBeInTheDocument()
  })

  it('shows error when LLM call fails (e.g. network error)', async () => {
    const user = userEvent.setup()

    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json(
          { error: { message: 'Unauthorized' } },
          { status: 401 }
        )
      })
    )

    const onUpdate = vi.fn()
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()

    render(
      <CardList cards={cards} deckId={deck.id} onUpdate={onUpdate} />
    )

    // Expand the card
    await expandFirstCard(user)

    // Click the hydrate button
    await user.click(screen.getByText('Hydrate (LLM)'))

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText('Invalid API key')).toBeInTheDocument()
    })

    // The card should NOT have verbData
    const card = await db.cards.get(verbCard.id)
    expect(card!.verbData).toBeUndefined()

    // onUpdate should NOT have been called on failure
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('shows hydrate button for non-verb cards when expanded', async () => {
    const user = userEvent.setup()

    // Create a non-verb card
    await createCard({
      deckId: deck.id,
      frontText: 'house',
      backText: 'casa',
      direction: 'source-to-target',
      tags: ['n'],
    })

    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    const nonVerbCards = cards.filter((c) => !c.tags.includes('v'))

    render(
      <CardList cards={nonVerbCards} deckId={deck.id} onUpdate={vi.fn()} />
    )

    // Before expanding, hydrate button should not be visible
    expect(screen.queryByText('Hydrate (LLM)')).not.toBeInTheDocument()

    // Expand the card
    await expandFirstCard(user)

    // All cards without verbData show the Hydrate button when expanded
    expect(screen.queryByText('Hydrate (LLM)')).toBeInTheDocument()
  })

  it('shows not-a-verb message when LLM rejects hydration', async () => {
    const user = userEvent.setup()

    const notAVerbResponse = JSON.stringify({
      error: 'not_a_verb',
      message: 'The word "casa" is not a Spanish verb.',
    })

    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          id: 'msg_456',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: notAVerbResponse }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
        })
      })
    )

    const nounCard = await createCard({
      deckId: deck.id,
      frontText: 'house',
      backText: 'casa',
      direction: 'source-to-target',
      tags: ['n'],
    })

    const cards = [nounCard]

    render(
      <CardList cards={cards} deckId={deck.id} onUpdate={vi.fn()} />
    )

    // Expand the card
    await expandFirstCard(user)

    await user.click(screen.getByText('Hydrate (LLM)'))

    await waitFor(() => {
      expect(screen.getByText('"casa" is not a verb.')).toBeInTheDocument()
    })

    // Card should NOT have verbData
    const card = await db.cards.get(nounCard.id)
    expect(card!.verbData).toBeUndefined()
  })

  it('does not show hydrate button for verb cards that already have verbData', async () => {
    const user = userEvent.setup()

    // Update the verb card to have verbData
    await db.cards.update(verbCard.id, {
      verbData: {
        infinitive: 'xyzificar',
        language: 'spanish',
        tenses: [],
      },
    })

    const cards = await db.cards.where('deckId').equals(deck.id).toArray()

    render(
      <CardList cards={cards} deckId={deck.id} onUpdate={vi.fn()} />
    )

    // Expand the card
    await expandFirstCard(user)

    // Should not show "Hydrate (LLM)" button since verbData exists
    expect(screen.queryByText('Hydrate (LLM)')).not.toBeInTheDocument()
  })
})

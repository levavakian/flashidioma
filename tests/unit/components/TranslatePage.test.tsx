import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import TranslatePage from '../../../src/components/translate/TranslatePage'
import { db } from '../../../src/db'

// --- MSW server setup ---

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.sideDeckCards.clear()

  await db.decks.put({
    id: 'test-deck',
    name: 'Spanish Vocab',
    targetLanguage: 'spanish',
    createdAt: new Date().toISOString(),
    constructChecklist: {},
    newCardBatchSize: 5,
    currentBatchCardIds: [],
  })
})

function renderTranslatePage() {
  return render(
    <MemoryRouter>
      <TranslatePage />
    </MemoryRouter>
  )
}

describe('TranslatePage', () => {
  it('translates a word and shows translation with add-card buttons', async () => {
    const user = userEvent.setup()

    // Mock Google Translate response: translating "hello" (en) -> "hola" (es)
    server.use(
      http.get('https://translate.googleapis.com/translate_a/single', () => {
        return HttpResponse.json([
          [['hola', 'hello', null, null, 10]],
          null,
          'en',
        ])
      })
    )

    renderTranslatePage()

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Translate' })).toBeInTheDocument()
    })

    // Type a word into the input
    const textarea = screen.getByPlaceholderText('Enter text to translate...')
    await user.type(textarea, 'hello')

    // Click the Translate button
    await user.click(screen.getByRole('button', { name: 'Translate' }))

    // Wait for translation to appear
    await waitFor(() => {
      expect(screen.getByDisplayValue('hola')).toBeInTheDocument()
    })

    // Verify the deck selector now shows our deck
    expect(screen.getByDisplayValue('Spanish Vocab')).toBeInTheDocument()

    // Verify the three add-card buttons appear (S -> T, T -> S, Both)
    expect(screen.getByText('Both')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    const buttonTexts = buttons.map((b) => b.textContent)
    // S → T and T → S buttons contain arrow characters rendered from &rarr;
    expect(buttonTexts.some((t) => t && t.includes('S') && t.includes('T'))).toBe(true)
    expect(buttonTexts.some((t) => t && t.includes('Both'))).toBe(true)
  })

  it('clicking "Both" adds 2 cards to the deck after translating', async () => {
    const user = userEvent.setup()

    server.use(
      http.get('https://translate.googleapis.com/translate_a/single', () => {
        return HttpResponse.json([
          [['hola', 'hello', null, null, 10]],
          null,
          'en',
        ])
      })
    )

    renderTranslatePage()

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Translate' })).toBeInTheDocument()
    })

    // Type and translate
    const textarea = screen.getByPlaceholderText('Enter text to translate...')
    await user.type(textarea, 'hello')
    await user.click(screen.getByRole('button', { name: 'Translate' }))

    // Wait for translation result
    await waitFor(() => {
      expect(screen.getByDisplayValue('hola')).toBeInTheDocument()
    })

    // Click the "Both" button
    await user.click(screen.getByText('Both'))

    // Wait for the confirmation message
    await waitFor(() => {
      expect(screen.getByText('Added 2 cards (both directions)')).toBeInTheDocument()
    })

    // Verify 2 cards exist in the database
    const cards = await db.cards.toArray()
    expect(cards).toHaveLength(2)

    const directions = cards.map((c) => c.direction).sort()
    expect(directions).toEqual(['source-to-target', 'target-to-source'])

    // Both cards share the same front/back text; the direction field records the semantic direction
    const stCard = cards.find((c) => c.direction === 'source-to-target')!
    const tsCard = cards.find((c) => c.direction === 'target-to-source')!
    expect(stCard.frontText).toBe('hello')
    expect(stCard.backText).toBe('hola')
    expect(tsCard.frontText).toBe('hello')
    expect(tsCard.backText).toBe('hola')
    expect(stCard.deckId).toBe('test-deck')
    expect(tsCard.deckId).toBe('test-deck')
  })
})

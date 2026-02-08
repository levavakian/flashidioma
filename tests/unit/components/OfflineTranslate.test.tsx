import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import TranslatePage from '../../../src/components/translate/TranslatePage'
import { db } from '../../../src/db'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderPage() {
  return render(
    <MemoryRouter>
      <TranslatePage />
    </MemoryRouter>
  )
}

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

describe('Offline translate mode', () => {
  it('shows offline banner and side deck button when offline', async () => {
    // Simulate offline
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/You are offline/)).toBeInTheDocument()
    })

    // "Save to Side Deck" button should be visible
    expect(screen.getByText('Save to Side Deck')).toBeInTheDocument()

    vi.restoreAllMocks()
  })

  it('saves word to side deck when offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/You are offline/)).toBeInTheDocument()
    })

    // Enter a word
    const textarea = screen.getByPlaceholderText('Enter text to translate...')
    await user.type(textarea, 'gato')

    // Click "Save to Side Deck"
    await user.click(screen.getByText('Save to Side Deck'))

    // Should show confirmation
    await waitFor(() => {
      expect(screen.getByText(/Saved to side deck/)).toBeInTheDocument()
    })

    // Verify side deck card exists in DB
    const sideDeckCards = await db.sideDeckCards.toArray()
    expect(sideDeckCards).toHaveLength(1)
    expect(sideDeckCards[0].text).toBe('gato')

    vi.restoreAllMocks()
  })
})

describe('Side deck', () => {
  it('shows side deck cards and batch translates them when online', async () => {
    // Pre-populate a side deck card
    await db.sideDeckCards.put({
      id: 'side-1',
      text: 'perro',
      targetLanguage: 'es',
      targetDeckId: 'test-deck',
      createdAt: new Date().toISOString(),
    })

    // Mock translation API
    server.use(
      http.get('https://translate.googleapis.com/translate_a/single', () => {
        return HttpResponse.json([
          [['dog', 'perro', null, null, 10]],
          null,
          'es',
        ])
      })
    )

    const user = userEvent.setup()
    renderPage()

    // Side deck section should show (1 pending) — click to expand
    await waitFor(() => {
      expect(screen.getByText(/Side Deck/)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/Side Deck/))

    // Wait for side deck content to show
    await waitFor(() => {
      expect(screen.getByText('perro')).toBeInTheDocument()
    })

    // Click batch translate
    const batchButton = screen.getByText(/Batch Translate/)
    await user.click(batchButton)

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/Batch translation complete/)).toBeInTheDocument()
    })

    // Side deck should be empty now
    const remaining = await db.sideDeckCards.toArray()
    expect(remaining).toHaveLength(0)

    // A card should have been created in the deck
    const cards = await db.cards.where('deckId').equals('test-deck').toArray()
    expect(cards.length).toBeGreaterThan(0)
  })
})

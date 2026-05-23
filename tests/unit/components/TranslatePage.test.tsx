import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import TranslatePage from '../../../src/components/translate/TranslatePage'
import { db } from '../../../src/db'
import { createCard } from '../../../src/services/card'

// --- MSW server setup ---

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.sideDeckCards.clear()
  await db.translationHistory.clear()

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

    const history = await db.translationHistory.toArray()
    expect(history).toHaveLength(1)
    expect(history[0].frontText).toBe('hello')
    expect(history[0].backText).toBe('hola')
    expect(history[0].direction).toBe('both')
    expect(history[0].cardIds).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /History/ }))
    expect(await screen.findByText(/hello/)).toBeInTheDocument()
    expect(screen.getByText(/Both directions/)).toBeInTheDocument()
  })

  it('shows only the 100 newest history entries newest first', async () => {
    const user = userEvent.setup()
    const entries = Array.from({ length: 101 }, (_, i) => ({
      id: `history-${i}`,
      deckId: 'test-deck',
      deckName: 'Spanish Vocab',
      frontText: `front-${i}`,
      backText: `back-${i}`,
      direction: 'source-to-target' as const,
      cardIds: [`card-${i}`],
      createdAt: new Date(Date.UTC(2024, 0, 1, 0, 0, i)).toISOString(),
    }))
    await db.translationHistory.bulkPut(entries)

    renderTranslatePage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Translate' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /History/ }))

    const historyItems = await screen.findAllByRole('listitem')
    expect(historyItems).toHaveLength(100)
    expect(historyItems[0]).toHaveTextContent('front-100')
    expect(historyItems[99]).toHaveTextContent('front-1')
    expect(screen.queryByText(/front-0/)).not.toBeInTheDocument()
  })

  it('keeps the translation textarea mounted when cleared for manual editing', async () => {
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

    const sourceTextarea = await screen.findByPlaceholderText('Enter text to translate...')
    await user.type(sourceTextarea, 'hello')
    await user.click(screen.getByRole('button', { name: 'Translate' }))

    const translationTextarea = await screen.findByLabelText('Translation')
    await user.clear(translationTextarea)

    expect(screen.getByLabelText('Translation')).toBeInTheDocument()
    expect(screen.getByLabelText('Translation')).toHaveValue('')
  })

  it('warns about duplicates before adding from translation and still allows adding anyway', async () => {
    const user = userEvent.setup()

    await createCard({
      deckId: 'test-deck',
      frontText: 'hello',
      backText: 'hola',
      direction: 'source-to-target',
    })

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

    const sourceTextarea = await screen.findByPlaceholderText('Enter text to translate...')
    await user.type(sourceTextarea, 'hello')
    await user.click(screen.getByRole('button', { name: 'Translate' }))

    await user.click(await screen.findByRole('button', { name: 'Both' }))

    await waitFor(() => {
      expect(screen.getByText('Duplicate detected!')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Add Anyway' }))

    await waitFor(() => {
      expect(screen.getByText('Added 2 cards (both directions)')).toBeInTheDocument()
    })

    expect(await db.cards.count()).toBe(3)
  })

  it('stores the deck target language text in backText for reverse translations', async () => {
    const user = userEvent.setup()

    server.use(
      http.get('https://translate.googleapis.com/translate_a/single', () => {
        return HttpResponse.json([
          [['hello', 'hola', null, null, 10]],
          null,
          'es',
        ])
      })
    )

    renderTranslatePage()

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'es')
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'en')

    const sourceTextarea = await screen.findByPlaceholderText('Enter text to translate...')
    await user.type(sourceTextarea, 'hola')
    await user.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /T.*S/ }))

    await waitFor(() => {
      expect(screen.getByText('Added 1 card')).toBeInTheDocument()
    })

    const cards = await db.cards.toArray()
    expect(cards).toHaveLength(1)
    expect(cards[0].direction).toBe('target-to-source')
    expect(cards[0].frontText).toBe('hello')
    expect(cards[0].backText).toBe('hola')
  })
})

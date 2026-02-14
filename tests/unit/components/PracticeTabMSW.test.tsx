import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import PracticeTab from '../../../src/components/practice/PracticeTab'
import { db } from '../../../src/db'
import { createDeck } from '../../../src/services/deck'
import { createCard } from '../../../src/services/card'
import { reviewCard } from '../../../src/services/review'
import type { Deck } from '../../../src/types'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

let deck: Deck

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.settings.clear()
  await db.reviewHistory.clear()
  await db.practiceSentences.clear()

  deck = await createDeck('Spanish Practice')

  // Create and review a verb card so it's available for vocab selection
  const verbCard = await createCard({
    deckId: deck.id,
    frontText: 'to eat',
    backText: 'comer',
    direction: 'source-to-target',
    tags: ['v'],
  })
  await reviewCard(verbCard.id, 3)

  // Configure LLM settings
  await db.settings.put({
    id: 'settings',
    llmProvider: 'anthropic',
    llmApiKey: 'test-key-123',
    llmModel: 'claude-sonnet-4-20250514',
    uiPreferences: {},
  })
})

/** Mock LLM to return an array of sentences (batch format) */
function mockLLMBatchResponse(sentences: { sourceText: string; targetText: string }[]) {
  server.use(
    http.post('https://api.anthropic.com/v1/messages', () => {
      return HttpResponse.json({
        id: 'msg_456',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify(sentences),
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
      })
    })
  )
}

// Default 5 sentences for 3 S→T + 2 T→S
const FIVE_SENTENCES = [
  { sourceText: 'I eat bread every morning.', targetText: 'Yo como pan cada mañana.' },
  { sourceText: 'She eats fruit.', targetText: 'Ella come fruta.' },
  { sourceText: 'We eat dinner late.', targetText: 'Cenamos tarde.' },
  { sourceText: 'Él come pescado.', targetText: 'He eats fish.' },
  { sourceText: 'Ellos comen arroz.', targetText: 'They eat rice.' },
]

describe('PracticeTab with MSW', () => {
  it('clicking generate produces a sentence from mock LLM', async () => {
    const user = userEvent.setup()
    mockLLMBatchResponse(FIVE_SENTENCES)

    render(<PracticeTab deck={deck} />)

    // Should show empty state initially
    expect(
      screen.getByText(/No practice sentences yet/)
    ).toBeInTheDocument()

    // Click Generate
    await user.click(screen.getByRole('button', { name: 'Generate' }))

    // Wait for first sentence to appear (S→T front = sourceText)
    await waitFor(() => {
      expect(screen.getByText('I eat bread every morning.')).toBeInTheDocument()
    })

    // Shows index "1 / 5"
    expect(screen.getByText(/1/)).toBeInTheDocument()
    expect(screen.getByText(/5/)).toBeInTheDocument()

    // Verify sentences are stored in the DB
    const sentences = await db.practiceSentences.toArray()
    expect(sentences).toHaveLength(5)
    expect(sentences.some(s => s.sourceText === 'I eat bread every morning.')).toBe(true)
  })

  it('sentences persist after re-render (navigating away and back)', async () => {
    const user = userEvent.setup()
    mockLLMBatchResponse(FIVE_SENTENCES)

    const { unmount } = render(<PracticeTab deck={deck} />)

    // Generate sentences
    await user.click(screen.getByRole('button', { name: 'Generate' }))

    // Wait for the card UI to appear with the index indicator
    await waitFor(() => {
      expect(screen.getByText(/\/ 5/)).toBeInTheDocument()
    })

    // Unmount and re-render (simulates navigating away and back)
    unmount()

    render(<PracticeTab deck={deck} />)

    // The sentences should still be loaded (card UI visible with Show Answer)
    await waitFor(() => {
      expect(screen.getByText('Show Answer')).toBeInTheDocument()
    })
    // Should show all 5 persisted sentences
    expect(screen.getByText(/\/ 5/)).toBeInTheDocument()
  })

  it('clicking Clear & Regenerate replaces existing sentences', async () => {
    const user = userEvent.setup()

    const firstBatch = FIVE_SENTENCES
    const secondBatch = [
      { sourceText: 'New sentence one.', targetText: 'Nueva oración uno.' },
      { sourceText: 'New sentence two.', targetText: 'Nueva oración dos.' },
      { sourceText: 'New sentence three.', targetText: 'Nueva oración tres.' },
      { sourceText: 'Nueva cuatro.', targetText: 'New four.' },
      { sourceText: 'Nueva cinco.', targetText: 'New five.' },
    ]

    let callCount = 0
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        callCount++
        const batch = callCount === 1 ? firstBatch : secondBatch
        return HttpResponse.json({
          id: `msg_${callCount}`,
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: JSON.stringify(batch) }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
        })
      })
    )

    render(<PracticeTab deck={deck} />)

    // Generate first batch
    await user.click(screen.getByRole('button', { name: 'Generate' }))

    await waitFor(() => {
      expect(screen.getByText('I eat bread every morning.')).toBeInTheDocument()
    })

    // Now click "Clear & Regenerate"
    await user.click(screen.getByRole('button', { name: 'Clear & Regenerate' }))

    await waitFor(() => {
      expect(screen.getByText('New sentence one.')).toBeInTheDocument()
    })

    // Old sentence should be gone
    expect(screen.queryByText('I eat bread every morning.')).not.toBeInTheDocument()

    // DB should only have the new sentences
    const sentences = await db.practiceSentences
      .where('deckId')
      .equals(deck.id)
      .toArray()
    expect(sentences).toHaveLength(5)
    expect(sentences.some(s => s.sourceText === 'New sentence one.')).toBe(true)
    expect(sentences.every(s => s.sourceText !== 'I eat bread every morning.')).toBe(true)
  })

  it('shows error when LLM call fails', async () => {
    const user = userEvent.setup()

    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json(
          { error: { message: 'Rate limited' } },
          { status: 429 }
        )
      })
    )

    render(<PracticeTab deck={deck} />)

    await user.click(screen.getByRole('button', { name: 'Generate' }))

    await waitFor(() => {
      expect(screen.getByText('Rate limited. Please try again later.')).toBeInTheDocument()
    })

    // No sentences should be stored
    const sentences = await db.practiceSentences.toArray()
    expect(sentences).toHaveLength(0)
  })
})

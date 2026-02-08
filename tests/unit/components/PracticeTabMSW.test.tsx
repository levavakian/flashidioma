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

function mockLLMSentenceResponse(sourceText: string, targetText: string) {
  server.use(
    http.post('https://api.anthropic.com/v1/messages', () => {
      return HttpResponse.json({
        id: 'msg_456',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify({ sourceText, targetText }),
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
      })
    })
  )
}

describe('PracticeTab with MSW', () => {
  it('clicking generate produces a sentence from mock LLM', async () => {
    const user = userEvent.setup()
    mockLLMSentenceResponse(
      'I eat bread every morning.',
      'Yo como pan cada mañana.'
    )

    render(<PracticeTab deck={deck} />)

    // Should show empty state initially
    expect(
      screen.getByText(/No practice sentences yet/)
    ).toBeInTheDocument()

    // Click Generate
    await user.click(screen.getByRole('button', { name: 'Generate' }))

    // Wait for sentence to appear
    await waitFor(() => {
      expect(screen.getByText('I eat bread every morning.')).toBeInTheDocument()
    })
    expect(screen.getByText('Yo como pan cada mañana.')).toBeInTheDocument()

    // Verify it's stored in the DB
    const sentences = await db.practiceSentences.toArray()
    expect(sentences).toHaveLength(1)
    expect(sentences[0].sourceText).toBe('I eat bread every morning.')
    expect(sentences[0].targetText).toBe('Yo como pan cada mañana.')
    expect(sentences[0].deckId).toBe(deck.id)
  })

  it('sentences persist after re-render (navigating away and back)', async () => {
    const user = userEvent.setup()
    mockLLMSentenceResponse(
      'She eats fruit.',
      'Ella come fruta.'
    )

    const { unmount } = render(<PracticeTab deck={deck} />)

    // Generate a sentence
    await user.click(screen.getByRole('button', { name: 'Generate' }))

    await waitFor(() => {
      expect(screen.getByText('She eats fruit.')).toBeInTheDocument()
    })

    // Unmount and re-render (simulates navigating away and back)
    unmount()

    render(<PracticeTab deck={deck} />)

    // The sentence should still be visible (loaded from DB)
    await waitFor(() => {
      expect(screen.getByText('She eats fruit.')).toBeInTheDocument()
    })
    expect(screen.getByText('Ella come fruta.')).toBeInTheDocument()
  })

  it('clicking Clear & Regenerate replaces existing sentences', async () => {
    const user = userEvent.setup()

    // First generation returns one sentence
    let callCount = 0
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        callCount++
        const response =
          callCount === 1
            ? { sourceText: 'First sentence.', targetText: 'Primera oración.' }
            : { sourceText: 'New sentence.', targetText: 'Nueva oración.' }

        return HttpResponse.json({
          id: `msg_${callCount}`,
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: JSON.stringify(response) }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
        })
      })
    )

    render(<PracticeTab deck={deck} />)

    // Generate first sentence
    await user.click(screen.getByRole('button', { name: 'Generate' }))

    await waitFor(() => {
      expect(screen.getByText('First sentence.')).toBeInTheDocument()
    })

    // Now click "Clear & Regenerate"
    await user.click(screen.getByRole('button', { name: 'Clear & Regenerate' }))

    await waitFor(() => {
      expect(screen.getByText('New sentence.')).toBeInTheDocument()
    })

    // Old sentence should be gone
    expect(screen.queryByText('First sentence.')).not.toBeInTheDocument()

    // DB should only have the new sentence
    const sentences = await db.practiceSentences
      .where('deckId')
      .equals(deck.id)
      .toArray()
    expect(sentences).toHaveLength(1)
    expect(sentences[0].sourceText).toBe('New sentence.')
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

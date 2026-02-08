import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import DeckDetailPage from '../../../src/components/decks/DeckDetailPage'
import { db } from '../../../src/db'
import { createDeck } from '../../../src/services/deck'
import { createCard } from '../../../src/services/card'
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

  deck = await createDeck('Test Deck')

  // Configure LLM settings
  await db.settings.put({
    id: 'settings',
    llmProvider: 'anthropic',
    llmApiKey: 'test-key-123',
    llmModel: 'claude-sonnet-4-20250514',
    uiPreferences: {},
  })
})

function renderDeckDetail(deckId: string) {
  return render(
    <MemoryRouter initialEntries={[`/deck/${deckId}`]}>
      <Routes>
        <Route path="/deck/:deckId" element={<DeckDetailPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const mockConjugationJson = JSON.stringify({
  infinitive: 'xyzverbar',
  tenses: [
    {
      tenseId: 'present',
      tenseName: 'Present',
      description: 'Actions happening now',
      conjugations: [
        { person: 'yo', form: 'xyzverbo', miniTranslation: 'I xyzverb' },
        { person: 'tú', form: 'xyzverbas', miniTranslation: 'you xyzverb' },
        { person: 'él/ella/usted', form: 'xyzverba', miniTranslation: 'he xyzverbs' },
      ],
    },
    {
      tenseId: 'preterite',
      tenseName: 'Preterite',
      description: 'Completed past actions',
      conjugations: [
        { person: 'yo', form: 'xyzverbé', miniTranslation: 'I xyzverbed' },
        { person: 'tú', form: 'xyzverbaste', miniTranslation: 'you xyzverbed' },
      ],
    },
  ],
})

describe('Full hydration flow integration', () => {
  it('add a verb card, hydrate via LLM, verify conjugation populates and persists', async () => {
    const user = userEvent.setup()

    // Create a verb card without conjugation data (use made-up verb not in static DB)
    await createCard({
      deckId: deck.id,
      frontText: 'to xyzverb',
      backText: 'xyzverbar',
      direction: 'source-to-target',
      tags: ['v'],
    })

    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          id: 'msg_hydrate',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: mockConjugationJson }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
        })
      })
    )

    renderDeckDetail(deck.id)

    // Wait for the deck page to load with our verb card
    await waitFor(() => {
      expect(screen.getByText('to xyzverb')).toBeInTheDocument()
    })

    // The "Conj" hydrate button should be visible (verb without verbData)
    expect(screen.getByText('Conj')).toBeInTheDocument()

    // Click hydrate
    await user.click(screen.getByText('Conj'))

    // Wait for the DB to be updated (the onUpdate callback from CardList calls loadDeck)
    await waitFor(
      () => {
        // Check the DB directly - this is the ground truth
        return db.cards
          .where('deckId')
          .equals(deck.id)
          .toArray()
          .then((cards) => {
            expect(cards[0].verbData).toBeDefined()
          })
      },
      { timeout: 3000 }
    )

    // Now verify the full persisted data
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    const card = cards[0]
    expect(card.verbData!.infinitive).toBe('xyzverbar')
    expect(card.verbData!.tenses).toHaveLength(2)
    expect(card.verbData!.tenses[0].tenseId).toBe('present')
    expect(card.verbData!.tenses[1].tenseId).toBe('preterite')
  })
})

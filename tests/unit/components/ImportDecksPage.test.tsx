import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ImportDecksPage from '../../../src/components/decks/ImportDecksPage'
import { db } from '../../../src/db'
import { createDeck } from '../../../src/services/deck'

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.sideDeckCards.clear()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ImportDecksPage />
    </MemoryRouter>
  )
}

describe('ImportDecksPage', () => {
  it('shows available pre-built decks', async () => {
    await createDeck('Test Deck')
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Spanish Frequency (Top Words)')).toBeInTheDocument()
    })

    expect(screen.getByText('Spanish Irregular Infinitives: Present')).toBeInTheDocument()
    expect(screen.getByText('Spanish Irregular Infinitives: Preterite (Indefinido)')).toBeInTheDocument()
    expect(screen.getAllByText(/words available/).length).toBeGreaterThan(1)
  })

  it('imports cards into a user deck (both directions)', async () => {
    const deck = await createDeck('My Spanish')
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Spanish Frequency (Top Words)')).toBeInTheDocument()
    })

    // Set a small limit to keep the test fast
    const limitInput = screen.getByDisplayValue('500')
    const user = userEvent.setup()
    await user.clear(limitInput)
    await user.type(limitInput, '5')

    const frequencyDeck = screen.getByText('Spanish Frequency (Top Words)').closest('.bg-white')
    if (!frequencyDeck) throw new Error('Frequency deck card not found')

    // Click Import
    await user.click(within(frequencyDeck as HTMLElement).getByRole('button', { name: 'Import' }))

    // Wait for import to complete — 5 words imported, each creating 2 cards
    await waitFor(() => {
      expect(screen.getByText(/Imported 5 cards/)).toBeInTheDocument()
    })

    // Verify cards in DB — 5 words × 2 directions = 10 cards
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    expect(cards).toHaveLength(10)

    // Verify both directions exist
    const s2t = cards.filter(c => c.direction === 'source-to-target')
    const t2s = cards.filter(c => c.direction === 'target-to-source')
    expect(s2t.length).toBe(5)
    expect(t2s.length).toBe(5)
  })

  it('importing twice does not create duplicates', async () => {
    const deck = await createDeck('My Spanish')
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Spanish Frequency (Top Words)')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const limitInput = screen.getByDisplayValue('500')
    await user.clear(limitInput)
    await user.type(limitInput, '3')

    const frequencyDeck = screen.getByText('Spanish Frequency (Top Words)').closest('.bg-white')
    if (!frequencyDeck) throw new Error('Frequency deck card not found')

    // First import
    await user.click(within(frequencyDeck as HTMLElement).getByRole('button', { name: 'Import' }))
    await waitFor(() => {
      expect(screen.getByText(/Imported 3 cards/)).toBeInTheDocument()
    })

    // Second import
    await user.click(within(frequencyDeck as HTMLElement).getByRole('button', { name: 'Import' }))
    await waitFor(() => {
      expect(screen.getByText(/skipped 3 duplicates/)).toBeInTheDocument()
    })

    // Should still only have 6 cards (3 words × 2 directions)
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    expect(cards).toHaveLength(6)
  })

  it('wraps preview pagination at the first and last pages', async () => {
    await createDeck('My Spanish')
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Spanish Frequency (Top Words)')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const frequencyDeck = screen.getByText('Spanish Frequency (Top Words)').closest('.bg-white')
    if (!frequencyDeck) throw new Error('Frequency deck card not found')

    await user.click(within(frequencyDeck as HTMLElement).getByRole('button', { name: 'Preview' }))

    await waitFor(() => {
      expect(screen.getByText(/1 \/ \d+/)).toBeInTheDocument()
    })

    const pageLabel = screen.getByText(/1 \/ \d+/)
    const totalPages = Number(pageLabel.textContent?.split('/')[1].trim())
    expect(totalPages).toBeGreaterThan(1)

    await user.click(screen.getByRole('button', { name: 'Prev' }))

    expect(screen.getByText(`${totalPages} / ${totalPages}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText(`1 / ${totalPages}`)).toBeInTheDocument()
  })

  it('previews and imports an irregular lesson deck', async () => {
    const deck = await createDeck('My Spanish')
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Spanish Irregular Infinitives: Imperfect')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const irregularDeck = screen.getByText('Spanish Irregular Infinitives: Imperfect').closest('.bg-white')
    if (!irregularDeck) throw new Error('Irregular deck card not found')

    await user.click(within(irregularDeck as HTMLElement).getByRole('button', { name: 'Preview' }))
    await waitFor(() => {
      expect(screen.getByText('ser')).toBeInTheDocument()
      expect(screen.getByText('ir')).toBeInTheDocument()
      expect(screen.getByText('ver')).toBeInTheDocument()
    })

    await user.click(within(irregularDeck as HTMLElement).getByRole('button', { name: 'Import' }))
    await waitFor(() => {
      expect(screen.getByText(/Imported 3 cards/)).toBeInTheDocument()
    })

    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    expect(cards).toHaveLength(6)
    expect(cards.every((card) => card.verbData?.language === 'spanish')).toBe(true)
  })
})

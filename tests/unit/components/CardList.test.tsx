import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CardList from '../../../src/components/cards/CardList'
import type { Card, VerbData } from '../../../src/types'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: crypto.randomUUID(),
    deckId: 'test-deck',
    frontText: 'hello',
    backText: 'hola',
    direction: 'source-to-target',
    tags: [],
    notes: '',
    fsrs: {
      stability: 5.0,
      difficulty: 5.0,
      dueDate: new Date().toISOString(),
      lastReview: null,
      reviewCount: 0,
      lapses: 0,
      state: 'new',
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
    },
    createdAt: new Date().toISOString(),
    source: 'manual',
    ...overrides,
  }
}

describe('CardList', () => {
  const onUpdate = vi.fn()

  beforeEach(() => {
    onUpdate.mockClear()
  })

  it('shows full untruncated text when card is expanded', async () => {
    const user = userEvent.setup()
    const longFront = 'This is a very long front text that would normally be truncated in the collapsed view'
    const longBack = 'Este es un texto posterior muy largo que normalmente se truncaría en la vista contraída'

    const card = makeCard({ frontText: longFront, backText: longBack })

    render(<CardList cards={[card]} deckId="test-deck" onUpdate={onUpdate} />)

    // Click to expand the card
    await user.click(screen.getByText(longFront))

    // Should show the full text in the expanded section (non-truncated, break-words)
    const frontElements = screen.getAllByText(longFront)
    const backElements = screen.getAllByText(longBack)

    // Should appear at least twice: once in the collapsed row (truncated) and once in expanded section
    expect(frontElements.length).toBeGreaterThanOrEqual(2)
    expect(backElements.length).toBeGreaterThanOrEqual(2)
  })

  it('examples section has a toggle that expands and collapses', async () => {
    const user = userEvent.setup()
    const card = makeCard({
      examples: [
        {
          id: 'ex1',
          sourceText: 'I eat bread.',
          targetText: 'Yo como pan.',
          direction: 'source-to-target',
          createdAt: new Date().toISOString(),
        },
      ],
    })

    render(<CardList cards={[card]} deckId="test-deck" onUpdate={onUpdate} />)

    // Expand the card
    await user.click(screen.getByText('hello'))

    // Examples toggle should be visible
    expect(screen.getByText('Examples (1)')).toBeInTheDocument()

    // Example content should NOT be visible yet
    expect(screen.queryByText('I eat bread.')).not.toBeInTheDocument()

    // Click the examples toggle
    await user.click(screen.getByText('Examples (1)'))

    // Now the example should be visible
    await waitFor(() => {
      expect(screen.getByText('I eat bread.')).toBeInTheDocument()
      expect(screen.getByText('Yo como pan.')).toBeInTheDocument()
    })

    // Click toggle again to collapse
    await user.click(screen.getByText('Examples (1)'))

    // Example content should be hidden again
    expect(screen.queryByText('I eat bread.')).not.toBeInTheDocument()
  })

  it('shows delete button for each example', async () => {
    const user = userEvent.setup()
    const card = makeCard({
      examples: [
        {
          id: 'ex1',
          sourceText: 'She eats fruit.',
          targetText: 'Ella come fruta.',
          direction: 'source-to-target',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'ex2',
          sourceText: 'He runs fast.',
          targetText: 'Él corre rápido.',
          direction: 'source-to-target',
          createdAt: new Date().toISOString(),
        },
      ],
    })

    render(<CardList cards={[card]} deckId="test-deck" onUpdate={onUpdate} />)

    // Expand card
    await user.click(screen.getByText('hello'))

    // Expand examples
    await user.click(screen.getByText('Examples (2)'))

    // Both examples should be visible
    expect(screen.getByText('She eats fruit.')).toBeInTheDocument()
    expect(screen.getByText('He runs fast.')).toBeInTheDocument()

    // Delete buttons should be present (× characters)
    const deleteButtons = screen.getAllByTitle('Delete example')
    expect(deleteButtons).toHaveLength(2)
  })

  it('shows direction badges on examples', async () => {
    const user = userEvent.setup()
    const card = makeCard({
      examples: [
        {
          id: 'ex1',
          sourceText: 'I eat.',
          targetText: 'Yo como.',
          direction: 'source-to-target',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'ex2',
          sourceText: 'Ella come.',
          targetText: 'She eats.',
          direction: 'target-to-source',
          createdAt: new Date().toISOString(),
        },
      ],
    })

    render(<CardList cards={[card]} deckId="test-deck" onUpdate={onUpdate} />)

    // Expand card then examples
    await user.click(screen.getByText('hello'))
    await user.click(screen.getByText('Examples (2)'))

    // Direction badges should be visible in examples
    // Note: 'S→T' also appears in the card's direction label, so use getAllByText
    const stBadges = screen.getAllByText('S\u2192T')
    expect(stBadges.length).toBeGreaterThanOrEqual(2) // one in card row, one in example
    expect(screen.getByText('T\u2192S')).toBeInTheDocument()
  })

  it('clamps pagination when the card list shrinks', async () => {
    const user = userEvent.setup()
    const cards = Array.from({ length: 51 }, (_, index) =>
      makeCard({
        id: `card-${index + 1}`,
        frontText: `front ${index + 1}`,
        backText: `back ${index + 1}`,
        createdAt: new Date(2026, 0, index + 1).toISOString(),
      })
    )

    const { rerender } = render(
      <CardList cards={cards} deckId="test-deck" onUpdate={onUpdate} />
    )

    expect(screen.getByText('front 1')).toBeInTheDocument()
    expect(screen.queryByText('front 51')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText('front 51')).toBeInTheDocument()
    expect(screen.queryByText('front 1')).not.toBeInTheDocument()

    rerender(<CardList cards={cards.slice(0, 50)} deckId="test-deck" onUpdate={onUpdate} />)

    await waitFor(() => {
      expect(screen.getByText('front 1')).toBeInTheDocument()
    })
    expect(screen.queryByText('front 51')).not.toBeInTheDocument()
  })

  it('shows authoritative static-DB conjugation when stored card data is stale', async () => {
    const user = userEvent.setup()

    // Mimics a card persisted by an older app version whose conjugation was
    // generated by the buggy regular-rule fallback (commit ea61d69): "haber"
    // was conjugated like a regular -er verb, producing a wrong preterite
    // (habí/habiste/habió/...) instead of the correct hube/hubiste/hubo/...
    const staleVerbData: VerbData = {
      infinitive: 'haber',
      language: 'spanish',
      tenses: [
        {
          tenseId: 'preterite',
          tenseName: 'Preterite',
          description: 'Completed past actions with a definite endpoint',
          conjugations: [
            { person: 'yo', form: 'habí', miniTranslation: 'I had' },
            { person: 'tú', form: 'habiste', miniTranslation: 'you had' },
            { person: 'él/ella/usted', form: 'habió', miniTranslation: 'he/she had' },
            { person: 'nosotros/as', form: 'habimos', miniTranslation: 'we had' },
            { person: 'vosotros/as', form: 'habisteis', miniTranslation: 'you all had' },
            { person: 'ellos/ellas/ustedes', form: 'habieron', miniTranslation: 'they had' },
          ],
        },
      ],
    }

    const card = makeCard({
      frontText: 'to have',
      backText: 'haber',
      direction: 'source-to-target',
      verbData: staleVerbData,
    })

    render(<CardList cards={[card]} deckId="test-deck" onUpdate={onUpdate} />)

    await user.click(screen.getByText('to have'))

    // Expand the conjugation section, then the Preterite tense.
    await user.click(await screen.findByRole('button', { name: /Conjugations \(haber\)/ }))

    // Wait for the authoritative static-DB lookup to resolve (full 18-tense
    // table replaces the single stored tense), then open the Preterite tense.
    await waitFor(() => {
      expect(screen.getByText('Imperfect', { exact: true })).toBeInTheDocument()
    })
    await user.click(screen.getByText('Preterite', { exact: true }))

    // The correct static-DB forms must be shown...
    await waitFor(() => {
      expect(screen.getByText('hubo')).toBeInTheDocument()
    })
    expect(screen.getByText('hube')).toBeInTheDocument()
    expect(screen.getByText('hubieron')).toBeInTheDocument()

    // ...and the stale forms must NOT appear.
    expect(screen.queryByText('habió')).not.toBeInTheDocument()
    expect(screen.queryByText('habí')).not.toBeInTheDocument()
    expect(screen.queryByText('habieron')).not.toBeInTheDocument()

    // Stored mini-translations are preserved and re-aligned onto the forms.
    expect(screen.getByText('he/she had')).toBeInTheDocument()
  })

  it('wraps pagination at the first and last pages', async () => {
    const user = userEvent.setup()
    const cards = Array.from({ length: 51 }, (_, index) =>
      makeCard({
        id: `card-${index + 1}`,
        frontText: `front ${index + 1}`,
        backText: `back ${index + 1}`,
        createdAt: new Date(2026, 0, index + 1).toISOString(),
      })
    )

    render(<CardList cards={cards} deckId="test-deck" onUpdate={onUpdate} />)

    expect(screen.getByText('front 1')).toBeInTheDocument()
    expect(screen.queryByText('front 51')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Prev' }))

    expect(screen.getByText('front 51')).toBeInTheDocument()
    expect(screen.queryByText('front 1')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText('front 1')).toBeInTheDocument()
    expect(screen.queryByText('front 51')).not.toBeInTheDocument()
  })
})

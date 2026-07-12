import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../src/db'
import { createDeck, updateDeck } from '../../src/services/deck'
import { createCard } from '../../src/services/card'
import { extractBracketedInfinitive, maybeAutoAddConjugationCard } from '../../src/services/conjugationAutoAdd'
import { isOnline, translateText } from '../../src/services/translate'
import type { Deck, VerbData } from '../../src/types'

vi.mock('../../src/services/translate', () => ({
  isOnline: vi.fn(() => false),
  translateText: vi.fn(),
}))

// Single tense with a single person so the picked form is deterministic
const verbData: VerbData = {
  infinitive: 'comentar',
  language: 'spanish',
  tenses: [
    {
      tenseId: 'present-subjunctive',
      tenseName: 'Present Subjunctive',
      description: '',
      conjugations: [{ person: 'ellos/ellas/ustedes', form: 'comenten', miniTranslation: '' }],
    },
  ],
}

let deck: Deck

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.conjugationAutoAdds.clear()
  vi.mocked(isOnline).mockReturnValue(false)
  vi.mocked(translateText).mockReset()

  const created = await createDeck('Test Deck')
  deck = await updateDeck(created.id, {
    constructChecklist: { 'present-subjunctive': true },
  })
})

describe('extractBracketedInfinitive', () => {
  it('extracts the infinitive from a labeled card text', () => {
    expect(extractBracketedInfinitive('we meet [to meet (nosotros/as present)]')).toBe('to meet')
  })

  it('extracts the innermost infinitive from a nested label', () => {
    const nested =
      'you commented [to comment (tú preterite)] [to you commented [to comment (tú preterite)] (ellos/ellas/ustedes present subjunctive)]'
    expect(extractBracketedInfinitive(nested)).toBe('to comment')
  })

  it('returns null for text without a bracket annotation', () => {
    expect(extractBracketedInfinitive('to eat')).toBeNull()
    expect(extractBracketedInfinitive('comentar')).toBeNull()
  })
})

describe('maybeAutoAddConjugationCard label building', () => {
  it('does not nest annotations when the reviewed card is itself a conjugation card (offline)', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'you commented [to comment (tú preterite)]',
      backText: 'comentaste',
      direction: 'source-to-target',
      source: 'auto-conjugation',
      verbData,
    })

    const result = await maybeAutoAddConjugationCard(card, 3, deck)

    expect(result.added).toBe(true)
    expect(result.form).toBe('comenten')
    expect(result.translation).toBe('to comment [to comment (ellos/ellas/ustedes present subjunctive)]')
  })

  it('does not nest annotations when translation fails while online', async () => {
    vi.mocked(isOnline).mockReturnValue(true)
    vi.mocked(translateText).mockRejectedValue(new Error('rate limited'))

    const card = await createCard({
      deckId: deck.id,
      frontText: 'you commented [to comment (tú preterite)]',
      backText: 'comentaste',
      direction: 'source-to-target',
      source: 'auto-conjugation',
      verbData,
    })

    const result = await maybeAutoAddConjugationCard(card, 3, deck)

    expect(result.added).toBe(true)
    expect(result.translationFailed).toBe(true)
    expect(result.translation).toBe('to comment [to comment (ellos/ellas/ustedes present subjunctive)]')
  })

  it('still uses the plain verb card text as offline fallback', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'to comment',
      backText: 'comentar',
      direction: 'source-to-target',
      verbData,
    })

    const result = await maybeAutoAddConjugationCard(card, 3, deck)

    expect(result.added).toBe(true)
    expect(result.translation).toBe('to comment [to comment (ellos/ellas/ustedes present subjunctive)]')
  })

  it('uses translated texts when online', async () => {
    vi.mocked(isOnline).mockReturnValue(true)
    vi.mocked(translateText).mockImplementation(async (text) => ({
      translatedText: text === 'comenten' ? 'They comment' : 'Comment',
    }))

    const card = await createCard({
      deckId: deck.id,
      frontText: 'you commented [to comment (tú preterite)]',
      backText: 'comentaste',
      direction: 'source-to-target',
      source: 'auto-conjugation',
      verbData,
    })

    const result = await maybeAutoAddConjugationCard(card, 3, deck)

    expect(result.added).toBe(true)
    expect(result.translation).toBe('they comment [to comment (ellos/ellas/ustedes present subjunctive)]')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/db'
import { createDeck, getDeck, updateDeck } from '../../src/services/deck'
import { createCard } from '../../src/services/card'
import {
  getDefaultSpanishChecklist,
  spanishLanguageModule,
} from '../../src/languages/spanish'

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.reviewHistory.clear()
  await db.practiceSentences.clear()
})

describe('getDefaultSpanishChecklist', () => {
  it('only enables the present tense by default', () => {
    const checklist = getDefaultSpanishChecklist()

    expect(checklist['present']).toBe(true)

    // Every other construct should be disabled
    const otherIds = spanishLanguageModule.constructs
      .map((c) => c.id)
      .filter((id) => id !== 'present')

    for (const id of otherIds) {
      expect(checklist[id]).toBe(false)
    }
  })

  it('includes all defined Spanish constructs', () => {
    const checklist = getDefaultSpanishChecklist()
    const keys = Object.keys(checklist)

    // Every construct from the module should appear in the checklist
    for (const construct of spanishLanguageModule.constructs) {
      expect(keys).toContain(construct.id)
    }

    // And no extra keys
    expect(keys).toHaveLength(spanishLanguageModule.constructs.length)
  })
})

describe('Construct checklist persistence per deck', () => {
  it('each deck has its own independent checklist', async () => {
    const deckA = await createDeck('Deck A')
    const deckB = await createDeck('Deck B')

    // Both start with the same default checklist
    expect(deckA.constructChecklist.present).toBe(true)
    expect(deckA.constructChecklist.preterite).toBe(false)
    expect(deckB.constructChecklist.present).toBe(true)
    expect(deckB.constructChecklist.preterite).toBe(false)

    // Modify deck A's checklist: enable preterite, disable present
    await updateDeck(deckA.id, {
      constructChecklist: {
        ...deckA.constructChecklist,
        present: false,
        preterite: true,
      },
    })

    // Re-read both decks
    const updatedA = await getDeck(deckA.id)
    const updatedB = await getDeck(deckB.id)

    // Deck A should reflect the change
    expect(updatedA!.constructChecklist.present).toBe(false)
    expect(updatedA!.constructChecklist.preterite).toBe(true)

    // Deck B should be unchanged
    expect(updatedB!.constructChecklist.present).toBe(true)
    expect(updatedB!.constructChecklist.preterite).toBe(false)
  })

  it('persists checklist changes through round-trip to DB', async () => {
    const deck = await createDeck('Persistence Test')

    // Enable several tenses
    const newChecklist = {
      ...deck.constructChecklist,
      preterite: true,
      imperfect: true,
      future: true,
    }

    await updateDeck(deck.id, { constructChecklist: newChecklist })

    // Read back from DB
    const fetched = await getDeck(deck.id)
    expect(fetched!.constructChecklist.present).toBe(true)
    expect(fetched!.constructChecklist.preterite).toBe(true)
    expect(fetched!.constructChecklist.imperfect).toBe(true)
    expect(fetched!.constructChecklist.future).toBe(true)
    expect(fetched!.constructChecklist.conditional).toBe(false)
    expect(fetched!.constructChecklist['present-subjunctive']).toBe(false)
  })
})

describe('Non-verb cards are unaffected by construct checklist', () => {
  it('non-verb cards have no verbData and ignore the checklist', async () => {
    const deck = await createDeck('Mixed Cards')

    // Create a regular (non-verb) card
    const card = await createCard({
      deckId: deck.id,
      frontText: 'house',
      backText: 'casa',
      direction: 'source-to-target',
      tags: ['noun'],
    })

    // The card should have no verbData
    expect(card.verbData).toBeUndefined()

    // Changing the checklist should not affect the card at all
    await updateDeck(deck.id, {
      constructChecklist: {
        ...deck.constructChecklist,
        present: false,
      },
    })

    // Re-read the card; it should be unchanged
    const fetchedCard = await db.cards.get(card.id)
    expect(fetchedCard!.frontText).toBe('house')
    expect(fetchedCard!.backText).toBe('casa')
    expect(fetchedCard!.verbData).toBeUndefined()
    expect(fetchedCard!.tags).toEqual(['noun'])
  })

  it('verb cards carry verbData independent of the construct checklist', async () => {
    const deck = await createDeck('Verb Deck')

    // Create a card with verbData attached
    const verbCard = await createCard({
      deckId: deck.id,
      frontText: 'to speak',
      backText: 'hablar',
      direction: 'source-to-target',
      tags: ['verb'],
    })

    // Manually add verbData via direct DB update (simulating hydration)
    const verbData = {
      infinitive: 'hablar',
      language: 'spanish',
      tenses: [
        {
          tenseId: 'present',
          tenseName: 'Present',
          description: 'Actions happening now',
          conjugations: [
            { person: 'yo', form: 'hablo', miniTranslation: 'I speak' },
          ],
        },
      ],
    }

    await db.cards.update(verbCard.id, { verbData })

    // The verbData on the card persists regardless of the deck checklist
    const fetchedCard = await db.cards.get(verbCard.id)
    expect(fetchedCard!.verbData).toBeDefined()
    expect(fetchedCard!.verbData!.infinitive).toBe('hablar')
    expect(fetchedCard!.verbData!.tenses).toHaveLength(1)

    // Even if we disable all constructs on the deck, the card's verbData stays
    const allOff: Record<string, boolean> = {}
    for (const construct of spanishLanguageModule.constructs) {
      allOff[construct.id] = false
    }
    await updateDeck(deck.id, { constructChecklist: allOff })

    const cardAfterChecklistChange = await db.cards.get(verbCard.id)
    expect(cardAfterChecklistChange!.verbData).toBeDefined()
    expect(cardAfterChecklistChange!.verbData!.infinitive).toBe('hablar')
  })
})

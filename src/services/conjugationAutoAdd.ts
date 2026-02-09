/**
 * Service for auto-adding conjugation cards when reviewing verbs.
 *
 * When a verb card is reviewed with Good (3) or Easy (4), this service
 * picks a random conjugation form that hasn't been added yet and creates
 * a bidirectional card pair. Limits: once per verb per day, and a
 * configurable daily max across all verbs.
 */

import { db } from '../db'
import { createCard } from './card'
import { lookupConjugation } from './conjugationLookup'
import { removeAccents } from './deduplication'
import { formatReflexiveForm } from './reflexive'
import type { Card, Deck, VerbData, ConjugationAutoAdd, ConstructChecklist } from '../types'

/** Get today's date as YYYY-MM-DD */
function todayString(now: Date = new Date()): string {
  return now.toISOString().split('T')[0]
}

/**
 * Get verbData from a card. Tries in order:
 * 1. Card's own verbData
 * 2. Paired card's verbData (same word pair, opposite direction)
 * 3. Static conjugation DB lookup (tries both text fields)
 */
async function getVerbDataForCard(card: Card): Promise<VerbData | null> {
  if (card.verbData?.tenses?.length) return card.verbData

  // Try to find the paired card (same deck, same text pair)
  const deckCards = await db.cards.where('deckId').equals(card.deckId).toArray()
  for (const other of deckCards) {
    if (other.id === card.id) continue
    if (!other.verbData?.tenses?.length) continue
    const sameWord =
      (card.frontText === other.frontText && card.backText === other.backText) ||
      (card.frontText === other.backText && card.backText === other.frontText)
    if (sameWord) return other.verbData
  }

  // Fallback: try static DB with both text fields
  const result = await lookupConjugation(card.backText)
  if (result) return result
  if (card.frontText !== card.backText) {
    return lookupConjugation(card.frontText)
  }

  return null
}

interface EligibleConjugation {
  tenseId: string
  tenseName: string
  person: string
  form: string
  miniTranslation: string
}

/**
 * Get all eligible conjugation forms for a verb that haven't been added yet.
 * Filters by enabled constructs and checks for existing cards in the deck.
 */
async function getEligibleConjugations(
  verbData: VerbData,
  deck: Deck,
  existingCards: Card[],
): Promise<EligibleConjugation[]> {
  const checklist: ConstructChecklist = deck.constructChecklist

  // Get all forms already auto-added for this verb in this deck
  const autoAdds = await db.conjugationAutoAdds
    .where('[deckId+verbInfinitive]')
    .equals([deck.id, verbData.infinitive])
    .toArray()
  const addedForms = new Set(autoAdds.map(a => `${a.tenseId}:${a.person}`))

  // Build set of existing card texts in the deck (accent-insensitive)
  // Check both text fields since imported/both-direction cards may have
  // the Spanish text in backText regardless of direction
  const existingTexts = new Set<string>()
  for (const card of existingCards) {
    existingTexts.add(removeAccents(card.frontText))
    existingTexts.add(removeAccents(card.backText))
  }

  const eligible: EligibleConjugation[] = []

  for (const tense of verbData.tenses) {
    // Only consider tenses enabled in the construct checklist
    if (!checklist[tense.tenseId]) continue

    for (const conj of tense.conjugations) {
      // Skip if already auto-added
      if (addedForms.has(`${tense.tenseId}:${conj.person}`)) continue

      // Skip empty forms
      if (!conj.form.trim()) continue

      // Build the card text (with reflexive support)
      const cardForm = formatReflexiveForm(conj.form, conj.person, verbData.infinitive, tense.tenseId)

      // Skip if this form already exists as a card in the deck
      if (existingTexts.has(removeAccents(cardForm))) continue

      eligible.push({
        tenseId: tense.tenseId,
        tenseName: tense.tenseName,
        person: conj.person,
        form: cardForm,
        miniTranslation: conj.miniTranslation,
      })
    }
  }

  return eligible
}

export interface AutoAddResult {
  added: boolean
  form?: string
  translation?: string
  reason?: string
}

/**
 * Attempt to auto-add a conjugation card after a verb is reviewed with Good/Easy.
 * Returns info about what was added (or why nothing was added).
 */
export async function maybeAutoAddConjugationCard(
  card: Card,
  grade: number,
  deck: Deck,
  now: Date = new Date()
): Promise<AutoAddResult> {
  // Only trigger on Good (3) or Easy (4)
  if (grade < 3) return { added: false, reason: 'grade_too_low' }

  // Check if feature is enabled
  if (deck.autoAddConjugations === false) return { added: false, reason: 'disabled' }

  // Get verb data
  const verbData = await getVerbDataForCard(card)
  if (!verbData?.tenses?.length) return { added: false, reason: 'not_a_verb' }

  const today = todayString(now)

  // Check daily limit across all verbs
  const dailyLimit = deck.maxConjugationCardsPerDay ?? 5
  let addedToday = deck.conjugationCardsAddedToday ?? 0
  if (deck.lastConjugationCardDate !== today) {
    addedToday = 0
  }
  if (addedToday >= dailyLimit) return { added: false, reason: 'daily_limit' }

  // Check per-verb per-day limit (once per verb per day)
  const verbAddsToday = await db.conjugationAutoAdds
    .where('[deckId+verbInfinitive]')
    .equals([deck.id, verbData.infinitive])
    .filter(a => a.addedDate === today)
    .count()
  if (verbAddsToday > 0) return { added: false, reason: 'verb_already_added_today' }

  // Get all existing cards for deduplication
  const existingCards = await db.cards.where('deckId').equals(deck.id).toArray()

  // Get eligible conjugations
  const eligible = await getEligibleConjugations(verbData, deck, existingCards)
  if (eligible.length === 0) return { added: false, reason: 'all_forms_added' }

  // Pick a random eligible form
  const pick = eligible[Math.floor(Math.random() * eligible.length)]

  // Build the translation text.
  // miniTranslation is populated by LLM hydration (e.g. "you eat").
  // For the static conjugation DB, miniTranslation is always empty.
  // In that case, construct a translation from the verb's English text
  // (from the reviewed card) + person/tense context.
  // For imported cards, frontText is always the English translation.
  const verbEnglish = card.frontText
  const translation = pick.miniTranslation || `${verbEnglish} (${pick.person}, ${pick.tenseName.toLowerCase()})`

  // Create bidirectional card pair using the same layout as importPrebuiltDeck:
  // frontText=English, backText=Spanish for both directions.
  // The direction field controls which is shown first during review.
  // Source 'auto-conjugation' means these start as "learning" (not "new")
  // and don't count against the daily new card limit.
  await createCard({
    deckId: deck.id,
    frontText: translation,
    backText: pick.form,
    direction: 'source-to-target',
    tags: [verbData.infinitive, pick.tenseName.toLowerCase()],
    source: 'auto-conjugation',
  })
  await createCard({
    deckId: deck.id,
    frontText: translation,
    backText: pick.form,
    direction: 'target-to-source',
    tags: [verbData.infinitive, pick.tenseName.toLowerCase()],
    source: 'auto-conjugation',
  })

  // Record the auto-add
  const autoAdd: ConjugationAutoAdd = {
    id: crypto.randomUUID(),
    deckId: deck.id,
    verbInfinitive: verbData.infinitive,
    tenseId: pick.tenseId,
    person: pick.person,
    form: pick.form,
    addedDate: today,
    createdAt: now.toISOString(),
  }
  await db.conjugationAutoAdds.put(autoAdd)

  // Update deck daily counter
  await db.decks.update(deck.id, {
    conjugationCardsAddedToday: addedToday + 1,
    lastConjugationCardDate: today,
  })

  return {
    added: true,
    form: pick.form,
    translation,
  }
}

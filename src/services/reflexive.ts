/**
 * Utilities for handling Spanish reflexive verbs.
 *
 * Reflexive verbs have infinitives ending in "-se" (levantarse, vestirse, irse).
 * When conjugated, the reflexive pronoun must be placed correctly:
 *   - Simple tenses: pronoun before verb ("me levanto")
 *   - Compound tenses: pronoun before auxiliary ("me he levantado")
 *   - Progressive tenses: pronoun before auxiliary ("me estoy levantando")
 *   - Modal constructs: pronoun before modal ("me puedo levantar")
 *   - Affirmative imperative: pronoun attached to end with stress accent
 *     adjustment ("levántate", "múdense")
 */

import type { TenseData, VerbData } from '../types'

const REFLEXIVE_PRONOUNS: Record<string, string> = {
  'yo': 'me',
  'tú': 'te',
  'él/ella/usted': 'se',
  'usted': 'se',
  'nosotros/as': 'nos',
  'nosotros': 'nos',
  'vosotros/as': 'os',
  'vosotros': 'os',
  'ellos/ellas/ustedes': 'se',
  'ustedes': 'se',
}

const REFLEXIVE_PRONOUN_WORDS = new Set(['me', 'te', 'se', 'nos', 'os'])

/** Pronoun suffixes for imperative, ordered longest-first to avoid partial matches */
const PRONOUN_SUFFIXES = ['nos', 'me', 'te', 'se', 'os']

const VOWELS = 'aeiouáéíóúü'
const STRONG_VOWELS = 'aeoáéó'
const ACCENTED_VOWELS = 'áéíóú'
const PLAIN_TO_ACCENTED: Record<string, string> = {
  a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú',
}

export function isReflexiveVerb(infinitive: string): boolean {
  return infinitive.endsWith('se') && infinitive.length > 2
}

export function getBaseInfinitive(infinitive: string): string {
  return isReflexiveVerb(infinitive) ? infinitive.slice(0, -2) : infinitive
}

export function getReflexivePronoun(person: string): string {
  return REFLEXIVE_PRONOUNS[person.toLowerCase().trim()] ?? 'se'
}

function isVowel(ch: string): boolean {
  return VOWELS.includes(ch.toLowerCase())
}

function isStrongVowel(ch: string): boolean {
  return STRONG_VOWELS.includes(ch.toLowerCase())
}

/**
 * Find the index of the last vowel of the syllable at the given position from
 * the end (0 = last syllable, 1 = penultimate, etc.). Treats vowel groups
 * (diphthongs) as a single nucleus.
 *
 * Returns the index of the vowel that takes the written accent: the strong
 * vowel of the diphthong, or the last vowel if all are weak.
 */
function findStressedVowelIndex(word: string, syllablesFromEnd: number): number {
  const lower = word.toLowerCase()
  let syllablesSeen = -1
  let i = lower.length - 1
  let groupEnd = -1
  let groupStart = -1

  while (i >= 0) {
    if (isVowel(lower[i])) {
      groupEnd = i
      while (i >= 0 && isVowel(lower[i])) i--
      groupStart = i + 1
      syllablesSeen++
      if (syllablesSeen === syllablesFromEnd) {
        // Within [groupStart, groupEnd], pick the strong vowel; fall back to
        // the last vowel of the group.
        for (let j = groupStart; j <= groupEnd; j++) {
          if (isStrongVowel(lower[j])) return j
        }
        return groupEnd
      }
    } else {
      i--
    }
  }
  return -1
}

function addAccentAt(word: string, index: number): string {
  if (index < 0) return word
  const ch = word[index]
  const lower = ch.toLowerCase()
  const accented = PLAIN_TO_ACCENTED[lower]
  if (!accented) return word
  const replacement = ch === lower ? accented : accented.toUpperCase()
  return word.slice(0, index) + replacement + word.slice(index + 1)
}

function removeWrittenAccents(word: string): string {
  return word.normalize('NFD').replace(/\u0301/g, '').normalize('NFC')
}

/**
 * Attach a clitic pronoun to the end of an imperative form, applying Spanish
 * stress accent rules so the original stressed syllable keeps its stress.
 *
 * The stressed syllable in the input is determined as follows:
 * - If the input has a written accent, that is the stressed syllable.
 * - Otherwise the default rule applies: penultimate if the word ends in
 *   vowel/n/s, last syllable otherwise.
 *
 * After attaching `addedSyllables` extra syllables, a written accent is added
 * on the original stressed vowel if natural stress would otherwise fall
 * elsewhere.
 */
function attachCliticToImperative(
  base: string,
  pronoun: string,
  person: string
): string {
  const isNosotros = person === 'nosotros' || person === 'nosotros/as'
  const isVosotros = person === 'vosotros' || person === 'vosotros/as'

  // Drop the conjugation-final letter that's elided when the clitic attaches:
  //   nosotros: drop final `-s` ("mudemos" + "nos" -> "mudémonos")
  //   vosotros: drop final `-d` ("mudad"   + "os"  -> "mudaos")
  let stem = base
  if (isNosotros && base.endsWith('s')) stem = base.slice(0, -1)
  if (isVosotros && base.endsWith('d')) stem = base.slice(0, -1)

  const combined = stem + pronoun

  // Special case for -ir verbs in vosotros: the stem ends in `i` and the
  // pronoun starts with `o`. Default rules would treat `io` as a diphthong;
  // a written accent on the stem `i` is required to mark the hiatus.
  // Examples: vivid + os -> vivíos, partid + os -> partíos.
  if (isVosotros && base.endsWith('id')) {
    const accentIdx = combined.length - pronoun.length - 1
    return addAccentAt(combined, accentIdx)
  }

  const baseAccentIdx = findExistingAccentIndex(base)

  // Determine the syllable position (counted from the end) of the originally
  // stressed vowel.
  let originalStressedSyllableFromEnd: number
  if (baseAccentIdx >= 0) {
    originalStressedSyllableFromEnd = syllablesFromEndOfPosition(base, baseAccentIdx)
  } else if (countSyllables(base) === 1) {
    originalStressedSyllableFromEnd = 0
  } else {
    originalStressedSyllableFromEnd = endsInVowelOrNS_for(base) ? 1 : 0
  }

  const addedSyllables = countSyllables(pronoun)
  const newStressedSyllableFromEnd = originalStressedSyllableFromEnd + addedSyllables

  const lastChar = combined[combined.length - 1].toLowerCase()
  const endsInVowelOrNS = isVowel(lastChar) || lastChar === 'n' || lastChar === 's'
  const naturalSyllableFromEnd = endsInVowelOrNS ? 1 : 0

  if (newStressedSyllableFromEnd === naturalSyllableFromEnd || baseAccentIdx >= 0) {
    return combined
  }

  const accentVowelIdx = findStressedVowelIndex(combined, newStressedSyllableFromEnd)
  return addAccentAt(combined, accentVowelIdx)
}

function findExistingAccentIndex(word: string): number {
  const lower = word.toLowerCase()
  for (let i = 0; i < lower.length; i++) {
    if (ACCENTED_VOWELS.includes(lower[i])) return i
  }
  return -1
}

function endsInVowelOrNS_for(word: string): boolean {
  if (!word) return false
  const last = word[word.length - 1].toLowerCase()
  // Strip any accent for the check
  const stripped = removeWrittenAccents(last)
  return isVowel(stripped) || stripped === 'n' || stripped === 's'
}

function syllablesFromEndOfPosition(word: string, index: number): number {
  // Count vowel-group nuclei between `index` and the end of the word.
  // The syllable containing `index` counts as 0 if it is the last, 1 if penult, etc.
  const lower = word.toLowerCase()
  let count = 0
  let inVowelGroup = false
  for (let i = lower.length - 1; i > index; i--) {
    if (isVowel(lower[i])) {
      if (!inVowelGroup) {
        count++
        inVowelGroup = true
      }
    } else {
      inVowelGroup = false
    }
  }
  return count
}

function countSyllables(word: string): number {
  const lower = word.toLowerCase()
  let count = 0
  let inVowelGroup = false
  for (let i = 0; i < lower.length; i++) {
    if (isVowel(lower[i])) {
      if (!inVowelGroup) {
        count++
        inVowelGroup = true
      }
    } else {
      inVowelGroup = false
    }
  }
  return count
}

/**
 * Add a reflexive pronoun to a single conjugated form derived from a
 * non-reflexive base verb (e.g. "mudo" -> "me mudo", "muda" -> "múdate").
 *
 * Caller is responsible for only invoking this on forms that do NOT already
 * have a pronoun attached. For data sourced from a reflexive infinitive
 * (e.g. from the static DB for "quejarse"), the pronouns are already in
 * place and this function should not be applied.
 */
export function addReflexivePronouns(
  form: string,
  person: string,
  tenseId: string
): string {
  if (!form) return form
  const personLower = person.toLowerCase().trim()
  const pronoun = getReflexivePronoun(personLower)

  if (tenseId === 'imperative') {
    return attachCliticToImperative(form, pronoun, personLower)
  }

  return `${pronoun} ${form}`
}

/** True if the first whitespace-separated token is a reflexive pronoun. */
function startsWithReflexivePronoun(form: string): boolean {
  if (!form) return false
  return REFLEXIVE_PRONOUN_WORDS.has(form.split(/\s+/)[0].toLowerCase())
}

/**
 * Strip reflexive pronouns from a conjugated form.
 * Inverse of addReflexivePronouns.
 *
 * For imperative, also undoes the elisions/accent additions caused by
 * clitic attachment so we recover the original verb form:
 *   quejémonos -> quejemos     (re-add lost `-s`, drop accent)
 *   quejaos    -> quejad       (re-add lost `-d`)
 *   vestíos    -> vestid
 *   múdate     -> muda         (drop accent)
 */
export function stripReflexivePronoun(form: string, tenseId: string): string {
  if (!form) return form
  if (tenseId === 'imperative') {
    const lower = form.toLowerCase()
    if (lower.endsWith('monos')) {
      const stripped = form.slice(0, -3) + 's' // drop "nos", re-add "s"
      return removeWrittenAccents(stripped)
    }
    if (lower.endsWith('aos') || lower.endsWith('eos') || lower.endsWith('íos')) {
      const stripped = form.slice(0, -2) + 'd' // drop "os", re-add "d"
      return removeWrittenAccents(stripped)
    }
    for (const suffix of PRONOUN_SUFFIXES) {
      if (lower.endsWith(suffix)) {
        const stripped = form.slice(0, -suffix.length)
        return removeWrittenAccents(stripped)
      }
    }
    return form
  }
  const words = form.split(/\s+/)
  if (words.length >= 2 && REFLEXIVE_PRONOUN_WORDS.has(words[0].toLowerCase())) {
    return words.slice(1).join(' ')
  }
  return form
}

/**
 * Format a conjugated form with the correct reflexive pronoun placement.
 * Only applies to verbs whose infinitive ends in "-se".
 *
 * If the form already has a reflexive pronoun attached (the common case for
 * data sourced from a reflexive infinitive), it is returned unchanged.
 */
export function formatReflexiveForm(
  form: string,
  person: string,
  infinitive: string,
  tenseId: string
): string {
  if (!isReflexiveVerb(infinitive) || !form) return form
  if (tenseId === 'imperative') {
    // If any reflexive suffix is present, assume the pronoun is already
    // attached. This is loose but works for our generated data.
    if (PRONOUN_SUFFIXES.some((p) => form.toLowerCase().endsWith(p))) return form
  } else if (startsWithReflexivePronoun(form)) {
    return form
  }
  return addReflexivePronouns(form, person, tenseId)
}

/**
 * Synthesize a reflexive VerbData by adding reflexive pronouns to each form
 * of a non-reflexive base VerbData. Used as a fallback when only the base
 * verb is in the static conjugation database (e.g. user looks up "mudarse"
 * but the DB only has "mudar").
 */
export function reflexifyVerbData(base: VerbData): VerbData {
  const reflexiveInfinitive = base.infinitive.endsWith('se')
    ? base.infinitive
    : base.infinitive + 'se'

  const tenses: TenseData[] = base.tenses.map((tense) => ({
    tenseId: tense.tenseId,
    tenseName: tense.tenseName,
    description: tense.description,
    conjugations: tense.conjugations.map((conj) => ({
      person: conj.person,
      form: conj.form
        ? addReflexivePronouns(conj.form, conj.person, tense.tenseId)
        : '',
      miniTranslation: conj.miniTranslation,
    })),
  }))

  return {
    infinitive: reflexiveInfinitive,
    language: base.language,
    tenses,
  }
}

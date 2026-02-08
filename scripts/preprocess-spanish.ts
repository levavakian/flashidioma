/**
 * Preprocessing script for spanish_data.
 * Fetches data from doozan/spanish_data@2026-02-01 and generates
 * a JSON artifact with frequency-ordered word list, translations, POS,
 * and verb conjugation tables.
 *
 * Usage: npx tsx scripts/preprocess-spanish.ts
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { conjugateVerb, type ConjugationTable } from './spanish-conjugator'

const REPO = 'https://github.com/doozan/spanish_data.git'
const TAG = '2026-02-01'
const DATA_DIR = join(process.cwd(), 'spanish_data')
const OUTPUT_DIR = join(process.cwd(), 'src', 'data')
const OUTPUT_FILE = join(OUTPUT_DIR, 'spanish-deck.json')
const CONJUGATION_FILE = join(OUTPUT_DIR, 'spanish-conjugations.json')

interface FrequencyEntry {
  word: string
  pos: string
  count: number
  forms: string[]
}

interface DictionaryEntry {
  word: string
  pos: string
  glosses: string[]
  etymology?: string
}

interface ProcessedCard {
  word: string
  pos: string
  frequency: number
  translation: string
  forms: string[]
}

interface ProcessedDeck {
  id: string
  name: string
  description: string
  language: string
  generatedAt: string
  cards: ProcessedCard[]
}

function fetchData() {
  if (existsSync(DATA_DIR)) {
    console.log('spanish_data directory already exists, skipping clone')
    return
  }
  console.log(`Cloning ${REPO} at tag ${TAG}...`)
  execSync(`git clone --depth 1 --branch ${TAG} ${REPO} ${DATA_DIR}`, {
    stdio: 'inherit',
  })
}

function parseFrequency(): FrequencyEntry[] {
  const content = readFileSync(join(DATA_DIR, 'frequency.csv'), 'utf-8')
  const lines = content.trim().split('\n')
  const entries: FrequencyEntry[] = []

  // Skip header: count,spanish,pos,flags,usage
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    // CSV format: count,word,pos,flags,usage
    // usage format: count:form|count:form|...
    const match = line.match(/^(\d+),([^,]+),([^,]*),([^,]*),(.*)$/)
    if (!match) continue

    const count = parseInt(match[1], 10)
    const word = match[2]
    const pos = match[3]
    const usage = match[5]

    // Parse usage to get word forms
    const forms: string[] = []
    if (usage) {
      const parts = usage.split('|')
      for (const part of parts) {
        const colonIdx = part.indexOf(':')
        if (colonIdx >= 0) {
          forms.push(part.substring(colonIdx + 1))
        }
      }
    }

    // Skip entries without a POS or with flags like NOUSAGE, DUPLICATE
    const flags = match[4]
    if (flags?.includes('NOUSAGE') || flags?.includes('DUPLICATE')) continue
    if (!pos) continue

    entries.push({ word, pos, count, forms: forms.slice(0, 10) })
  }

  return entries
}

function parseDictionary(): Map<string, DictionaryEntry[]> {
  const content = readFileSync(join(DATA_DIR, 'es-en.data'), 'utf-8')
  const blocks = content.split('_____\n').filter(Boolean)
  const dict = new Map<string, DictionaryEntry[]>()

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    const word = lines[0].trim()
    if (!word) continue

    // A single block can contain multiple POS sections.
    // Split on 'pos:' lines to handle each section separately.
    let currentPos = ''
    let currentGlosses: string[] = []
    let currentEtymology: string | undefined

    const flushEntry = () => {
      if (currentPos && currentGlosses.length > 0) {
        const entry: DictionaryEntry = {
          word,
          pos: currentPos,
          glosses: [...currentGlosses],
          etymology: currentEtymology,
        }
        const existing = dict.get(word)
        if (existing) {
          existing.push(entry)
        } else {
          dict.set(word, [entry])
        }
      }
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.startsWith('pos: ')) {
        // Flush previous POS section
        flushEntry()
        currentPos = line.substring(5).trim()
        currentGlosses = []
        currentEtymology = undefined
      } else if (line.startsWith('gloss: ')) {
        currentGlosses.push(line.substring(7).trim())
      } else if (line.startsWith('etymology: ')) {
        currentEtymology = line.substring(11).trim()
      }
    }
    // Flush last section
    flushEntry()
  }

  return dict
}

function posMatch(freqPos: string, dictPos: string): boolean {
  // Map frequency POS to dictionary POS
  const map: Record<string, string[]> = {
    v: ['v', 'verb'],
    n: ['n', 'noun'],
    adj: ['adj', 'adjective'],
    adv: ['adv', 'adverb'],
    prep: ['prep', 'preposition'],
    conj: ['conj', 'conjunction'],
    pron: ['pron', 'pronoun'],
    num: ['num', 'numeral'],
    art: ['art', 'article'],
    interj: ['interj', 'interjection'],
    determiner: ['determiner', 'det'],
  }

  const matchSet = map[freqPos]
  if (!matchSet) return freqPos === dictPos
  return matchSet.includes(dictPos)
}

function main() {
  console.log('Starting Spanish data preprocessing...')

  fetchData()

  console.log('Parsing frequency.csv...')
  const frequency = parseFrequency()
  console.log(`  Found ${frequency.length} frequency entries`)

  console.log('Parsing es-en.data...')
  const dictionary = parseDictionary()
  console.log(`  Found ${dictionary.size} dictionary entries`)

  console.log('Combining data...')
  const cards: ProcessedCard[] = []

  for (const entry of frequency) {
    const dictEntries = dictionary.get(entry.word)
    if (!dictEntries) continue

    // Find a matching POS entry
    const matchingEntry = dictEntries.find((d) => posMatch(entry.pos, d.pos))
    if (!matchingEntry) continue

    // Use the first gloss as translation, clean up wiki markup
    let translation = matchingEntry.glosses[0]
    // Clean common wiki markup patterns
    translation = translation.replace(/\{\{[^}]*\}\}/g, '')
    translation = translation.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    translation = translation.trim()

    if (!translation) continue

    cards.push({
      word: entry.word,
      pos: entry.pos,
      frequency: entry.count,
      translation,
      forms: entry.forms,
    })
  }

  console.log(`  Generated ${cards.length} cards`)

  // Generate verb conjugation tables (compact format)
  console.log('Generating verb conjugation tables...')
  const verbs = cards.filter((c) => c.pos === 'v')

  // Build compact conjugation data:
  // - tenses: shared metadata (name, description, persons)
  // - verbs: { infinitive: [[form, form, ...], ...] } indexed by tense order
  const firstVerb = verbs.length > 0 ? conjugateVerb(verbs[0].word) : null
  const tenseMetadata = firstVerb
    ? firstVerb.tenses.map((t) => ({
        tenseId: t.tenseId,
        tenseName: t.tenseName,
        description: t.description,
        persons: t.conjugations.map((c) => c.person),
      }))
    : []

  const compactVerbs: Record<string, string[][]> = {}
  let conjugated = 0

  for (const verb of verbs) {
    const table = conjugateVerb(verb.word)
    if (table) {
      compactVerbs[verb.word] = table.tenses.map((t) =>
        t.conjugations.map((c) => c.form)
      )
      conjugated++
    }
  }
  console.log(`  Generated conjugation tables for ${conjugated} verbs`)

  const deck: ProcessedDeck = {
    id: 'spanish-frequency',
    name: 'Spanish Frequency (Top Words)',
    description: `Top ${cards.length} most frequent Spanish words with translations from Wiktionary`,
    language: 'spanish',
    generatedAt: new Date().toISOString(),
    cards,
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(deck, null, 2))
  console.log(`Deck output written to ${OUTPUT_FILE}`)

  // Write conjugation data as a separate artifact (compact format)
  const conjugationData = {
    language: 'spanish',
    generatedAt: new Date().toISOString(),
    verbCount: conjugated,
    tenses: tenseMetadata,
    verbs: compactVerbs,
  }
  writeFileSync(CONJUGATION_FILE, JSON.stringify(conjugationData))
  console.log(`Conjugation output written to ${CONJUGATION_FILE}`)
  console.log(`Total cards: ${cards.length}`)
  console.log(`Total verb conjugations: ${conjugated}`)

  // Print some stats
  const posStats = new Map<string, number>()
  for (const card of cards) {
    posStats.set(card.pos, (posStats.get(card.pos) || 0) + 1)
  }
  console.log('POS distribution:')
  for (const [pos, count] of [...posStats.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pos}: ${count}`)
  }
}

main()

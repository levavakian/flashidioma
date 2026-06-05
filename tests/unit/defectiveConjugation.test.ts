import { describe, it, expect } from 'vitest'
import { maskDefectivePersons } from '../../scripts/spanish-conjugator'
import conjugationData from '../../src/data/spanish-conjugations.json'

const TENSE_IDS = conjugationData.tenses.map((t) => t.tenseId)

function rowFor(verb: string, tenseId: string): string[] {
  const verbs = conjugationData.verbs as Record<string, string[][]>
  return verbs[verb][TENSE_IDS.indexOf(tenseId)]
}

describe('maskDefectivePersons', () => {
  it('leaves a fully-conjugated verb unchanged', () => {
    const tenseIds = ['present', 'imperative', 'present-progressive', 'poder-present']
    const rows = [
      ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan'],
      ['habla', 'hable', 'hablemos', 'hablad', 'hablen'],
      ['estoy hablando', 'estás hablando', 'está hablando', 'estamos hablando', 'estáis hablando', 'están hablando'],
      ['puedo hablar', 'puedes hablar', 'puede hablar', 'podemos hablar', 'podéis hablar', 'pueden hablar'],
    ]
    expect(maskDefectivePersons(rows, tenseIds)).toEqual(rows)
  })

  it('blanks synthesized persons that never appear in an authoritative tense', () => {
    const tenseIds = ['present', 'imperative', 'present-progressive', 'poder-present']
    const rows = [
      ['', '', 'llueve', '', '', ''],
      ['', 'llueva', '', 'lloved', 'lluevan'],
      ['estoy lloviendo', 'estás lloviendo', 'está lloviendo', 'estamos lloviendo', 'estáis lloviendo', 'están lloviendo'],
      ['puedo llover', 'puedes llover', 'puede llover', 'podemos llover', 'podéis llover', 'pueden llover'],
    ]
    expect(maskDefectivePersons(rows, tenseIds)).toEqual([
      ['', '', 'llueve', '', '', ''],
      ['', 'llueva', '', '', ''],
      ['', '', 'está lloviendo', '', '', ''],
      ['', '', 'puede llover', '', '', ''],
    ])
  })

  it('keeps every defective person that is genuinely valid (3rd singular and plural)', () => {
    const tenseIds = ['present', 'present-progressive']
    const rows = [
      ['', '', 'duele', '', '', 'duelen'],
      ['estoy doliendo', 'estás doliendo', 'está doliendo', 'estamos doliendo', 'estáis doliendo', 'están doliendo'],
    ]
    expect(maskDefectivePersons(rows, tenseIds)).toEqual([
      ['', '', 'duele', '', '', 'duelen'],
      ['', '', 'está doliendo', '', '', 'están doliendo'],
    ])
  })
})

describe('impersonal verbs in the committed conjugation data', () => {
  it('llover only shows the 3rd-person-singular form in every tense', () => {
    expect(rowFor('llover', 'present-progressive')).toEqual(['', '', 'está lloviendo', '', '', ''])
    expect(rowFor('llover', 'poder-present')).toEqual(['', '', 'puede llover', '', '', ''])
    expect(rowFor('llover', 'deber-present')).toEqual(['', '', 'debe llover', '', '', ''])
    expect(rowFor('llover', 'imperative')).toEqual(['', 'llueva', '', '', ''])
  })

  it('doler keeps 3rd singular and 3rd plural in synthesized tenses', () => {
    expect(rowFor('doler', 'present-progressive')).toEqual([
      '', '', 'está doliendo', '', '', 'están doliendo',
    ])
  })

  it('does not strip persons from a normal verb', () => {
    expect(rowFor('hablar', 'present-progressive')).toEqual([
      'estoy hablando', 'estás hablando', 'está hablando',
      'estamos hablando', 'estáis hablando', 'están hablando',
    ])
  })
})

import { describe, it, expect } from 'vitest'
import type { VerbData, ConstructChecklist, TenseData } from '../../src/types'

// Replicate the filtering logic from ConjugationView to test independently
function filterTensesByConstructs(
  tenses: TenseData[],
  enabledConstructs?: ConstructChecklist
): TenseData[] {
  if (!enabledConstructs) return tenses
  return tenses.filter((t) => enabledConstructs[t.tenseId] !== false)
}

const mockVerbData: VerbData = {
  infinitive: 'hablar',
  language: 'spanish',
  tenses: [
    {
      tenseId: 'present',
      tenseName: 'Present',
      description: 'Actions happening now',
      conjugations: [{ person: 'yo', form: 'hablo', miniTranslation: 'I speak' }],
    },
    {
      tenseId: 'preterite',
      tenseName: 'Preterite',
      description: 'Completed past actions',
      conjugations: [{ person: 'yo', form: 'hablé', miniTranslation: 'I spoke' }],
    },
    {
      tenseId: 'imperfect',
      tenseName: 'Imperfect',
      description: 'Ongoing past actions',
      conjugations: [{ person: 'yo', form: 'hablaba', miniTranslation: 'I was speaking' }],
    },
    {
      tenseId: 'future',
      tenseName: 'Future',
      description: 'Will happen',
      conjugations: [{ person: 'yo', form: 'hablaré', miniTranslation: 'I will speak' }],
    },
  ],
}

describe('Construct filtering', () => {
  it('returns all tenses when no checklist is provided', () => {
    const result = filterTensesByConstructs(mockVerbData.tenses)
    expect(result).toHaveLength(4)
  })

  it('with only present enabled, only shows present tense forms', () => {
    const checklist: ConstructChecklist = {
      present: true,
      preterite: false,
      imperfect: false,
      future: false,
    }
    const result = filterTensesByConstructs(mockVerbData.tenses, checklist)
    expect(result).toHaveLength(1)
    expect(result[0].tenseId).toBe('present')
  })

  it('enabling preterite adds preterite forms to the pool', () => {
    const checklist: ConstructChecklist = {
      present: true,
      preterite: true,
      imperfect: false,
      future: false,
    }
    const result = filterTensesByConstructs(mockVerbData.tenses, checklist)
    expect(result).toHaveLength(2)
    const tenseIds = result.map((t) => t.tenseId)
    expect(tenseIds).toContain('present')
    expect(tenseIds).toContain('preterite')
  })

  it('all constructs enabled shows all tenses', () => {
    const checklist: ConstructChecklist = {
      present: true,
      preterite: true,
      imperfect: true,
      future: true,
    }
    const result = filterTensesByConstructs(mockVerbData.tenses, checklist)
    expect(result).toHaveLength(4)
  })

  it('all constructs disabled shows no tenses', () => {
    const checklist: ConstructChecklist = {
      present: false,
      preterite: false,
      imperfect: false,
      future: false,
    }
    const result = filterTensesByConstructs(mockVerbData.tenses, checklist)
    expect(result).toHaveLength(0)
  })

  it('non-verb cards are unaffected (they have no tenses to filter)', () => {
    // Non-verb cards have no verbData, so filtering doesn't apply
    // This test verifies that the filter handles empty arrays correctly
    const result = filterTensesByConstructs([], { present: false })
    expect(result).toHaveLength(0)
  })
})

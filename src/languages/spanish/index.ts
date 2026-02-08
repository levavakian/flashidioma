import type { LanguageModule, ConstructDefinition } from '../../types'

const spanishConstructs: ConstructDefinition[] = [
  // Indicative tenses
  {
    id: 'present',
    name: 'Present',
    category: 'tense',
    description: 'Actions happening now, habitual actions, general truths',
  },
  {
    id: 'preterite',
    name: 'Preterite',
    category: 'tense',
    description: 'Completed past actions with a definite endpoint',
  },
  {
    id: 'imperfect',
    name: 'Imperfect',
    category: 'tense',
    description: 'Ongoing, habitual, or background past actions',
  },
  {
    id: 'future',
    name: 'Future',
    category: 'tense',
    description: 'Actions that will happen, predictions, probability',
  },
  {
    id: 'conditional',
    name: 'Conditional',
    category: 'tense',
    description: 'Hypothetical situations, polite requests, future in the past',
  },
  // Subjunctive
  {
    id: 'present-subjunctive',
    name: 'Present Subjunctive',
    category: 'tense',
    description: 'Wishes, doubts, emotions, impersonal expressions in the present',
  },
  {
    id: 'imperfect-subjunctive',
    name: 'Imperfect Subjunctive',
    category: 'tense',
    description: 'Hypothetical or contrary-to-fact situations in the past',
  },
  // Imperative
  {
    id: 'imperative',
    name: 'Imperative',
    category: 'mood',
    description: 'Commands and instructions',
  },
  // Compound tenses
  {
    id: 'present-perfect',
    name: 'Present Perfect',
    category: 'tense',
    description: 'Actions completed recently or with present relevance (he comido)',
  },
  {
    id: 'pluperfect',
    name: 'Pluperfect',
    category: 'tense',
    description: 'Actions completed before another past action (había comido)',
  },
  {
    id: 'future-perfect',
    name: 'Future Perfect',
    category: 'tense',
    description: 'Actions that will be completed before a future point (habré comido)',
  },
  {
    id: 'conditional-perfect',
    name: 'Conditional Perfect',
    category: 'tense',
    description: 'Hypothetical completed actions (habría comido)',
  },
]

const spanishPersons = [
  'yo',
  'tú',
  'él/ella/usted',
  'nosotros/as',
  'vosotros/as',
  'ellos/ellas/ustedes',
]

export const spanishLanguageModule: LanguageModule = {
  id: 'spanish',
  name: 'Spanish',
  constructs: spanishConstructs,
  persons: spanishPersons,
}

export function getDefaultSpanishChecklist(): Record<string, boolean> {
  const checklist: Record<string, boolean> = {}
  for (const construct of spanishConstructs) {
    // Only present tense enabled by default
    checklist[construct.id] = construct.id === 'present'
  }
  return checklist
}

import { Conjugator as LibraryConjugator, type Result as LibraryResult } from '@jirimracek/conjugate-esp'

/**
 * Spanish verb conjugation engine.
 * Uses a model-based conjugator for broad irregular coverage and
 * falls back to legacy regular rules only if the library cannot resolve a verb.
 */

export interface ConjugationTable {
  infinitive: string
  tenses: TenseTable[]
}

export interface TenseTable {
  tenseId: string
  tenseName: string
  description: string
  conjugations: { person: string; form: string }[]
}

const PERSONS = [
  'yo',
  'tú',
  'él/ella/usted',
  'nosotros/as',
  'vosotros/as',
  'ellos/ellas/ustedes',
]

const IMPERATIVE_PERSONS = [
  'tú',
  'usted',
  'nosotros/as',
  'vosotros/as',
  'ustedes',
]

const TENSE_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  present: {
    name: 'Present',
    description: 'Actions happening now, habitual actions, general truths',
  },
  preterite: {
    name: 'Preterite',
    description: 'Completed past actions with a definite endpoint',
  },
  imperfect: {
    name: 'Imperfect',
    description: 'Ongoing, habitual, or background past actions',
  },
  future: {
    name: 'Future',
    description: 'Actions that will happen, predictions, probability',
  },
  conditional: {
    name: 'Conditional',
    description: 'Hypothetical situations, polite requests, future in the past',
  },
  'present-subjunctive': {
    name: 'Present Subjunctive',
    description: 'Wishes, doubts, emotions, impersonal expressions in the present',
  },
  'imperfect-subjunctive': {
    name: 'Imperfect Subjunctive',
    description: 'Hypothetical or contrary-to-fact situations in the past',
  },
  imperative: {
    name: 'Imperative',
    description: 'Commands and instructions',
  },
  'present-perfect': {
    name: 'Present Perfect',
    description: 'Actions completed recently or with present relevance',
  },
  pluperfect: {
    name: 'Pluperfect',
    description: 'Actions completed before another past action',
  },
  'future-perfect': {
    name: 'Future Perfect',
    description: 'Actions that will be completed before a future point',
  },
  'conditional-perfect': {
    name: 'Conditional Perfect',
    description: 'Hypothetical completed actions',
  },
  'present-progressive': {
    name: 'Present Progressive',
    description: 'Actions happening right now (estoy hablando)',
  },
  'preterite-progressive': {
    name: 'Preterite Progressive',
    description: 'Actions that were underway during a bounded stretch of the past (estuve hablando)',
  },
  'imperfect-progressive': {
    name: 'Imperfect Progressive',
    description: 'Ongoing past actions in progress (estaba hablando)',
  },
  'future-progressive': {
    name: 'Future Progressive',
    description: 'Actions that will be in progress (estaré hablando)',
  },
  'poder-present': {
    name: 'Poder + Infinitive',
    description: 'Ability or possibility (puedo hablar)',
  },
  'deber-present': {
    name: 'Deber + Infinitive',
    description: 'Obligation or probability (debo hablar)',
  },
}

const libraryConjugator = new LibraryConjugator()

const REFLEXIVE_PRONOUNS = ['me', 'te', 'se', 'nos', 'os', 'se']

function normalizeLibraryForm(form: string): string {
  return form === '-' ? '' : form
}

function normalizeLibraryForms(forms: string[]): string[] {
  return forms.map(normalizeLibraryForm)
}

function isReflexiveInfinitive(infinitive: string): boolean {
  return infinitive.endsWith('se') && infinitive.length > 2
}

function getPrimaryLibraryResult(infinitive: string): LibraryResult | null {
  const result = libraryConjugator.conjugateSync(infinitive)
  if (typeof result === 'string') return null
  return result.find((entry) => !entry.info.defective) ?? result[0] ?? null
}

function getSyntheticBaseForms(primary: LibraryResult, infinitive: string): {
  baseInfinitive: string
  gerund: string
} {
  if (!isReflexiveInfinitive(infinitive)) {
    return {
      baseInfinitive: infinitive,
      gerund: primary.conjugation.Impersonal.Gerundio,
    }
  }

  const baseInfinitive = infinitive.slice(0, -2)
  const baseResult = getPrimaryLibraryResult(baseInfinitive)

  return {
    baseInfinitive,
    gerund: baseResult?.conjugation.Impersonal.Gerundio ?? primary.conjugation.Impersonal.Gerundio,
  }
}

function makeSyntheticForms(leadForms: string[], tail: string, infinitive: string): string[] {
  if (!isReflexiveInfinitive(infinitive)) {
    return leadForms.map((lead) => `${lead} ${tail}`)
  }

  return leadForms.map((lead, index) => `${REFLEXIVE_PRONOUNS[index]} ${lead} ${tail}`)
}

// Auxiliary forms of "haber" for compound tenses
const HABER = {
  present: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
  imperfect: ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'],
  future: ['habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán'],
  conditional: ['habría', 'habrías', 'habría', 'habríamos', 'habríais', 'habrían'],
}

// Auxiliary forms of "estar" for progressive tenses
const ESTAR = {
  present: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
  preterite: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron'],
  imperfect: ['estaba', 'estabas', 'estaba', 'estábamos', 'estabais', 'estaban'],
  future: ['estaré', 'estarás', 'estará', 'estaremos', 'estaréis', 'estarán'],
}

// Auxiliary forms for modal verb constructs
const PODER_PRESENT = ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden']
const DEBER_PRESENT = ['debo', 'debes', 'debe', 'debemos', 'debéis', 'deben']

type VerbType = 'ar' | 'er' | 'ir'

function getVerbType(infinitive: string): VerbType | null {
  if (infinitive.endsWith('ar')) return 'ar'
  if (infinitive.endsWith('er')) return 'er'
  if (infinitive.endsWith('ir')) return 'ir'
  return null
}

function getStem(infinitive: string): string {
  return infinitive.slice(0, -2)
}

function getParticiple(infinitive: string): string {
  const stem = getStem(infinitive)
  const type = getVerbType(infinitive)
  // Check irregular participles
  const irregular = IRREGULAR_PARTICIPLES[infinitive]
  if (irregular) return irregular
  return type === 'ar' ? stem + 'ado' : stem + 'ido'
}

const IRREGULAR_GERUNDS: Record<string, string> = {
  dormir: 'durmiendo',
  morir: 'muriendo',
  sentir: 'sintiendo',
  preferir: 'prefiriendo',
  pedir: 'pidiendo',
  seguir: 'siguiendo',
  servir: 'sirviendo',
  elegir: 'eligiendo',
  conseguir: 'consiguiendo',
  poder: 'pudiendo',
  venir: 'viniendo',
  decir: 'diciendo',
  ir: 'yendo',
  oír: 'oyendo',
  leer: 'leyendo',
  caer: 'cayendo',
  traer: 'trayendo',
  construir: 'construyendo',
  destruir: 'destruyendo',
  huir: 'huyendo',
  incluir: 'incluyendo',
  contribuir: 'contribuyendo',
  distribuir: 'distribuyendo',
  sustituir: 'sustituyendo',
  influir: 'influyendo',
  concluir: 'concluyendo',
  excluir: 'excluyendo',
  creer: 'creyendo',
  poseer: 'poseyendo',
  proveer: 'proveyendo',
}

function getGerund(infinitive: string): string {
  const irregular = IRREGULAR_GERUNDS[infinitive]
  if (irregular) return irregular
  const type = getVerbType(infinitive)
  const stem = getStem(infinitive)
  if (type === 'ar') return stem + 'ando'
  // -er/-ir: if stem ends in a vowel, use -yendo instead of -iendo
  if (/[aeiouáéíóú]$/.test(stem)) return stem + 'yendo'
  return stem + 'iendo'
}

const IRREGULAR_PARTICIPLES: Record<string, string> = {
  abrir: 'abierto',
  cubrir: 'cubierto',
  decir: 'dicho',
  descubrir: 'descubierto',
  escribir: 'escrito',
  hacer: 'hecho',
  morir: 'muerto',
  poner: 'puesto',
  resolver: 'resuelto',
  romper: 'roto',
  ver: 'visto',
  volver: 'vuelto',
  devolver: 'devuelto',
  envolver: 'envuelto',
  freír: 'frito',
  imprimir: 'impreso',
  satisfacer: 'satisfecho',
  componer: 'compuesto',
  deshacer: 'deshecho',
  disponer: 'dispuesto',
  exponer: 'expuesto',
  imponer: 'impuesto',
  oponer: 'opuesto',
  proponer: 'propuesto',
  suponer: 'supuesto',
  describir: 'descrito',
  inscribir: 'inscrito',
  prescribir: 'prescrito',
  suscribir: 'suscrito',
  contradecir: 'contradicho',
  predecir: 'predicho',
  prever: 'previsto',
  revolver: 'revuelto',
  descomponer: 'descompuesto',
  rehacer: 'rehecho',
  entrevolver: 'entrevuelto',
  sobreponer: 'sobrepuesto',
  anteponer: 'antepuesto',
  reponer: 'repuesto',
}

function conjugateRegularPresent(stem: string, type: VerbType): string[] {
  const endings: Record<VerbType, string[]> = {
    ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
    er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
    ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
  }
  return endings[type].map((e) => stem + e)
}

function conjugateRegularPreterite(stem: string, type: VerbType): string[] {
  const endings: Record<VerbType, string[]> = {
    ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'],
    er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
    ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
  }
  return endings[type].map((e) => stem + e)
}

function conjugateRegularImperfect(stem: string, type: VerbType): string[] {
  const endings: Record<VerbType, string[]> = {
    ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'],
    er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
  }
  return endings[type].map((e) => stem + e)
}

function conjugateRegularFuture(infinitive: string): string[] {
  const endings = ['é', 'ás', 'á', 'emos', 'éis', 'án']
  return endings.map((e) => infinitive + e)
}

function conjugateRegularConditional(infinitive: string): string[] {
  const endings = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían']
  return endings.map((e) => infinitive + e)
}

function conjugateRegularPresentSubjunctive(stem: string, type: VerbType): string[] {
  // -ar verbs use -e endings; -er/-ir verbs use -a endings
  const endings: Record<VerbType, string[]> = {
    ar: ['e', 'es', 'e', 'emos', 'éis', 'en'],
    er: ['a', 'as', 'a', 'amos', 'áis', 'an'],
    ir: ['a', 'as', 'a', 'amos', 'áis', 'an'],
  }
  return endings[type].map((e) => stem + e)
}

function conjugateRegularImperfectSubjunctive(stem: string, type: VerbType): string[] {
  const endings: Record<VerbType, string[]> = {
    ar: ['ara', 'aras', 'ara', 'áramos', 'arais', 'aran'],
    er: ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'],
    ir: ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'],
  }
  return endings[type].map((e) => stem + e)
}

function conjugateRegularImperative(
  stem: string,
  type: VerbType,
  infinitive: string,
  presentSubjunctive: string[]
): string[] {
  // tú: present 3rd singular → stem + a/e/e
  const tuEndings: Record<VerbType, string> = { ar: 'a', er: 'e', ir: 'e' }
  const vosotrosEndings: Record<VerbType, string> = { ar: 'ad', er: 'ed', ir: 'id' }

  return [
    stem + tuEndings[type], // tú
    presentSubjunctive[2], // usted (3rd singular subjunctive)
    presentSubjunctive[3], // nosotros (1st plural subjunctive)
    stem + vosotrosEndings[type], // vosotros
    presentSubjunctive[5], // ustedes (3rd plural subjunctive)
  ]
}

function makeTense(
  tenseId: string,
  forms: string[],
  persons: string[] = PERSONS
): TenseTable {
  const info = TENSE_DESCRIPTIONS[tenseId]
  return {
    tenseId,
    tenseName: info.name,
    description: info.description,
    conjugations: persons.map((person, i) => ({
      person,
      form: forms[i],
    })),
  }
}

function makeCompoundTense(
  tenseId: string,
  auxiliaryForms: string[],
  participle: string
): TenseTable {
  const forms = auxiliaryForms.map((aux) => `${aux} ${participle}`)
  return makeTense(tenseId, forms)
}

function conjugateWithLibrary(infinitive: string): ConjugationTable | null {
  const primary = getPrimaryLibraryResult(infinitive)
  if (!primary) return null

  const { conjugation } = primary
  const { baseInfinitive, gerund } = getSyntheticBaseForms(primary, infinitive)

  return {
    infinitive,
    tenses: [
      makeTense('present', normalizeLibraryForms(conjugation.Indicativo.Presente)),
      makeTense('preterite', normalizeLibraryForms(conjugation.Indicativo.PreteritoIndefinido)),
      makeTense('imperfect', normalizeLibraryForms(conjugation.Indicativo.PreteritoImperfecto)),
      makeTense('future', normalizeLibraryForms(conjugation.Indicativo.FuturoImperfecto)),
      makeTense('conditional', normalizeLibraryForms(conjugation.Indicativo.CondicionalSimple)),
      makeTense('present-subjunctive', normalizeLibraryForms(conjugation.Subjuntivo.Presente)),
      makeTense(
        'imperfect-subjunctive',
        normalizeLibraryForms(conjugation.Subjuntivo.PreteritoImperfectoRa)
      ),
      makeTense(
        'imperative',
        normalizeLibraryForms(conjugation.Imperativo.Afirmativo.slice(1)),
        IMPERATIVE_PERSONS
      ),
      makeTense('present-perfect', normalizeLibraryForms(conjugation.Indicativo.PreteritoPerfecto)),
      makeTense(
        'pluperfect',
        normalizeLibraryForms(conjugation.Indicativo.PreteritoPluscuamperfecto)
      ),
      makeTense('future-perfect', normalizeLibraryForms(conjugation.Indicativo.FuturoPerfecto)),
      makeTense(
        'conditional-perfect',
        normalizeLibraryForms(conjugation.Indicativo.CondicionalCompuesto)
      ),
      makeTense('present-progressive', makeSyntheticForms(ESTAR.present, gerund, infinitive)),
      makeTense('preterite-progressive', makeSyntheticForms(ESTAR.preterite, gerund, infinitive)),
      makeTense('imperfect-progressive', makeSyntheticForms(ESTAR.imperfect, gerund, infinitive)),
      makeTense('future-progressive', makeSyntheticForms(ESTAR.future, gerund, infinitive)),
      makeTense('poder-present', makeSyntheticForms(PODER_PRESENT, baseInfinitive, infinitive)),
      makeTense('deber-present', makeSyntheticForms(DEBER_PRESENT, baseInfinitive, infinitive)),
    ],
  }
}

function conjugateRegular(infinitive: string): ConjugationTable {
  const type = getVerbType(infinitive)!
  const stem = getStem(infinitive)
  const participle = getParticiple(infinitive)
  const gerund = getGerund(infinitive)

  const present = conjugateRegularPresent(stem, type)
  const preterite = conjugateRegularPreterite(stem, type)
  const imperfect = conjugateRegularImperfect(stem, type)
  const future = conjugateRegularFuture(infinitive)
  const conditional = conjugateRegularConditional(infinitive)
  const presentSubjunctive = conjugateRegularPresentSubjunctive(stem, type)
  const imperfectSubjunctive = conjugateRegularImperfectSubjunctive(stem, type)
  const imperative = conjugateRegularImperative(stem, type, infinitive, presentSubjunctive)

  return {
    infinitive,
    tenses: [
      makeTense('present', present),
      makeTense('preterite', preterite),
      makeTense('imperfect', imperfect),
      makeTense('future', future),
      makeTense('conditional', conditional),
      makeTense('present-subjunctive', presentSubjunctive),
      makeTense('imperfect-subjunctive', imperfectSubjunctive),
      makeTense('imperative', imperative, IMPERATIVE_PERSONS),
      makeCompoundTense('present-perfect', HABER.present, participle),
      makeCompoundTense('pluperfect', HABER.imperfect, participle),
      makeCompoundTense('future-perfect', HABER.future, participle),
      makeCompoundTense('conditional-perfect', HABER.conditional, participle),
      makeTense('present-progressive', ESTAR.present.map(e => `${e} ${gerund}`)),
      makeTense('preterite-progressive', ESTAR.preterite.map(e => `${e} ${gerund}`)),
      makeTense('imperfect-progressive', ESTAR.imperfect.map(e => `${e} ${gerund}`)),
      makeTense('future-progressive', ESTAR.future.map(e => `${e} ${gerund}`)),
      makeTense('poder-present', PODER_PRESENT.map(p => `${p} ${infinitive}`)),
      makeTense('deber-present', DEBER_PRESENT.map(d => `${d} ${infinitive}`)),
    ],
  }
}

// Note: The Jehle Spanish Verbs database is still the primary build-time source
// (see preprocess-spanish.ts). This generator fills gaps for verbs Jehle does not
// cover, using a model-based conjugator first and the legacy regular rules last.

/**
 * Conjugate a Spanish verb for preprocessing fallback use.
 */
export function conjugateVerb(infinitive: string): ConjugationTable | null {
  const libraryTable = conjugateWithLibrary(infinitive)
  if (libraryTable) return libraryTable

  const type = getVerbType(infinitive)
  if (!type) return null

  return conjugateRegular(infinitive)
}

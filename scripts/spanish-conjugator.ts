/**
 * Rule-based Spanish verb conjugation engine.
 * Generates conjugation tables for regular -ar/-er/-ir verbs
 * and includes hardcoded data for common irregular verbs.
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
  'imperfect-progressive': {
    name: 'Imperfect Progressive',
    description: 'Ongoing past actions in progress (estaba hablando)',
  },
  'poder-present': {
    name: 'Poder + Infinitive',
    description: 'Ability or possibility (puedo hablar)',
  },
  'deber-present': {
    name: 'Deber + Infinitive',
    description: 'Obligation or probability (debo hablar)',
  },
  'future-progressive': {
    name: 'Future Progressive',
    description: 'Actions that will be in progress (estaré hablando)',
  },
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
      makeTense('imperfect-progressive', ESTAR.imperfect.map(e => `${e} ${gerund}`)),
      makeTense('poder-present', PODER_PRESENT.map(p => `${p} ${infinitive}`)),
      makeTense('deber-present', DEBER_PRESENT.map(d => `${d} ${infinitive}`)),
      makeTense('future-progressive', ESTAR.future.map(e => `${e} ${gerund}`)),
    ],
  }
}

// ---- Irregular verb data ----
// Full conjugation overrides for the most common irregular verbs.

interface IrregularOverrides {
  present?: string[]
  preterite?: string[]
  imperfect?: string[]
  futureStem?: string // irregular stem for future/conditional
  presentSubjunctive?: string[]
  imperfectSubjunctive?: string[]
  imperative?: string[] // [tú, usted, nosotros, vosotros, ustedes]
  participle?: string
}

const IRREGULAR_VERBS: Record<string, IrregularOverrides> = {
  ser: {
    present: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
    preterite: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    imperfect: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
    presentSubjunctive: ['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'],
    imperfectSubjunctive: ['fuera', 'fueras', 'fuera', 'fuéramos', 'fuerais', 'fueran'],
    imperative: ['sé', 'sea', 'seamos', 'sed', 'sean'],
    participle: 'sido',
  },
  estar: {
    present: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
    preterite: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron'],
    presentSubjunctive: ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'],
    imperfectSubjunctive: ['estuviera', 'estuvieras', 'estuviera', 'estuviéramos', 'estuvierais', 'estuvieran'],
    imperative: ['está', 'esté', 'estemos', 'estad', 'estén'],
    participle: 'estado',
  },
  haber: {
    present: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
    preterite: ['hube', 'hubiste', 'hubo', 'hubimos', 'hubisteis', 'hubieron'],
    futureStem: 'habr',
    presentSubjunctive: ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
    imperfectSubjunctive: ['hubiera', 'hubieras', 'hubiera', 'hubiéramos', 'hubierais', 'hubieran'],
    imperative: ['he', 'haya', 'hayamos', 'habed', 'hayan'],
    participle: 'habido',
  },
  tener: {
    present: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'],
    preterite: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'],
    futureStem: 'tendr',
    presentSubjunctive: ['tenga', 'tengas', 'tenga', 'tengamos', 'tengáis', 'tengan'],
    imperfectSubjunctive: ['tuviera', 'tuvieras', 'tuviera', 'tuviéramos', 'tuvierais', 'tuvieran'],
    imperative: ['ten', 'tenga', 'tengamos', 'tened', 'tengan'],
    participle: 'tenido',
  },
  hacer: {
    present: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'],
    preterite: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron'],
    futureStem: 'har',
    presentSubjunctive: ['haga', 'hagas', 'haga', 'hagamos', 'hagáis', 'hagan'],
    imperfectSubjunctive: ['hiciera', 'hicieras', 'hiciera', 'hiciéramos', 'hicierais', 'hicieran'],
    imperative: ['haz', 'haga', 'hagamos', 'haced', 'hagan'],
    participle: 'hecho',
  },
  ir: {
    present: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
    preterite: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    imperfect: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
    presentSubjunctive: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'],
    imperfectSubjunctive: ['fuera', 'fueras', 'fuera', 'fuéramos', 'fuerais', 'fueran'],
    imperative: ['ve', 'vaya', 'vayamos', 'id', 'vayan'],
    participle: 'ido',
  },
  poder: {
    present: ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'],
    preterite: ['pude', 'pudiste', 'pudo', 'pudimos', 'pudisteis', 'pudieron'],
    futureStem: 'podr',
    presentSubjunctive: ['pueda', 'puedas', 'pueda', 'podamos', 'podáis', 'puedan'],
    imperfectSubjunctive: ['pudiera', 'pudieras', 'pudiera', 'pudiéramos', 'pudierais', 'pudieran'],
    participle: 'podido',
  },
  decir: {
    present: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'],
    preterite: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron'],
    futureStem: 'dir',
    presentSubjunctive: ['diga', 'digas', 'diga', 'digamos', 'digáis', 'digan'],
    imperfectSubjunctive: ['dijera', 'dijeras', 'dijera', 'dijéramos', 'dijerais', 'dijeran'],
    imperative: ['di', 'diga', 'digamos', 'decid', 'digan'],
    participle: 'dicho',
  },
  querer: {
    present: ['quiero', 'quieres', 'quiere', 'queremos', 'queréis', 'quieren'],
    preterite: ['quise', 'quisiste', 'quiso', 'quisimos', 'quisisteis', 'quisieron'],
    futureStem: 'querr',
    presentSubjunctive: ['quiera', 'quieras', 'quiera', 'queramos', 'queráis', 'quieran'],
    imperfectSubjunctive: ['quisiera', 'quisieras', 'quisiera', 'quisiéramos', 'quisierais', 'quisieran'],
    imperative: ['quiere', 'quiera', 'queramos', 'quered', 'quieran'],
    participle: 'querido',
  },
  venir: {
    present: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'],
    preterite: ['vine', 'viniste', 'vino', 'vinimos', 'vinisteis', 'vinieron'],
    futureStem: 'vendr',
    presentSubjunctive: ['venga', 'vengas', 'venga', 'vengamos', 'vengáis', 'vengan'],
    imperfectSubjunctive: ['viniera', 'vinieras', 'viniera', 'viniéramos', 'vinierais', 'vinieran'],
    imperative: ['ven', 'venga', 'vengamos', 'venid', 'vengan'],
    participle: 'venido',
  },
  dar: {
    present: ['doy', 'das', 'da', 'damos', 'dais', 'dan'],
    preterite: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'],
    presentSubjunctive: ['dé', 'des', 'dé', 'demos', 'deis', 'den'],
    imperfectSubjunctive: ['diera', 'dieras', 'diera', 'diéramos', 'dierais', 'dieran'],
    imperative: ['da', 'dé', 'demos', 'dad', 'den'],
    participle: 'dado',
  },
  saber: {
    present: ['sé', 'sabes', 'sabe', 'sabemos', 'sabéis', 'saben'],
    preterite: ['supe', 'supiste', 'supo', 'supimos', 'supisteis', 'supieron'],
    futureStem: 'sabr',
    presentSubjunctive: ['sepa', 'sepas', 'sepa', 'sepamos', 'sepáis', 'sepan'],
    imperfectSubjunctive: ['supiera', 'supieras', 'supiera', 'supiéramos', 'supierais', 'supieran'],
    imperative: ['sabe', 'sepa', 'sepamos', 'sabed', 'sepan'],
    participle: 'sabido',
  },
  poner: {
    present: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'],
    preterite: ['puse', 'pusiste', 'puso', 'pusimos', 'pusisteis', 'pusieron'],
    futureStem: 'pondr',
    presentSubjunctive: ['ponga', 'pongas', 'ponga', 'pongamos', 'pongáis', 'pongan'],
    imperfectSubjunctive: ['pusiera', 'pusieras', 'pusiera', 'pusiéramos', 'pusierais', 'pusieran'],
    imperative: ['pon', 'ponga', 'pongamos', 'poned', 'pongan'],
    participle: 'puesto',
  },
  salir: {
    present: ['salgo', 'sales', 'sale', 'salimos', 'salís', 'salen'],
    futureStem: 'saldr',
    presentSubjunctive: ['salga', 'salgas', 'salga', 'salgamos', 'salgáis', 'salgan'],
    imperative: ['sal', 'salga', 'salgamos', 'salid', 'salgan'],
    participle: 'salido',
  },
  ver: {
    present: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
    preterite: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'],
    imperfect: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
    presentSubjunctive: ['vea', 'veas', 'vea', 'veamos', 'veáis', 'vean'],
    imperfectSubjunctive: ['viera', 'vieras', 'viera', 'viéramos', 'vierais', 'vieran'],
    imperative: ['ve', 'vea', 'veamos', 'ved', 'vean'],
    participle: 'visto',
  },
  conocer: {
    present: ['conozco', 'conoces', 'conoce', 'conocemos', 'conocéis', 'conocen'],
    presentSubjunctive: ['conozca', 'conozcas', 'conozca', 'conozcamos', 'conozcáis', 'conozcan'],
    participle: 'conocido',
  },
  sentir: {
    present: ['siento', 'sientes', 'siente', 'sentimos', 'sentís', 'sienten'],
    preterite: ['sentí', 'sentiste', 'sintió', 'sentimos', 'sentisteis', 'sintieron'],
    presentSubjunctive: ['sienta', 'sientas', 'sienta', 'sintamos', 'sintáis', 'sientan'],
    imperfectSubjunctive: ['sintiera', 'sintieras', 'sintiera', 'sintiéramos', 'sintierais', 'sintieran'],
    imperative: ['siente', 'sienta', 'sintamos', 'sentid', 'sientan'],
    participle: 'sentido',
  },
  dormir: {
    present: ['duermo', 'duermes', 'duerme', 'dormimos', 'dormís', 'duermen'],
    preterite: ['dormí', 'dormiste', 'durmió', 'dormimos', 'dormisteis', 'durmieron'],
    presentSubjunctive: ['duerma', 'duermas', 'duerma', 'durmamos', 'durmáis', 'duerman'],
    imperfectSubjunctive: ['durmiera', 'durmieras', 'durmiera', 'durmiéramos', 'durmierais', 'durmieran'],
    imperative: ['duerme', 'duerma', 'durmamos', 'dormid', 'duerman'],
    participle: 'dormido',
  },
  pedir: {
    present: ['pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden'],
    preterite: ['pedí', 'pediste', 'pidió', 'pedimos', 'pedisteis', 'pidieron'],
    presentSubjunctive: ['pida', 'pidas', 'pida', 'pidamos', 'pidáis', 'pidan'],
    imperfectSubjunctive: ['pidiera', 'pidieras', 'pidiera', 'pidiéramos', 'pidierais', 'pidieran'],
    imperative: ['pide', 'pida', 'pidamos', 'pedid', 'pidan'],
    participle: 'pedido',
  },
  pensar: {
    present: ['pienso', 'piensas', 'piensa', 'pensamos', 'pensáis', 'piensan'],
    presentSubjunctive: ['piense', 'pienses', 'piense', 'pensemos', 'penséis', 'piensen'],
    imperative: ['piensa', 'piense', 'pensemos', 'pensad', 'piensen'],
    participle: 'pensado',
  },
  volver: {
    present: ['vuelvo', 'vuelves', 'vuelve', 'volvemos', 'volvéis', 'vuelven'],
    presentSubjunctive: ['vuelva', 'vuelvas', 'vuelva', 'volvamos', 'volváis', 'vuelvan'],
    imperative: ['vuelve', 'vuelva', 'volvamos', 'volved', 'vuelvan'],
    participle: 'vuelto',
  },
  seguir: {
    present: ['sigo', 'sigues', 'sigue', 'seguimos', 'seguís', 'siguen'],
    preterite: ['seguí', 'seguiste', 'siguió', 'seguimos', 'seguisteis', 'siguieron'],
    presentSubjunctive: ['siga', 'sigas', 'siga', 'sigamos', 'sigáis', 'sigan'],
    imperfectSubjunctive: ['siguiera', 'siguieras', 'siguiera', 'siguiéramos', 'siguierais', 'siguieran'],
    imperative: ['sigue', 'siga', 'sigamos', 'seguid', 'sigan'],
    participle: 'seguido',
  },
  encontrar: {
    present: ['encuentro', 'encuentras', 'encuentra', 'encontramos', 'encontráis', 'encuentran'],
    presentSubjunctive: ['encuentre', 'encuentres', 'encuentre', 'encontremos', 'encontréis', 'encuentren'],
    imperative: ['encuentra', 'encuentre', 'encontremos', 'encontrad', 'encuentren'],
    participle: 'encontrado',
  },
  traer: {
    present: ['traigo', 'traes', 'trae', 'traemos', 'traéis', 'traen'],
    preterite: ['traje', 'trajiste', 'trajo', 'trajimos', 'trajisteis', 'trajeron'],
    presentSubjunctive: ['traiga', 'traigas', 'traiga', 'traigamos', 'traigáis', 'traigan'],
    imperfectSubjunctive: ['trajera', 'trajeras', 'trajera', 'trajéramos', 'trajerais', 'trajeran'],
    imperative: ['trae', 'traiga', 'traigamos', 'traed', 'traigan'],
    participle: 'traído',
  },
  caer: {
    present: ['caigo', 'caes', 'cae', 'caemos', 'caéis', 'caen'],
    preterite: ['caí', 'caíste', 'cayó', 'caímos', 'caísteis', 'cayeron'],
    presentSubjunctive: ['caiga', 'caigas', 'caiga', 'caigamos', 'caigáis', 'caigan'],
    imperfectSubjunctive: ['cayera', 'cayeras', 'cayera', 'cayéramos', 'cayerais', 'cayeran'],
    imperative: ['cae', 'caiga', 'caigamos', 'caed', 'caigan'],
    participle: 'caído',
  },
  oír: {
    present: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'],
    preterite: ['oí', 'oíste', 'oyó', 'oímos', 'oísteis', 'oyeron'],
    presentSubjunctive: ['oiga', 'oigas', 'oiga', 'oigamos', 'oigáis', 'oigan'],
    imperfectSubjunctive: ['oyera', 'oyeras', 'oyera', 'oyéramos', 'oyerais', 'oyeran'],
    imperative: ['oye', 'oiga', 'oigamos', 'oíd', 'oigan'],
    participle: 'oído',
  },
  conducir: {
    present: ['conduzco', 'conduces', 'conduce', 'conducimos', 'conducís', 'conducen'],
    preterite: ['conduje', 'condujiste', 'condujo', 'condujimos', 'condujisteis', 'condujeron'],
    presentSubjunctive: ['conduzca', 'conduzcas', 'conduzca', 'conduzcamos', 'conduzcáis', 'conduzcan'],
    imperfectSubjunctive: ['condujera', 'condujeras', 'condujera', 'condujéramos', 'condujerais', 'condujeran'],
    imperative: ['conduce', 'conduzca', 'conduzcamos', 'conducid', 'conduzcan'],
    participle: 'conducido',
  },
  contar: {
    present: ['cuento', 'cuentas', 'cuenta', 'contamos', 'contáis', 'cuentan'],
    presentSubjunctive: ['cuente', 'cuentes', 'cuente', 'contemos', 'contéis', 'cuenten'],
    imperative: ['cuenta', 'cuente', 'contemos', 'contad', 'cuenten'],
    participle: 'contado',
  },
  empezar: {
    present: ['empiezo', 'empiezas', 'empieza', 'empezamos', 'empezáis', 'empiezan'],
    preterite: ['empecé', 'empezaste', 'empezó', 'empezamos', 'empezasteis', 'empezaron'],
    presentSubjunctive: ['empiece', 'empieces', 'empiece', 'empecemos', 'empecéis', 'empiecen'],
    imperative: ['empieza', 'empiece', 'empecemos', 'empezad', 'empiecen'],
    participle: 'empezado',
  },
  morir: {
    present: ['muero', 'mueres', 'muere', 'morimos', 'morís', 'mueren'],
    preterite: ['morí', 'moriste', 'murió', 'morimos', 'moristeis', 'murieron'],
    presentSubjunctive: ['muera', 'mueras', 'muera', 'muramos', 'muráis', 'mueran'],
    imperfectSubjunctive: ['muriera', 'murieras', 'muriera', 'muriéramos', 'murierais', 'murieran'],
    imperative: ['muere', 'muera', 'muramos', 'morid', 'mueran'],
    participle: 'muerto',
  },
  jugar: {
    present: ['juego', 'juegas', 'juega', 'jugamos', 'jugáis', 'juegan'],
    preterite: ['jugué', 'jugaste', 'jugó', 'jugamos', 'jugasteis', 'jugaron'],
    presentSubjunctive: ['juegue', 'juegues', 'juegue', 'juguemos', 'juguéis', 'jueguen'],
    imperative: ['juega', 'juegue', 'juguemos', 'jugad', 'jueguen'],
    participle: 'jugado',
  },
  entender: {
    present: ['entiendo', 'entiendes', 'entiende', 'entendemos', 'entendéis', 'entienden'],
    presentSubjunctive: ['entienda', 'entiendas', 'entienda', 'entendamos', 'entendáis', 'entiendan'],
    imperative: ['entiende', 'entienda', 'entendamos', 'entended', 'entiendan'],
    participle: 'entendido',
  },
  recordar: {
    present: ['recuerdo', 'recuerdas', 'recuerda', 'recordamos', 'recordáis', 'recuerdan'],
    presentSubjunctive: ['recuerde', 'recuerdes', 'recuerde', 'recordemos', 'recordéis', 'recuerden'],
    imperative: ['recuerda', 'recuerde', 'recordemos', 'recordad', 'recuerden'],
    participle: 'recordado',
  },
  perder: {
    present: ['pierdo', 'pierdes', 'pierde', 'perdemos', 'perdéis', 'pierden'],
    presentSubjunctive: ['pierda', 'pierdas', 'pierda', 'perdamos', 'perdáis', 'pierdan'],
    imperative: ['pierde', 'pierda', 'perdamos', 'perded', 'pierdan'],
    participle: 'perdido',
  },
  mover: {
    present: ['muevo', 'mueves', 'mueve', 'movemos', 'movéis', 'mueven'],
    presentSubjunctive: ['mueva', 'muevas', 'mueva', 'movamos', 'mováis', 'muevan'],
    imperative: ['mueve', 'mueva', 'movamos', 'moved', 'muevan'],
    participle: 'movido',
  },
  mostrar: {
    present: ['muestro', 'muestras', 'muestra', 'mostramos', 'mostráis', 'muestran'],
    presentSubjunctive: ['muestre', 'muestres', 'muestre', 'mostremos', 'mostréis', 'muestren'],
    imperative: ['muestra', 'muestre', 'mostremos', 'mostrad', 'muestren'],
    participle: 'mostrado',
  },
  servir: {
    present: ['sirvo', 'sirves', 'sirve', 'servimos', 'servís', 'sirven'],
    preterite: ['serví', 'serviste', 'sirvió', 'servimos', 'servisteis', 'sirvieron'],
    presentSubjunctive: ['sirva', 'sirvas', 'sirva', 'sirvamos', 'sirváis', 'sirvan'],
    imperfectSubjunctive: ['sirviera', 'sirvieras', 'sirviera', 'sirviéramos', 'sirvierais', 'sirvieran'],
    imperative: ['sirve', 'sirva', 'sirvamos', 'servid', 'sirvan'],
    participle: 'servido',
  },
  elegir: {
    present: ['elijo', 'eliges', 'elige', 'elegimos', 'elegís', 'eligen'],
    preterite: ['elegí', 'elegiste', 'eligió', 'elegimos', 'elegisteis', 'eligieron'],
    presentSubjunctive: ['elija', 'elijas', 'elija', 'elijamos', 'elijáis', 'elijan'],
    imperfectSubjunctive: ['eligiera', 'eligieras', 'eligiera', 'eligiéramos', 'eligierais', 'eligieran'],
    imperative: ['elige', 'elija', 'elijamos', 'elegid', 'elijan'],
    participle: 'elegido',
  },
  escribir: {
    participle: 'escrito',
  },
  abrir: {
    participle: 'abierto',
  },
  cubrir: {
    participle: 'cubierto',
  },
  romper: {
    participle: 'roto',
  },
  resolver: {
    present: ['resuelvo', 'resuelves', 'resuelve', 'resolvemos', 'resolvéis', 'resuelven'],
    presentSubjunctive: ['resuelva', 'resuelvas', 'resuelva', 'resolvamos', 'resolváis', 'resuelvan'],
    imperative: ['resuelve', 'resuelva', 'resolvamos', 'resolved', 'resuelvan'],
    participle: 'resuelto',
  },
  producir: {
    present: ['produzco', 'produces', 'produce', 'producimos', 'producís', 'producen'],
    preterite: ['produje', 'produjiste', 'produjo', 'produjimos', 'produjisteis', 'produjeron'],
    presentSubjunctive: ['produzca', 'produzcas', 'produzca', 'produzcamos', 'produzcáis', 'produzcan'],
    imperfectSubjunctive: ['produjera', 'produjeras', 'produjera', 'produjéramos', 'produjerais', 'produjeran'],
    participle: 'producido',
  },
  conseguir: {
    present: ['consigo', 'consigues', 'consigue', 'conseguimos', 'conseguís', 'consiguen'],
    preterite: ['conseguí', 'conseguiste', 'consiguió', 'conseguimos', 'conseguisteis', 'consiguieron'],
    presentSubjunctive: ['consiga', 'consigas', 'consiga', 'consigamos', 'consigáis', 'consigan'],
    imperfectSubjunctive: ['consiguiera', 'consiguieras', 'consiguiera', 'consiguiéramos', 'consiguierais', 'consiguieran'],
    imperative: ['consigue', 'consiga', 'consigamos', 'conseguid', 'consigan'],
    participle: 'conseguido',
  },
  preferir: {
    present: ['prefiero', 'prefieres', 'prefiere', 'preferimos', 'preferís', 'prefieren'],
    preterite: ['preferí', 'preferiste', 'prefirió', 'preferimos', 'preferisteis', 'prefirieron'],
    presentSubjunctive: ['prefiera', 'prefieras', 'prefiera', 'prefiramos', 'prefiráis', 'prefieran'],
    imperfectSubjunctive: ['prefiriera', 'prefirieras', 'prefiriera', 'prefiriéramos', 'prefirierais', 'prefirieran'],
    imperative: ['prefiere', 'prefiera', 'prefiramos', 'preferid', 'prefieran'],
    participle: 'preferido',
  },
  comenzar: {
    present: ['comienzo', 'comienzas', 'comienza', 'comenzamos', 'comenzáis', 'comienzan'],
    preterite: ['comencé', 'comenzaste', 'comenzó', 'comenzamos', 'comenzasteis', 'comenzaron'],
    presentSubjunctive: ['comience', 'comiences', 'comience', 'comencemos', 'comencéis', 'comiencen'],
    imperative: ['comienza', 'comience', 'comencemos', 'comenzad', 'comiencen'],
    participle: 'comenzado',
  },
}

/**
 * Conjugate a Spanish verb, using irregular data if available,
 * falling back to regular conjugation rules.
 */
export function conjugateVerb(infinitive: string): ConjugationTable | null {
  const type = getVerbType(infinitive)
  if (!type) return null

  const stem = getStem(infinitive)
  const overrides = IRREGULAR_VERBS[infinitive]

  // Get participle
  const participle = overrides?.participle
    ?? IRREGULAR_PARTICIPLES[infinitive]
    ?? (type === 'ar' ? stem + 'ado' : stem + 'ido')

  const gerund = getGerund(infinitive)

  // Build each tense, using overrides where available
  const present = overrides?.present ?? conjugateRegularPresent(stem, type)
  const preterite = overrides?.preterite ?? conjugateRegularPreterite(stem, type)
  const imperfect = overrides?.imperfect ?? conjugateRegularImperfect(stem, type)

  const futureStem = overrides?.futureStem
  const future = futureStem
    ? ['é', 'ás', 'á', 'emos', 'éis', 'án'].map((e) => futureStem + e)
    : conjugateRegularFuture(infinitive)
  const conditional = futureStem
    ? ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'].map((e) => futureStem + e)
    : conjugateRegularConditional(infinitive)

  const presentSubjunctive = overrides?.presentSubjunctive
    ?? conjugateRegularPresentSubjunctive(stem, type)
  const imperfectSubjunctive = overrides?.imperfectSubjunctive
    ?? conjugateRegularImperfectSubjunctive(stem, type)

  const imperative = overrides?.imperative
    ?? conjugateRegularImperative(stem, type, infinitive, presentSubjunctive)

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
      makeTense('imperfect-progressive', ESTAR.imperfect.map(e => `${e} ${gerund}`)),
      makeTense('poder-present', PODER_PRESENT.map(p => `${p} ${infinitive}`)),
      makeTense('deber-present', DEBER_PRESENT.map(d => `${d} ${infinitive}`)),
      makeTense('future-progressive', ESTAR.future.map(e => `${e} ${gerund}`)),
    ],
  }
}

/** Check if a verb has hardcoded irregular data */
export function isIrregular(infinitive: string): boolean {
  return infinitive in IRREGULAR_VERBS
}

import type {
  EndingsTable,
  LessonData,
  LessonIrregularGroup,
  LessonIrregularVerb,
} from '../types'

interface CompactConjugationData {
  language: string
  generatedAt: string
  verbCount: number
  tenses: { tenseId: string; tenseName: string; description: string; persons: string[] }[]
  verbs: Record<string, string[][]>
}

type VerbType = 'ar' | 'er' | 'ir'

const PERSONS_FULL = [
  'yo',
  'tú',
  'él/ella/usted',
  'nosotros/as',
  'vosotros/as',
  'ellos/ellas/ustedes',
]

const IMPERATIVE_PERSONS = ['tú', 'usted', 'nosotros/as', 'vosotros/as', 'ustedes']

const REGULAR_ENDINGS: Record<string, Record<VerbType, string[]>> = {
  present: {
    ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
    er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
    ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
  },
  preterite: {
    ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'],
    er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
    ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
  },
  imperfect: {
    ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'],
    er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
  },
  'present-subjunctive': {
    ar: ['e', 'es', 'e', 'emos', 'éis', 'en'],
    er: ['a', 'as', 'a', 'amos', 'áis', 'an'],
    ir: ['a', 'as', 'a', 'amos', 'áis', 'an'],
  },
  'imperfect-subjunctive': {
    ar: ['ara', 'aras', 'ara', 'áramos', 'arais', 'aran'],
    er: ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'],
    ir: ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'],
  },
}

const REGULAR_INFINITIVE_ENDINGS: Record<string, string[]> = {
  future: ['é', 'ás', 'á', 'emos', 'éis', 'án'],
  conditional: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
}

const REGULAR_IMPERATIVE: Record<VerbType, { tu: string; vosotros: string }> = {
  ar: { tu: 'a', vosotros: 'ad' },
  er: { tu: 'e', vosotros: 'ed' },
  ir: { tu: 'e', vosotros: 'id' },
}

/** Alternative ending sets used by irregular verbs (preterite strong/j-stems share the regular -ir endings except for -eron). */
const ALTERNATIVE_ENDINGS: Record<string, string[][]> = {
  preterite: [
    ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'],
    ['e', 'iste', 'o', 'imos', 'isteis', 'eron'],
  ],
  'imperfect-subjunctive': [
    ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
  ],
}

const FORMATION: Record<string, string> = {
  present: 'Drop the infinitive ending and add the present endings to the stem.',
  preterite: 'Drop the infinitive ending and add the preterite endings to the stem.',
  imperfect: 'Drop the infinitive ending and add the imperfect endings to the stem.',
  future: 'Add the future endings to the full infinitive (no stem change).',
  conditional: 'Add the conditional endings to the full infinitive (no stem change).',
  'present-subjunctive':
    'Take the yo form of the present indicative, drop the -o, then add the opposite-vowel endings (-ar verbs use -e endings, -er/-ir verbs use -a endings).',
  'imperfect-subjunctive':
    'Take the ellos form of the preterite, drop -ron, then add the imperfect-subjunctive endings.',
  imperative:
    'Affirmative tú is the same as él/ella present indicative. Affirmative vosotros replaces the -r of the infinitive with -d. The other forms (usted, nosotros, ustedes) are taken from the present subjunctive.',
  'present-perfect':
    'Conjugate haber in the present + the past participle (regular: -ado / -ido).',
  pluperfect: 'Conjugate haber in the imperfect + the past participle (regular: -ado / -ido).',
  'future-perfect': 'Conjugate haber in the future + the past participle (regular: -ado / -ido).',
  'conditional-perfect':
    'Conjugate haber in the conditional + the past participle (regular: -ado / -ido).',
  'present-progressive':
    'Conjugate estar in the present + the gerund (regular: -ar → -ando, -er/-ir → -iendo).',
  'preterite-progressive':
    'Conjugate estar in the preterite + the gerund (regular: -ar → -ando, -er/-ir → -iendo).',
  'imperfect-progressive':
    'Conjugate estar in the imperfect + the gerund (regular: -ar → -ando, -er/-ir → -iendo).',
  'future-progressive':
    'Conjugate estar in the future + the gerund (regular: -ar → -ando, -er/-ir → -iendo).',
  'poder-present':
    'Conjugate poder (puedo, puedes, puede, podemos, podéis, pueden) + the infinitive.',
  'deber-present':
    'Conjugate deber (debo, debes, debe, debemos, debéis, deben) + the infinitive.',
}

const IRREGULAR_RULES: Record<string, string[]> = {
  present: [
    'Stem-changing verbs (e→ie, o→ue, e→i, u→ue) change in all forms except nosotros and vosotros.',
    'Many verbs have an irregular yo form ending in -go (tengo, pongo, salgo, hago) or -zco for -cer/-cir verbs (conozco, traduzco).',
    'Ser, ir, haber, and a few others are fully irregular.',
  ],
  preterite: [
    'A small group of verbs uses a fully irregular stem with the endings -e, -iste, -o, -imos, -isteis, -ieron (no accent on yo / él): tener→tuv-, estar→estuv-, poder→pud-, poner→pus-, saber→sup-, hacer→hic- (hizo).',
    'Verbs whose irregular stem ends in -j use -eron instead of -ieron (decir→dijeron, traer→trajeron, conducir→condujeron).',
    'Ser and ir share the same fully irregular preterite (fui, fuiste, fue, fuimos, fuisteis, fueron).',
    '-ir stem-changing verbs change e→i or o→u in the él/ella and ellos/ellas forms (pedir→pidió/pidieron, dormir→durmió/durmieron).',
  ],
  imperfect: [
    'Only three verbs are irregular in the imperfect: ser (era, eras, era, éramos, erais, eran), ir (iba, ibas, iba, íbamos, ibais, iban), and ver (veía, veías, veía, veíamos, veíais, veían — keeping the e of the stem).',
  ],
  future: [
    'A handful of verbs use a contracted or modified infinitive as the stem, but the endings are always -é, -ás, -á, -emos, -éis, -án.',
    'Common irregular stems: decir→dir-, hacer→har-, poder→podr-, poner→pondr-, querer→querr-, saber→sabr-, salir→saldr-, tener→tendr-, valer→valdr-, venir→vendr-, caber→cabr-, haber→habr-.',
  ],
  conditional: [
    'The conditional uses the same irregular stems as the future, with the endings -ía, -ías, -ía, -íamos, -íais, -ían.',
  ],
  'present-subjunctive': [
    'Most irregular present subjunctives are derived from an irregular yo present (tener→tenga, hacer→haga, conocer→conozca).',
    'Six verbs have a fully irregular present subjunctive stem: dar (dé), estar (esté), haber (haya), ir (vaya), saber (sepa), ser (sea).',
  ],
  'imperfect-subjunctive': [
    'The imperfect subjunctive is built from the ellos preterite stem, so any verb irregular in the preterite is irregular here too (tuvieron → tuviera, dijeron → dijera).',
  ],
  imperative: [
    'A small group of verbs has an irregular tú affirmative: di (decir), haz (hacer), ve (ir), pon (poner), sal (salir), sé (ser), ten (tener), ven (venir).',
    'All other imperative forms use the present subjunctive.',
  ],
  'present-perfect': [
    'The auxiliary haber is irregular (he, has, ha, hemos, habéis, han).',
    'Common irregular past participles: abrir→abierto, decir→dicho, escribir→escrito, hacer→hecho, morir→muerto, poner→puesto, romper→roto, ver→visto, volver→vuelto, cubrir→cubierto, resolver→resuelto.',
  ],
  pluperfect: [
    'Same irregular participles as the present perfect; the auxiliary haber is in the imperfect.',
  ],
  'future-perfect': [
    'Same irregular participles as the present perfect; the auxiliary haber is in the future.',
  ],
  'conditional-perfect': [
    'Same irregular participles as the present perfect; the auxiliary haber is in the conditional.',
  ],
  'present-progressive': [
    'Estar is irregular in the present (estoy, estás, está, estamos, estáis, están).',
    'Some gerunds are irregular: -ir verbs that stem-change in the preterite use the same change (dormir→durmiendo, pedir→pidiendo, sentir→sintiendo, venir→viniendo, decir→diciendo); -er/-ir verbs whose stem ends in a vowel take -yendo instead of -iendo (leer→leyendo, oír→oyendo, traer→trayendo, construir→construyendo); ir → yendo.',
  ],
  'preterite-progressive': [
    'Estar is irregular in the preterite (estuve, estuviste, estuvo, estuvimos, estuvisteis, estuvieron).',
    'Same irregular gerunds as the present progressive.',
  ],
  'imperfect-progressive': [
    'Estar is regular in the imperfect (estaba, estabas, estaba, estábamos, estabais, estaban).',
    'Same irregular gerunds as the present progressive.',
  ],
  'future-progressive': [
    'Estar is regular in the future (estaré, estarás, estará, estaremos, estaréis, estarán).',
    'Same irregular gerunds as the present progressive.',
  ],
  'poder-present': [
    'Poder is the only irregular piece (puedo, puedes, puede, podemos, podéis, pueden); the infinitive that follows never changes.',
  ],
  'deber-present': ['Deber is regular; this construct has no irregular verbs.'],
}

function getVerbType(infinitive: string): VerbType | null {
  if (infinitive.endsWith('ar')) return 'ar'
  if (infinitive.endsWith('er')) return 'er'
  if (infinitive.endsWith('ir')) return 'ir'
  return null
}

function getStem(infinitive: string): string {
  return infinitive.slice(0, -2)
}

function getRegularParticiple(infinitive: string): string {
  const type = getVerbType(infinitive)
  const stem = getStem(infinitive)
  if (type === 'ar') return stem + 'ado'
  return stem + 'ido'
}

function getRegularGerund(infinitive: string): string {
  const type = getVerbType(infinitive)
  const stem = getStem(infinitive)
  if (type === 'ar') return stem + 'ando'
  if (/[aeiouáéíóú]$/.test(stem)) return stem + 'yendo'
  return stem + 'iendo'
}

function isReflexive(infinitive: string): boolean {
  return infinitive.endsWith('se') && infinitive.length > 2
}

function regularSimpleForms(tenseId: string, infinitive: string): string[] | null {
  const type = getVerbType(infinitive)
  if (!type) return null
  const stem = getStem(infinitive)

  if (REGULAR_ENDINGS[tenseId]) {
    return REGULAR_ENDINGS[tenseId][type].map((e) => stem + e)
  }
  if (REGULAR_INFINITIVE_ENDINGS[tenseId]) {
    return REGULAR_INFINITIVE_ENDINGS[tenseId].map((e) => infinitive + e)
  }
  if (tenseId === 'imperative') {
    const presentSubj = REGULAR_ENDINGS['present-subjunctive'][type].map((e) => stem + e)
    const imp = REGULAR_IMPERATIVE[type]
    return [
      stem + imp.tu,
      presentSubj[2],
      presentSubj[3],
      stem + imp.vosotros,
      presentSubj[5],
    ]
  }
  return null
}

/** Pure spelling-rule substitutions that don't represent a real lexical irregularity. */
function isOrthographicOnly(infinitive: string, stems: string[]): boolean {
  const regularStem = getStem(infinitive)
  return stems.every((s) => stemMatchesOrtho(regularStem, s))
}

function stemMatchesOrtho(regular: string, actual: string): boolean {
  if (regular === actual) return true
  if (regular.endsWith('c') && actual === regular.slice(0, -1) + 'qu') return true
  if (regular.endsWith('g') && actual === regular + 'u') return true
  if (regular.endsWith('z') && actual === regular.slice(0, -1) + 'c') return true
  if (regular.endsWith('g') && actual === regular.slice(0, -1) + 'j') return true
  if (regular.endsWith('gu') && actual === regular.slice(0, -1)) return true
  if (regular.endsWith('c') && actual === regular.slice(0, -1) + 'z') return true
  return false
}

interface VerbForms {
  infinitive: string
  type: VerbType
  forms: string[]
  /** Per-person stem (form minus best-fitting ending). */
  stems: string[]
  /** Endings paired with each stem (the ending set chosen by extractStems). */
  endings: string[]
}

/** Choose the ending set whose application yields the cleanest extraction (no stem == raw form). */
function extractStems(
  tenseId: string,
  type: VerbType,
  forms: string[]
): { stems: string[]; endings: string[] } {
  const candidates: string[][] = []
  if (REGULAR_ENDINGS[tenseId]) candidates.push(REGULAR_ENDINGS[tenseId][type])
  if (REGULAR_INFINITIVE_ENDINGS[tenseId]) candidates.push(REGULAR_INFINITIVE_ENDINGS[tenseId])
  if (ALTERNATIVE_ENDINGS[tenseId]) candidates.push(...ALTERNATIVE_ENDINGS[tenseId])

  if (candidates.length === 0) return { stems: forms.slice(), endings: forms.map(() => '') }

  let bestStems = forms.slice()
  let bestEndings = candidates[0]
  let bestScore = Infinity
  for (const endings of candidates) {
    const stems = forms.map((form, i) => {
      const ending = endings[i]
      if (form && ending && form.endsWith(ending)) {
        return form.slice(0, form.length - ending.length)
      }
      return form
    })
    const uncleanCount = stems.filter((s, i) => s === forms[i] && forms[i] !== '').length
    const distinct = new Set(stems).size
    const score = uncleanCount * 1000 + distinct
    if (score < bestScore) {
      bestScore = score
      bestStems = stems
      bestEndings = endings
    }
  }
  return { stems: bestStems, endings: bestEndings }
}

function hasShorterIrregularBase(infinitive: string, pool: Set<string>): boolean {
  for (const other of pool) {
    if (other === infinitive) continue
    if (other.length < 4) continue
    if (other.length >= infinitive.length) continue
    if (infinitive.endsWith(other)) return true
  }
  return false
}

function buildEndingsTables(tenseId: string): EndingsTable[] {
  if (tenseId === 'imperative') {
    return (['ar', 'er', 'ir'] as VerbType[]).map((t) => ({
      verbTypes: [`-${t}`],
      persons: IMPERATIVE_PERSONS,
      endings: [
        REGULAR_IMPERATIVE[t].tu,
        REGULAR_ENDINGS['present-subjunctive'][t][2],
        REGULAR_ENDINGS['present-subjunctive'][t][3],
        REGULAR_IMPERATIVE[t].vosotros,
        REGULAR_ENDINGS['present-subjunctive'][t][5],
      ],
    }))
  }

  if (REGULAR_INFINITIVE_ENDINGS[tenseId]) {
    return [
      {
        verbTypes: ['-ar', '-er', '-ir'],
        persons: PERSONS_FULL,
        endings: REGULAR_INFINITIVE_ENDINGS[tenseId],
      },
    ]
  }

  const set = REGULAR_ENDINGS[tenseId]
  if (!set) return []

  const types: VerbType[] = ['ar', 'er', 'ir']
  const used = new Set<VerbType>()
  const tables: EndingsTable[] = []
  for (const t of types) {
    if (used.has(t)) continue
    const merged: VerbType[] = [t]
    for (const u of types) {
      if (u === t || used.has(u)) continue
      if (set[u].every((e, i) => e === set[t][i])) merged.push(u)
    }
    merged.forEach((m) => used.add(m))
    tables.push({
      verbTypes: merged.map((m) => `-${m}`),
      persons: PERSONS_FULL,
      endings: set[t],
    })
  }
  return tables
}

interface IrregularEntry {
  verb: VerbForms
  /** Hint shown next to the verb name (the unique stem(s) that differ from regular). */
  hint: string
  /** Group key: the ending signature this verb conjugates with. */
  endingSignature: string
}

function detectSimpleTenseIrregulars(
  tenseId: string,
  data: CompactConjugationData,
  tenseIdx: number,
  persons: string[]
): { irregularGroups: LessonIrregularGroup[]; otherIrregulars: LessonIrregularVerb[] } {
  const entries: IrregularEntry[] = []

  // Imperative has its own "irregular" definition: tú affirmative differs from
  // the él/ella present indicative (catches the di/haz/ve/pon/sal/sé/ten/ven
  // shortcuts only). Every other imperative slot is the present subjunctive
  // and is covered by that lesson.
  const presentTenseIdx = data.tenses.findIndex((t) => t.tenseId === 'present')

  for (const [infinitive, allTenseForms] of Object.entries(data.verbs)) {
    if (isReflexive(infinitive)) continue
    const type = getVerbType(infinitive)
    if (!type) continue
    const forms = allTenseForms[tenseIdx]
    if (!forms || forms.length !== persons.length) continue

    let isIrregular: boolean
    if (tenseId === 'imperative') {
      const tu = forms[0]
      const presentForms = allTenseForms[presentTenseIdx]
      const elPresent = presentForms?.[2]
      if (!tu || !elPresent) continue
      isIrregular = tu !== elPresent
    } else {
      const expected = regularSimpleForms(tenseId, infinitive)
      if (!expected) continue
      isIrregular = forms.some((f, i) => f && f !== expected[i])
    }
    if (!isIrregular) continue

    const { stems, endings } = extractStems(tenseId, type, forms)
    if (isOrthographicOnly(infinitive, stems)) continue

    const uniqueStems = Array.from(new Set(stems.filter((s) => s !== '')))
    const hint = tenseId === 'imperative'
      ? `tú ${forms[0]}`
      : uniqueStems.map((s) => `${s}-`).join(' / ')
    entries.push({
      verb: { infinitive, type, forms, stems, endings },
      hint,
      endingSignature: endings.join('|'),
    })
  }

  const allInfinitives = new Set(entries.map((e) => e.verb.infinitive))
  const baseEntries = entries.filter(
    (e) => !hasShorterIrregularBase(e.verb.infinitive, allInfinitives)
  )

  // Group by ending signature. Verbs that conjugate with the regular endings
  // (i.e. only their stem changes) all land in one big "regular endings" group.
  const byEndings = new Map<string, IrregularEntry[]>()
  for (const e of baseEntries) {
    const arr = byEndings.get(e.endingSignature) ?? []
    arr.push(e)
    byEndings.set(e.endingSignature, arr)
  }

  // Identify the regular-endings signature(s) for this tense. Verbs in those
  // groups don't get a labelled "alt endings" group: they go into otherIrregulars
  // (still sorted alphabetically with their stem hint).
  // For the imperative, we never form ending groups: each form is its own
  // irregular shortcut and ending-grouping isn't meaningful.
  const skipGrouping = tenseId === 'imperative'
  const regularSignatures = new Set<string>()
  if (REGULAR_ENDINGS[tenseId]) {
    for (const t of ['ar', 'er', 'ir'] as VerbType[]) {
      regularSignatures.add(REGULAR_ENDINGS[tenseId][t].join('|'))
    }
  }
  if (REGULAR_INFINITIVE_ENDINGS[tenseId]) {
    regularSignatures.add(REGULAR_INFINITIVE_ENDINGS[tenseId].join('|'))
  }

  const groups: LessonIrregularGroup[] = []
  const others: LessonIrregularVerb[] = []
  for (const [sig, es] of byEndings.entries()) {
    if (skipGrouping || regularSignatures.has(sig)) {
      for (const e of es) {
        others.push({ infinitive: e.verb.infinitive, hint: e.hint })
      }
      continue
    }
    const verbs: LessonIrregularVerb[] = es
      .map((e) => ({ infinitive: e.verb.infinitive, hint: e.hint }))
      .sort((a, b) => a.infinitive.localeCompare(b.infinitive))
    const repEndings = es[0].verb.endings
    const label = `Endings: ${repEndings.map((e) => `-${e}`).join(' ')}`
    groups.push({
      id: sig,
      label,
      persons,
      endings: repEndings,
      verbs,
    })
  }

  groups.sort((a, b) => b.verbs.length - a.verbs.length || a.label.localeCompare(b.label))
  others.sort((a, b) => a.infinitive.localeCompare(b.infinitive))
  return { irregularGroups: groups, otherIrregulars: others }
}

interface CompoundDetection {
  irregularGroups: LessonIrregularGroup[]
  otherIrregulars: LessonIrregularVerb[]
}

/** Pull the last whitespace-separated word out of a compound form. */
function compoundTail(form: string): string {
  const parts = form.split(/\s+/)
  if (parts.length < 2) return ''
  return parts[parts.length - 1]
}

function detectCompoundTenseIrregulars(
  data: CompactConjugationData,
  tenseIdx: number,
  persons: string[],
  expectedTail: (infinitive: string) => string,
  hintLabel: string
): CompoundDetection {
  const records: { infinitive: string; tail: string }[] = []
  for (const [infinitive, allTenseForms] of Object.entries(data.verbs)) {
    if (isReflexive(infinitive)) continue
    if (!getVerbType(infinitive)) continue
    const forms = allTenseForms[tenseIdx]
    if (!forms || forms.length !== persons.length) continue
    const tail = compoundTail(forms[0])
    if (!tail) continue
    if (tail === expectedTail(infinitive)) continue
    records.push({ infinitive, tail })
  }

  const allInfinitives = new Set(records.map((r) => r.infinitive))
  const base = records.filter(
    (r) => !hasShorterIrregularBase(r.infinitive, allInfinitives)
  )

  const byTail = new Map<string, string[]>()
  for (const r of base) {
    const arr = byTail.get(r.tail) ?? []
    arr.push(r.infinitive)
    byTail.set(r.tail, arr)
  }

  // For perfect/progressive tenses, every irregular verb has its own unique
  // tail (participle/gerund), so there are no natural multi-verb groups.
  // Just produce a flat list of {verb, hint=tail}.
  const others: LessonIrregularVerb[] = []
  for (const [tail, verbs] of byTail.entries()) {
    for (const v of verbs.sort((a, b) => a.localeCompare(b))) {
      others.push({ infinitive: v, hint: `${hintLabel.toLowerCase()} ${tail}` })
    }
  }
  others.sort((a, b) => a.infinitive.localeCompare(b.infinitive))
  return { irregularGroups: [], otherIrregulars: others }
}

const PERFECT_TENSES = new Set([
  'present-perfect',
  'pluperfect',
  'future-perfect',
  'conditional-perfect',
])

const PROGRESSIVE_TENSES = new Set([
  'present-progressive',
  'preterite-progressive',
  'imperfect-progressive',
  'future-progressive',
])

const MODAL_TENSES = new Set(['poder-present', 'deber-present'])

function buildLessonForTense(data: CompactConjugationData, tenseIdx: number): LessonData {
  const tense = data.tenses[tenseIdx]
  const tenseId = tense.tenseId

  const base = {
    tenseId,
    tenseName: tense.tenseName,
    description: tense.description,
    formationSummary: FORMATION[tenseId] ?? '',
    endingsTables: buildEndingsTables(tenseId),
    irregularRules: IRREGULAR_RULES[tenseId] ?? [],
  }

  if (MODAL_TENSES.has(tenseId)) {
    return { ...base, irregularGroups: [], otherIrregulars: [] }
  }

  if (PERFECT_TENSES.has(tenseId)) {
    const detection = detectCompoundTenseIrregulars(
      data,
      tenseIdx,
      tense.persons,
      getRegularParticiple,
      'Participle'
    )
    return { ...base, ...detection }
  }

  if (PROGRESSIVE_TENSES.has(tenseId)) {
    const detection = detectCompoundTenseIrregulars(
      data,
      tenseIdx,
      tense.persons,
      getRegularGerund,
      'Gerund'
    )
    return { ...base, ...detection }
  }

  const detection = detectSimpleTenseIrregulars(tenseId, data, tenseIdx, tense.persons)
  return { ...base, ...detection }
}

let cachedLessons: LessonData[] | null = null

/** Build all per-tense lessons from the static Spanish conjugation database. Memoised. */
export async function getSpanishLessons(): Promise<LessonData[]> {
  if (cachedLessons) return cachedLessons
  const module = await import('../data/spanish-conjugations.json')
  const data = module.default as CompactConjugationData
  cachedLessons = data.tenses.map((_, idx) => buildLessonForTense(data, idx))
  return cachedLessons
}

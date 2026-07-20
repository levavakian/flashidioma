import type { EndingsTable, LessonData, LessonIrregularCategory } from '../types'

/**
 * Hand-curated Spanish verb lessons for the Verbs > Lessons tab.
 *
 * The goal is not to be exhaustive but to give a learner a clear picture of
 * each tense: how the regular forms are built, what categories of irregularity
 * exist, the rule for each category, and ~10–20 of the most important verbs in
 * each category that span every type of irregularity.
 *
 * Each verb's hint is a short reminder of *why* it's irregular (a stem, a
 * participle, etc.). When several derived verbs share the same irregularity
 * (poner / suponer / componer / proponer / disponer / oponer / imponer), only
 * the base verb is listed; learners can find the derived forms by searching
 * the Browse tab.
 */

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

// Regular ending tables, used both for display and to derive merged tables.
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

  if (tenseId === 'negative-imperative') {
    // "no" + present subjunctive for all five command persons. The endings
    // are the present subjunctive endings (-ar separate, -er/-ir merged).
    const subj = REGULAR_ENDINGS['present-subjunctive']
    const pick = (t: VerbType) => [subj[t][1], subj[t][2], subj[t][3], subj[t][4], subj[t][5]]
    return [
      { verbTypes: ['-ar'], persons: IMPERATIVE_PERSONS, endings: pick('ar') },
      { verbTypes: ['-er', '-ir'], persons: IMPERATIVE_PERSONS, endings: pick('er') },
    ]
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
  'perfect-subjunctive':
    'Conjugate haber in the present subjunctive (haya, hayas, haya, hayamos, hayáis, hayan) + the past participle (regular: -ado / -ido).',
  'pluperfect-subjunctive':
    'Conjugate haber in the imperfect subjunctive (hubiera, hubieras, hubiera, hubiéramos, hubierais, hubieran) + the past participle (regular: -ado / -ido).',
  imperative:
    'Affirmative tú is the same as él/ella present indicative. Affirmative vosotros replaces the -r of the infinitive with -d. The other forms (usted, nosotros, ustedes) are taken from the present subjunctive.',
  'negative-imperative':
    'Place no before the present subjunctive form. All five command persons (tú, usted, nosotros, vosotros, ustedes) use the present subjunctive, so any verb irregular in the present subjunctive is irregular here too. E.g. no hables, no comas, no escribáis.',
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

// =============================================================================
// Curated irregular categories per construct
// =============================================================================

const PRESENT: LessonIrregularCategory[] = [
  {
    id: 'stem-e-ie',
    label: 'Stem-changing e → ie',
    description:
      'The stressed e of the stem becomes ie in all forms except nosotros and vosotros. Tener and venir also appear under "Irregular yo in -go".',
    verbs: [
      { infinitive: 'pensar', hint: 'pienso' },
      { infinitive: 'cerrar', hint: 'cierro' },
      { infinitive: 'empezar', hint: 'empiezo' },
      { infinitive: 'comenzar', hint: 'comienzo' },
      { infinitive: 'recomendar', hint: 'recomiendo' },
      { infinitive: 'despertar', hint: 'despierto' },
      { infinitive: 'entender', hint: 'entiendo' },
      { infinitive: 'perder', hint: 'pierdo' },
      { infinitive: 'querer', hint: 'quiero' },
      { infinitive: 'defender', hint: 'defiendo' },
      { infinitive: 'encender', hint: 'enciendo' },
      { infinitive: 'sentir', hint: 'siento' },
      { infinitive: 'preferir', hint: 'prefiero' },
      { infinitive: 'mentir', hint: 'miento' },
      { infinitive: 'divertir', hint: 'divierto' },
      { infinitive: 'advertir', hint: 'advierto' },
      { infinitive: 'sugerir', hint: 'sugiero' },
    ],
  },
  {
    id: 'stem-o-ue',
    label: 'Stem-changing o → ue',
    description:
      'The stressed o of the stem becomes ue in all forms except nosotros and vosotros.',
    verbs: [
      { infinitive: 'contar', hint: 'cuento' },
      { infinitive: 'encontrar', hint: 'encuentro' },
      { infinitive: 'recordar', hint: 'recuerdo' },
      { infinitive: 'mostrar', hint: 'muestro' },
      { infinitive: 'soñar', hint: 'sueño' },
      { infinitive: 'costar', hint: 'cuesta' },
      { infinitive: 'almorzar', hint: 'almuerzo' },
      { infinitive: 'probar', hint: 'pruebo' },
      { infinitive: 'volver', hint: 'vuelvo' },
      { infinitive: 'mover', hint: 'muevo' },
      { infinitive: 'poder', hint: 'puedo' },
      { infinitive: 'soler', hint: 'suelo' },
      { infinitive: 'resolver', hint: 'resuelvo' },
      { infinitive: 'dormir', hint: 'duermo' },
      { infinitive: 'morir', hint: 'muero' },
    ],
  },
  {
    id: 'stem-e-i',
    label: 'Stem-changing e → i (-ir verbs only)',
    description:
      'The stressed e of the stem becomes i in all forms except nosotros and vosotros. Only happens with -ir verbs.',
    verbs: [
      { infinitive: 'pedir', hint: 'pido' },
      { infinitive: 'servir', hint: 'sirvo' },
      { infinitive: 'repetir', hint: 'repito' },
      { infinitive: 'seguir', hint: 'sigo' },
      { infinitive: 'vestir', hint: 'visto' },
      { infinitive: 'decir', hint: 'digo (also yo→go)' },
      { infinitive: 'elegir', hint: 'elijo' },
      { infinitive: 'medir', hint: 'mido' },
      { infinitive: 'competir', hint: 'compito' },
      { infinitive: 'derretir', hint: 'derrito' },
      { infinitive: 'gemir', hint: 'gimo' },
    ],
  },
  {
    id: 'stem-u-ue',
    label: 'Stem-changing u → ue',
    description: 'Only one common verb has this pattern.',
    verbs: [{ infinitive: 'jugar', hint: 'juego' }],
  },
  {
    id: 'yo-go',
    label: 'Irregular yo in -go',
    description:
      'These verbs have an irregular yo form ending in -go. The other persons follow the regular pattern (sometimes with an additional stem change).',
    verbs: [
      { infinitive: 'tener', hint: 'tengo (also e→ie: tienes)' },
      { infinitive: 'venir', hint: 'vengo (also e→ie: vienes)' },
      { infinitive: 'poner', hint: 'pongo' },
      { infinitive: 'salir', hint: 'salgo' },
      { infinitive: 'valer', hint: 'valgo' },
      { infinitive: 'hacer', hint: 'hago' },
      { infinitive: 'decir', hint: 'digo (also e→i: dices)' },
      { infinitive: 'oír', hint: 'oigo' },
      { infinitive: 'caer', hint: 'caigo' },
      { infinitive: 'traer', hint: 'traigo' },
    ],
  },
  {
    id: 'yo-zco',
    label: 'Irregular yo in -zco (-cer / -cir verbs after a vowel)',
    description:
      '-cer and -cir verbs whose stem ends in a vowel insert a z before the c in the yo form.',
    verbs: [
      { infinitive: 'conocer', hint: 'conozco' },
      { infinitive: 'parecer', hint: 'parezco' },
      { infinitive: 'ofrecer', hint: 'ofrezco' },
      { infinitive: 'agradecer', hint: 'agradezco' },
      { infinitive: 'crecer', hint: 'crezco' },
      { infinitive: 'nacer', hint: 'nazco' },
      { infinitive: 'pertenecer', hint: 'pertenezco' },
      { infinitive: 'permanecer', hint: 'permanezco' },
      { infinitive: 'establecer', hint: 'establezco' },
      { infinitive: 'obedecer', hint: 'obedezco' },
      { infinitive: 'conducir', hint: 'conduzco' },
      { infinitive: 'producir', hint: 'produzco' },
      { infinitive: 'traducir', hint: 'traduzco' },
      { infinitive: 'reducir', hint: 'reduzco' },
      { infinitive: 'introducir', hint: 'introduzco' },
    ],
  },
  {
    id: 'yo-only',
    label: 'Irregular yo only',
    description:
      'These verbs have an irregular yo but otherwise conjugate regularly. The -ger / -gir / -cer-after-consonant verbs are written with j or z to keep the soft sound.',
    verbs: [
      { infinitive: 'saber', hint: 'sé' },
      { infinitive: 'ver', hint: 'veo' },
      { infinitive: 'dar', hint: 'doy' },
      { infinitive: 'caber', hint: 'quepo' },
      { infinitive: 'coger', hint: 'cojo' },
      { infinitive: 'proteger', hint: 'protejo' },
      { infinitive: 'dirigir', hint: 'dirijo' },
      { infinitive: 'exigir', hint: 'exijo' },
      { infinitive: 'vencer', hint: 'venzo' },
    ],
  },
  {
    id: 'fully-irregular',
    label: 'Fully irregular',
    description:
      'These verbs do not follow any pattern and must be memorised. They are also among the most common verbs.',
    verbs: [
      { infinitive: 'ser', hint: 'soy, eres, es, somos, sois, son' },
      { infinitive: 'estar', hint: 'estoy, estás, está, estamos, estáis, están' },
      { infinitive: 'ir', hint: 'voy, vas, va, vamos, vais, van' },
      { infinitive: 'haber', hint: 'he, has, ha, hemos, habéis, han' },
    ],
  },
]

const PRETERITE: LessonIrregularCategory[] = [
  {
    id: 'strong',
    label: 'Strong preterite',
    description:
      'These verbs use a fully irregular stem with a special set of endings (no accent on yo or él/ella). All twelve are listed.',
    altEndings: {
      verbTypes: ['stem +'],
      persons: PERSONS_FULL,
      endings: ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'],
    },
    verbs: [
      { infinitive: 'tener', hint: 'tuv-' },
      { infinitive: 'estar', hint: 'estuv-' },
      { infinitive: 'andar', hint: 'anduv-' },
      { infinitive: 'poder', hint: 'pud-' },
      { infinitive: 'poner', hint: 'pus-' },
      { infinitive: 'saber', hint: 'sup-' },
      { infinitive: 'caber', hint: 'cup-' },
      { infinitive: 'haber', hint: 'hub-' },
      { infinitive: 'querer', hint: 'quis-' },
      { infinitive: 'venir', hint: 'vin-' },
      { infinitive: 'hacer', hint: 'hic- (hizo for él/ella)' },
      { infinitive: 'satisfacer', hint: 'satisfic- (satisfizo for él/ella)' },
    ],
  },
  {
    id: 'j-stem',
    label: 'j-stem preterite',
    description:
      'These verbs use a stem ending in -j and take -eron instead of -ieron in the ellos/ellas form. The -ucir verbs all follow the same conducir pattern.',
    altEndings: {
      verbTypes: ['stem +'],
      persons: PERSONS_FULL,
      endings: ['e', 'iste', 'o', 'imos', 'isteis', 'eron'],
    },
    verbs: [
      { infinitive: 'decir', hint: 'dij-' },
      { infinitive: 'traer', hint: 'traj-' },
      { infinitive: 'conducir', hint: 'conduj-' },
      { infinitive: 'producir', hint: 'produj-' },
      { infinitive: 'traducir', hint: 'traduj-' },
      { infinitive: 'reducir', hint: 'reduj-' },
      { infinitive: 'introducir', hint: 'introduj-' },
      { infinitive: 'deducir', hint: 'deduj-' },
      { infinitive: 'inducir', hint: 'induj-' },
      { infinitive: 'seducir', hint: 'seduj-' },
      { infinitive: 'aducir', hint: 'aduj-' },
    ],
  },
  {
    id: 'ir-stem-change-3rd',
    label: 'Stem change in 3rd person (-ir verbs)',
    description:
      '-ir stem-changing verbs change e → i or o → u, but only in the él/ella and ellos/ellas forms. Same set of verbs as the present-tense e→i and o→ue -ir patterns.',
    verbs: [
      { infinitive: 'pedir', hint: 'pidió, pidieron' },
      { infinitive: 'servir', hint: 'sirvió, sirvieron' },
      { infinitive: 'repetir', hint: 'repitió, repitieron' },
      { infinitive: 'seguir', hint: 'siguió, siguieron' },
      { infinitive: 'vestir', hint: 'vistió, vistieron' },
      { infinitive: 'medir', hint: 'midió, midieron' },
      { infinitive: 'elegir', hint: 'eligió, eligieron' },
      { infinitive: 'competir', hint: 'compitió, compitieron' },
      { infinitive: 'sentir', hint: 'sintió, sintieron' },
      { infinitive: 'mentir', hint: 'mintió, mintieron' },
      { infinitive: 'preferir', hint: 'prefirió, prefirieron' },
      { infinitive: 'sugerir', hint: 'sugirió, sugirieron' },
      { infinitive: 'divertir', hint: 'divirtió, divirtieron' },
      { infinitive: 'advertir', hint: 'advirtió, advirtieron' },
      { infinitive: 'convertir', hint: 'convirtió, convirtieron' },
      { infinitive: 'dormir', hint: 'durmió, durmieron' },
      { infinitive: 'morir', hint: 'murió, murieron' },
    ],
  },
  {
    id: 'i-to-y',
    label: 'i → y in 3rd person',
    description:
      '-er and -ir verbs whose stem ends in a vowel change i → y in the él/ella and ellos/ellas forms (e.g. leyó, leyeron).',
    verbs: [
      { infinitive: 'leer', hint: 'leyó, leyeron' },
      { infinitive: 'creer', hint: 'creyó, creyeron' },
      { infinitive: 'oír', hint: 'oyó, oyeron' },
      { infinitive: 'caer', hint: 'cayó, cayeron' },
      { infinitive: 'construir', hint: 'construyó, construyeron' },
      { infinitive: 'destruir', hint: 'destruyó, destruyeron' },
      { infinitive: 'incluir', hint: 'incluyó, incluyeron' },
      { infinitive: 'concluir', hint: 'concluyó, concluyeron' },
      { infinitive: 'huir', hint: 'huyó, huyeron' },
      { infinitive: 'contribuir', hint: 'contribuyó, contribuyeron' },
      { infinitive: 'distribuir', hint: 'distribuyó, distribuyeron' },
      { infinitive: 'sustituir', hint: 'sustituyó, sustituyeron' },
      { infinitive: 'poseer', hint: 'poseyó, poseyeron' },
      { infinitive: 'proveer', hint: 'proveyó, proveyeron' },
    ],
  },
  {
    id: 'fully-irregular',
    label: 'Fully irregular',
    description:
      'Ser and ir share the same fully irregular preterite. Dar and ver use the regular -er/-ir endings without accents.',
    verbs: [
      { infinitive: 'ser', hint: 'fui, fuiste, fue, fuimos, fuisteis, fueron' },
      { infinitive: 'ir', hint: 'fui, fuiste, fue, fuimos, fuisteis, fueron' },
      { infinitive: 'dar', hint: 'di, diste, dio, dimos, disteis, dieron' },
      { infinitive: 'ver', hint: 'vi, viste, vio, vimos, visteis, vieron' },
    ],
  },
]

const IMPERFECT: LessonIrregularCategory[] = [
  {
    id: 'all',
    label: 'The only three irregular verbs in the imperfect',
    description:
      'The imperfect is the most regular tense in Spanish. Only three verbs are irregular.',
    verbs: [
      { infinitive: 'ser', hint: 'era, eras, era, éramos, erais, eran' },
      { infinitive: 'ir', hint: 'iba, ibas, iba, íbamos, ibais, iban' },
      { infinitive: 'ver', hint: 'veía, veías, veía, veíamos, veíais, veían (keeps the e)' },
    ],
  },
]

const FUTURE_CONDITIONAL: LessonIrregularCategory[] = [
  {
    id: 'irregular-stems',
    label: 'Verbs with an irregular stem',
    description:
      'A handful of verbs use a contracted or modified infinitive as the stem. The endings are always regular. All thirteen are listed.',
    verbs: [
      { infinitive: 'tener', hint: 'tendr- (tendré, tendrías, ...)' },
      { infinitive: 'venir', hint: 'vendr-' },
      { infinitive: 'poner', hint: 'pondr-' },
      { infinitive: 'salir', hint: 'saldr-' },
      { infinitive: 'valer', hint: 'valdr-' },
      { infinitive: 'poder', hint: 'podr-' },
      { infinitive: 'saber', hint: 'sabr-' },
      { infinitive: 'caber', hint: 'cabr-' },
      { infinitive: 'haber', hint: 'habr-' },
      { infinitive: 'querer', hint: 'querr-' },
      { infinitive: 'hacer', hint: 'har-' },
      { infinitive: 'satisfacer', hint: 'satisfar-' },
      { infinitive: 'decir', hint: 'dir-' },
    ],
  },
]

const PRESENT_SUBJUNCTIVE: LessonIrregularCategory[] = [
  {
    id: 'derived-from-yo',
    label: 'Derived from an irregular yo present',
    description:
      'Most irregular present subjunctives are built by taking the yo form of the present indicative, dropping -o, and adding the subjunctive endings. There are ~290 verbs in this group — anything irregular in the present yo (see the Present lesson) is irregular here too. A representative sample is shown.',
    verbs: [
      { infinitive: 'tener', hint: 'tengo → tenga' },
      { infinitive: 'venir', hint: 'vengo → venga' },
      { infinitive: 'poner', hint: 'pongo → ponga' },
      { infinitive: 'hacer', hint: 'hago → haga' },
      { infinitive: 'decir', hint: 'digo → diga' },
      { infinitive: 'salir', hint: 'salgo → salga' },
      { infinitive: 'oír', hint: 'oigo → oiga' },
      { infinitive: 'caer', hint: 'caigo → caiga' },
      { infinitive: 'traer', hint: 'traigo → traiga' },
      { infinitive: 'ver', hint: 'veo → vea' },
      { infinitive: 'conocer', hint: 'conozco → conozca' },
      { infinitive: 'parecer', hint: 'parezco → parezca' },
      { infinitive: 'conducir', hint: 'conduzco → conduzca' },
      { infinitive: 'pensar', hint: 'pienso → piense (with stem change)' },
      { infinitive: 'volver', hint: 'vuelvo → vuelva (with stem change)' },
      { infinitive: 'pedir', hint: 'pido → pida (with stem change)' },
      { infinitive: 'coger', hint: 'cojo → coja' },
      { infinitive: 'dirigir', hint: 'dirijo → dirija' },
    ],
  },
  {
    id: 'fully-irregular',
    label: 'Fully irregular present subjunctive',
    description: 'These six verbs have a fully irregular present subjunctive stem.',
    verbs: [
      { infinitive: 'ser', hint: 'sea' },
      { infinitive: 'estar', hint: 'esté' },
      { infinitive: 'ir', hint: 'vaya' },
      { infinitive: 'haber', hint: 'haya' },
      { infinitive: 'saber', hint: 'sepa' },
      { infinitive: 'dar', hint: 'dé' },
    ],
  },
  {
    id: 'ir-stem-change',
    label: 'Stem change in nosotros/vosotros (-ir verbs)',
    description:
      '-ir stem-changing verbs keep the stem change in nosotros and vosotros (unlike the present indicative). All -ir stem-change verbs are affected; the most common are listed.',
    verbs: [
      { infinitive: 'sentir', hint: 'sintamos, sintáis' },
      { infinitive: 'mentir', hint: 'mintamos, mintáis' },
      { infinitive: 'preferir', hint: 'prefiramos, prefiráis' },
      { infinitive: 'sugerir', hint: 'sugiramos, sugiráis' },
      { infinitive: 'divertir', hint: 'divirtamos, divirtáis' },
      { infinitive: 'advertir', hint: 'advirtamos, advirtáis' },
      { infinitive: 'convertir', hint: 'convirtamos, convirtáis' },
      { infinitive: 'dormir', hint: 'durmamos, durmáis' },
      { infinitive: 'morir', hint: 'muramos, muráis' },
      { infinitive: 'pedir', hint: 'pidamos, pidáis' },
      { infinitive: 'servir', hint: 'sirvamos, sirváis' },
      { infinitive: 'seguir', hint: 'sigamos, sigáis' },
      { infinitive: 'repetir', hint: 'repitamos, repitáis' },
      { infinitive: 'vestir', hint: 'vistamos, vistáis' },
      { infinitive: 'medir', hint: 'midamos, midáis' },
      { infinitive: 'elegir', hint: 'elijamos, elijáis' },
      { infinitive: 'decir', hint: 'digamos, digáis' },
      { infinitive: 'venir', hint: 'vengamos, vengáis' },
    ],
  },
]

const IMPERFECT_SUBJUNCTIVE: LessonIrregularCategory[] = [
  {
    id: 'from-preterite',
    label: 'Derived from the ellos preterite stem',
    description:
      'The imperfect subjunctive is built from the ellos preterite stem, so any verb irregular in the preterite is irregular here too.',
    verbs: [
      { infinitive: 'tener', hint: 'tuvieron → tuviera' },
      { infinitive: 'estar', hint: 'estuvieron → estuviera' },
      { infinitive: 'poder', hint: 'pudieron → pudiera' },
      { infinitive: 'poner', hint: 'pusieron → pusiera' },
      { infinitive: 'saber', hint: 'supieron → supiera' },
      { infinitive: 'hacer', hint: 'hicieron → hiciera' },
      { infinitive: 'querer', hint: 'quisieron → quisiera' },
      { infinitive: 'venir', hint: 'vinieron → viniera' },
      { infinitive: 'decir', hint: 'dijeron → dijera' },
      { infinitive: 'traer', hint: 'trajeron → trajera' },
      { infinitive: 'conducir', hint: 'condujeron → condujera' },
      { infinitive: 'ser', hint: 'fueron → fuera' },
      { infinitive: 'ir', hint: 'fueron → fuera' },
      { infinitive: 'leer', hint: 'leyeron → leyera' },
      { infinitive: 'pedir', hint: 'pidieron → pidiera' },
      { infinitive: 'dormir', hint: 'durmieron → durmiera' },
    ],
  },
]

const IMPERATIVE: LessonIrregularCategory[] = [
  {
    id: 'irregular-tu',
    label: 'Irregular tú affirmative (one-syllable shortcuts)',
    description:
      'These verbs have a special tú affirmative form. Every other imperative slot (usted, nosotros, ustedes) uses the present subjunctive. All ten are listed.',
    verbs: [
      { infinitive: 'tener', hint: 'ten' },
      { infinitive: 'venir', hint: 'ven' },
      { infinitive: 'poner', hint: 'pon' },
      { infinitive: 'salir', hint: 'sal' },
      { infinitive: 'hacer', hint: 'haz' },
      { infinitive: 'decir', hint: 'di' },
      { infinitive: 'ir', hint: 've' },
      { infinitive: 'ser', hint: 'sé' },
      { infinitive: 'haber', hint: 'he (rare; mostly in fixed expressions)' },
      { infinitive: 'satisfacer', hint: 'satisfaz (or regular satisface)' },
    ],
  },
]

const IRREGULAR_PARTICIPLES: LessonIrregularCategory[] = [
  {
    id: 'irregular-participles',
    label: 'Verbs with an irregular past participle',
    description:
      'The auxiliary haber is irregular (he, has, ha, hemos, habéis, han). The participle itself is irregular for these verbs.',
    verbs: [
      { infinitive: 'abrir', hint: 'abierto' },
      { infinitive: 'cubrir', hint: 'cubierto' },
      { infinitive: 'decir', hint: 'dicho' },
      { infinitive: 'escribir', hint: 'escrito' },
      { infinitive: 'hacer', hint: 'hecho' },
      { infinitive: 'morir', hint: 'muerto' },
      { infinitive: 'poner', hint: 'puesto' },
      { infinitive: 'romper', hint: 'roto' },
      { infinitive: 'ver', hint: 'visto' },
      { infinitive: 'volver', hint: 'vuelto' },
      { infinitive: 'resolver', hint: 'resuelto' },
      { infinitive: 'absolver', hint: 'absuelto' },
      { infinitive: 'disolver', hint: 'disuelto' },
      { infinitive: 'satisfacer', hint: 'satisfecho' },
      { infinitive: 'freír', hint: 'frito (also regular freído)' },
      { infinitive: 'imprimir', hint: 'impreso (also regular imprimido)' },
      { infinitive: 'pudrir', hint: 'podrido' },
      { infinitive: 'caer', hint: 'caído (regular but written with an accent)' },
      { infinitive: 'leer', hint: 'leído (regular but written with an accent)' },
      { infinitive: 'creer', hint: 'creído (regular but written with an accent)' },
      { infinitive: 'oír', hint: 'oído (regular but written with an accent)' },
    ],
  },
]

const IRREGULAR_GERUNDS: LessonIrregularCategory[] = [
  {
    id: 'ir-stem-change-gerund',
    label: 'Stem change in the gerund (-ir verbs)',
    description:
      '-ir verbs that stem-change in the preterite use the same change in the gerund (e → i or o → u). Same set of verbs as the preterite "Stem change in 3rd person" category.',
    verbs: [
      { infinitive: 'pedir', hint: 'pidiendo' },
      { infinitive: 'servir', hint: 'sirviendo' },
      { infinitive: 'repetir', hint: 'repitiendo' },
      { infinitive: 'seguir', hint: 'siguiendo' },
      { infinitive: 'vestir', hint: 'vistiendo' },
      { infinitive: 'medir', hint: 'midiendo' },
      { infinitive: 'elegir', hint: 'eligiendo' },
      { infinitive: 'competir', hint: 'compitiendo' },
      { infinitive: 'sentir', hint: 'sintiendo' },
      { infinitive: 'mentir', hint: 'mintiendo' },
      { infinitive: 'preferir', hint: 'prefiriendo' },
      { infinitive: 'sugerir', hint: 'sugiriendo' },
      { infinitive: 'divertir', hint: 'divirtiendo' },
      { infinitive: 'advertir', hint: 'advirtiendo' },
      { infinitive: 'convertir', hint: 'convirtiendo' },
      { infinitive: 'dormir', hint: 'durmiendo' },
      { infinitive: 'morir', hint: 'muriendo' },
      { infinitive: 'venir', hint: 'viniendo' },
      { infinitive: 'decir', hint: 'diciendo' },
      { infinitive: 'poder', hint: 'pudiendo' },
    ],
  },
  {
    id: 'yendo',
    label: '-er / -ir verbs with a vowel-ending stem (-yendo)',
    description:
      'When the stem ends in a vowel, -iendo becomes -yendo to avoid three vowels in a row.',
    verbs: [
      { infinitive: 'leer', hint: 'leyendo' },
      { infinitive: 'creer', hint: 'creyendo' },
      { infinitive: 'oír', hint: 'oyendo' },
      { infinitive: 'caer', hint: 'cayendo' },
      { infinitive: 'traer', hint: 'trayendo' },
      { infinitive: 'construir', hint: 'construyendo' },
      { infinitive: 'destruir', hint: 'destruyendo' },
      { infinitive: 'incluir', hint: 'incluyendo' },
      { infinitive: 'concluir', hint: 'concluyendo' },
      { infinitive: 'huir', hint: 'huyendo' },
      { infinitive: 'contribuir', hint: 'contribuyendo' },
      { infinitive: 'distribuir', hint: 'distribuyendo' },
      { infinitive: 'sustituir', hint: 'sustituyendo' },
      { infinitive: 'poseer', hint: 'poseyendo' },
      { infinitive: 'proveer', hint: 'proveyendo' },
      { infinitive: 'ir', hint: 'yendo' },
    ],
  },
]

// Same irregular participles, but with a description that names the
// subjunctive haber forms instead of the indicative ones.
const IRREGULAR_PARTICIPLES_SUBJUNCTIVE: LessonIrregularCategory[] = [
  {
    ...IRREGULAR_PARTICIPLES[0],
    description:
      'The subjunctive forms of haber are irregular (haya... / hubiera...). The participle itself is irregular for these verbs.',
  },
]

const NO_IRREGULARS: LessonIrregularCategory[] = []

const CATEGORIES: Record<string, LessonIrregularCategory[]> = {
  present: PRESENT,
  preterite: PRETERITE,
  imperfect: IMPERFECT,
  future: FUTURE_CONDITIONAL,
  conditional: FUTURE_CONDITIONAL,
  'present-subjunctive': PRESENT_SUBJUNCTIVE,
  'imperfect-subjunctive': IMPERFECT_SUBJUNCTIVE,
  // Perfect subjunctives = subjunctive haber + past participle, so the only
  // verb-specific irregularity is the participle itself.
  'perfect-subjunctive': IRREGULAR_PARTICIPLES_SUBJUNCTIVE,
  'pluperfect-subjunctive': IRREGULAR_PARTICIPLES_SUBJUNCTIVE,
  imperative: IMPERATIVE,
  // Negative imperative = "no" + present subjunctive, so it inherits the same
  // irregular verbs as the present subjunctive.
  'negative-imperative': PRESENT_SUBJUNCTIVE,
  'present-perfect': IRREGULAR_PARTICIPLES,
  pluperfect: IRREGULAR_PARTICIPLES,
  'future-perfect': IRREGULAR_PARTICIPLES,
  'conditional-perfect': IRREGULAR_PARTICIPLES,
  'present-progressive': IRREGULAR_GERUNDS,
  'preterite-progressive': IRREGULAR_GERUNDS,
  'imperfect-progressive': IRREGULAR_GERUNDS,
  'future-progressive': IRREGULAR_GERUNDS,
  'poder-present': NO_IRREGULARS,
  'deber-present': NO_IRREGULARS,
}

// =============================================================================
// Tense metadata (id, name, description) — kept in sync with the static
// conjugation database / Spanish language module.
// =============================================================================

interface TenseMeta {
  id: string
  name: string
  description: string
}

const TENSES: TenseMeta[] = [
  { id: 'present', name: 'Present', description: 'Actions happening now, habitual actions, general truths' },
  { id: 'preterite', name: 'Preterite', description: 'Completed past actions with a definite endpoint' },
  { id: 'imperfect', name: 'Imperfect', description: 'Ongoing, habitual, or background past actions' },
  { id: 'future', name: 'Future', description: 'Actions that will happen, predictions, probability' },
  { id: 'conditional', name: 'Conditional', description: 'Hypothetical situations, polite requests, future in the past' },
  { id: 'present-subjunctive', name: 'Present Subjunctive', description: 'Wishes, doubts, emotions, impersonal expressions in the present' },
  { id: 'imperfect-subjunctive', name: 'Imperfect Subjunctive', description: 'Hypothetical or contrary-to-fact situations in the past' },
  { id: 'perfect-subjunctive', name: 'Perfect Subjunctive', description: 'Completed actions in subjunctive contexts (haya hablado)' },
  { id: 'pluperfect-subjunctive', name: 'Pluperfect Subjunctive', description: 'Contrary-to-fact completed past actions (hubiera hablado)' },
  { id: 'imperative', name: 'Imperative', description: 'Commands and instructions' },
  { id: 'negative-imperative', name: 'Negative Imperative', description: 'Negative commands and prohibitions (no hables)' },
  { id: 'present-perfect', name: 'Present Perfect', description: 'Actions completed recently or with present relevance' },
  { id: 'pluperfect', name: 'Pluperfect', description: 'Actions completed before another past action' },
  { id: 'future-perfect', name: 'Future Perfect', description: 'Actions that will be completed before a future point' },
  { id: 'conditional-perfect', name: 'Conditional Perfect', description: 'Hypothetical completed actions' },
  { id: 'present-progressive', name: 'Present Progressive', description: 'Actions happening right now (estoy hablando)' },
  { id: 'preterite-progressive', name: 'Preterite Progressive', description: 'Actions that were underway during a bounded stretch of the past (estuve hablando)' },
  { id: 'imperfect-progressive', name: 'Imperfect Progressive', description: 'Ongoing past actions in progress (estaba hablando)' },
  { id: 'future-progressive', name: 'Future Progressive', description: 'Actions that will be in progress (estaré hablando)' },
  { id: 'poder-present', name: 'Poder + Infinitive', description: 'Ability or possibility (puedo hablar)' },
  { id: 'deber-present', name: 'Deber + Infinitive', description: 'Obligation or probability (debo hablar)' },
]

export function getSpanishLessons(): LessonData[] {
  return TENSES.map((t) => ({
    tenseId: t.id,
    tenseName: t.name,
    description: t.description,
    formationSummary: FORMATION[t.id] ?? '',
    endingsTables: buildEndingsTables(t.id),
    irregularCategories: CATEGORIES[t.id] ?? [],
  }))
}

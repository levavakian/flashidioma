import { useEffect, useState } from 'react'
import type { LessonData, EndingsTable, LessonIrregularGroup, LessonIrregularVerb } from '../../types'
import { getSpanishLessons } from '../../services/verbLessons'
import { lookupConjugation } from '../../services/conjugationLookup'
import ConjugationView from '../cards/ConjugationView'
import type { VerbData } from '../../types'

export default function VerbLessonsPage() {
  const [lessons, setLessons] = useState<LessonData[] | null>(null)
  const [openTense, setOpenTense] = useState<string | null>(null)

  useEffect(() => {
    getSpanishLessons().then(setLessons)
  }, [])

  if (!lessons) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading lessons...</div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Verb Lessons</h2>
      <p className="text-sm text-gray-500 mb-4">
        How each tense is formed, the rules for irregular verbs, and the irregular verbs grouped by
        their alternate ending pattern.
      </p>

      <div className="space-y-2">
        {lessons.map((lesson) => {
          const isOpen = openTense === lesson.tenseId
          return (
            <div key={lesson.tenseId} className="bg-white rounded-lg border">
              <button
                onClick={() => setOpenTense(isOpen ? null : lesson.tenseId)}
                className="w-full text-left p-3 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{lesson.tenseName}</div>
                  <div className="text-xs text-gray-500 truncate">{lesson.description}</div>
                </div>
                <span className="text-gray-400 ml-2 shrink-0 text-sm">
                  {isOpen ? '\u25BC' : '\u25B6'}
                </span>
              </button>

              {isOpen && (
                <div className="border-t px-3 py-3">
                  <LessonContent lesson={lesson} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LessonContent({ lesson }: { lesson: LessonData }) {
  return (
    <div className="space-y-4">
      {lesson.formationSummary && (
        <section>
          <h3 className="text-sm font-semibold mb-1">Formation</h3>
          <p className="text-sm text-gray-700">{lesson.formationSummary}</p>
        </section>
      )}

      {lesson.endingsTables.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">Regular endings</h3>
          <div className="space-y-3">
            {lesson.endingsTables.map((table, idx) => (
              <EndingsTableView key={idx} table={table} />
            ))}
          </div>
        </section>
      )}

      {lesson.irregularRules.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-1">Irregular verb rules</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            {lesson.irregularRules.map((rule, idx) => (
              <li key={idx}>{rule}</li>
            ))}
          </ul>
        </section>
      )}

      {lesson.irregularGroups.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">Irregular verb groups</h3>
          <div className="space-y-3">
            {lesson.irregularGroups.map((group) => (
              <IrregularGroupView key={group.id} group={group} />
            ))}
          </div>
        </section>
      )}

      {lesson.otherIrregulars.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">
            {lesson.irregularGroups.length > 0 ? 'Other irregular verbs' : 'Irregular verbs'}
            <span className="ml-1 text-xs text-gray-400">({lesson.otherIrregulars.length})</span>
          </h3>
          <VerbList verbs={lesson.otherIrregulars} />
        </section>
      )}

      {lesson.irregularGroups.length === 0 && lesson.otherIrregulars.length === 0 && (
        <p className="text-sm text-gray-500 italic">No irregular verbs in this construct.</p>
      )}
    </div>
  )
}

function EndingsTableView({ table }: { table: EndingsTable }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{table.verbTypes.join(', ')}</div>
      <table className="w-full text-sm border rounded overflow-hidden">
        <tbody>
          {table.persons.map((person, i) => (
            <tr key={person} className="border-b last:border-b-0">
              <td className="py-1 px-2 text-gray-500 w-1/2">{person}</td>
              <td className="py-1 px-2 font-mono">-{table.endings[i] || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IrregularGroupView({ group }: { group: LessonIrregularGroup }) {
  return (
    <div className="border rounded">
      <div className="px-3 py-2 bg-gray-50 border-b">
        <div className="text-sm font-medium">{group.label}</div>
        <div className="text-xs text-gray-500">{group.verbs.length} verbs share these endings</div>
      </div>
      <div className="px-3 py-2">
        <table className="w-full text-sm mb-3">
          <tbody>
            {group.persons.map((person, i) => (
              <tr key={person} className="border-b last:border-b-0">
                <td className="py-1 text-gray-500 w-1/2">{person}</td>
                <td className="py-1 font-mono">-{group.endings[i] || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <VerbList verbs={group.verbs} />
      </div>
    </div>
  )
}

function VerbList({ verbs }: { verbs: LessonIrregularVerb[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [data, setData] = useState<VerbData | null>(null)

  const toggle = async (infinitive: string) => {
    if (expanded === infinitive) {
      setExpanded(null)
      setData(null)
      return
    }
    setExpanded(infinitive)
    setData(null)
    const verbData = await lookupConjugation(infinitive)
    setData(verbData)
  }

  return (
    <ul className="space-y-1">
      {verbs.map((verb) => {
        const isOpen = expanded === verb.infinitive
        return (
          <li key={verb.infinitive} className="text-sm">
            <button
              onClick={() => toggle(verb.infinitive)}
              className="text-left hover:underline text-blue-600"
            >
              <span className="font-medium">{verb.infinitive}</span>
              {verb.hint && <span className="ml-2 text-gray-500 text-xs">{verb.hint}</span>}
            </button>
            {isOpen && (
              <div className="ml-2 mt-1 mb-2 border-l-2 border-blue-200 pl-3">
                {data ? (
                  <ConjugationView verbData={data} />
                ) : (
                  <div className="text-xs text-gray-400 py-2">Loading…</div>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

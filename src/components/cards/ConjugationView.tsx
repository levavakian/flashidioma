import { useState, useMemo } from 'react'
import type { VerbData, ConstructChecklist } from '../../types'

interface Props {
  verbData: VerbData
  enabledConstructs?: ConstructChecklist
}

export default function ConjugationView({ verbData, enabledConstructs }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [expandedTenses, setExpandedTenses] = useState<Set<string>>(new Set())

  const toggleTense = (tenseId: string) => {
    setExpandedTenses((prev) => {
      const next = new Set(prev)
      if (next.has(tenseId)) next.delete(tenseId)
      else next.add(tenseId)
      return next
    })
  }

  // Filter tenses by enabled constructs if provided
  const visibleTenses = useMemo(() => {
    if (!enabledConstructs) return verbData.tenses
    return verbData.tenses.filter((t) => enabledConstructs[t.tenseId] !== false)
  }, [verbData.tenses, enabledConstructs])

  return (
    <div className="mt-3 border-t pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm font-medium text-blue-500 hover:text-blue-700"
      >
        {expanded ? '▼' : '▶'} Conjugations ({verbData.infinitive})
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {visibleTenses.map((tense) => (
            <div key={tense.tenseId} className="border rounded">
              <button
                onClick={() => toggleTense(tense.tenseId)}
                className="w-full text-left px-3 py-2 text-sm font-medium bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
              >
                <span>{tense.tenseName}</span>
                <span className="text-gray-400">
                  {expandedTenses.has(tense.tenseId) ? '▼' : '▶'}
                </span>
              </button>

              {expandedTenses.has(tense.tenseId) && (
                <div className="px-3 py-2">
                  {tense.description && (
                    <p className="text-xs text-gray-500 italic mb-2">{tense.description}</p>
                  )}
                  <table className="w-full text-sm">
                    <tbody>
                      {tense.conjugations.map((conj) => (
                        <tr key={conj.person} className="border-b last:border-b-0">
                          <td className="py-1 text-gray-500 w-1/3">{conj.person}</td>
                          <td className="py-1 font-medium">{conj.form}</td>
                          <td className="py-1 text-gray-400 text-xs">{conj.miniTranslation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { addReflexivePronouns, stripReflexivePronoun, isReflexiveVerb } from '../../services/reflexive'
import type { VerbData, ConstructChecklist } from '../../types'

interface Props {
  verbData: VerbData
  enabledConstructs?: ConstructChecklist
}

export default function ConjugationView({ verbData, enabledConstructs }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [expandedTenses, setExpandedTenses] = useState<Set<string>>(new Set())
  const isNaturallyReflexive = isReflexiveVerb(verbData.infinitive)
  const [showReflexive, setShowReflexive] = useState(isNaturallyReflexive)

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

  const getDisplayForm = (form: string, person: string, tenseId: string): string => {
    if (showReflexive) {
      if (isNaturallyReflexive) {
        // Data already has pronouns baked in, use as-is
        return form
      }
      // Non-reflexive verb: add pronouns for practice
      return addReflexivePronouns(form, person, tenseId)
    } else {
      if (isNaturallyReflexive) {
        // Strip pronouns from the stored data
        return stripReflexivePronoun(form, tenseId)
      }
      // Non-reflexive verb without toggle: use as-is
      return form
    }
  }

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm font-medium text-blue-500 hover:text-blue-700"
        >
          {expanded ? '\u25BC' : '\u25B6'} Conjugations ({verbData.infinitive})
        </button>

        {expanded && (
          <button
            onClick={() => setShowReflexive(!showReflexive)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              showReflexive
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
            }`}
            title={showReflexive
              ? 'Showing with reflexive pronouns — click to hide'
              : 'Click to show with reflexive pronouns'}
          >
            reflexive {showReflexive ? 'on' : 'off'}
          </button>
        )}
      </div>

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
                  {expandedTenses.has(tense.tenseId) ? '\u25BC' : '\u25B6'}
                </span>
              </button>

              {expandedTenses.has(tense.tenseId) && (
                <div className="px-3 py-2">
                  {tense.description && (
                    <p className="text-xs text-gray-500 italic mb-2">{tense.description}</p>
                  )}
                  <table className="w-full text-sm">
                    <tbody>
                      {tense.conjugations.map((conj) => {
                        const displayForm = getDisplayForm(conj.form, conj.person, tense.tenseId)
                        return (
                          <tr key={conj.person} className="border-b last:border-b-0">
                            <td className="py-1 text-gray-500 w-1/3">{conj.person}</td>
                            <td className="py-1 font-medium">{displayForm}</td>
                            <td className="py-1 text-gray-400 text-xs">{conj.miniTranslation}</td>
                          </tr>
                        )
                      })}
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

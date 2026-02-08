import { useState, useEffect } from 'react'
import { updateDeck } from '../../services/deck'
import { spanishLanguageModule } from '../../languages/spanish'
import type { Deck } from '../../types'

interface Props {
  deck: Deck
  onUpdate: () => void
}

export default function ConstructChecklist({ deck, onUpdate }: Props) {
  const [checklist, setChecklist] = useState(deck.constructChecklist)
  const languageModule = spanishLanguageModule

  useEffect(() => {
    setChecklist(deck.constructChecklist)
  }, [deck])

  const handleToggle = async (constructId: string) => {
    const updated = { ...checklist, [constructId]: !checklist[constructId] }
    setChecklist(updated)
    await updateDeck(deck.id, { constructChecklist: updated })
    onUpdate()
  }

  const categories = [...new Set(languageModule.constructs.map((c) => c.category))]

  return (
    <div className="bg-white rounded-lg shadow border p-4">
      <h3 className="font-semibold text-lg mb-3">Enabled Constructs</h3>
      <p className="text-sm text-gray-500 mb-3">
        Toggle which tenses and constructs are active for review and practice.
      </p>

      {categories.map((category) => (
        <div key={category} className="mb-3">
          <h4 className="text-sm font-medium text-gray-700 capitalize mb-1">{category}s</h4>
          <div className="space-y-1">
            {languageModule.constructs
              .filter((c) => c.category === category)
              .map((construct) => (
                <label
                  key={construct.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checklist[construct.id] ?? false}
                    onChange={() => handleToggle(construct.id)}
                    className="rounded"
                  />
                  <span>{construct.name}</span>
                  <span className="text-xs text-gray-400">- {construct.description}</span>
                </label>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

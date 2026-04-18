import { useState } from 'react'
import ConjugationBrowserPage from './ConjugationBrowserPage'
import VerbLessonsPage from './VerbLessonsPage'

type Tab = 'browse' | 'lessons'

const TABS: { id: Tab; label: string }[] = [
  { id: 'browse', label: 'Browse' },
  { id: 'lessons', label: 'Lessons' },
]

export default function VerbsPage() {
  const [tab, setTab] = useState<Tab>('browse')

  return (
    <div>
      <div className="flex border-b mb-4 overflow-x-auto -mx-4 px-4 scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'browse' ? <ConjugationBrowserPage /> : <VerbLessonsPage />}
    </div>
  )
}

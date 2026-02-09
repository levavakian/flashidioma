import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDeck } from '../../services/deck'
import { getCardsByDeck } from '../../services/card'
import { getDueCards, getNewCardBatch } from '../../services/review'
import type { Deck, Card } from '../../types'
import CardList from '../cards/CardList'
import AddCardForm from '../cards/AddCardForm'
import ReviewSession from '../review/ReviewSession'
import ConstructChecklist from './ConstructChecklist'
import DeckSettings from './DeckSettings'
import PracticeTab from '../practice/PracticeTab'

type Tab = 'cards' | 'review' | 'add' | 'practice' | 'constructs' | 'settings'

const tabs: { id: Tab; label: string }[] = [
  { id: 'cards', label: 'Cards' },
  { id: 'review', label: 'Review' },
  { id: 'add', label: '+ Add' },
  { id: 'practice', label: 'Practice' },
  { id: 'constructs', label: 'Constructs' },
  { id: 'settings', label: 'Settings' },
]

export default function DeckDetailPage() {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [dueCount, setDueCount] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [tab, setTab] = useState<Tab>('cards')
  const [loading, setLoading] = useState(true)

  const loadDeck = async () => {
    if (!deckId) return
    const d = await getDeck(deckId)
    if (!d) {
      navigate('/')
      return
    }
    setDeck(d)
    const allCards = await getCardsByDeck(deckId)
    setCards(allCards)

    const due = await getDueCards(deckId)
    setDueCount(due.length)

    const newBatch = await getNewCardBatch(d)
    setNewCount(newBatch.length)
    setLoading(false)
  }

  useEffect(() => {
    loadDeck()
  }, [deckId])

  if (loading) {
    return <p className="text-gray-500 py-8 text-center">Loading deck...</p>
  }

  if (!deck) return null

  const getTabLabel = (t: typeof tabs[0]) => {
    if (t.id === 'cards') return `${t.label} (${cards.length})`
    if (t.id === 'review') return t.label
    return t.label
  }

  const reviewBadge = dueCount + newCount

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => navigate('/')}
          className="text-blue-500 hover:text-blue-700"
        >
          &larr; Back
        </button>
        <h2 className="text-2xl font-bold truncate">{deck.name}</h2>
      </div>

      <div className="flex border-b mb-4 overflow-x-auto -mx-4 px-4 scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {getTabLabel(t)}
            {t.id === 'review' && reviewBadge > 0 && (
              <span className="ml-1 bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs">
                {reviewBadge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'cards' && (
        <CardList cards={cards} deckId={deck.id} onUpdate={loadDeck} enabledConstructs={deck.constructChecklist} />
      )}

      {tab === 'review' && (
        <ReviewSession deck={deck} onComplete={loadDeck} />
      )}

      {tab === 'add' && (
        <AddCardForm
          deckId={deck.id}
          onAdded={() => {
            loadDeck()
            setTab('cards')
          }}
        />
      )}

      {tab === 'practice' && <PracticeTab deck={deck} />}

      {tab === 'constructs' && (
        <ConstructChecklist deck={deck} onUpdate={loadDeck} />
      )}

      {tab === 'settings' && (
        <DeckSettings deck={deck} onUpdate={loadDeck} />
      )}
    </div>
  )
}

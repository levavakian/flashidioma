import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import DecksPage from './components/decks/DecksPage'
import DeckDetailPage from './components/decks/DeckDetailPage'
import ImportDecksPage from './components/decks/ImportDecksPage'
import TranslatePage from './components/translate/TranslatePage'
import SettingsPage from './components/settings/SettingsPage'

function App() {
  return (
    <HashRouter>
      <div className="h-dvh bg-gray-50 flex flex-col overflow-hidden">
        <header className="bg-blue-500 text-white px-4 py-3 shadow-md shrink-0">
          <h1 className="text-xl font-bold">FlashIdioma</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<DecksPage />} />
            <Route path="/deck/:deckId" element={<DeckDetailPage />} />
            <Route path="/import" element={<ImportDecksPage />} />
            <Route path="/translate" element={<TranslatePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>

        <nav className="shrink-0 bg-white border-t border-gray-200 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center text-xs ${isActive ? 'text-blue-500' : 'text-gray-500'}`
            }
          >
            <span className="text-lg">&#128218;</span>
            <span>Decks</span>
          </NavLink>
          <NavLink
            to="/translate"
            className={({ isActive }) =>
              `flex flex-col items-center text-xs ${isActive ? 'text-blue-500' : 'text-gray-500'}`
            }
          >
            <span className="text-lg">&#127760;</span>
            <span>Translate</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex flex-col items-center text-xs ${isActive ? 'text-blue-500' : 'text-gray-500'}`
            }
          >
            <span className="text-lg">&#9881;</span>
            <span>Settings</span>
          </NavLink>
        </nav>
      </div>
    </HashRouter>
  )
}

export default App

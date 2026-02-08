import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import DecksPage from './components/decks/DecksPage'
import DeckDetailPage from './components/decks/DeckDetailPage'
import ImportDecksPage from './components/decks/ImportDecksPage'
import TranslatePage from './components/translate/TranslatePage'
import SettingsPage from './components/settings/SettingsPage'

const basename = import.meta.env.BASE_URL

function App() {
  return (
    <BrowserRouter basename={basename}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-blue-500 text-white px-4 py-3 shadow-md">
          <h1 className="text-xl font-bold">FlashIdioma</h1>
        </header>

        <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<DecksPage />} />
            <Route path="/deck/:deckId" element={<DeckDetailPage />} />
            <Route path="/import" element={<ImportDecksPage />} />
            <Route path="/translate" element={<TranslatePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>

        <nav className="bg-white border-t border-gray-200 px-4 py-2 flex justify-around">
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
    </BrowserRouter>
  )
}

export default App

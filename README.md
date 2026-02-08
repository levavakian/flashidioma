# flashidioma

A language-learning flashcard PWA with built-in translation, spaced repetition, verb conjugation support, and AI-powered practice sentence generation. Designed to work fully offline with local data storage.

## Platform & Tech Stack

- **Frontend:** React + TailwindCSS
- **Hosting:** Static site on GitHub Pages
- **Install:** Progressive Web App (PWA) — installable on mobile and desktop
- **Data storage:** All user data stored locally (IndexedDB or localStorage) — no server required
- **Target devices:** Mobile browsers and desktop browsers

## External Services

### Translation
Google Translate via the unofficial web endpoint (no API key required):
```
https://translate.google.de/translate_a/single?client=webapp&sl=auto&tl=en&...&q=<encoded_text>
```
This works without authentication but may be rate-limited. When translation is unavailable (network issues, rate limiting), the app must degrade gracefully (see Offline Behavior below).

### LLM (Bring Your Own Key)
Used for: verb conjugation hydration and practice sentence generation.
- Supports multiple providers (Anthropic Claude, OpenAI, etc.)
- User provides their own API key, which is stored in local storage
- User can specify which model to use (text input)
- Default: Claude Sonnet
- API calls are made directly from the client

### Spanish Language Data
Source: [doozan/spanish_data](https://github.com/doozan/spanish_data) at tag `2026-02-01`.

Files used:
| File | Contents |
|------|----------|
| `frequency.csv` | Most frequent Spanish lemmas with POS, usage counts, and word forms |
| `es-en.data` | Spanish-to-English Wiktionary dictionary entries with glosses, etymology, POS |
| `es_allforms.csv` | Maps all inflected forms to their base lemmas |
| `sentences.tsv` | English/Spanish sentence pairs with POS tags and lemma annotations |

A **build-time preprocessing script** combines `frequency.csv` and `es-en.data` to generate an importable deck artifact (JSON) ordered by word frequency. This artifact is shipped with the app. The raw data files are **not** bundled into the app — only the preprocessed artifact is. The spanish_data repo should not be a git submodule; the preprocessing script fetches the data from the pinned tag at build time.

## Core Concepts

### Decks
- Users can have **multiple concurrent decks**, each fully independent
- Each deck has its own: cards, review history, FSRS state, practice sentences, construct checklist, and settings
- Pre-built decks (e.g. the spanish_data frequency deck) can be imported from an "Importable Decks" tab — importing is optional, not automatic
- Multiple pre-built decks can be imported into the same user deck

### Cards
A card consists of:
- **Front text** (source or target language)
- **Back text** (the translation)
- **Direction:** source→target or target→source. Adding "both directions" creates **two independent cards**, each with its own FSRS review schedule
- **Tags:** user-defined tags for organization and filtering
- **Notes:** optional free-text notes field
- **Verb data:** optional expandable conjugation data (see Verb Conjugation below)
- **Metadata:** creation date, source (manual, imported, generated from practice), deck membership

### Spaced Repetition (FSRS)
Uses the [Free Spaced Repetition Scheduler (FSRS)](https://github.com/open-spaced-repetition/fsrs4anki) algorithm.

- Cards become due based on FSRS scheduling
- **New card introduction:** new cards are introduced in configurable batches (default: 5 per day). The next batch is only introduced after the current batch of new cards have all been reviewed at least once (converting them from "new" to "review" cards)
- Due cards accumulate in the review queue and are presented when the user opens the review tab

## Features

### Built-in Translator
- Translate words/phrases between source and target language using Google Translate
- After translating, the user can:
  - Add as a new card (source→target, target→source, or both)
  - The card is automatically added to the review pool
- If the translated word is a verb, the user can also trigger conjugation hydration (see below)

### Verb Conjugation System
Cards for verbs have an expandable extra info section:

- **Primary conjugations:** all standard tenses (present, preterite, imperfect, future, conditional, present subjunctive, imperfect subjunctive, imperative), each showing all persons (yo, tú, él/ella, nosotros, vosotros, ellos/ellas)
- **Compound/secondary tenses:** e.g. present perfect (he facilitado), pluperfect (había facilitado), future perfect (habré facilitado), conditional perfect (habría facilitado), etc.
- Each conjugation form has a **mini translation** (e.g. "I facilitate", "you facilitated")
- Each tense section has a **description of when it is used** (e.g. preterite: "completed past actions with a definite endpoint"; imperfect: "ongoing, habitual, or background past actions")
- The conjugation section is **collapsed by default** with expandable subsections per tense

**Data sources for conjugations:**
1. **Static database:** the app ships with pre-built conjugation data for common Spanish verbs (derived from spanish_data)
2. **LLM fallback:** for verbs not in the static DB, or to fill in missing mini-translations/descriptions, the user can trigger LLM generation

**Hydration:** the user can trigger conjugation hydration for:
- A newly translated word (if it's a verb, offer to hydrate when adding as a card)
- An existing card in the deck that is missing conjugation data

### Construct Checklist
Each deck has a configurable checklist of language constructs that are "unlocked" for review:
- Example: start with only present tense enabled → verb flashcards only test present tense forms
- As the user enables more tenses, additional conjugation forms of already-learned verbs become available for review
- This checklist also governs what constructs appear in practice sentence generation

### Practice Sentence Generation
A tab where the user can generate sentences to translate from source to target language.

**Generation process:**
1. **Programmatic selection:** the app randomly selects from the user's reviewed vocabulary pool:
   - A verb (or None, with configurable probability)
   - An adjective (or None, with configurable probability)
   - A conjugation/tense (from the enabled construct checklist)
   - Other relevant constructs
2. **LLM generation:** the selected components are sent to the LLM, which generates a natural sentence incorporating them and provides the translation
3. The generated sentences **persist until the user explicitly clicks regenerate** — they are not auto-refreshed

**Additional features:**
- Each practice sentence can be converted into a permanent flashcard for any deck
- Practice sentences are scoped to the deck they were generated for (using that deck's vocabulary and construct settings)

### Tagging System
- Users can add, remove, and manage tags on any card
- Cards can be filtered/searched by tags or by card content (front/back text)
- Tags are per-card, not per-deck

### Deduplication
When adding a new card, the app checks for duplicates:
- Deduplication is based on the **target language text only** (e.g. the Spanish word)
  - Rationale: the same English word can map to multiple Spanish words, but a given Spanish word shouldn't appear twice
- Comparison is **accent-insensitive** (e.g. "facilitar" matches "facilitar" even if one was typed without accents)
- If a duplicate is detected, the user gets a warning prompt (not a hard block) — they can still add it if they choose

### Import / Export
- **Full app state export/import:** the entire app state — all decks (including imported ones), all cards, review history, FSRS state, settings, tags, practice sentences, side deck, construct checklists, LLM config — is exportable to and importable from a **single JSON file**. This is the primary backup/restore and device-transfer mechanism.
- **Pre-built deck import:** from the "Importable Decks" tab, users can browse and import pre-built decks (e.g. the spanish_data frequency deck) into their own decks

## Offline Behavior

The app must function gracefully without an internet connection:

| Feature | Online | Offline |
|---------|--------|---------|
| Create cards | Auto-translate via Google Translate | Manual translation input |
| Pending translation | N/A | Card saved to a **side deck** — translated later when back online |
| Review cards | Works | Works (all data is local) |
| Conjugation hydration | LLM generates data | Unavailable — use static DB if available |
| Practice sentences | LLM generates | Unavailable |
| Import/export | Works | Works (local file operations) |

The **side deck** is a holding area for cards that were created without a translation (due to being offline or translation failure). When the user is back online, they can batch-translate these and move them into a deck.

## Multi-Language Architecture

The app is architected to support multiple target languages, even though only **Spanish** is implemented initially.

- Language-specific data (conjugation tables, tense descriptions, construct types) is modular — each language provides its own definitions
- The construct checklist system is generic — it works with whatever constructs a language defines
- For example, French could define its own set of tenses, moods, and verb groups without changing the core app
- Language-specific pre-built decks and static conjugation databases are separate modules

## Data Model (High-Level)

```
App
├── Settings (global)
│   ├── LLM provider config (provider, API key, model)
│   ├── "Install as App" button (triggers PWA install prompt on supported devices)
│   └── UI preferences
├── Decks[]
│   ├── Deck metadata (name, target language, created date)
│   ├── Cards[]
│   │   ├── front_text, back_text, direction
│   │   ├── tags[]
│   │   ├── notes
│   │   ├── verb_data? (conjugations, tense descriptions, mini translations)
│   │   └── fsrs_state (stability, difficulty, due date, review count, etc.)
│   ├── Construct checklist (which tenses/constructs are enabled)
│   ├── New card batch settings (batch size, current batch)
│   ├── Practice sentences[] (generated, persist until regenerated)
│   └── Review history
├── Side deck (cards pending translation)
└── Importable decks catalog (pre-built decks available for import)
```

## Development Setup

Development (including running Claude Code) happens inside a Docker container. The dev container includes Node.js, npm, and the Claude Code CLI.

**Prerequisites:** Docker, an `ANTHROPIC_API_KEY` environment variable.

```bash
# Build the dev image (only needed once, or when Dockerfile changes)
./build.sh

# Start the dev container and get a shell
ANTHROPIC_API_KEY=<your-key> ./run.sh
```

The project directory is bind-mounted into the container at `/app` with host UID/GID matching, so files created or edited inside the container have correct ownership on the host.

**When to rebuild the Docker image:** only when `Dockerfile` changes (e.g. new system-level packages). Day-to-day dependency changes via `npm install` do not require a rebuild.

**Git access:** The container has SSH keys configured and can push directly to origin.

## Deployment

The app is deployed to GitHub Pages via GitHub Actions. On every push to `main`, the workflow (`.github/workflows/deploy.yml`) builds the app and deploys the `dist/` directory. The live site is at `https://levavakian.github.io/flashidioma/`.

## Build & Preprocessing

1. **Preprocessing script:** fetches data from `doozan/spanish_data@2026-02-01`, combines `frequency.csv` + `es-en.data` + `es_allforms.csv`, and outputs a JSON artifact containing:
   - Frequency-ordered word list with translations, POS, and usage data
   - Pre-computed verb conjugation tables for common verbs
   - This artifact is committed or generated at build time and bundled with the app

2. **App build:** standard React build producing static assets deployable to GitHub Pages

## License

Data from [doozan/spanish_data](https://github.com/doozan/spanish_data) is used under the following licenses:
- `es-en.data`: CC-BY-SA (Attribution: wiktionary.org)
- `frequency.csv`: CC-BY-SA 3.0 (github.com/hermitdave/FrequencyWords)
- `sentences.tsv`: CC-BY 2.0 FR (Attribution: tatoeba.org)

---

## Project Plan & Tracker

This section is the combined implementation plan and issue tracker. Phases are ordered by dependency — later phases build on earlier ones. Items are marked as they are completed.

**Testing stack:** Vitest for unit/integration tests, React Testing Library for component tests, Playwright for E2E tests, `fake-indexeddb` for storage tests in Node, MSW (Mock Service Worker) for mocking HTTP requests (Google Translate, LLM APIs).

### Phase 1: Project Scaffolding
- [x] Initialize React + TypeScript project with Vite
- [x] Configure TailwindCSS
- [x] Set up PWA (service worker, manifest, offline caching)
- [x] Configure GitHub Pages deployment (build output, base path)
- [x] Set up local storage layer (IndexedDB via Dexie or similar)
- [x] Define core TypeScript types/interfaces (Card, Deck, Settings, etc.)
- [x] Set up testing infrastructure (Vitest, React Testing Library, Playwright, fake-indexeddb, MSW)
- **Verify:** app builds, dev server runs, `npm test` passes with a trivial test, production build deploys to GitHub Pages and loads, PWA manifest is served and app is installable

### Phase 2: Core Data & State
- [x] Implement data model (decks, cards, tags, settings) with IndexedDB persistence
- [x] Full app state export to JSON
- [x] Full app state import from JSON (with validation)
- [x] Implement FSRS algorithm (scheduling, review grading, state updates)
- [x] New card batch introduction logic (configurable batch size, gate on previous batch reviewed)
- **Tests:**
  - [x] Unit: CRUD operations on decks and cards — create, read, update, delete — verify IndexedDB state via fake-indexeddb
  - [x] Unit: export produces valid JSON containing all app state; import from that JSON restores identical state
  - [x] Unit: import rejects malformed JSON and partially valid data gracefully (no crash, user-facing error)
  - [x] Unit: FSRS scheduling — given a card with known state and a grade, verify next due date, stability, and difficulty match expected FSRS output
  - [x] Unit: FSRS edge cases — new card first review, card at maximum interval, all four grade buttons
  - [x] Unit: batch introduction — new cards are gated until current batch is fully reviewed; batch size is respected; next batch unlocks correctly
  - [x] Integration: round-trip test — create decks/cards, export, clear storage, import, verify all data matches

### Phase 3: Basic Flashcard UI
- [x] Deck list view (create, rename, delete decks)
- [x] Card list/browse view within a deck (search by content, filter by tags)
- [x] Add card manually (front text, back text, direction selection, tags)
- [x] Edit and delete existing cards
- [x] Review session UI (show card front → reveal back → grade with FSRS buttons)
- [x] Due card queue display (count of due cards, new cards remaining in batch)
- **Tests:**
  - [x] Component: deck list renders decks, create/rename/delete update the list
  - [x] Component: add card form — submitting with valid data creates a card; "both directions" creates two independent cards; empty required fields show validation
  - [x] Component: review session — card front is shown, clicking reveal shows back, grading advances to next card, session ends when queue is empty
  - [ ] E2E: full workflow — create a deck, add 3 cards, start review, grade all cards, verify due counts update

### Phase 4: Tagging & Deduplication
- [x] Tag management (add, remove, rename tags on cards)
- [x] Search/filter cards by tags
- [x] Accent-insensitive deduplication check on target language text when adding cards
- [x] Deduplication warning prompt (non-blocking — user can proceed)
- **Tests:**
  - [x] Unit: accent-insensitive comparison — "está" matches "esta", "café" matches "cafe", "ñoño" matches "nono"
  - [x] Unit: deduplication only checks target language text — same English word with different Spanish translations should not trigger
  - [x] Component: adding a card with a duplicate target word shows warning; user can dismiss and add anyway
  - [x] Component: tag filter — selecting a tag shows only cards with that tag; clearing filter shows all; searching by card content works

### Phase 5: Translation Integration
- [x] Google Translate integration via unofficial web endpoint
- [x] Translator tab UI (input text, select languages, show result)
- [x] "Add as card" flow after translation (one direction, reverse, or both → two independent cards)
- [x] Offline detection and graceful fallback to manual input
- [x] Side deck for cards pending translation
- [x] Batch translate side deck cards when back online
- **Tests:**
  - [x] Unit: Google Translate client parses the response format correctly (mock a real response payload)
  - [x] Unit: Google Translate client handles error responses (rate limit, network error) without crashing
  - [ ] Component (MSW): translator tab — type a word, mock a successful translation response, verify translation displays and "add as card" buttons appear
  - [ ] Component: offline mode — simulate offline (MSW returns network error), verify manual input fallback is shown and card goes to side deck
  - [ ] Component: side deck — cards appear in side deck list; going "online" (MSW returns success) and batch-translating moves them to the target deck
  - [ ] E2E: translate a word, add as card in both directions, verify two cards exist in deck with correct front/back

### Phase 6: Spanish Data Preprocessing & Import
- [x] Build preprocessing script to fetch `doozan/spanish_data@2026-02-01`
- [x] Parse `frequency.csv` + `es-en.data` + `es_allforms.csv` into JSON artifact
- [ ] Generate pre-computed verb conjugation tables for common verbs
- [x] Bundle artifact with the app build
- [x] "Importable Decks" tab UI
- [x] Import pre-built deck(s) into user deck(s)
- **Tests:**
  - [ ] Unit: preprocessing script — run on a small subset of the real data files, verify output JSON has correct structure (frequency order, POS tags, translations, conjugation tables)
  - [ ] Unit: preprocessing script — verify known verbs (ser, estar, tener) have complete conjugation tables in output
  - [ ] Unit: preprocessing script — verify output is deterministic (same input → same output)
  - [ ] Component: importable decks tab shows available pre-built decks; importing adds cards to a user deck; importing twice does not create duplicates
  - [ ] Integration: full pipeline — run preprocessing, build app, verify the artifact is loadable and importable in the running app

### Phase 7: Verb Conjugation System
- [x] Define language-agnostic conjugation data structure (tenses, persons, forms)
- [x] Spanish conjugation module (tense list, person list, compound tense definitions)
- [x] Conjugation display UI (collapsed by default, expandable per tense)
- [x] Mini translations per conjugation form
- [x] Tense usage descriptions (e.g. preterite vs imperfect)
- [ ] Static conjugation DB lookup for known verbs
- **Tests:**
  - [ ] Unit: conjugation data structure validates correctly — all required tenses and persons present for a well-formed entry
  - [ ] Unit: Spanish module — spot-check conjugations for irregular verbs (ser, ir, tener) against known correct forms
  - [ ] Unit: compound tense generation — verify "he comido", "había comido", etc. are correctly formed from auxiliary + participle
  - [ ] Unit: static DB lookup — known verbs return conjugation data, unknown verbs return null
  - [x] Component: conjugation section is collapsed by default; clicking expands a tense; each form shows mini translation; tense descriptions are visible

### Phase 8: LLM Integration
- [x] Settings UI for LLM config (provider selector, API key input, model text field)
- [x] LLM API client (support Anthropic and OpenAI endpoint formats)
- [x] Secure local storage of API keys
- [x] Conjugation hydration via LLM (for verbs not in static DB)
- [x] "Hydrate" button on verb cards (new and existing)
- [x] Error handling for LLM failures (network, auth, rate limits)
- **Tests:**
  - [x] Unit (MSW): Anthropic API client — mock a successful response, verify parsed output matches expected conjugation/sentence format
  - [x] Unit (MSW): OpenAI API client — same as above for OpenAI endpoint format
  - [x] Unit (MSW): API client error handling — 401 (bad key), 429 (rate limit), network error — each produces a user-friendly error, no crash
  - [x] Component: settings UI — entering and saving API key persists it; changing provider updates the UI; clearing key removes it from storage
  - [ ] Component: hydrate button — clicking it with mock LLM response populates conjugation data on the card; clicking it when offline shows appropriate error
  - [ ] Integration (MSW): full hydration flow — add a verb card without conjugation data, click hydrate, mock LLM response, verify conjugation section populates and persists across page reload

### Phase 9: Construct Checklist
- [x] Define construct types per language (Spanish: tenses, moods)
- [x] Per-deck construct checklist UI (toggle which constructs are enabled)
- [ ] Filter review cards by enabled constructs (verb cards only show enabled tenses)
- [x] Persist checklist state per deck
- **Tests:**
  - [ ] Unit: construct filtering — with only present tense enabled, a verb card's review only tests present tense forms; enabling preterite adds preterite forms to the review pool
  - [x] Unit: non-verb cards are unaffected by construct checklist
  - [x] Unit: checklist state persists per deck — deck A can have different enabled constructs than deck B
  - [x] Component: checklist UI — toggling a construct on/off updates the stored state; review queue changes accordingly
  - [ ] E2E: create a deck with verb cards, enable only present tense, start review, verify only present tense forms appear; enable imperfect, verify imperfect forms now also appear

### Phase 10: Practice Sentence Generation
- [x] Programmatic vocab/construct selector (random verb, adjective, tense from reviewed pool + enabled constructs, with configurable None probabilities)
- [x] LLM prompt for sentence generation with selected components
- [x] Practice sentences tab UI (display generated sentences, show translations)
- [x] Sentences persist until user clicks regenerate
- [x] Convert practice sentence to permanent flashcard
- [x] Scope generation to per-deck vocabulary and construct settings
- **Tests:**
  - [ ] Unit: vocab selector — only selects from reviewed words, not unreviewed; only selects from enabled constructs; respects None probability (run many times, verify None appears at roughly the configured rate)
  - [ ] Unit: vocab selector — with no reviewed words, returns empty/error (not a crash)
  - [ ] Unit: vocab selector — with only one reviewed verb and one tense enabled, always selects that combination
  - [ ] Component (MSW): practice tab — click generate, mock LLM response, verify sentences display with translations; sentences persist after navigating away and back; clicking regenerate replaces them
  - [ ] Component: convert to flashcard — click the convert button on a practice sentence, verify a new card is created in the deck with correct front/back text
  - [ ] E2E: full flow — add and review some vocab, generate practice sentences, convert one to a card, verify it appears in the deck

### Phase 11: Polish & PWA Refinement
- [x] Responsive layout for mobile and desktop
- [x] Offline service worker caching for all app assets
- [x] PWA install prompt: capture the `beforeinstallprompt` event and expose an "Install as App" button in Settings that triggers it (hidden when already installed or unsupported)
- [x] Performance optimization for large decks (paginated card list, memoized search)
- [x] Error boundaries and user-facing error messages
- **Tests:**
  - [ ] E2E: responsive layout — run Playwright at mobile viewport (375×667) and desktop viewport (1280×800), verify all major views are usable (no overflow, no hidden controls)
  - [ ] E2E: offline — load the app, go offline (service worker serves cached assets), verify app still loads and review still works
  - [ ] E2E: large deck performance — import a deck with 5000+ cards, verify card list renders without lag (measure render time, assert under threshold)
  - [ ] Component: error boundaries — simulate a component crash, verify a fallback error message is shown instead of a white screen

### Known Issues
<!-- Track bugs and issues here as they arise during development -->
| # | Description | Status |
|---|-------------|--------|
| — | No issues yet | — |

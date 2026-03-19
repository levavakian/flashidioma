# FlashIdioma Testing Workflow

Use this skill whenever you change app behavior, test code, or project configuration.

## Repo-Specific Facts

- The app base path is `/flashidioma/`.
- The cloud environment's long-running dev server should be `http://127.0.0.1:4174/flashidioma/`.
- The existing Playwright config uses `vite preview` on `http://127.0.0.1:4173/flashidioma/`.
- Prefer Chromium for browser-based verification in the cloud environment.
- `npm run test:e2e` is preview-driven, so run `npm run build` before relying on it.

## Pick The Smallest Sufficient Test Set

- Logic-only or state-only changes: run `npm test`.
- UI-only changes: run targeted Playwright coverage and the visual testing skill.
- Routing, persistence, import/export, review flow, or PWA changes: run `npm test`, `npm run build`, and relevant Playwright coverage.
- Translation flow changes: prefer deterministic unit/component coverage first because the live translation E2E path is network-sensitive.

## Recommended Workflow

1. Start with fast deterministic coverage:

```bash
npm test
```

2. If you touched lint-sensitive code or config, also run:

```bash
npm run lint
```

3. If the change affects built output, routing, assets, or PWA behavior, build the app:

```bash
npm run build
```

4. Run a targeted Playwright check before considering the full suite. Useful examples from this repo:

```bash
npx playwright test tests/e2e/app.spec.ts --grep "desktop viewport"
npx playwright test tests/e2e/app.spec.ts --grep "full workflow"
npx playwright test tests/e2e/app.spec.ts --grep "offline"
```

5. If the user can see the change, also use the visual testing skill and keep PNG artifacts in `test-results/cloud-agent/`.

6. Only run the full E2E suite when the change spans multiple flows or you need broad regression coverage:

```bash
npm run build
npm run test:e2e
```

## What To Report Back

- The exact commands you ran.
- Which user flows you verified.
- Any remaining gaps, especially slow tests you skipped or checks that depend on external network behavior.

## Agent-Owned Cursor Files And Memory

- The agent may edit `.cursor/environment.json`, `.cursor/Dockerfile`, and files under `.cursor/skills/`.
- Only make those edits for durable, reusable, high-leverage improvements.
- Do not change those files for one-off task-specific convenience.
- If the agent edits its own environment or skills, add an `Agent Requests` section to the PR explaining what changed and why.
- If the agent has a general capability request or tooling request, add an `Agent Requests` section to the PR describing what is needed and why it is high leverage.
- Keep durable, long-term memory in `.cursor/memories.md`.
- Use `.cursor/memories.md` for high-leverage information that should survive across agent runs.
- Record rejected or deferred high-leverage requests there so future agents do not ask for them every time.
- Do not store transient debugging notes or one-off task context there.

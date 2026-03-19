# Cursor Memories

Use this file for durable, high-leverage information that should survive across different agent runs. Keep it concise and prune stale entries.

## Stable Repo Facts

- The app base path is `/flashidioma/`.
- The cloud-agent environment is configured in `.cursor/environment.json` and `.cursor/Dockerfile`.
- The default long-running dev server is `http://127.0.0.1:4174/flashidioma/`.
- Preview-based Playwright checks use `npm run build` and `http://127.0.0.1:4173/flashidioma/`.
- Prefer Chromium-only Playwright screenshot capture for visual verification in containerized runs.

## Rejected Or Deferred High-Leverage Requests

- None yet.

## Maintenance Notes

- Add durable decisions, reusable commands, and important cross-run context here.
- Do not add transient debugging notes or one-off task details.
- If a high-leverage request is rejected, record it here so future agents do not keep asking for it.

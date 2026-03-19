# FlashIdioma Visual Testing

Use this skill for any change that affects visible UI, layout, navigation, or any user-facing state that should be verified on screen.

## Why This Skill Exists

Cloud agents for this repo should not rely on computer-use browser control. Instead, render the page headlessly with Playwright, save PNG artifacts, and inspect those images to verify the UI.

## Preferred Visual Test Targets

- Use the dev server on `http://127.0.0.1:4174/flashidioma/` for quick iteration against the current working tree.
- Use the preview server on `http://127.0.0.1:4173/flashidioma/` for production-like checks and for anything aligned with the repo's Playwright config.
- Prefer Chromium-only commands in containerized environments.

## Proven Screenshot Commands

These commands were validated in this repo.

1. Build if you want preview-based verification:

```bash
npm run build
```

2. Start preview if it is not already running:

```bash
npm run preview -- --host 0.0.0.0 --port 4173
```

3. Capture desktop and mobile screenshots:

```bash
mkdir -p test-results/cloud-agent
npx playwright screenshot --browser=chromium http://127.0.0.1:4173/flashidioma/ test-results/cloud-agent/home-desktop.png
npx playwright screenshot --browser=chromium --viewport-size=390,844 http://127.0.0.1:4173/flashidioma/ test-results/cloud-agent/home-mobile.png
```

## How To Use The Images

- Open the PNG artifacts from `test-results/cloud-agent/` and inspect them directly.
- Check for blank screens, broken layout, clipped controls, missing headings, wrong navigation state, and obvious visual regressions.
- On mobile-sized screenshots, check for horizontal overflow, hidden buttons, or bottom-nav overlap.
- On desktop-sized screenshots, check that major tabs and actions are visible without layout breakage.
- Keep screenshots as supporting evidence, not as a replacement for DOM assertions or targeted Playwright checks.

## For Stateful Or Post-Interaction Screens

- If the initial route is not enough, write a focused Playwright script or targeted test that drives the page into the needed state and then calls `page.screenshot(...)`.
- Save those screenshots in `test-results/cloud-agent/` with descriptive names.
- Clean up temporary debug-only scripts when they are no longer useful.

## What To Report Back

- Which URL and viewport you captured.
- Which screenshots you inspected.
- What visual issues you checked for.
- Any remaining uncertainty if you could not reach the exact state that needed a screenshot.

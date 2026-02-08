# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of Truth

**README.md is the source of truth** for all project requirements, constraints, and desiderata. Always refer to it before implementing features. When requirements are added or changed, update README.md accordingly — it is the living design document for this project.

The **"Project Plan & Tracker"** section at the bottom of README.md is the implementation plan and issue tracker. When completing work, mark items as done (`[x]`). When bugs are found, add them to the Known Issues table. When new work is identified, add it to the appropriate phase or create a new one.

## Project Overview

flashidioma is a language-learning flashcard PWA built with React + TailwindCSS. It runs as a static site on GitHub Pages with all data stored locally (no server). See README.md for full requirements.

## Key Architectural Constraints

- **No server:** everything runs client-side. API keys are stored in local storage and API calls go directly from the browser.
- **Offline-first:** core flashcard and review functionality must work without internet. Translation and LLM features degrade gracefully.
- **Multi-language ready:** data models and construct systems must be language-agnostic, even though only Spanish is implemented now.
- **Static deployment:** the build output must be purely static assets deployable to GitHub Pages.

## Development Environment

Claude Code runs inside a Docker dev container. The container is defined by `Dockerfile`, `entrypoint.sh`, `build.sh`, and `run.sh` in the repo root.

- **Build:** `./build.sh` builds the Docker image.
- **Run:** `ANTHROPIC_API_KEY=<key> ./run.sh` starts the container and drops into a shell. The project directory is mounted at `/app` with UID/GID matching so file edits don't cause permission issues.
- **Dev dependencies** (npm packages, etc.) should be managed by the project's package manager (npm) and installed at runtime via `npm install`. The Dockerfile should only be updated for **system-level** dependencies (e.g. new OS packages, global CLI tools). If a new system dependency is added, prompt the user to rebuild the Docker image with `./build.sh`.
- **Git access:** The container has `git` and SSH keys configured, so you can push directly to origin. After making significant changes, push and verify the deployed GitHub Pages site at `https://levavakian.github.io/flashidioma/`.

## Deployment

The app is deployed to GitHub Pages via a GitHub Actions workflow (`.github/workflows/deploy.yml`). On every push to `main`, the workflow runs `npm ci && npm run build` and deploys the `dist/` directory. The live site is at `https://levavakian.github.io/flashidioma/`.

## Spanish Data Dependency

The app depends on [doozan/spanish_data](https://github.com/doozan/spanish_data) pinned to tag `2026-02-01`. This is NOT a git submodule — a preprocessing script fetches the raw data at build time and produces a JSON artifact that gets bundled with the app.

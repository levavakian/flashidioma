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

## Spanish Data Dependency

The app depends on [doozan/spanish_data](https://github.com/doozan/spanish_data) pinned to tag `2026-02-01`. This is NOT a git submodule — a preprocessing script fetches the raw data at build time and produces a JSON artifact that gets bundled with the app.

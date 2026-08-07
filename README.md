# Bug Bounty Checklist

An offline-first bug bounty workbench: a huge, structured testing checklist plus a set of
recon and PoC tools, packaged as a desktop app (Electron) or run in the browser.
All data stays local — no backend, no accounts.

> Use responsibly and only against targets you are explicitly authorized to test.

## What's inside

**The checklist** — ~8,000 checks across 6 platforms, organized like the OWASP WSTG:

| Platform | Categories | Checks |
|----------|-----------:|-------:|
| 🌐 Web | 88 | 4,032 |
| 🔌 API | 28 | 1,303 |
| 🤖 Android | 27 | 1,141 |
| 🖥️ Thick Client | 20 | 764 |
| 🍏 iOS | 15 | 620 |
| ⛓️ Web3 | 2 | 99 |

Each check has:
- a **status** (Not Tested → In Progress → Not Vulnerable / Vulnerable / WAF Blocked / Needs Retest),
- a **"How to test" guide** with copy-to-clipboard commands and `{{TARGET}}` templating (auto-filled from your scope),
- **notes + screenshot** evidence,
- a **severity** (VRT-anchored on the Web platform).

**Web Focus view** — instead of scrolling 88 categories, pick the part of the app you're
testing (Login & Auth, Search & Inputs, File Upload, SSRF, …) and it surfaces just the
relevant categories, each with a live coverage strip. Cards open full-screen into the real
check list. Toggle **✎ Edit** to switch back to the classic editable list.

**Tools & engines**
- **Payload Vault** — payload library, mutation generator, reverse-shell builder
- **PoC Sandbox** — JWT manipulator, XSS tester, regex analyzer
- **Recon URL Parser** — classifies wayback/recon URLs into vuln buckets (XSS, SQLi, SSRF, …)
- **Recon Diff** — diff two recon runs to spot new assets
- **Fingerprint / Methodology / Test-Flow** engines and a **Dashboard** for progress
- Optional **AI scenario generation** (bring your own Google Gemini API key)

**Workflow niceties** — multiple projects, per-category timers, dark/light theme,
command palette (`Ctrl/Cmd + K`), import/export, all persisted in `localStorage` / `localforage`.

## Setup & run

Requires Node.js 18+.

```bash
npm install        # first-time setup
npm run dev        # dev server with hot reload → http://localhost:5173
```

## Build

```bash
npm run build      # production build into dist/
npx serve dist     # preview the built files
```

## Desktop app (Electron)

```bash
npm run build      # build the web assets first
npm run electron   # launch the desktop app
npm run dist       # package a Windows installer into release/
```

## Project layout

```
src/
  App.jsx                 # top-level shell, view switching
  components/             # UI: checklist, WebFocusView, tools, modals
  hooks/                  # useChecklist, useProjects, useTimer, usePayloads, useTheme
  data/                   # defaultCategories.js (the checklist), defaultGuides.js
                          # (how-to-test content), webSurfaces.js (Focus map), …
  utils/storage.js        # localStorage schema + versioned reseeding
electron/main.cjs         # Electron entry point
```

Checklist **structure** (categories/sections/checks) is shared across all projects; your
**progress, notes, guides, scope, and timers** are stored per project. Bumping
`CATEGORIES_VERSION` in `src/utils/storage.js` reseeds the shipped checklist while keeping
your progress (which is keyed by check ID).

## Tech

React 19 · Vite 8 · Electron 42 · react-virtuoso · localforage — no server, no telemetry.

## Tests

Small, framework-free checks run with plain Node:

```bash
node src/data/webSurfaces.test.mjs   # Focus-map coverage + coverage math
node src/data/guideLookup.test.js    # guide lookup survives check renames
```

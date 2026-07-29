# Contributing

Read `AGENTS.md` and the canonical Russian Obsidian project before planning or changing behavior.

## Local checks

```sh
npm install
npm run check
git diff --check
```

Use `npm run dev` for a watch build. Load the resulting `main.js`, `manifest.json`, and optional `styles.css` only in a dedicated disposable test vault. Never develop or run mutation scenarios first in the production vault.

Tests use Node's test runner through `tsx` and must cover operation planning, FIFO and expiration ordering, strict local dates, calendar-input local-day defaults, manual-date normalization, property selection, Archives exclusion, path validation, typed vault lookup, input cancellation, queue transitions, explicit status replacement, exact compensation, destructive-action revalidation, editor-exit decisions, the public command surface, action availability, and recovery reports without loading the Obsidian runtime or requiring a live vault. `npm run check` is the same build, lint, and test gate used by CI. Manual Obsidian evidence complements, but does not replace, automated checks.

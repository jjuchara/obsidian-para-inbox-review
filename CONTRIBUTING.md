# Contributing

Read `AGENTS.md` and the canonical Russian Obsidian project before planning or changing behavior.

## Local checks

```sh
npm install
npm run check
git diff --check
```

Use `npm run dev` for a watch build. Load the resulting `main.js`, `manifest.json`, and optional `styles.css` only in a dedicated disposable test vault. Never develop or run mutation scenarios first in the production vault.

Tests should cover operation planning, FIFO ordering, validation, queue transitions, compensation, and recovery reports without requiring a live vault. Manual Obsidian evidence complements, but does not replace, automated checks.

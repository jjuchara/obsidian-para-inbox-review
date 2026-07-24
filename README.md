# PARA Inbox Review

An Obsidian community plugin for reviewing an Inbox as a predictable FIFO queue and sorting notes into Projects, Areas, Resources, or Archives.

## Status

The repository is under active development. The FIFO loader, review session model, transaction executor, and official-API mutation adapter are implemented and covered by automated tests; the Obsidian review UI is not implemented yet.

## Scope

The plugin will provide only the desktop Inbox review workflow shared with `nvim-obsidian-para-flow`:

- open the oldest Inbox note first;
- edit the note in Obsidian's native Markdown editor;
- sort it into a configured PARA folder while adding only missing required metadata;
- skip a note for the current pass, pause review, or move it to the configured Obsidian trash after confirmation;
- preflight all required input and destination conflicts before mutation;
- stop with an exact recovery report if a multi-step mutation cannot be fully rolled back.

Capture, Home, general search, multi-note merge, and Daily notes are outside this plugin.

## Implemented foundation

- direct-child Markdown filtering for the configured Inbox folder;
- FIFO ordering by creation time with a deterministic path tie-breaker;
- immutable source snapshots for later external-change preflight;
- independent active, finished, paused, closed, and halted session states;
- immutable complete, skip, pause, close, and halt transitions;
- summaries that distinguish an empty Inbox from a pass completed with skipped notes.
- a pure PARA metadata planner that preserves existing values, reports missing input, moves last, and emits reverse compensation steps.
- an async transaction executor that rechecks file and metadata snapshots, blocks destination conflicts, applies properties in order, moves last, and reports complete or incomplete rollback.
- an Obsidian mutation adapter that performs typed Markdown lookup, reads fresh frontmatter snapshots, uses atomic frontmatter edits, moves through `FileManager.renameFile()`, and sends confirmed deletions through `FileManager.trashFile()`.

## Settings

The plugin stores explicit vault-relative roots for Inbox, Projects, Areas, Resources, and Archives. Projects and Areas also have explicit index wikilinks used only when a sorted note is missing its `links` property. Settings are persisted through Obsidian's plugin data API; paths are not guessed from the active file.

## Development

Requirements: Node.js 18 or newer and npm.

```sh
npm install
npm run check
npm run dev
```

Develop and manually test only in a disposable Obsidian vault. A production build writes `main.js` at the repository root; the file is ignored by Git and is intended for release assets.

## Documentation

Product design, roadmap, decisions, and manual evidence are maintained in Russian in the canonical Obsidian project:

- `1. Projects/obsidian para flow/Плагин для PARA Обсидиан.md`
- `1. Projects/obsidian para flow/DESKTOP_INBOX_REVIEW.md`

This repository contains only code-adjacent English contracts needed to develop, verify, and release the plugin.

## Privacy

The planned plugin is local-only. It must not transmit vault content, filenames, metadata, or usage information and must not include telemetry.

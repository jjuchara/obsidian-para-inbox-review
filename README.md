# PARA Inbox Review

An Obsidian community plugin for reviewing an Inbox as a predictable FIFO queue and sorting notes into Projects, Areas, Resources, or Archives.

## Status

The repository is under active development. The automated Inbox review workflow is implemented and covered by tests, including native-editor save, PARA input collection, transactional sorting, confirmed trash, and halted recovery output. Disposable-vault manual verification is still required before production use.

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
- the `Open inbox review` command and ribbon action, a native editor for the current FIFO note, and an `ItemView` with queue status, skip, and pause controls.
- Projects, Areas, Resources, and Archives controls with nested destination-folder selection, existing `#area` note selection when required, archive-reason input, skip, pause, close, transaction results, and exact halted recovery output.
- confirmed movement to the user's configured Obsidian trash; permanent deletion is not exposed.

## Commands

- `Open inbox review` rebuilds the FIFO queue, opens the oldest note in Obsidian's native Markdown editor, and reveals the review view.

Before a PARA action, the plugin saves the current native Markdown view, reads a fresh source snapshot, collects every required input, and then revalidates the source immediately before the first mutation. Canceling a selector or prompt leaves the note and session unchanged.

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

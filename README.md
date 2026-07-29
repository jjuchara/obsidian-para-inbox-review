# PARA Review

An Obsidian community plugin with independent Inbox and expired-note review workflows.

## Status

Release `0.3.0` makes a native calendar the default expired-note reschedule input, keeps strict manual entry as an explicit fallback, and is covered by a 64-test automated gate. The owner completed the agreed disposable-vault manual gate for both expired-note interfaces without issues; the exact Obsidian version and UI provider were not separately reported. Submission to the Obsidian Community Directory is pending owner authentication.

## Scope

The plugin provides two user-started review workflows shared with `nvim-obsidian-para-flow`:

- open the oldest Inbox note first;
- edit the note in Obsidian's native Markdown editor;
- sort it into a configured PARA folder while adding only missing required metadata;
- skip a note for the current pass, pause review, or move it to the configured Obsidian trash after confirmation;
- preflight all required input and destination conflicts before mutation;
- stop with an exact recovery report if a multi-step mutation cannot be fully rolled back.
- review Projects whose `deadline` has passed and other non-archive Markdown notes that opt in with `expired_at`; strict `YYYY-MM-DD` and `DD.MM.YYYY` calendar dates are accepted, while rescheduling writes ISO;
- reschedule a candidate through a native today-or-later calendar or explicit strict manual entry, archive it, confirm trash, or skip it without background mutation;
- require a configurable new project status before an expired Project is archived.

Capture, Home, general search, multi-note merge, and Daily notes remain outside this plugin.

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
- a shared native `list-checks` icon for the ribbon action and review view, a native editor for the current FIFO note, and an `ItemView` with queue status and review controls.
- Projects, Areas, Resources, and Archives controls in an evenly spaced category row, with skip, pause, trash, and close grouped in a separate review-control row that wraps safely on narrow sidebars.
- Nested destination-folder selection, existing `#area` note selection when required, archive-reason input, transaction results, and exact halted recovery output.
- confirmed movement to the user's configured Obsidian trash only after a second source snapshot matches the pre-confirmation baseline; permanent deletion is not exposed.
- pause returns to the native editor, while close offers save, discard, and safe cancel when the current editor has unsaved changes.
- plugin-scoped modal action rows with theme spacing, wrapping, and native Obsidian buttons.
- nine Inbox-review commands that users can bind in Settings → Hotkeys; action commands are disabled unless an idle active item exists, the plugin defines no default hotkeys, and the review controls keep the assignment location visible.
- an independent expired-note queue, `archive-restore` ribbon/view, six current-item/session commands plus its opening command, a native calendar-first reschedule modal with manual dual-format fallback, visible invalid-metadata diagnostics, and Archives exclusion.

## Commands

- `Open inbox review` rebuilds the FIFO queue, opens the oldest note in Obsidian's native Markdown editor, and reveals the review view.
- `Sort current note into Projects`
- `Sort current note into Areas`
- `Sort current note into Resources`
- `Sort current note into Archives`
- `Skip current note`
- `Pause inbox review`
- `Move current note to trash`
- `Close inbox review`

Expired-note commands:

- `Open expired-note review`
- `Change current expiration date`
- `Archive current expired note`
- `Move current expired note to trash`
- `Skip current expired note`
- `Pause expired-note review`
- `Close expired-note review`

Assign commands in Obsidian's Settings → Hotkeys. The two opening commands are always available; current-item commands require an idle item in their own session. No command has a default hotkey.

Before a PARA action, the plugin saves the current native Markdown view, reads a fresh source snapshot, collects every required input, and then revalidates the source immediately before the first mutation. Trash follows the same safety shape: save, inspect, confirm, inspect again, and delete only if both inspections match. Canceling a selector or prompt leaves the note and session unchanged.

## Settings

The plugin stores explicit vault-relative roots for Inbox, Projects, Areas, Resources, and Archives. Projects and Areas also have explicit index wikilinks used only when a sorted note is missing its `links` property. `Project archive statuses` is a comma-separated non-empty list with defaults `Завершено, Отменено`. Settings are persisted through Obsidian's plugin data API; paths and archive destinations are not guessed.

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
- `1. Projects/obsidian para flow/ARCHIVE_REVIEW_DESIGN.md`

This repository contains only code-adjacent English contracts needed to develop, verify, and release the plugin.

## Privacy

The plugin is local-only. It does not transmit vault content, filenames, metadata, or usage information and includes no telemetry.

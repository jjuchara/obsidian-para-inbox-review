# Architecture

## Boundary

`PARA Inbox Review` is an Obsidian UI adapter for the established Inbox review contract. It does not own capture, Home, search, merge, or Daily workflows.

## Runtime model

- Use an ordinary `MarkdownView` as the editor for the current note.
- Use a dedicated `ItemView` for queue state, actions, prompts, and recovery output.
- Each pass is built from Markdown files directly under the configured Inbox folder, ordered oldest first by `TFile.stat.ctime` with a deterministic path tie-breaker. The loader records `mtime` and size for later external-change preflight.
- Session state is an immutable domain model independent from workspace leaves. It distinguishes active, finished, paused, closed, and halted states; only an active state can advance.
- A skipped note leaves the current pass but remains in the Inbox summary. `inboxEmpty` is true only after every queued note was successfully processed and none was skipped.

## Official API boundary

- Read vault-visible files through `Vault` and display content through native Obsidian views.
- Resolve configured paths with `normalizePath()` and typed `TFile`/`TFolder` checks.
- Add only missing metadata with `FileManager.processFrontMatter()`.
- Move notes with `FileManager.renameFile()` so Obsidian applies its link-update behavior.
- Confirm deletion and use `FileManager.trashFile()` so the user's trash preference is respected.
- Register commands, views, and events through `Plugin` lifecycle helpers.

Direct filesystem, Adapter, Node, Electron, network, and telemetry access are outside the planned architecture. The manifest therefore remains mobile-compatible unless later implementation evidence requires a desktop-only API.

## Mutation safety

A PARA action is a multi-step operation, not an atomic Obsidian API transaction. The implementation must therefore:

1. collect all missing input and validate source, destination folder, and exact path conflict;
2. snapshot the source path and affected metadata;
3. add only missing required metadata;
4. move the file last;
5. compensate completed metadata changes in reverse order if the move fails;
6. halt the session with an exact recovery report if compensation is incomplete.

Existing metadata and note body content remain unchanged unless the user edits the note in the native editor.

The pure planner is implemented independently from Obsidian APIs. It produces a preflight report, complete metadata snapshot, ordered property additions, a move-last step, and reverse compensation steps. Missing `area`, `archive_reason`, `created`, or `archived` values remain visible in preflight and prevent a future executor from starting.

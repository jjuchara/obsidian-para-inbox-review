# Architecture

## Boundary

`PARA Inbox Review` is an Obsidian UI adapter for the established Inbox review contract. It does not own capture, Home, search, merge, or Daily workflows.

## Runtime model

- Use an ordinary `MarkdownView` as the editor for the current note.
- Use a dedicated `ItemView` for queue state, actions, prompts, and recovery output.
- Each pass is built from Markdown files directly under the configured Inbox folder, ordered oldest first by `TFile.stat.ctime` with a deterministic path tie-breaker. The loader records `mtime` and size for later external-change preflight.
- Session state is an immutable domain model independent from workspace leaves. It distinguishes active, finished, paused, closed, and halted states; only an active state can advance.
- A skipped note leaves the current pass but remains in the Inbox summary. `inboxEmpty` is true only after every queued note was successfully processed and none was skipped.
- A tested review controller owns the current session independently from the view, serializes asynchronous navigation, and commits a skip only after the next note opens successfully. The plugin lifecycle registers the command, ribbon action, and `ItemView`; the current note opens in a normal workspace leaf.

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

The executor depends on a narrow asynchronous mutation port instead of Obsidian globals. Before the first write it rejects missing input, changed file evidence, changed metadata, inspection errors, and exact destination conflicts. It records only successful property steps, compensates those steps in reverse after an apply or move failure, and distinguishes complete rollback from a halted incomplete-recovery result.

The concrete Obsidian adapter is now implemented behind that port. It rejects absolute, traversal, backslash, and non-Markdown paths before lookup; resolves source files with a typed `TFile` check; reads current note content through `Vault.read()` and parses its frontmatter with `getFrontMatterInfo()` plus `parseYaml()` rather than relying on a potentially stale metadata cache; and rejects a file whose `mtime` or size changes during inspection. Each property mutation uses `processFrontMatter()`, moving uses `renameFile()`, and trashing uses `trashFile()`. Adapter behavior is tested through a structural boundary so automated tests never load or mutate a real vault.

The PARA action service composes the pure planner and executor. It first calls `MarkdownView.save()` for the active source, obtains a fresh file/metadata snapshot, then collects an existing destination folder and any missing area or archive reason. The executor performs a second inspection after those prompts, so native edits made before the action are accepted while changes during the action are rejected. Folder and area discovery may use current vault objects and metadata cache because they are UI choices, not safety snapshots. A successful action completes the queue item; cancellation, preflight failure, or complete rollback keeps it active; incomplete rollback halts the session with exact recovery details.

Obsidian's `FuzzySuggestModal` closes before it invokes `onChooseItem()`. Choice settlement therefore records the selected value and resolves the awaiting action on the next window macrotask after `onClose()`. This both distinguishes a real selection from cancellation and prevents a second selector from being mounted inside the first modal's teardown lifecycle.

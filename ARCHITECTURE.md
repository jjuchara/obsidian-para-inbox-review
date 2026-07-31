# Architecture

## Boundary

`PARA Review` is an Obsidian UI adapter for independent Inbox and expired-note review contracts. It does not own capture, Home, search, merge, or Daily workflows. The stable plugin id remains `para-inbox-review`.

## Runtime model

- Use an ordinary `MarkdownView` as the editor for the current note.
- Use a dedicated `ItemView` for queue state, actions, prompts, and recovery output.
- Render PARA destinations and review lifecycle controls as two semantic flex rows. Category buttons share available width; both rows wrap without clipping in narrow sidebars, using a plugin-local `styles.css` with native Obsidian button appearance.
- Use the native Lucide `list-checks` icon for both the ribbon action and review view. Plugin-owned prompt, confirmation, and editor-exit modals share one scoped action-row class with theme spacing and native buttons.
- Each pass is built from Markdown files directly under the configured Inbox folder, ordered oldest first by `TFile.stat.ctime` with a deterministic path tie-breaker. The loader records `mtime` and size for later external-change preflight.
- Session state is an immutable domain model independent from workspace leaves. It distinguishes active, finished, paused, closed, and halted states; only an active state can advance.
- A skipped note leaves the current pass but remains in the Inbox summary. `inboxEmpty` is true only after every queued note was successfully processed and none was skipped.
- A tested review controller owns the current session independently from the view, serializes asynchronous navigation, and commits a skip only after the next note opens successfully. The plugin lifecycle registers ten commands, the ribbon action, and `ItemView`; the current note opens in a normal workspace leaf.
- The opening command is always available. The nine current-item commands use `checkCallback()` and are exposed to Obsidian's Hotkeys settings only while an idle active item exists; no default hotkeys are registered, and the review view keeps a compact Settings → Hotkeys hint visible.
- Pause commits a terminal session and detaches the review leaf, leaving the current native editor in place. Close compares the editor contents with its saved data and, when necessary, requires an explicit save, discard, or cancel choice before closing the session.
- Expired-note review has a separate controller and `ItemView`. Its loader inspects vault-visible Markdown files outside Archives, uses `deadline` for the configured Projects root and opt-in `expired_at` elsewhere, accepts strict `YYYY-MM-DD` and `DD.MM.YYYY` calendar dates, rejects other non-empty values, and sorts overdue candidates oldest first. Rescheduling normalizes storage to ISO.
- Rescheduling revalidates the source around a calendar-first modal and writes one typed date property. The native date input starts at the local current day, rejects earlier calendar choices, and returns ISO; an explicit manual mode accepts the same strict ISO and `DD.MM.YYYY` contract before normalization. Project archival collects a configured status before the existing folder/reason flow and passes status as an explicit replacement with reverse compensation.
- Inbox expiration calls the same save/inspect/pick/reinspect/write action with fixed `expired_at`, but returns a stay transition so the FIFO item is not processed. Cancel, invalid/past input, and unequal source evidence stop before `processFrontMatter()`.

## Official API boundary

- Read vault-visible files through `Vault` and display content through native Obsidian views.
- Resolve configured paths with `normalizePath()` and typed `TFile`/`TFolder` checks.
- Add only missing metadata with `FileManager.processFrontMatter()`, except for a user-confirmed expiration reschedule or Project status replacement during archival.
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

Existing metadata and note body content remain unchanged unless the user edits the note in the native editor or explicitly chooses a documented replacement action.

The pure planner is implemented independently from Obsidian APIs. It produces a preflight report, complete metadata snapshot, ordered property additions, a move-last step, and reverse compensation steps. Missing `area`, `archive_reason`, `created`, or `archived` values remain visible in preflight and prevent a future executor from starting.

The executor depends on a narrow asynchronous mutation port instead of Obsidian globals. Before the first write it rejects missing input, changed file evidence, changed metadata, inspection errors, and exact destination conflicts. It records only successful property steps, compensates those steps in reverse after an apply or move failure, and distinguishes complete rollback from a halted incomplete-recovery result.

The concrete Obsidian adapter is now implemented behind that port. It rejects absolute, traversal, backslash, and non-Markdown paths before lookup; resolves source files with a typed `TFile` check; reads current note content through `Vault.read()` and parses its frontmatter with `getFrontMatterInfo()` plus `parseYaml()` rather than relying on a potentially stale metadata cache; and rejects a file whose `mtime` or size changes during inspection. Each property mutation uses `processFrontMatter()`, moving uses `renameFile()`, and trashing uses `trashFile()`. Adapter behavior is tested through a structural boundary so automated tests never load or mutate a real vault.

Trash is a separate tested action transaction. It saves the native editor, captures fresh file and metadata evidence, asks for confirmation, captures the evidence again, and calls `trashFile()` only when both inspections match. Cancellation and a changed source remain mutation-free.

The PARA action service composes the pure planner and executor. It first calls `MarkdownView.save()` for the active source, obtains a fresh file/metadata snapshot, then collects an existing destination folder and any missing area or archive reason. The executor performs a second inspection after those prompts, so native edits made before the action are accepted while changes during the action are rejected. Folder and area discovery may use current vault objects and metadata cache because they are UI choices, not safety snapshots. A successful action completes the queue item; cancellation, preflight failure, or complete rollback keeps it active; incomplete rollback halts the session with exact recovery details.

Obsidian's `FuzzySuggestModal` closes before it invokes `onChooseItem()`. Choice settlement therefore records the selected value and resolves the awaiting action on the next window macrotask after `onClose()`. This both distinguishes a real selection from cancellation and prevents a second selector from being mounted inside the first modal's teardown lifecycle.

Rollback distinguishes property presence from semantic emptiness. If a required property existed as an empty string or `null`, compensation restores that exact value instead of deleting the key. A malformed non-empty `tags` value fails closed before any metadata mutation rather than being overwritten during normalization.

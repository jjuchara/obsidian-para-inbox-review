# Decisions

## 2026-07-24 — Keep the plugin limited to Inbox review

- Status: accepted.
- The repository implements only the compatible FIFO Inbox review workflow.
- Capture, Home, general search, multi-note merge, and Daily notes remain in their existing owners or future project phases.

## 2026-07-24 — Use native views and official vault APIs

- Status: accepted for implementation.
- The current note opens in Obsidian's native Markdown editor; a dedicated item view owns review controls and queue state.
- Metadata uses `FileManager.processFrontMatter()`, moves use `FileManager.renameFile()`, and deletion uses `FileManager.trashFile()`.
- Direct filesystem access, network calls, and telemetry are excluded.

## 2026-07-24 — Preserve the existing transaction contract

- Status: accepted for implementation.
- Review collects every required value and completes preflight before the first mutation.
- Required metadata is added only when missing, the note body is preserved, and the move occurs last.
- A failed mutation compensates completed steps or halts with an exact recovery report.

## 2026-07-24 — Keep queue and session behavior independent from Obsidian UI

- Status: accepted and implemented for the initial domain slice.
- The Obsidian adapter supplies typed file snapshots; pure domain code filters and orders the Inbox without accessing workspace state.
- Session transitions are immutable and reject advancement outside the active state.
- Skipped notes are retained separately so a finished pass cannot be confused with an empty Inbox.

## 2026-07-24 — Port the released Neovim metadata plan exactly

- Status: accepted and implemented in the pure planner.
- Property order, value types, missing-input reporting, tag normalization, move-last behavior, and reverse compensation match the released Neovim contract.
- The planner accepts explicit Projects and Areas index links rather than discovering MOC notes.
- Existing non-empty metadata is never overwritten, and the planner never receives or changes note body content.

## 2026-07-24 — Put transaction semantics behind an injected async port

- Status: accepted and implemented for the executor slice.
- Pure execution code owns preflight ordering, applied-step tracking, move-last, reverse compensation, and recovery results.
- The Obsidian adapter owns only typed lookup, fresh frontmatter inspection, path validation, and individual `FileManager` operations.
- No mutation begins if the file snapshot, metadata snapshot, required input, or destination check differs from the plan.

## 2026-07-24 — Read fresh frontmatter for mutation preflight

- Status: accepted and implemented in the Obsidian adapter.
- Mutation preflight reads current note content with `Vault.read()` and parses only its frontmatter with the official `getFrontMatterInfo()` and `parseYaml()` helpers.
- `MetadataCache.getFileCache()` is not used for this safety check because cache freshness is event-driven and may lag behind a native-editor save.
- The adapter compares file `mtime` and size before and after the read, rejects unsafe vault paths, and keeps all writes on `FileManager` APIs.

## 2026-07-24 — Keep navigation state outside the review view

- Status: accepted and implemented for the first native UI slice.
- A review controller owns session and pending state; `ItemView` subscribes to snapshots and can be recreated without advancing the queue.
- Start and skip serialize navigation, open notes in Obsidian's native editor, and commit a transition only after the required note opens successfully.
- The initial shell exposed start, skip, and pause; the later action slice below adds PARA and trash controls without moving session ownership into the view.

## 2026-07-24 — Save native edits before establishing the action snapshot

- Status: accepted and implemented for the complete automated review flow.
- A PARA action calls `MarkdownView.save()` before its first inspection, so edits intentionally made in the native editor become the operation baseline rather than an external-change error.
- Folder, area, and archive-reason input is collected after that inspection. The transaction executor inspects again immediately before mutation and rejects any source change that occurred during input collection.
- Destination folders are selected from the configured root and its existing descendants. Missing area values are selected only from existing notes tagged `#area`; existing non-empty metadata is never prompted or overwritten.
- Cancellation stays mutation-free. Successful sorting or confirmed trash advances the queue, complete rollback keeps the item active, and incomplete rollback halts the session with exact recovery details.

## 2026-07-24 — Settle fuzzy choices after modal teardown

- Status: accepted, implemented, regression-tested, and verified in Obsidian 1.12.7.
- `FuzzySuggestModal` calls `onClose()` before `onChooseItem()` and a follow-up modal cannot safely mount inside the first modal's teardown.
- The adapter records a later choice and resolves selection or cancellation on the next window macrotask. This preserves cancellation while allowing folder selection to continue into an area selector.

## 2026-07-27 — Revalidate destructive trash after confirmation

- Status: accepted, implemented, and regression-tested.
- Trash saves and inspects the current source before confirmation, then repeats the inspection after confirmation and deletes only when file and metadata evidence still match.
- A canceled confirmation or changed source leaves the note and active session unchanged.

## 2026-07-27 — Restore exact property presence during compensation

- Status: accepted, implemented, and regression-tested.
- Compensation uses key presence rather than semantic non-emptiness, so existing empty strings and null values are restored exactly after a failed operation.
- Non-empty malformed `tags` data fails closed before mutation instead of being silently replaced.

## 2026-07-27 — Make pause and close editor-safe

- Status: accepted, implemented, and regression-tested at the pure decision boundary.
- Pause ends the review surface while keeping the current native editor open.
- Close proceeds immediately for a clean editor; an unsaved editor requires an explicit save, discard, or cancel choice, and cancel preserves the active session.

## 2026-07-27 — Use native iconography and Obsidian hotkey assignment

- Status: accepted, implemented, and covered by contract tests.
- The ribbon action and review view share the native Lucide `list-checks` icon; the manifest gains no non-standard icon field and the plugin ships no custom SVG.
- Opening plus the eight active-review actions are registered as Obsidian commands. Users assign shortcuts in Settings → Hotkeys, while the plugin intentionally defines no default hotkeys.
- Current-item commands are available only for an idle active item, so a shortcut cannot bypass pending-action safety. Plugin-owned modal action rows use scoped CSS, theme spacing variables, and native Obsidian buttons.

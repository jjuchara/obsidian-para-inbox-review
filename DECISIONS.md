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

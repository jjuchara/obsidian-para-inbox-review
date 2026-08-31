# Changelog

All notable changes to this project will be documented in this file.

## 0.4.0 - 2026-07-31

- Added `Set expiration` to Inbox review and a tenth user-assignable command for writing
  `expired_at` through the existing calendar/manual UI without advancing the FIFO queue.
- Shared save, source revalidation, today-or-later validation, and canonical ISO mutation between
  Inbox assignment and expired-note rescheduling; the automated gate now passes 67 tests.
- The project owner explicitly authorized the feature release while the focused disposable-vault
  Inbox-expiration gate remained open; publication did not count as manual evidence.
- The focused disposable-vault Inbox-expiration gate was completed on 2026-08-31, covering the
  calendar and manual paths, cancellation, past-date and source-change refusal, ISO storage, and
  unchanged queue position.
- Published annotated tag and public GitHub Release `0.4.0` from commit
  `eca09f2286cf1fea4321e31680f8d8134f462400`; release/main CI runs `30661278632` and
  `30661278790` are green, and downloaded `main.js`, `manifest.json`, and `styles.css` match the
  local production build by SHA-256.

## 0.3.0 - 2026-07-29

- Replaced the expired-note reschedule text-only prompt with a native calendar initialized to the
  local current day and constrained to today or later.
- Kept strict `YYYY-MM-DD` and `DD.MM.YYYY` entry behind an explicit manual fallback, with safe
  round-tripping back to the calendar and canonical ISO storage.
- Added isolated coverage for local calendar defaults and manual-to-calendar normalization; the
  automated gate now passes 64 tests.
- The owner completed the agreed disposable-vault manual gate for both expired-note interfaces
  without issues, including discovery and invalid metadata, calendar/manual rescheduling,
  project status and archive branches, rollback, trash, and independent session behavior. The
  exact Obsidian version and UI provider were not separately reported.
- Published tag and GitHub Release `0.3.0` from commit
  `ef1a3cbde85527f66ceac160900b85e8a88f173e`; main CI `30426391265` and release build
  `30426391151` are green, and downloaded `main.js`, `manifest.json`, and `styles.css` match the
  local production build by SHA-256.

## 0.2.1 - 2026-07-28

- Accepted strict `DD.MM.YYYY` expiration dates used by the existing vault alongside ISO
  `YYYY-MM-DD`; rescheduling accepts either form and writes canonical ISO.
- Published tag and GitHub Release `0.2.1` from commit
  `3dd880ba27c644bc5bf080c403c9379e7acba5a6` after green CI run `30378684381`; release build
  `30378802519` produced `main.js`, `manifest.json`, and `styles.css` matching local SHA-256 values.

## 0.2.0 - 2026-07-28

- Expanded the display name to `PARA Review` while preserving the stable plugin id `para-inbox-review`.
- Added an independent expired-note review queue and native view/ribbon action. Projects use strict
  `deadline`; other non-archive Markdown notes opt in with `expired_at`.
- Added rescheduling to today or later, confirmed trash, skip/pause/close, explicit archive folder
  and reason collection, and configurable project status choice before archive.
- Included project status replacement in the existing source-revalidated, move-last rollback
  transaction and expanded the automated gate from 58 to 62 tests.
- The owner explicitly authorized release before the new disposable-vault manual gate and will
  validate the workflow in normal use; the open evidence is not represented as completed.
- Published tag and GitHub Release `0.2.0` from commit
  `33e6d9dffb5140dc846f6b5ca7349486e0f26c59` after green CI run `30375095730`; release build
  `30375225029` produced `main.js`, `manifest.json`, and `styles.css` matching local SHA-256 values.

## 0.1.0 - 2026-07-27

- Initialized the Obsidian community plugin development repository from the official sample template.
- Added explicit Inbox and PARA folder settings.
- Documented the Inbox-only scope and official Obsidian API architecture.
- Added the direct-child FIFO Inbox loader with deterministic ordering and file snapshots.
- Added an immutable review session model for complete, skip, pause, close, halt, and summary transitions.
- Added automated domain tests and made the CI matrix run the complete build, lint, and test gate.
- Added the shared PARA metadata normalizer and pure operation planner with missing-input preflight, move-last ordering, snapshots, and reverse compensation.
- Added explicit Projects and Areas index-link settings used only when the destination metadata is missing.
- Added the asynchronous transaction executor with source revalidation, destination-conflict preflight, ordered mutation, move-last behavior, selective rollback, and exact incomplete-recovery details.
- Added the concrete Obsidian mutation adapter with safe typed path lookup, fresh frontmatter inspection, atomic property edits, link-aware moves, configured trash handling, and isolated adapter tests.
- Added the `Open inbox review` command, inbox ribbon action, native-note navigation, review status view, and tested skip/pause controller with serialized pending actions.
- Added Projects, Areas, Resources, and Archives controls with native-editor save, nested folder selection, missing-area selection from `#area` notes, archive-reason input, transactional execution, and halted recovery rendering.
- Added explicit trash confirmation backed by the user's configured Obsidian trash and advanced the isolated gate to 43 tests.
- Fixed Obsidian `FuzzySuggestModal` lifecycle handling so a selected folder is not mistaken for cancellation and a following area selector mounts only after the first modal has fully closed; the isolated gate now passes 45 tests.
- Completed the Obsidian 1.12.7 disposable-vault gate for native save, all PARA categories, nested folder and area selection, prompt cancellation, skip, pause, close, trash cancellation/success, destination conflict, complete rollback, and incomplete rollback with exact halted recovery output.
- Revalidated the source file and metadata after trash confirmation so external changes block deletion.
- Restored exact empty and null metadata values during compensation and rejected malformed non-empty `tags` before mutation.
- Made pause return to the native editor and made close require save, discard, or cancel for unsaved editor changes.
- Expanded the automated gate from 45 to 56 tests and completed the focused disposable-vault recheck of the hardened Trash and Close flows.
- Split the review controls into a padded PARA-category row and a separate session-action row, with responsive wrapping for narrow Obsidian sidebars.
- Added a shared native `list-checks` icon to the ribbon action and review view, plus scoped padding and gap for prompt, trash-confirmation, and editor-exit modal actions.
- Registered opening, four PARA actions, skip, pause, trash, and close as nine user-assignable Obsidian commands without default hotkeys; current-item commands are unavailable outside an idle active session, and the review controls keep a compact Hotkeys hint visible.
- Expanded the automated gate to 58 tests; the owner confirmed the icon, modal spacing, and assigned-hotkey flows on Obsidian 1.12.7 after explicitly installing the release candidate in the production profile.
- Published GitHub Release 0.1.0 from commit `70be0386c5a2d129d36d5a8b0044c38f4ab0c052` after a green CI run; the three downloaded release assets matched the local SHA-256 checksums.

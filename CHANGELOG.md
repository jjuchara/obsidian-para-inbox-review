# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

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
- Expanded the automated gate from 45 to 56 tests; a focused disposable-vault recheck of the hardened Trash and Close flows remains required before publication.
- Split the review controls into a padded PARA-category row and a separate session-action row, with responsive wrapping for narrow Obsidian sidebars.

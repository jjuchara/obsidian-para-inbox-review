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

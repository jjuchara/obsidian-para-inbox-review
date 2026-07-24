# Release checklist

## Before release

- [ ] Canonical Russian documentation and affected English code-adjacent contracts are synchronized.
- [ ] `npm run check` passes.
- [ ] `git diff --check` passes.
- [ ] Inbox review passes automated success, cancellation, conflict, rollback, and incomplete-recovery scenarios.
- [ ] Manual testing passes in a disposable vault with the exact intended Obsidian version.
- [ ] The production vault has not been used for development or first-run mutation testing.
- [ ] `manifest.json` and `versions.json` agree on plugin and minimum app versions.
- [ ] The production build contains no telemetry, network access, direct filesystem access, or undeclared dependencies.

## Publication

- [ ] The release tag exactly matches the manifest version and has no leading `v`.
- [ ] The GitHub release includes `main.js`, `manifest.json`, and `styles.css` only when styles exist.
- [ ] The release notes describe shipped behavior rather than planned behavior.

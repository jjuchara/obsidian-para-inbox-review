# Release checklist

## Before release

- [x] Canonical Russian documentation and affected English code-adjacent contracts are synchronized. ✅ 2026-07-27
- [x] `npm run check` passes (56 tests). ✅ 2026-07-27
- [x] `git diff --check` passes after the complete code and documentation diff. ✅ 2026-07-27
- [x] Inbox review passes automated success, cancellation, conflict, rollback, and incomplete-recovery scenarios. ✅ 2026-07-24
- [ ] Focused Trash revalidation and save/discard/cancel Close testing passes in a disposable vault after the 2026-07-27 safety hardening. The original complete flow passed on Obsidian 1.12.7 on 2026-07-24.
- [x] The production vault has not been used for development or first-run mutation testing. ✅ 2026-07-24
- [x] `manifest.json` and `versions.json` agree on plugin and minimum app versions. ✅ 2026-07-24
- [x] The production build contains no telemetry, network access, direct filesystem access, or undeclared dependencies. ✅ 2026-07-24

## Publication

- [ ] The release tag exactly matches the manifest version and has no leading `v`.
- [ ] The GitHub release includes `main.js`, `manifest.json`, and `styles.css` only when styles exist.
- [ ] The release notes describe shipped behavior rather than planned behavior.

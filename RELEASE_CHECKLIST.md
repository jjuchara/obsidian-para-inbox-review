# Release checklist

## Before release

- [x] The current automated `npm run check` gate passes 64 tests for Inbox plus expired-note domain and calendar-input behavior. ✅ 2026-07-29
- [x] Expired-note review passes the agreed disposable-vault manual gate for both strict date formats, invalid metadata, ISO-normalized reschedule, both default project statuses, archive conflict/rollback, trash cancel/success, skip/pause/close, and independent Inbox state. The owner reported no issues; the exact Obsidian version and UI provider were not separately reported. ✅ 2026-07-29
- [x] The calendar-first modal opens on today, accepts a future date, blocks past calendar values, supports both strict manual formats, returns valid manual input to the calendar, cancels without mutation, and writes ISO. ✅ 2026-07-29
- [x] Canonical Russian documentation and affected English code-adjacent contracts are synchronized for `0.3.0`. ✅ 2026-07-29
- [x] `npm run check` passes 64 tests and `git diff --check` passes after the complete code and documentation diff. ✅ 2026-07-29
- [x] The owner explicitly authorized `0.2.0` publication before the then-open manual gate; the completed evidence is recorded above. ✅ 2026-07-28

- [x] Canonical Russian documentation and affected English code-adjacent contracts are synchronized. ✅ 2026-07-27
- [x] `npm run check` passes (58 tests). ✅ 2026-07-27
- [x] `git diff --check` passes after the complete code and documentation diff. ✅ 2026-07-27
- [x] Inbox review passes automated success, cancellation, conflict, rollback, and incomplete-recovery scenarios. ✅ 2026-07-24
- [x] Focused Trash revalidation and save/discard/cancel Close testing passes in a disposable vault after the 2026-07-27 safety hardening. The original complete flow passed on Obsidian 1.12.7 on 2026-07-24. ✅ 2026-07-27
- [x] The owner verified the `list-checks` ribbon/view icon, modal action spacing, user-assigned commands, and idle-active availability on Obsidian 1.12.7 after explicitly installing the release candidate in the production profile. ✅ 2026-07-27
- [x] The production vault has not been used for development or first-run mutation testing. ✅ 2026-07-24
- [x] `manifest.json` and `versions.json` agree on plugin and minimum app versions. ✅ 2026-07-24
- [x] The production build contains no telemetry, network access, direct filesystem access, or undeclared dependencies. ✅ 2026-07-24

## Publication

- [ ] Tag `0.3.0` resolves to the release commit and tag/main CI are green.
- [ ] Release `0.3.0` is published with `main.js`, `manifest.json`, and `styles.css`; downloaded asset SHA-256 values match the local production build.

- [x] Tag `0.2.1` resolves to commit `3dd880ba27c644bc5bf080c403c9379e7acba5a6`; CI run
  `30378684381` and release build `30378802519` are green. ✅ 2026-07-28
- [x] Release `0.2.1` is published with `main.js`, `manifest.json`, and `styles.css`; release asset
  SHA-256 values match the local production build. The owner-authorized manual evidence remains
  open. ✅ 2026-07-28

- [x] Tag `0.2.0` resolves to commit `33e6d9dffb5140dc846f6b5ca7349486e0f26c59`; CI run `30375095730` and release build `30375225029` are green. ✅ 2026-07-28
- [x] Release `0.2.0` is published with `main.js`, `manifest.json`, and `styles.css`; downloaded assets match the local SHA-256 checksums. ✅ 2026-07-28

- [x] The release tag exactly matches the manifest version and has no leading `v`; `0.1.0` resolves to commit `70be0386c5a2d129d36d5a8b0044c38f4ab0c052`. ✅ 2026-07-27
- [x] The GitHub release includes `main.js`, `manifest.json`, and `styles.css`; downloaded assets match the local SHA-256 checksums. ✅ 2026-07-27
- [x] The release notes describe shipped behavior rather than planned behavior. ✅ 2026-07-27
- [ ] The repository is submitted through `community.obsidian.md/plugins/new` after owner sign-in and GitHub linking.

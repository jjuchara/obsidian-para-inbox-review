# Release checklist

## Before release

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

- [x] The release tag exactly matches the manifest version and has no leading `v`; `0.1.0` resolves to commit `70be0386c5a2d129d36d5a8b0044c38f4ab0c052`. ✅ 2026-07-27
- [x] The GitHub release includes `main.js`, `manifest.json`, and `styles.css`; downloaded assets match the local SHA-256 checksums. ✅ 2026-07-27
- [x] The release notes describe shipped behavior rather than planned behavior. ✅ 2026-07-27
- [ ] The repository is submitted through `community.obsidian.md/plugins/new` after owner sign-in and GitHub linking.

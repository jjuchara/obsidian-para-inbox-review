# Repository Guidelines

## Project knowledge

- **The single source of truth is always the documentation project in Obsidian** (the Russian second-brain): [Плагин для PARA Обсидиан](</Users/jjuchara/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian_jjuchara/1. Projects/obsidian para flow/Плагин для PARA Обсидиан.md>). Open it in Obsidian with [Плагин для PARA Обсидиан](obsidian://open?vault=obsidian_jjuchara&file=1.%20Projects%2Fobsidian%20para%20flow%2F%D0%9F%D0%BB%D0%B0%D0%B3%D0%B8%D0%BD%20%D0%B4%D0%BB%D1%8F%20PARA%20%D0%9E%D0%B1%D1%81%D0%B8%D0%B4%D0%B8%D0%B0%D0%BD). All product thinking, planning, ideas, decisions, design, manual-testing evidence, and roadmap live and are maintained there.
- **This git repository stores only the code-adjacent English contracts required to use, maintain, verify, and release this plugin** — README, CHANGELOG, ARCHITECTURE, CONTRIBUTING, DECISIONS, LICENSE, and RELEASE_CHECKLIST. Do not create English mirrors of the second brain here.
- **Read `Плагин для PARA Обсидиан.md`, `DESKTOP_INBOX_REVIEW.md`, and the relevant files under `1. Projects/obsidian para flow/` before planning substantial work.**
- After meaningful code or behavior changes, update the affected Russian documents in the Obsidian source of truth and refresh the repository's release-facing English files when the change is user-visible.

## Current state

This repository contains the in-progress `PARA Inbox Review` Obsidian community plugin. The pure direct-child FIFO loader, file snapshots, and independent immutable review session model are implemented and tested; Obsidian UI and vault mutations are not implemented yet. Scope remains limited to a compatible Inbox review workflow. Capture, Home, general search, multi-note merge, and Daily notes remain outside this repository.

The plugin uses TypeScript, the official Obsidian API, npm, esbuild, and ESLint. Use `npm run check` before claiming changes are complete. Do not develop against the production vault; use a dedicated test vault.

## Change discipline

Keep changes focused and add automated coverage for behavior. Prefer the official `Vault`, `Workspace`, and `FileManager` APIs over direct filesystem access. Use `FileManager.processFrontMatter()` for metadata, `FileManager.renameFile()` for moves, and `FileManager.trashFile()` for deletion. Preserve existing metadata and note bodies unless the documented review action explicitly changes them.

Record user-visible changes and durable technical decisions in the repository's English changelog and decision log. Keep the corresponding product, design, roadmap, and manual-testing documentation in Russian in the canonical Obsidian project.

## Mandatory documentation gate before every commit

**Do not create or amend a commit until implementation and documentation are synchronized.** Immediately before every commit or amend:

1. Inspect the complete staged and unstaged diff and classify its effect on public behavior, configuration, commands, TypeScript API, architecture, verification, release state, decisions, manual evidence, and roadmap.
2. Update the affected Russian documents in the canonical Obsidian project first. Behavior, design, decisions, manual evidence, and roadmap must not be left only in this repository or in chat.
3. Update every affected English code-adjacent contract in the same change: README for user behavior; ARCHITECTURE and DECISIONS for durable technical contracts; CONTRIBUTING and RELEASE_CHECKLIST for verification or release workflow; CHANGELOG for user-visible changes.
4. Re-read the resulting code and documentation diff together, run `npm run check` and `git diff --check`, and verify any public command and settings documentation tests.
5. Commit code and its required documentation together. A code-only commit is allowed only after explicitly concluding that none of the documentation categories are affected.

This gate applies to implementation commits, fixes, refactors, tests that change the verification contract, and commit amendments. Release evidence discovered only after publication may use a follow-up docs-only commit because it did not exist at release-commit time.

# PARA Inbox Review

An Obsidian community plugin for reviewing an Inbox as a predictable FIFO queue and sorting notes into Projects, Areas, Resources, or Archives.

## Status

The repository is initialized for development. The review workflow is not implemented yet.

## Scope

The plugin will provide only the desktop Inbox review workflow shared with `nvim-obsidian-para-flow`:

- open the oldest Inbox note first;
- edit the note in Obsidian's native Markdown editor;
- sort it into a configured PARA folder while adding only missing required metadata;
- skip a note for the current pass, pause review, or move it to the configured Obsidian trash after confirmation;
- preflight all required input and destination conflicts before mutation;
- stop with an exact recovery report if a multi-step mutation cannot be fully rolled back.

Capture, Home, general search, multi-note merge, and Daily notes are outside this plugin.

## Development

Requirements: Node.js 18 or newer and npm.

```sh
npm install
npm run check
npm run dev
```

Develop and manually test only in a disposable Obsidian vault. A production build writes `main.js` at the repository root; the file is ignored by Git and is intended for release assets.

## Documentation

Product design, roadmap, decisions, and manual evidence are maintained in Russian in the canonical Obsidian project:

- `1. Projects/obsidian para flow/Плагин для PARA Обсидиан.md`
- `1. Projects/obsidian para flow/DESKTOP_INBOX_REVIEW.md`

This repository contains only code-adjacent English contracts needed to develop, verify, and release the plugin.

## Privacy

The planned plugin is local-only. It must not transmit vault content, filenames, metadata, or usage information and must not include telemetry.

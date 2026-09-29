import {
	getFrontMatterInfo,
	normalizePath,
	parseYaml,
	TFile,
	TFolder,
	type App,
	type TAbstractFile,
} from 'obsidian';
import type { MetadataRecord } from '../domain/operation-plan';
import type { ProjectMovementPort, ProjectTreeEntry } from '../project-movement';
import { createObsidianMutationAdapter } from './mutation-adapter';

function safePath(path: string): string {
	const trimmed = path.trim();
	if (!trimmed || trimmed.startsWith('/') || trimmed.includes('\\') ||
		trimmed.split('/').includes('..')) throw new Error(`Unsafe vault path: ${path}`);
	return normalizePath(trimmed);
}

function metadataEqual(left: MetadataRecord, right: MetadataRecord): boolean {
	const normalize = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(normalize);
		if (value !== null && typeof value === 'object') {
			return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
				.map(([key, entry]) => [key, normalize(entry)]));
		}
		return value;
	};
	return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function parseMetadata(text: string): MetadataRecord {
	const info = getFrontMatterInfo(text);
	if (!info.exists) return {};
	const parsed: unknown = parseYaml(info.frontmatter);
	if (parsed === null || parsed === undefined) return {};
	if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid project frontmatter');
	return parsed as MetadataRecord;
}

export function createProjectMovementPort(app: App): ProjectMovementPort {
	const mutation = createObsidianMutationAdapter(app);
	const resolveFile = (path: string): TFile => {
		const entry = app.vault.getAbstractFileByPath(safePath(path));
		if (!(entry instanceof TFile) || entry.extension.toLowerCase() !== 'md') {
			throw new Error(`Project note not found: ${path}`);
		}
		return entry;
	};
	const resolveEntry = (path: string): TAbstractFile => {
		const entry = app.vault.getAbstractFileByPath(safePath(path));
		if (!entry) throw new Error(`Project source not found: ${path}`);
		return entry;
	};
	return {
		inspectSource: (path) => mutation.inspectSource(path),
		async readText(path) { return app.vault.read(resolveFile(path)); },
		async processText(path, expected, next) {
			await app.vault.process(resolveFile(path), (current) => {
				if (current !== expected) throw new Error('Project note changed before history update');
				return next;
			});
		},
		async listTree(path) {
			const root = resolveEntry(path);
			const entries: ProjectTreeEntry[] = [];
			const visit = (entry: TAbstractFile): void => {
				if (entry instanceof TFile) {
					entries.push({ path: entry.path, mtime: entry.stat.mtime, size: entry.stat.size });
				} else if (entry instanceof TFolder) {
					entries.push({ path: entry.path, mtime: 0, size: 0 });
					for (const child of entry.children) visit(child);
				}
			};
			visit(root);
			return entries.sort((a, b) => a.path.localeCompare(b.path));
		},
		async destinationExists(path) {
			return app.vault.getAbstractFileByPath(safePath(path)) !== null;
		},
		async ensureFolder(path) {
			const normalized = safePath(path);
			const existing = app.vault.getAbstractFileByPath(normalized);
			if (existing instanceof TFolder) return false;
			if (existing) throw new Error(`Destination is not a folder: ${normalized}`);
			const parent = normalized.slice(0, normalized.lastIndexOf('/'));
			if (!(app.vault.getAbstractFileByPath(parent) instanceof TFolder)) {
				throw new Error(`Archive root does not exist: ${parent}`);
			}
			await app.vault.createFolder(normalized);
			return true;
		},
		async removeEmptyFolder(path) {
			const entry = app.vault.getAbstractFileByPath(safePath(path));
			if (!(entry instanceof TFolder) || entry.children.length > 0) {
				throw new Error(`Created folder is no longer empty: ${path}`);
			}
			await app.fileManager.trashFile(entry);
		},
		async writeMetadata(path, expected, next) {
			const file = resolveFile(path);
			if (!metadataEqual(parseMetadata(await app.vault.read(file)), expected)) {
				throw new Error('Project metadata changed before update');
			}
			await app.fileManager.processFrontMatter(file, (frontmatter) => {
				const values = frontmatter as Record<string, unknown>;
				if (!metadataEqual(values, expected)) throw new Error('Project metadata changed during update');
				for (const key of new Set([...Object.keys(expected), ...Object.keys(next)])) {
					if (!Object.prototype.hasOwnProperty.call(next, key)) delete values[key];
					else if (!metadataEqual({ value: values[key] }, { value: next[key] })) {
						values[key] = structuredClone(next[key]);
					}
				}
			});
		},
		async move(path, destination) {
			await app.fileManager.renameFile(resolveEntry(path), safePath(destination));
		},
	};
}

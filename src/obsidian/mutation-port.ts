import type { MetadataRecord, PropertyAddition } from '../domain/operation-plan';
import type {
	FileMutationSnapshot,
	ParaMutationPort,
} from '../domain/transaction-executor';

export interface VaultFileLike {
	path: string;
	extension: string;
	stat: FileMutationSnapshot;
}

export interface ObsidianMutationPort extends ParaMutationPort {
	trashFile(path: string): Promise<void>;
}

interface VaultBoundary<File extends VaultFileLike> {
	getAbstractFileByPath(path: string): unknown;
	read(file: File): Promise<string>;
}

interface FileManagerBoundary<File extends VaultFileLike> {
	processFrontMatter(
		file: File,
		callback: (frontmatter: Record<string, unknown>) => void,
	): Promise<void>;
	renameFile(file: File, destination: string): Promise<void>;
	trashFile(file: File): Promise<void>;
}

export interface ObsidianMutationDependencies<
	File extends VaultFileLike = VaultFileLike,
> {
	vault: VaultBoundary<File>;
	fileManager: FileManagerBoundary<File>;
	normalizePath(path: string): string;
	isFile(value: unknown): value is File;
	parseFrontmatter(content: string): MetadataRecord;
}

function clone<T>(value: T): T {
	return structuredClone(value);
}

function snapshot(file: VaultFileLike): FileMutationSnapshot {
	return { mtime: file.stat.mtime, size: file.stat.size };
}

function sameSnapshot(
	left: FileMutationSnapshot,
	right: FileMutationSnapshot,
): boolean {
	return left.mtime === right.mtime && left.size === right.size;
}

export function normalizeMarkdownPath(
	rawPath: string,
	normalizePath: (path: string) => string,
): string {
	const path = rawPath.trim();
	if (
		path.length === 0 ||
		path.includes('\0') ||
		path.startsWith('/') ||
		/^[A-Za-z]:[\\/]/u.test(path) ||
		path.includes('\\') ||
		path.split('/').includes('..')
	) {
		throw new Error(`Unsafe vault path: ${rawPath}`);
	}

	const normalized = normalizePath(path);
	if (normalized.length === 0 || !normalized.toLowerCase().endsWith('.md')) {
		throw new Error(`Expected a vault-relative Markdown path: ${rawPath}`);
	}
	return normalized;
}

export function createObsidianMutationPort<File extends VaultFileLike>(
	dependencies: ObsidianMutationDependencies<File>,
): ObsidianMutationPort {
	const { vault, fileManager } = dependencies;
	const normalize = (path: string) => dependencies.normalizePath(path);

	function resolveFile(rawPath: string): File {
		const path = normalizeMarkdownPath(rawPath, normalize);
		const entry = vault.getAbstractFileByPath(path);
		if (!dependencies.isFile(entry) || entry.extension.toLowerCase() !== 'md') {
			throw new Error(`Markdown file not found: ${path}`);
		}
		return entry;
	}

	return {
		async inspectSource(path) {
			const file = resolveFile(path);
			const before = snapshot(file);
			const content = await vault.read(file);
			const after = snapshot(file);
			if (!sameSnapshot(before, after)) {
				throw new Error(`Inbox note changed during inspection: ${file.path}`);
			}
			return {
				file: after,
				metadata: clone(dependencies.parseFrontmatter(content)),
			};
		},

		async destinationExists(path) {
			const normalized = normalizeMarkdownPath(path, normalize);
			return vault.getAbstractFileByPath(normalized) !== null;
		},

		async setProperty(path, step: PropertyAddition) {
			const file = resolveFile(path);
			await fileManager.processFrontMatter(file, (frontmatter) => {
				frontmatter[step.name] = clone(step.value);
			});
		},

		async removeProperty(path, name) {
			const file = resolveFile(path);
			await fileManager.processFrontMatter(file, (frontmatter) => {
				delete frontmatter[name];
			});
		},

		async moveFile(path, destination) {
			const file = resolveFile(path);
			const normalized = normalizeMarkdownPath(destination, normalize);
			await fileManager.renameFile(file, normalized);
		},

		async trashFile(path) {
			await fileManager.trashFile(resolveFile(path));
		},
	};
}

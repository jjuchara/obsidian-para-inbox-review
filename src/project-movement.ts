import { parseLocalDate, localDayStart, normalizeLocalDate } from './domain/expired-queue';
import type { MetadataRecord } from './domain/operation-plan';
import type { SourceInspection } from './domain/transaction-executor';
import { isMainProjectPath } from './project-choices';
import { sourceInspectionsEqual } from './source-snapshot';

export type ProjectMovementDirection = 'archive' | 'restore';
export type DeadlineChoice = { kind: 'keep' | 'clear' } | { kind: 'set'; value: string };

export interface ProjectTreeEntry {
	path: string;
	mtime: number;
	size: number;
}

export interface ProjectMovementPort {
	inspectSource(path: string): Promise<SourceInspection>;
	readText(path: string): Promise<string>;
	processText(path: string, expected: string, next: string): Promise<void>;
	listTree(path: string): Promise<ProjectTreeEntry[]>;
	destinationExists(path: string): Promise<boolean>;
	ensureFolder(path: string): Promise<boolean>;
	removeEmptyFolder(path: string): Promise<void>;
	writeMetadata(path: string, expected: MetadataRecord, next: MetadataRecord): Promise<void>;
	move(path: string, destination: string): Promise<void>;
}

export interface ProjectMovementInput {
	saveSource(path: string): Promise<void>;
	chooseStatus(direction: ProjectMovementDirection, current: string): Promise<string | null>;
	requestReason(direction: ProjectMovementDirection): Promise<string | null>;
	chooseDeadline(current: unknown, expired: boolean): Promise<DeadlineChoice | null>;
	confirm(source: string, destination: string, direction: ProjectMovementDirection): Promise<boolean>;
}

export type ProjectMovementResult =
	| { ok: true; kind: 'success'; destination: string }
	| { ok: false; kind: 'canceled' | 'preflight' | 'rolled_back' | 'rollback'; message: string; recovery?: string[] };

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function normalizeRoot(root: string): string {
	const normalized = root.trim().replace(/\/+$/u, '');
	if (!normalized || normalized.startsWith('/') || normalized.includes('\\') ||
		normalized.split('/').includes('..')) throw new Error(`Unsafe project root: ${root}`);
	return normalized;
}

export function projectArchiveRoot(archivesFolder: string): string {
	return `${normalizeRoot(archivesFolder)}/Projects`;
}

export function projectMovePaths(
	path: string,
	direction: ProjectMovementDirection,
	projectsFolder: string,
	archivesFolder: string,
): { source: string; destination: string; mainDestination: string; parent: string } {
	const sourceRoot = direction === 'archive'
		? normalizeRoot(projectsFolder) : projectArchiveRoot(archivesFolder);
	const destinationRoot = direction === 'archive'
		? projectArchiveRoot(archivesFolder) : normalizeRoot(projectsFolder);
	if (sourceRoot === destinationRoot || sourceRoot.startsWith(`${destinationRoot}/`) ||
		destinationRoot.startsWith(`${sourceRoot}/`)) throw new Error('Project and archive roots overlap');
	if (!isMainProjectPath(sourceRoot, path)) throw new Error(`Not a main project note: ${path}`);
	const relative = path.slice(sourceRoot.length + 1);
	const parts = relative.split('/');
	const source = parts.length === 2 ? `${sourceRoot}/${parts[0]}` : path;
	const destination = parts.length === 2
		? `${destinationRoot}/${parts[0]}` : `${destinationRoot}/${relative}`;
	return {
		source,
		destination,
		mainDestination: `${destinationRoot}/${relative}`,
		parent: destinationRoot,
	};
}

function sameTree(left: readonly ProjectTreeEntry[], right: readonly ProjectTreeEntry[]): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function safeLine(value: string): string {
	return value.replace(/[\r\n]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

export function addProjectHistory(content: string, entry: {
	direction: ProjectMovementDirection;
	at: string;
	oldStatus: string;
	newStatus: string;
	reason: string;
}): string {
	const line = `- ${safeLine(entry.at)} — ${entry.direction === 'archive' ? 'Архивирован' : 'Возвращён в работу'}; ` +
		`статус: ${safeLine(entry.oldStatus) || 'не задан'} → ${safeLine(entry.newStatus)}; ` +
		`причина: ${safeLine(entry.reason)}.`;
	const heading = '## История движения проекта';
	const headingMatch = /^## История движения проекта\s*$/mu.exec(content);
	if (!headingMatch) {
		const trimmed = content.replace(/\s*$/u, '');
		return `${trimmed}\n\n${heading}\n\n${line}\n`;
	}
	const start = headingMatch.index + headingMatch[0].length;
	const nextHeading = /^#{1,2} (?!#)/gmu;
	nextHeading.lastIndex = start;
	const next = nextHeading.exec(content);
	const end = next?.index ?? content.length;
	const before = content.slice(0, end).replace(/\s*$/u, '');
	const after = content.slice(end);
	return `${before}\n${line}\n\n${after}`;
}

function timestamp(date: Date): string {
	const pad = (value: number): string => String(value).padStart(2, '0');
	const offset = -date.getTimezoneOffset();
	const sign = offset >= 0 ? '+' : '-';
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
		`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ` +
		`${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

function metadataAfter(
	before: MetadataRecord,
	direction: ProjectMovementDirection,
	status: string,
	reason: string,
	deadline: DeadlineChoice,
	now: Date,
): MetadataRecord {
	const next = structuredClone(before);
	next.status = status;
	if (direction === 'archive') {
		next.archived = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		next.archive_reason = reason;
	} else {
		delete next.archived;
		delete next.archive_reason;
		if (deadline.kind === 'clear') delete next.deadline;
		if (deadline.kind === 'set') next.deadline = deadline.value;
	}
	return next;
}

export class ProjectMovementService {
	constructor(
		private readonly port: ProjectMovementPort,
		private readonly input: ProjectMovementInput,
		private readonly settings: () => { projectsFolder: string; archivesFolder: string },
		private readonly now: () => Date = () => new Date(),
	) {}

	async execute(path: string, direction: ProjectMovementDirection): Promise<ProjectMovementResult> {
		let paths: ReturnType<typeof projectMovePaths>;
		try {
			const settings = this.settings();
			paths = projectMovePaths(path, direction, settings.projectsFolder, settings.archivesFolder);
		} catch (error) {
			return { ok: false, kind: 'preflight', message: errorMessage(error) };
		}
		await this.input.saveSource(path);
		for (const entry of await this.port.listTree(paths.source)) {
			if (entry.path !== path && /\.md$/iu.test(entry.path)) {
				await this.input.saveSource(entry.path);
			}
		}
		const initial = await this.port.inspectSource(path);
		const initialText = await this.port.readText(path);
		const initialTree = await this.port.listTree(paths.source);
		const currentStatus = typeof initial.metadata.status === 'string' ? initial.metadata.status : '';
		const status = (await this.input.chooseStatus(direction, currentStatus))?.trim();
		if (!status) return { ok: false, kind: 'canceled', message: 'Project status was not selected' };
		const reason = (await this.input.requestReason(direction))?.trim();
		if (!reason) return { ok: false, kind: 'canceled', message: 'Project reason was not entered' };
		let deadline: DeadlineChoice = { kind: 'keep' };
		if (direction === 'restore') {
			const parsed = parseLocalDate(initial.metadata.deadline);
			const hasDeadline = initial.metadata.deadline !== null &&
				initial.metadata.deadline !== undefined && initial.metadata.deadline !== '';
			const needsReplacement = hasDeadline && (parsed === null || parsed < localDayStart(this.now()));
			const choice = await this.input.chooseDeadline(initial.metadata.deadline, needsReplacement);
			if (choice === null) return { ok: false, kind: 'canceled', message: 'Deadline choice canceled' };
			if (choice.kind === 'keep' && needsReplacement) {
				return { ok: false, kind: 'preflight', message: 'An expired or invalid deadline must be changed or cleared' };
			}
			if (choice.kind === 'set') {
				const parsedDate = parseLocalDate(choice.value);
				if (parsedDate === null || parsedDate < localDayStart(this.now())) {
					return { ok: false, kind: 'preflight', message: 'New deadline must be today or later' };
				}
				deadline = { kind: 'set', value: normalizeLocalDate(choice.value) ?? choice.value };
			} else deadline = choice;
		}
		if (!await this.input.confirm(paths.source, paths.destination, direction)) {
			return { ok: false, kind: 'canceled', message: 'Project move canceled' };
		}
		const current = await this.port.inspectSource(path);
		const currentText = await this.port.readText(path);
		const currentTree = await this.port.listTree(paths.source);
		if (!sourceInspectionsEqual(initial, current) || currentText !== initialText ||
			!sameTree(initialTree, currentTree)) {
			return { ok: false, kind: 'preflight', message: 'Project changed while choices were open' };
		}
		if (await this.port.destinationExists(paths.destination)) {
			return { ok: false, kind: 'preflight', message: `Destination already exists: ${paths.destination}` };
		}
		const now = this.now();
		const nextMetadata = metadataAfter(initial.metadata, direction, status, reason, deadline, now);
		let metadataWritten = false;
		let historyWritten = false;
		let createdFolder = false;
		let contentAfterMetadata = '';
		let contentWithHistory = '';
		try {
			createdFolder = await this.port.ensureFolder(paths.parent);
			await this.port.writeMetadata(path, initial.metadata, nextMetadata);
			metadataWritten = true;
			contentAfterMetadata = await this.port.readText(path);
			contentWithHistory = addProjectHistory(contentAfterMetadata, {
				direction, at: timestamp(now), oldStatus: currentStatus, newStatus: status, reason,
			});
			await this.port.processText(path, contentAfterMetadata, contentWithHistory);
			historyWritten = true;
			if (await this.port.readText(path) !== contentWithHistory ||
				!sourceInspectionsEqual(
					{ file: initial.file, metadata: (await this.port.inspectSource(path)).metadata },
					{ file: initial.file, metadata: nextMetadata },
				)) {
				throw new Error('Project note changed before the move');
			}
			if (!sameTree(initialTree.map((entry) => entry.path === path ?
				{ ...entry, mtime: -1, size: -1 } : entry),
				(await this.port.listTree(paths.source)).map((entry) => entry.path === path ?
					{ ...entry, mtime: -1, size: -1 } : entry))) {
				throw new Error('Another file in the project changed before the move');
			}
			if (await this.port.destinationExists(paths.destination)) {
				throw new Error(`Destination appeared before move: ${paths.destination}`);
			}
			await this.port.move(paths.source, paths.destination);
			return { ok: true, kind: 'success', destination: paths.destination };
		} catch (error) {
			const recovery: string[] = [];
			try {
				if (!await this.port.destinationExists(paths.source) &&
					await this.port.destinationExists(paths.destination)) {
					await this.port.move(paths.destination, paths.source);
				}
			} catch (failure) {
				recovery.push(`Move back or inspect paths: ${errorMessage(failure)}`);
			}
			if (!historyWritten) {
				try { historyWritten = await this.port.readText(path) === contentWithHistory &&
					contentWithHistory.length > 0; }
				catch { /* The source may have moved; report below. */ }
			}
			if (historyWritten) {
				try { await this.port.processText(path, contentWithHistory, contentAfterMetadata); }
				catch (failure) { recovery.push(`History: ${errorMessage(failure)}`); }
			}
			if (!metadataWritten) {
				try { metadataWritten = sourceInspectionsEqual(
					{ file: initial.file, metadata: (await this.port.inspectSource(path)).metadata },
					{ file: initial.file, metadata: nextMetadata },
				); }
				catch { /* The source may have moved; report below. */ }
			}
			if (metadataWritten) {
				try { await this.port.writeMetadata(path, nextMetadata, initial.metadata); }
				catch (failure) { recovery.push(`Metadata: ${errorMessage(failure)}`); }
			}
			if (createdFolder) {
				try { await this.port.removeEmptyFolder(paths.parent); }
				catch (failure) { recovery.push(`Created folder: ${errorMessage(failure)}`); }
			}
			return {
				ok: false,
				kind: recovery.length ? 'rollback' : 'rolled_back',
				message: `Project move failed: ${errorMessage(error)}`,
				recovery: recovery.length ? recovery : undefined,
			};
		}
	}
}

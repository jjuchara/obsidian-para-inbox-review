import {
	buildParaOperationPlan,
	type MetadataContext,
	type ParaCategory,
} from './domain/operation-plan';
import {
	executeParaOperation,
	type ParaExecutionResult,
	type ParaMutationPort,
} from './domain/transaction-executor';
import type { InboxQueueItem } from './domain/inbox-queue';
import type { ParaInboxReviewSettings } from './settings';

export interface ParaActionInputPort {
	saveSource(path: string): Promise<void>;
	selectFolder(category: ParaCategory, root: string): Promise<string | null>;
	selectArea(): Promise<string | null>;
	requestArchiveReason(): Promise<string | null>;
}

export type ParaActionResult =
	| { ok: false; kind: 'canceled' }
	| ParaExecutionResult;

function hasValue(value: unknown): boolean {
	return value !== null && value !== undefined &&
		(typeof value !== 'string' || value.trim().length > 0);
}

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

export function formatLocalDate(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatLocalDateTime(date: Date): string {
	return `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function destinationPath(folder: string, source: string): string {
	const filename = source.split('/').at(-1);
	if (!filename) throw new Error(`Inbox note has no filename: ${source}`);
	return `${folder.replace(/\/+$/u, '')}/${filename}`;
}

function categoryRoot(
	category: ParaCategory,
	settings: ParaInboxReviewSettings,
): string {
	const roots: Record<ParaCategory, string> = {
		projects: settings.projectsFolder,
		areas: settings.areasFolder,
		resources: settings.resourcesFolder,
		archives: settings.archivesFolder,
	};
	return roots[category];
}

export class ParaActionService {
	constructor(
		private readonly mutation: ParaMutationPort,
		private readonly input: ParaActionInputPort,
		private readonly settings: () => ParaInboxReviewSettings,
		private readonly now: () => Date = () => new Date(),
	) {}

	async execute(
		item: InboxQueueItem,
		category: ParaCategory,
		replacements?: MetadataContext['replacements'],
	): Promise<ParaActionResult> {
		await this.input.saveSource(item.path);
		const inspection = await this.mutation.inspectSource(item.path);
		const settings = this.settings();
		const folder = await this.input.selectFolder(
			category,
			categoryRoot(category, settings),
		);
		if (folder === null) return { ok: false, kind: 'canceled' };

		const context: MetadataContext = {
			created: formatLocalDateTime(new Date(item.ctime)),
			archived: formatLocalDate(this.now()),
			replacements,
		};
		if (
			(category === 'projects' || category === 'resources') &&
			!hasValue(inspection.metadata.area)
		) {
			const area = await this.input.selectArea();
			if (area === null) return { ok: false, kind: 'canceled' };
			context.area = area;
		}
		if (category === 'archives' && !hasValue(inspection.metadata.archive_reason)) {
			const reason = await this.input.requestArchiveReason();
			if (reason === null) return { ok: false, kind: 'canceled' };
			context.archiveReason = reason.trim();
		}

		const plan = buildParaOperationPlan({
			path: item.path,
			destination: destinationPath(folder, item.path),
			category,
			existing: inspection.metadata,
			context,
			config: {
				projectsLink: settings.projectsLink,
				areasLink: settings.areasLink,
			},
		});
		return executeParaOperation({
			plan,
			expectedFile: inspection.file,
			port: this.mutation,
		});
	}
}

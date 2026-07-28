import type { Vault } from 'obsidian';
import type { ObsidianMutationPort } from './mutation-port';
import {
	buildExpiredQueue,
	type ExpiredQueueResult,
	type ExpiredQueueSource,
} from '../domain/expired-queue';
import type { ParaInboxReviewSettings } from '../settings';

const INSPECTION_CONCURRENCY = 6;

export async function loadExpiredQueue(
	vault: Vault,
	mutation: ObsidianMutationPort,
	settings: ParaInboxReviewSettings,
	now: Date = new Date(),
): Promise<ExpiredQueueResult> {
	const archiveRoot = settings.archivesFolder.trim().replace(/\/+$/u, '');
	const files = vault.getMarkdownFiles().filter(
		(file) => file.path !== archiveRoot && !file.path.startsWith(`${archiveRoot}/`),
	);
	const sources: Array<ExpiredQueueSource | undefined> = Array.from({ length: files.length });
	let nextIndex = 0;
	await Promise.all(
		Array.from(
			{ length: Math.min(INSPECTION_CONCURRENCY, files.length) },
			async () => {
				while (nextIndex < files.length) {
					const index = nextIndex++;
					const file = files[index];
					if (!file) continue;
					const inspection = await mutation.inspectSource(file.path);
					sources[index] = {
						path: file.path,
						ctime: file.stat.ctime,
						mtime: inspection.file.mtime,
						size: inspection.file.size,
						metadata: inspection.metadata,
					};
				}
			},
		),
	);
	return buildExpiredQueue({
		sources: sources.filter((source): source is ExpiredQueueSource => source !== undefined),
		projectsFolder: settings.projectsFolder,
		archivesFolder: settings.archivesFolder,
		now,
	});
}

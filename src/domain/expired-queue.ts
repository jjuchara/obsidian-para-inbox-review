import type { InboxQueueItem } from './inbox-queue';
import type { MetadataRecord } from './operation-plan';

export interface ExpiredQueueSource {
	path: string;
	ctime: number;
	mtime: number;
	size: number;
	metadata: MetadataRecord;
}

export interface ExpiredQueueItem extends InboxQueueItem {
	expires: number;
	expirationProperty: 'deadline' | 'expired_at';
	project: boolean;
	metadata: MetadataRecord;
}

export interface ExpiredQueueResult {
	items: ExpiredQueueItem[];
	invalid: string[];
}

function inside(path: string, folder: string): boolean {
	const root = folder.trim().replace(/\/+$/u, '');
	return path === root || path.startsWith(`${root}/`);
}

export function parseLocalDate(value: unknown): number | null {
	if (typeof value !== 'string') return null;
	const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value.trim());
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
		? date.getTime()
		: null;
}

export function localDayStart(now: Date): number {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function buildExpiredQueue(options: {
	sources: readonly ExpiredQueueSource[];
	projectsFolder: string;
	archivesFolder: string;
	now: Date;
}): ExpiredQueueResult {
	const items: ExpiredQueueItem[] = [];
	const invalid: string[] = [];
	const cutoff = localDayStart(options.now);
	for (const source of options.sources) {
		if (inside(source.path, options.archivesFolder)) continue;
		const project = inside(source.path, options.projectsFolder);
		const expirationProperty = project ? 'deadline' : 'expired_at';
		const raw = source.metadata[expirationProperty];
		if (raw === null || raw === undefined || raw === '') continue;
		const expires = parseLocalDate(raw);
		if (expires === null) {
			invalid.push(`${source.path}: invalid ${expirationProperty}`);
			continue;
		}
		if (expires >= cutoff) continue;
		items.push({
			path: source.path,
			ctime: source.ctime,
			snapshot: { mtime: source.mtime, size: source.size },
			expires,
			expirationProperty,
			project,
			metadata: structuredClone(source.metadata),
		});
	}
	items.sort((left, right) => left.expires - right.expires || left.path.localeCompare(right.path));
	invalid.sort();
	return { items, invalid };
}

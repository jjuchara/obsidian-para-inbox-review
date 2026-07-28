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

export function normalizeLocalDate(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(trimmed);
	const localized = /^(\d{2})\.(\d{2})\.(\d{4})$/u.exec(trimmed);
	if (!iso && !localized) return null;
	const year = Number(iso?.[1] ?? localized?.[3]);
	const month = Number(iso?.[2] ?? localized?.[2]);
	const day = Number(iso?.[3] ?? localized?.[1]);
	const date = new Date(year, month - 1, day);
	if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
		return null;
	}
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseLocalDate(value: unknown): number | null {
	const normalized = normalizeLocalDate(value);
	if (normalized === null) return null;
	const [year, month, day] = normalized.split('-').map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).getTime();
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

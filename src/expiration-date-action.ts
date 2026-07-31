import {
	localDayStart,
	normalizeLocalDate,
	parseLocalDate,
} from './domain/expired-queue';
import type { ObsidianMutationPort } from './obsidian/mutation-port';
import { sourceInspectionsEqual } from './source-snapshot';

export type ExpirationDateActionResult =
	| { kind: 'updated'; value: string }
	| { kind: 'canceled' | 'invalid' | 'source_changed' };

export async function setExpirationDate(options: {
	path: string;
	property: 'deadline' | 'expired_at';
	mutation: ObsidianMutationPort;
	saveSource(path: string): Promise<void>;
	requestDate(property: 'deadline' | 'expired_at'): Promise<string | null>;
	now?: Date;
}): Promise<ExpirationDateActionResult> {
	await options.saveSource(options.path);
	const before = await options.mutation.inspectSource(options.path);
	const value = await options.requestDate(options.property);
	if (value === null) return { kind: 'canceled' };

	const normalized = normalizeLocalDate(value);
	const timestamp = parseLocalDate(normalized);
	if (
		normalized === null || timestamp === null ||
		timestamp < localDayStart(options.now ?? new Date())
	) {
		return { kind: 'invalid' };
	}

	const after = await options.mutation.inspectSource(options.path);
	if (!sourceInspectionsEqual(before, after)) return { kind: 'source_changed' };

	await options.mutation.setProperty(options.path, {
		name: options.property,
		value: normalized,
		type: 'date',
	});
	return { kind: 'updated', value: normalized };
}

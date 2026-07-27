import type { ObsidianMutationPort } from './obsidian/mutation-port';
import { sourceInspectionsEqual } from './source-snapshot';

export type TrashActionResult =
	| { ok: true; kind: 'success' }
	| { ok: false; kind: 'canceled' }
	| { ok: false; kind: 'source_changed'; message: string };

export interface TrashActionInputPort {
	saveSource(path: string): Promise<void>;
	confirm(path: string): Promise<boolean>;
}

export async function executeTrashAction(options: {
	path: string;
	mutation: ObsidianMutationPort;
	input: TrashActionInputPort;
}): Promise<TrashActionResult> {
	const { path, mutation, input } = options;
	await input.saveSource(path);
	const baseline = await mutation.inspectSource(path);
	if (!await input.confirm(path)) return { ok: false, kind: 'canceled' };

	const current = await mutation.inspectSource(path);
	if (!sourceInspectionsEqual(current, baseline)) {
		return {
			ok: false,
			kind: 'source_changed',
			message: `Inbox note changed while trash confirmation was open: ${path}`,
		};
	}

	await mutation.trashFile(path);
	return { ok: true, kind: 'success' };
}

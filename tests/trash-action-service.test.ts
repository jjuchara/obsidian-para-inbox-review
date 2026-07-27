import assert from 'node:assert/strict';
import test from 'node:test';
import type { ObsidianMutationPort } from '../src/obsidian/mutation-port';
import { executeTrashAction } from '../src/trash-action-service';

function fixture(options: {
	confirmed?: boolean;
	secondInspection?: {
		file: { mtime: number; size: number };
		metadata: Record<string, unknown>;
	};
} = {}) {
	const calls: string[] = [];
	let inspections = 0;
	const baseline = {
		file: { mtime: 1, size: 2 },
		metadata: { tags: ['inbox'] },
	};
	const mutation: ObsidianMutationPort = {
		async inspectSource(path) {
			calls.push(`inspect:${path}`);
			inspections += 1;
			return inspections === 2 && options.secondInspection
				? structuredClone(options.secondInspection)
				: structuredClone(baseline);
		},
		async destinationExists() { return false; },
		async setProperty() {},
		async removeProperty() {},
		async moveFile() {},
		async trashFile(path) { calls.push(`trash:${path}`); },
	};
	return {
		calls,
		run: () => executeTrashAction({
			path: '6. Inbox/Note.md',
			mutation,
			input: {
				async saveSource(path) { calls.push(`save:${path}`); },
				async confirm(path) {
					calls.push(`confirm:${path}`);
					return options.confirmed ?? true;
				},
			},
		}),
	};
}

void test('saves and snapshots before confirmation, then revalidates before trash', async () => {
	const setup = fixture();
	assert.deepEqual(await setup.run(), { ok: true, kind: 'success' });
	assert.deepEqual(setup.calls, [
		'save:6. Inbox/Note.md',
		'inspect:6. Inbox/Note.md',
		'confirm:6. Inbox/Note.md',
		'inspect:6. Inbox/Note.md',
		'trash:6. Inbox/Note.md',
	]);
});

void test('canceling trash performs no second inspection or deletion', async () => {
	const setup = fixture({ confirmed: false });
	assert.deepEqual(await setup.run(), { ok: false, kind: 'canceled' });
	assert.equal(setup.calls.some((call) => call.startsWith('trash:')), false);
	assert.equal(setup.calls.filter((call) => call.startsWith('inspect:')).length, 1);
});

void test('changed file evidence blocks trash after confirmation', async () => {
	const setup = fixture({
		secondInspection: {
			file: { mtime: 2, size: 2 },
			metadata: { tags: ['inbox'] },
		},
	});
	const result = await setup.run();
	assert.equal(result.ok, false);
	assert.equal(result.kind, 'source_changed');
	assert.equal(setup.calls.some((call) => call.startsWith('trash:')), false);
});

void test('changed metadata blocks trash even when file evidence is unchanged', async () => {
	const setup = fixture({
		secondInspection: {
			file: { mtime: 1, size: 2 },
			metadata: { tags: ['external'] },
		},
	});
	const result = await setup.run();
	assert.equal(result.ok, false);
	assert.equal(result.kind, 'source_changed');
	assert.equal(setup.calls.some((call) => call.startsWith('trash:')), false);
});

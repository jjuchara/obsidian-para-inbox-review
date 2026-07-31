import assert from 'node:assert/strict';
import test from 'node:test';
import { setExpirationDate } from '../src/expiration-date-action';
import type { ObsidianMutationPort } from '../src/obsidian/mutation-port';

function fixture() {
	let inspection = {
		file: { mtime: 1, size: 2 },
		metadata: { created: '2026-07-31' },
	};
	const calls: string[] = [];
	const mutation: ObsidianMutationPort = {
		async inspectSource(path) {
			calls.push(`inspect:${path}`);
			return structuredClone(inspection);
		},
		async setProperty(path, step) {
			calls.push(`set:${path}:${step.name}:${String(step.value)}:${step.type}`);
		},
		async destinationExists() { return false; },
		async removeProperty() { throw new Error('not used'); },
		async moveFile() { throw new Error('not used'); },
		async trashFile() { throw new Error('not used'); },
	};
	return {
		calls,
		mutation,
		changeInspection() {
			inspection = { ...inspection, file: { ...inspection.file, mtime: 2 } };
		},
	};
}

void test('saves, revalidates, and writes canonical expired_at without moving the review', async () => {
	const setup = fixture();
	const result = await setExpirationDate({
		path: '6. Inbox/Note.md',
		property: 'expired_at',
		mutation: setup.mutation,
		saveSource: async (path) => { setup.calls.push(`save:${path}`); },
		requestDate: async () => '15.08.2026',
		now: new Date(2026, 6, 31),
	});

	assert.deepEqual(result, { kind: 'updated', value: '2026-08-15' });
	assert.deepEqual(setup.calls, [
		'save:6. Inbox/Note.md',
		'inspect:6. Inbox/Note.md',
		'inspect:6. Inbox/Note.md',
		'set:6. Inbox/Note.md:expired_at:2026-08-15:date',
	]);
});

void test('cancel and invalid past dates never reach mutation', async () => {
	for (const value of [null, '2026-07-30']) {
		const setup = fixture();
		const result = await setExpirationDate({
			path: '6. Inbox/Note.md',
			property: 'expired_at',
			mutation: setup.mutation,
			saveSource: async () => undefined,
			requestDate: async () => value,
			now: new Date(2026, 6, 31),
		});
		assert.equal(result.kind, value === null ? 'canceled' : 'invalid');
		assert.equal(setup.calls.some((call) => call.startsWith('set:')), false);
	}
});

void test('rejects a source change while the calendar is open', async () => {
	const setup = fixture();
	const result = await setExpirationDate({
		path: '6. Inbox/Note.md',
		property: 'expired_at',
		mutation: setup.mutation,
		saveSource: async () => undefined,
		requestDate: async () => {
			setup.changeInspection();
			return '2026-08-01';
		},
		now: new Date(2026, 6, 31),
	});
	assert.deepEqual(result, { kind: 'source_changed' });
	assert.equal(setup.calls.some((call) => call.startsWith('set:')), false);
});

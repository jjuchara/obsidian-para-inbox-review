import assert from 'node:assert/strict';
import test from 'node:test';
import { buildParaOperationPlan } from '../src/domain/operation-plan';
import {
	executeParaOperation,
	type ParaMutationPort,
} from '../src/domain/transaction-executor';

const EXPECTED_FILE = { mtime: 20, size: 10 };

function plan() {
	return buildParaOperationPlan({
		path: '6. Inbox/Note.md',
		destination: '1. Projects/Note.md',
		category: 'projects',
		existing: { tags: ['old'], created: 'old', area: '[[Work]]' },
		context: {},
		config: { projectsLink: '[[My Projects]]' },
	});
}

function port(overrides: Partial<ParaMutationPort> = {}): {
	port: ParaMutationPort;
	calls: string[];
} {
	const calls: string[] = [];
	return {
		calls,
		port: {
			async inspectSource(path) {
				calls.push(`inspect:${path}`);
				return {
					file: EXPECTED_FILE,
					metadata: { tags: ['old'], created: 'old', area: '[[Work]]' },
				};
			},
			async destinationExists(path) {
				calls.push(`exists:${path}`);
				return false;
			},
			async setProperty(_path, step) {
				calls.push(`set:${step.name}`);
			},
			async removeProperty(_path, name) {
				calls.push(`remove:${name}`);
			},
			async moveFile(_path, destination) {
				calls.push(`move:${destination}`);
			},
			...overrides,
		},
	};
}

void test('applies properties in order and moves last', async () => {
	const fixture = port();
	const result = await executeParaOperation({
		plan: plan(),
		expectedFile: EXPECTED_FILE,
		port: fixture.port,
	});

	assert.deepEqual(result, {
		ok: true,
		kind: 'success',
		destination: '1. Projects/Note.md',
	});
	assert.deepEqual(fixture.calls, [
		'inspect:6. Inbox/Note.md',
		'exists:1. Projects/Note.md',
		'set:tags',
		'set:links',
		'set:status',
		'move:1. Projects/Note.md',
	]);
});

void test('rejects missing metadata before inspecting or mutating the vault', async () => {
	const fixture = port();
	const missingPlan = buildParaOperationPlan({
		path: '6. Inbox/Note.md',
		destination: '1. Projects/Note.md',
		category: 'projects',
		existing: {},
		context: {},
		config: { projectsLink: '[[My Projects]]' },
	});
	const result = await executeParaOperation({
		plan: missingPlan,
		expectedFile: EXPECTED_FILE,
		port: fixture.port,
	});

	assert.equal(result.ok, false);
	assert.equal(result.kind, 'preflight');
	assert.deepEqual(fixture.calls, []);
});

void test('rejects changed file or metadata snapshots before mutation', async () => {
	for (const inspectSource of [
		async () => ({
			file: { mtime: 21, size: 10 },
			metadata: { tags: ['old'], created: 'old', area: '[[Work]]' },
		}),
		async () => ({
			file: EXPECTED_FILE,
			metadata: { tags: ['external'], created: 'old', area: '[[Work]]' },
		}),
	]) {
		const fixture = port({ inspectSource });
		const result = await executeParaOperation({
			plan: plan(),
			expectedFile: EXPECTED_FILE,
			port: fixture.port,
		});

		assert.equal(result.ok, false);
		assert.equal(result.kind, 'preflight');
		if (!result.ok && result.kind === 'preflight') {
			assert.equal(result.reason, 'source_changed');
		}
		assert.equal(fixture.calls.some((call) => call.startsWith('set:')), false);
	}
});

void test('rejects an exact destination conflict before mutation', async () => {
	const fixture = port({ destinationExists: async () => true });
	const result = await executeParaOperation({
		plan: plan(),
		expectedFile: EXPECTED_FILE,
		port: fixture.port,
	});

	assert.equal(result.ok, false);
	assert.equal(result.kind, 'preflight');
	if (!result.ok && result.kind === 'preflight') {
		assert.equal(result.reason, 'destination_conflict');
	}
	assert.equal(fixture.calls.some((call) => call.startsWith('set:')), false);
});

void test('rolls back only properties applied before a later apply failure', async () => {
	const fixture = port({
		async setProperty(_path, step) {
			fixture.calls.push(`set:${step.name}`);
			if (step.name === 'status') throw new Error('status failed');
		},
	});
	const result = await executeParaOperation({
		plan: plan(),
		expectedFile: EXPECTED_FILE,
		port: fixture.port,
	});

	assert.equal(result.ok, false);
	assert.equal(result.kind, 'rolled_back');
	assert.deepEqual(fixture.calls.slice(-5), [
		'set:tags',
		'set:links',
		'set:status',
		'remove:links',
		'set:tags',
	]);
});

void test('rolls back every applied property after a move failure', async () => {
	const fixture = port({
		async moveFile() {
			fixture.calls.push('move:failed');
			throw new Error('move failed');
		},
	});
	const result = await executeParaOperation({
		plan: plan(),
		expectedFile: EXPECTED_FILE,
		port: fixture.port,
	});

	assert.equal(result.ok, false);
	assert.equal(result.kind, 'rolled_back');
	assert.deepEqual(fixture.calls.slice(-7), [
		'set:tags',
		'set:links',
		'set:status',
		'move:failed',
		'remove:status',
		'remove:links',
		'set:tags',
	]);
});

void test('reports exact details when rollback is incomplete', async () => {
	const fixture = port({
		async moveFile() {
			throw new Error('move failed');
		},
		async removeProperty(_path, name) {
			if (name === 'status') throw new Error('remove failed');
		},
	});
	const result = await executeParaOperation({
		plan: plan(),
		expectedFile: EXPECTED_FILE,
		port: fixture.port,
	});

	assert.equal(result.ok, false);
	assert.equal(result.kind, 'rollback');
	if (!result.ok && result.kind === 'rollback') {
		assert.deepEqual(result.recovery, {
			source: '6. Inbox/Note.md',
			destination: '1. Projects/Note.md',
			failure: 'move failed',
			changedProperties: ['tags', 'links', 'status'],
			rollbackFailures: [
				{
					property: 'status',
					action: 'remove',
					message: 'remove failed',
				},
			],
		});
	}
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
	addProjectHistory,
	ProjectMovementService,
	projectMovePaths,
	type DeadlineChoice,
	type ProjectMovementInput,
	type ProjectMovementPort,
	type ProjectTreeEntry,
} from '../src/project-movement';

const SETTINGS = { projectsFolder: '1. Projects', archivesFolder: '4. Archives' };
const SOURCE = '1. Projects/Alpha/00. Alpha.md';
const CONTENT = '---\nstatus: В работе\ndeadline: 2026-08-01\n---\n# Alpha\nExisting text.\n';

function fixture(options: {
	path?: string;
	direction?: 'archive' | 'restore';
	status?: string | null;
	reason?: string | null;
	deadline?: DeadlineChoice | null;
	confirm?: boolean;
	conflict?: boolean;
	changeTree?: boolean;
	changeAfterHistory?: boolean;
	failMove?: boolean;
	failAfterMove?: boolean;
	failRollback?: boolean;
} = {}) {
	const path = options.path ?? SOURCE;
	const direction = options.direction ?? 'archive';
	const calls: string[] = [];
	const state = {
		metadata: { status: 'В работе', deadline: '2026-08-01' } as Record<string, unknown>,
		content: CONTENT,
		path,
	};
	const root = path.includes('/Alpha/') ? path.slice(0, path.lastIndexOf('/')) : path;
	const child = `${root}/notes/details.md`;
	let treeCount = 0;
	const port: ProjectMovementPort = {
		async inspectSource() {
			return { file: { mtime: 1, size: 2 }, metadata: structuredClone(state.metadata) };
		},
		async readText() { return state.content; },
		async processText(_path, expected, next) {
			calls.push('history');
			if (state.content !== expected || options.failRollback && next === CONTENT) {
				throw new Error('history changed');
			}
			state.content = next;
		},
		async listTree() {
			treeCount++;
			const entries: ProjectTreeEntry[] = root === path ? [
				{ path, mtime: 1, size: 2 },
			] : [
				{ path: root, mtime: 0, size: 0 },
				{ path, mtime: 1, size: 2 },
				{ path: child, mtime: options.changeTree && treeCount >= 3 ||
					options.changeAfterHistory && treeCount >= 4 ? 3 : 1, size: 2 },
			];
			return entries;
		},
		async destinationExists(target) {
			return options.conflict || target === state.path;
		},
		async ensureFolder(folder) { calls.push(`ensure:${folder}`); return direction === 'archive'; },
		async removeEmptyFolder(folder) { calls.push(`remove-folder:${folder}`); },
		async writeMetadata(_path, expected, next) {
			calls.push('metadata');
			assert.deepEqual(state.metadata, expected);
			state.metadata = structuredClone(next);
		},
		async move(_path, destination) {
			calls.push(`move:${destination}`);
			if (options.failMove) throw new Error('move failed');
			state.path = destination;
			if (options.failAfterMove && destination.startsWith('4. Archives/')) throw new Error('move reported failure');
		},
	};
	const input: ProjectMovementInput = {
		async saveSource(file) { calls.push(`save:${file}`); },
		async chooseStatus() { return options.status === undefined ? 'Завершено' : options.status; },
		async requestReason() { return options.reason === undefined ? 'Готово' : options.reason; },
		async chooseDeadline() { return options.deadline === undefined ? { kind: 'clear' } : options.deadline; },
		async confirm() { return options.confirm ?? true; },
	};
	return {
		calls, state,
		service: new ProjectMovementService(port, input, () => SETTINGS, () => new Date(2026, 8, 29, 12)),
		path, direction,
	};
}

void test('moves an entire project folder and records status history', async () => {
	const setup = fixture();
	assert.deepEqual(await setup.service.execute(setup.path, setup.direction), {
		ok: true, kind: 'success', destination: '4. Archives/Projects/Alpha',
	});
	assert.deepEqual(setup.state.metadata, {
		status: 'Завершено', deadline: '2026-08-01', archived: '2026-09-29', archive_reason: 'Готово',
	});
	assert.match(setup.state.content, /## История движения проекта\n\n- 2026-09-29 .*Архивирован; статус: В работе → Завершено; причина: Готово\./u);
	assert.match(setup.state.content, /Existing text\./u);
	assert.deepEqual(setup.calls.slice(-4), [
		'ensure:4. Archives/Projects', 'metadata', 'history', 'move:4. Archives/Projects/Alpha',
	]);
});

void test('moves a root-level project note without a folder', async () => {
	const setup = fixture({ path: '1. Projects/Alpha.md' });
	const result = await setup.service.execute(setup.path, 'archive');
	assert.equal(result.ok, true);
	assert.equal(setup.state.path, '4. Archives/Projects/Alpha.md');
});

void test('return clears archive markers and an expired deadline while recording a required reason', async () => {
	const setup = fixture({
		path: '4. Archives/Projects/Alpha/00. Alpha.md',
		direction: 'restore', status: 'В работе', reason: 'Появился новый этап',
	});
	setup.state.metadata = {
		status: 'Завершено', deadline: '2026-08-01',
		archived: '2026-08-02', archive_reason: 'Первый этап завершён',
	};
	const result = await setup.service.execute(setup.path, 'restore');
	assert.equal(result.ok, true);
	assert.equal(setup.state.path, '1. Projects/Alpha');
	assert.deepEqual(setup.state.metadata, { status: 'В работе' });
	assert.match(setup.state.content, /Возвращён в работу; статус: Завершено → В работе; причина: Появился новый этап/u);
});

void test('existing history heading is reused', () => {
	const content = '# Project\n\n## История движения проекта\n\n- Earlier entry\n\n## Notes\nText\n';
	const result = addProjectHistory(content, {
		direction: 'restore', at: '2026-09-29 12:00:00 +03:00',
		oldStatus: 'Done', newStatus: 'Work', reason: 'Again',
	});
	assert.equal(result.match(/## История движения проекта/gu)?.length, 1);
	assert.ok(result.indexOf('причина: Again.') < result.indexOf('## Notes'));
	assert.match(result, /## Notes\nText\n/u);
});

void test('cancellation, destination conflict, and a changed nested file leave the project untouched', async () => {
	for (const options of [{ reason: null }, { confirm: false }, { conflict: true }, { changeTree: true }]) {
		const setup = fixture(options);
		const result = await setup.service.execute(setup.path, 'archive');
		assert.equal(result.ok, false);
		assert.equal(setup.state.content, CONTENT);
		assert.deepEqual(setup.state.metadata, { status: 'В работе', deadline: '2026-08-01' });
		assert.equal(setup.calls.includes('metadata'), false);
	}
});

void test('restore refuses to keep an expired deadline', async () => {
	const setup = fixture({ path: '4. Archives/Projects/Alpha.md', direction: 'restore', deadline: { kind: 'keep' } });
	const result = await setup.service.execute(setup.path, 'restore');
	assert.equal(result.ok, false);
	assert.equal(setup.calls.includes('metadata'), false);
});

void test('restore refuses to keep an invalid deadline and normalizes a new date', async () => {
	const setup = fixture({ path: '4. Archives/Projects/Alpha.md', direction: 'restore', deadline: { kind: 'keep' } });
	setup.state.metadata.deadline = 'not-a-date';
	assert.equal((await setup.service.execute(setup.path, 'restore')).kind, 'preflight');
	const valid = fixture({ path: '4. Archives/Projects/Alpha.md', direction: 'restore',
		deadline: { kind: 'set', value: '30.09.2026' } });
	assert.equal((await valid.service.execute(valid.path, 'restore')).ok, true);
	assert.equal(valid.state.metadata.deadline, '2026-09-30');
});

void test('a failed move restores metadata and history; failed recovery is reported', async () => {
	const normal = fixture({ failMove: true });
	const result = await normal.service.execute(normal.path, 'archive');
	assert.equal(result.ok, false);
	assert.equal(result.kind, 'rolled_back');
	assert.equal(normal.state.content, CONTENT);
	assert.deepEqual(normal.state.metadata, { status: 'В работе', deadline: '2026-08-01' });

	const failed = fixture({ failMove: true, failRollback: true });
	const failedResult = await failed.service.execute(failed.path, 'archive');
	assert.equal(failedResult.ok, false);
	assert.equal(failedResult.kind, 'rollback');
	assert.deepEqual(failedResult.recovery, ['History: history changed']);
});

void test('a descendant change after history writing rolls back the main note', async () => {
	const setup = fixture({ changeAfterHistory: true });
	const result = await setup.service.execute(setup.path, 'archive');
	assert.equal(result.kind, 'rolled_back');
	assert.equal(setup.state.content, CONTENT);
	assert.deepEqual(setup.state.metadata, { status: 'В работе', deadline: '2026-08-01' });
});

void test('a move that reports failure after moving is reversed before metadata rollback', async () => {
	const setup = fixture({ failAfterMove: true });
	const result = await setup.service.execute(setup.path, 'archive');
	assert.equal(result.kind, 'rolled_back');
	assert.equal(setup.state.path, '1. Projects/Alpha');
	assert.equal(setup.state.content, CONTENT);
	assert.deepEqual(setup.state.metadata, { status: 'В работе', deadline: '2026-08-01' });
});

void test('rejects nested and overlapping project paths', () => {
	assert.throws(() => projectMovePaths('1. Projects/Alpha/docs/Deep.md', 'archive',
		SETTINGS.projectsFolder, SETTINGS.archivesFolder));
	assert.throws(() => projectMovePaths('1. Projects/Alpha.md', 'archive',
		'1. Projects', '1. Projects/Archive'));
});

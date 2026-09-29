import assert from 'node:assert/strict';
import test from 'node:test';
import type { ParaMutationPort } from '../src/domain/transaction-executor';
import {
	ParaActionService,
	formatLocalDate,
	formatLocalDateTime,
	type ParaActionInputPort,
} from '../src/para-action-service';

const SETTINGS = {
	inboxFolder: '6. Inbox',
	projectsFolder: '1. Projects',
	projectsLink: '[[My Projects]]',
	areasFolder: '2. Areas',
	areasLink: '[[My Areas]]',
	resourcesFolder: '3. Resources',
	archivesFolder: '4. Archives',
	projectArchiveStatuses: ['Завершено', 'Отменено'],
};

const ITEM = {
	path: '6. Inbox/Note.md',
	ctime: new Date(2026, 6, 20, 10, 11, 12).getTime(),
	snapshot: { mtime: 1, size: 2 },
};

function fixture(options: {
	metadata?: Record<string, unknown>;
	folder?: string | null;
	area?: string | null;
	project?: string | null;
	changeDuringProjectChoice?: boolean;
	failMove?: boolean;
	reason?: string | null;
} = {}) {
	const calls: string[] = [];
	let metadata = structuredClone(options.metadata ?? {});
	const file = { mtime: 20, size: 10 };
	const mutation: ParaMutationPort = {
		async inspectSource(path) {
			calls.push(`inspect:${path}`);
			return { file, metadata: structuredClone(metadata) };
		},
		async destinationExists(path) {
			calls.push(`exists:${path}`);
			return false;
		},
		async setProperty(_path, step) {
			calls.push(`set:${step.name}`);
			metadata[step.name] = structuredClone(step.value);
		},
		async removeProperty(_path, name) {
			calls.push(`remove:${name}`);
			delete metadata[name];
		},
		async moveFile(_path, destination) {
			calls.push(`move:${destination}`);
			if (options.failMove) throw new Error('move failed');
		},
	};
	const input: ParaActionInputPort = {
		async saveSource(path) {
			calls.push(`save:${path}`);
		},
		async selectFolder(category, root) {
			calls.push(`folder:${category}:${root}`);
			return options.folder === undefined ? root : options.folder;
		},
		async selectArea() {
			calls.push('area');
			return options.area === undefined ? '[[2. Areas/Work]]' : options.area;
		},
		async selectProject(root) {
			calls.push(`project:${root}`);
			if (options.changeDuringProjectChoice) metadata.external = 'changed';
			return options.project === undefined ? '' : options.project;
		},
		async requestArchiveReason() {
			calls.push('reason');
			return options.reason === undefined ? 'Done' : options.reason;
		},
	};
	return {
		calls,
		service: new ParaActionService(
			mutation,
			input,
			() => SETTINGS,
			() => new Date(2026, 6, 24, 12),
		),
	};
}

void test('formats local dates with the released metadata contract', () => {
	const date = new Date(2026, 6, 24, 3, 4, 5);
	assert.equal(formatLocalDate(date), '2026-07-24');
	assert.equal(formatLocalDateTime(date), '2026-07-24T03:04:05');
});

void test('saves, collects missing input, and executes a move-last project plan', async () => {
	const setup = fixture();
	const result = await setup.service.execute(ITEM, 'projects');

	assert.equal(result.ok, true);
	assert.deepEqual(setup.calls, [
		'save:6. Inbox/Note.md',
		'inspect:6. Inbox/Note.md',
		'folder:projects:1. Projects',
		'area',
		'inspect:6. Inbox/Note.md',
		'exists:1. Projects/Note.md',
		'set:created',
		'set:tags',
		'set:links',
		'set:status',
		'set:area',
		'move:1. Projects/Note.md',
	]);
});

void test('does not ask for values already present in metadata', async () => {
	const setup = fixture({
		metadata: {
			created: 'old',
			area: '[[Existing]]',
			archive_reason: 'Existing reason',
			archived: 'old',
		},
	});
	await setup.service.execute(ITEM, 'archives');

	assert.equal(setup.calls.includes('area'), false);
	assert.equal(setup.calls.includes('reason'), false);
});

void test('cancellation before mutation keeps the note unchanged', async () => {
	const folder = fixture({ folder: null });
	assert.deepEqual(await folder.service.execute(ITEM, 'areas'), { ok: false, kind: 'canceled' });
	const area = fixture({ area: null });
	assert.deepEqual(await area.service.execute(ITEM, 'projects'), { ok: false, kind: 'canceled' });
	const reason = fixture({ reason: null });
	assert.deepEqual(await reason.service.execute(ITEM, 'archives'), { ok: false, kind: 'canceled' });

	for (const setup of [folder, area, reason]) {
		assert.equal(setup.calls.some((call) => call.startsWith('set:')), false);
		assert.equal(setup.calls.some((call) => call.startsWith('move:')), false);
	}
});

void test('uses a selected nested destination folder', async () => {
	const setup = fixture({
		folder: '3. Resources/Reference',
		metadata: { area: '[[Work]]' },
	});
	const result = await setup.service.execute(ITEM, 'resources');

	assert.equal(result.ok, true);
	assert.equal(setup.calls.includes('move:3. Resources/Reference/Note.md'), true);
});

void test('selected project is written before the resource moves', async () => {
	const setup = fixture({ metadata: { area: '[[Work]]' }, project: '[[1. Projects/Alpha/Alpha]]' });
	assert.equal((await setup.service.execute(ITEM, 'resources')).ok, true);
	assert.deepEqual(setup.calls.slice(-3), [
		'set:tags', 'set:project', 'move:3. Resources/Note.md',
	]);
});

void test('explicit no-project choice moves without writing project', async () => {
	const setup = fixture({ metadata: { area: '[[Work]]' }, project: '' });
	assert.equal((await setup.service.execute(ITEM, 'resources')).ok, true);
	assert.equal(setup.calls.includes('project:1. Projects'), true);
	assert.equal(setup.calls.includes('set:project'), false);
});

void test('existing project is kept without prompting', async () => {
	const setup = fixture({ metadata: { area: '[[Work]]', project: '[[Existing]]' } });
	assert.equal((await setup.service.execute(ITEM, 'resources')).ok, true);
	assert.equal(setup.calls.some((call) => call.startsWith('project:')), false);
	assert.equal(setup.calls.includes('set:project'), false);
});

void test('closing project choice cancels before mutation', async () => {
	const setup = fixture({ metadata: { area: '[[Work]]' }, project: null });
	assert.deepEqual(await setup.service.execute(ITEM, 'resources'), { ok: false, kind: 'canceled' });
	assert.equal(setup.calls.some((call) => call.startsWith('set:') || call.startsWith('move:')), false);
});

void test('source changed during project choice fails preflight', async () => {
	const setup = fixture({ metadata: { area: '[[Work]]' }, project: '[[Alpha]]', changeDuringProjectChoice: true });
	const result = await setup.service.execute(ITEM, 'resources');
	assert.equal(result.ok, false);
	assert.equal(result.kind, 'preflight');
	assert.equal(setup.calls.some((call) => call.startsWith('set:') || call.startsWith('move:')), false);
});

void test('failed resource move compensates project property', async () => {
	const setup = fixture({ metadata: { area: '[[Work]]' }, project: '[[Alpha]]', failMove: true });
	const result = await setup.service.execute(ITEM, 'resources');
	assert.equal(result.ok, false);
	assert.equal(result.kind, 'rolled_back');
	assert.equal(setup.calls.includes('remove:project'), true);
});

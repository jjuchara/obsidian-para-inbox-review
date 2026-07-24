import assert from 'node:assert/strict';
import test from 'node:test';
import type { InboxQueueItem } from '../src/domain/inbox-queue';
import {
	ReviewController,
	type ReviewControllerPort,
} from '../src/review-controller';

const QUEUE: InboxQueueItem[] = [
	{ path: '6. Inbox/Old.md', ctime: 1, snapshot: { mtime: 2, size: 3 } },
	{ path: '6. Inbox/New.md', ctime: 2, snapshot: { mtime: 3, size: 4 } },
];

function fixture(overrides: Partial<ReviewControllerPort> = {}) {
	const opened: string[] = [];
	const port: ReviewControllerPort = {
		async loadQueue() {
			return QUEUE;
		},
		async openNote(path) {
			opened.push(path);
		},
		...overrides,
	};
	return { controller: new ReviewController(port), opened };
}

void test('starts a fresh FIFO session and opens the oldest note', async () => {
	const setup = fixture();
	const session = await setup.controller.start();

	assert.equal(session.status, 'active');
	assert.equal(session.pending[0]?.path, '6. Inbox/Old.md');
	assert.deepEqual(setup.opened, ['6. Inbox/Old.md']);
});

void test('starts an empty session without opening an editor', async () => {
	const setup = fixture({ loadQueue: async () => [] });
	const session = await setup.controller.start();

	assert.equal(session.status, 'finished');
	assert.deepEqual(setup.opened, []);
});

void test('skip advances to and opens the next note', async () => {
	const setup = fixture();
	await setup.controller.start();
	const session = await setup.controller.skip();

	assert.equal(session.skipped[0]?.path, '6. Inbox/Old.md');
	assert.equal(session.pending[0]?.path, '6. Inbox/New.md');
	assert.deepEqual(setup.opened, ['6. Inbox/Old.md', '6. Inbox/New.md']);
});

void test('failed navigation does not commit the skip transition', async () => {
	let calls = 0;
	const setup = fixture({
		async openNote() {
			calls += 1;
			if (calls === 2) throw new Error('open failed');
		},
	});
	await setup.controller.start();

	await assert.rejects(setup.controller.skip(), /open failed/u);
	assert.equal(setup.controller.getSession()?.pending[0]?.path, '6. Inbox/Old.md');
});

void test('pending actions are exclusive and listeners receive state changes', async () => {
	let release: (() => void) | undefined;
	const setup = fixture({
		openNote: () => new Promise<void>((resolve) => {
			release = resolve;
		}),
	});
	const states: Array<string | null> = [];
	setup.controller.subscribe((session) => states.push(session?.status ?? null));
	const start = setup.controller.start();
	await Promise.resolve();

	await assert.rejects(setup.controller.start(), /already pending/u);
	assert.equal(setup.controller.isPending(), true);
	release?.();
	await start;
	assert.equal(setup.controller.isPending(), false);
	assert.deepEqual(states, [null, null, 'active', 'active']);
});

void test('pause preserves the current note and closes advancement', async () => {
	const setup = fixture();
	await setup.controller.start();
	const session = setup.controller.pause();

	assert.equal(session.status, 'paused');
	assert.equal(session.pending[0]?.path, '6. Inbox/Old.md');
	await assert.rejects(setup.controller.skip(), /no active Inbox note/u);
});

void test('a successful current action completes and opens the next note', async () => {
	const setup = fixture();
	await setup.controller.start();
	const result = await setup.controller.performCurrent(async (item) => ({
		transition: 'complete',
		result: item.path,
	}));

	assert.equal(result, '6. Inbox/Old.md');
	assert.equal(setup.controller.getSession()?.processed, 1);
	assert.equal(setup.controller.getSession()?.pending[0]?.path, '6. Inbox/New.md');
});

void test('stay and halt decisions preserve exact action outcomes', async () => {
	const setup = fixture();
	await setup.controller.start();
	const canceled = await setup.controller.performCurrent(async () => ({
		transition: 'stay',
		result: 'canceled',
	}));
	assert.equal(canceled, 'canceled');
	assert.equal(setup.controller.getSession()?.status, 'active');

	const failed = await setup.controller.performCurrent(async () => ({
		transition: 'halt',
		result: 'rollback',
		reason: 'Manual recovery required',
	}));
	assert.equal(failed, 'rollback');
	assert.equal(setup.controller.getSession()?.status, 'halted');
	assert.equal(setup.controller.getSession()?.haltReason, 'Manual recovery required');
});

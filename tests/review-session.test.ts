import assert from 'node:assert/strict';
import test from 'node:test';
import type { InboxQueueItem } from '../src/domain/inbox-queue';
import {
	closeSession,
	completeCurrent,
	createReviewSession,
	currentInboxItem,
	haltSession,
	pauseSession,
	skipCurrent,
	summarizeSession,
} from '../src/domain/review-session';

function item(path: string, ctime: number): InboxQueueItem {
	return { path, ctime, snapshot: { mtime: ctime + 1, size: 1 } };
}

const QUEUE = [item('6. Inbox/old.md', 1), item('6. Inbox/new.md', 2)];

void test('an empty queue starts finished and is reported as an empty Inbox', () => {
	const session = createReviewSession([]);

	assert.equal(session.status, 'finished');
	assert.equal(currentInboxItem(session), null);
	assert.deepEqual(summarizeSession(session), {
		processed: 0,
		skipped: 0,
		remainingInInbox: 0,
		inboxEmpty: true,
	});
});

void test('completing the current item advances without mutating the previous session', () => {
	const original = createReviewSession(QUEUE);
	const advanced = completeCurrent(original);

	assert.equal(currentInboxItem(original)?.path, '6. Inbox/old.md');
	assert.equal(currentInboxItem(advanced)?.path, '6. Inbox/new.md');
	assert.equal(advanced.processed, 1);
	assert.deepEqual(advanced.skipped, []);
});

void test('completing the last item finishes with an empty Inbox', () => {
	const finished = completeCurrent(
		completeCurrent(createReviewSession(QUEUE)),
	);

	assert.equal(finished.status, 'finished');
	assert.deepEqual(summarizeSession(finished), {
		processed: 2,
		skipped: 0,
		remainingInInbox: 0,
		inboxEmpty: true,
	});
});

void test('skip removes an item only from the current pass', () => {
	const skipped = skipCurrent(createReviewSession(QUEUE));
	const finished = completeCurrent(skipped);

	assert.equal(currentInboxItem(skipped)?.path, '6. Inbox/new.md');
	assert.deepEqual(finished.skipped.map((entry) => entry.path), [
		'6. Inbox/old.md',
	]);
	assert.deepEqual(summarizeSession(finished), {
		processed: 1,
		skipped: 1,
		remainingInInbox: 1,
		inboxEmpty: false,
	});
});

void test('pause, close, and halt preserve the active item', () => {
	const session = createReviewSession(QUEUE);

	for (const stopped of [
		pauseSession(session),
		closeSession(session),
		haltSession(session, ' Move failed; metadata restored '),
	]) {
		assert.equal(stopped.pending[0]?.path, '6. Inbox/old.md');
		assert.equal(stopped.processed, 0);
	}

	assert.equal(haltSession(session, 'recovery required').haltReason, 'recovery required');
});

void test('terminal sessions reject accidental queue advancement', () => {
	const paused = pauseSession(createReviewSession(QUEUE));
	assert.throws(
		() => completeCurrent(paused),
		/Review session has no active Inbox note/,
	);
});

void test('halt requires a concrete recovery reason', () => {
	assert.throws(
		() => haltSession(createReviewSession(QUEUE), '   '),
		/A halted review session requires a recovery reason/,
	);
});

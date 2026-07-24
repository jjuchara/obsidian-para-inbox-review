import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildInboxQueue,
	type InboxFileSnapshot,
} from '../src/domain/inbox-queue';

function file(
	path: string,
	ctime: number,
	overrides: Partial<InboxFileSnapshot> = {},
): InboxFileSnapshot {
	const parentPath = path.slice(0, path.lastIndexOf('/'));
	return {
		path,
		parentPath,
		extension: 'md',
		ctime,
		mtime: ctime + 10,
		size: path.length,
		...overrides,
	};
}

void test('buildInboxQueue includes only direct Markdown children', () => {
	const queue = buildInboxQueue(
		[
			file('6. Inbox/first.md', 1),
			file('6. Inbox/nested/second.md', 2),
			file('6. Inbox/attachment.png', 3, { extension: 'png' }),
			file('Elsewhere/third.md', 4),
		],
		'6. Inbox',
	);

	assert.deepEqual(queue.map((item) => item.path), ['6. Inbox/first.md']);
});

void test('buildInboxQueue orders oldest first with a path tie-breaker', () => {
	const queue = buildInboxQueue(
		[
			file('6. Inbox/new.md', 30),
			file('6. Inbox/b.md', 10),
			file('6. Inbox/a.md', 10),
		],
		'6. Inbox',
	);

	assert.deepEqual(queue.map((item) => item.path), [
		'6. Inbox/a.md',
		'6. Inbox/b.md',
		'6. Inbox/new.md',
	]);
});

void test('buildInboxQueue preserves the input collection and captures mutation evidence', () => {
	const files = [file('6. Inbox/note.md', 10)];
	const before = structuredClone(files);
	const queue = buildInboxQueue(files, '6. Inbox');

	assert.deepEqual(files, before);
	assert.deepEqual(queue[0], {
		path: '6. Inbox/note.md',
		ctime: 10,
		snapshot: { mtime: 20, size: 16 },
	});
});

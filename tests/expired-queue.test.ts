import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExpiredQueue, parseLocalDate } from '../src/domain/expired-queue';

void test('parses strict local ISO dates', () => {
	assert.notEqual(parseLocalDate('2026-07-28'), null);
	assert.equal(parseLocalDate('28.07.2026'), null);
	assert.equal(parseLocalDate('2026-02-30'), null);
	assert.equal(parseLocalDate('2026-07-28T12:00:00'), null);
});

void test('selects overdue projects by deadline and other notes by expired_at', () => {
	const result = buildExpiredQueue({
		projectsFolder: '1. Projects',
		archivesFolder: '4. Archives',
		now: new Date(2026, 6, 28, 12),
		sources: [
			{ path: '1. Projects/Late.md', ctime: 1, mtime: 2, size: 3, metadata: { deadline: '2026-01-01' } },
			{ path: '2. Areas/Review.md', ctime: 1, mtime: 2, size: 3, metadata: { expired_at: '2026-02-01' } },
			{ path: '3. Resources/Future.md', ctime: 1, mtime: 2, size: 3, metadata: { expired_at: '2027-01-01' } },
			{ path: '3. Resources/Invalid.md', ctime: 1, mtime: 2, size: 3, metadata: { expired_at: '2026-99-01' } },
			{ path: '4. Archives/Projects/Old.md', ctime: 1, mtime: 2, size: 3, metadata: { deadline: '2020-01-01' } },
		],
	});
	assert.deepEqual(result.items.map((item) => [item.path, item.expirationProperty, item.project]), [
		['1. Projects/Late.md', 'deadline', true],
		['2. Areas/Review.md', 'expired_at', false],
	]);
	assert.deepEqual(result.invalid, ['3. Resources/Invalid.md: invalid expired_at']);
});

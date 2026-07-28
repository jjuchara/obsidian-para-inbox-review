import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPIRED_REVIEW_COMMANDS } from '../src/expired-review-commands';

void test('publishes the exact assignable expired-review command surface', () => {
	assert.deepEqual(
		EXPIRED_REVIEW_COMMANDS.map(({ id, name }) => ({ id, name })),
		[
			{ id: 'open-expired-note-review', name: 'Open expired-note review' },
			{ id: 'change-expired-note-date', name: 'Change current expiration date' },
			{ id: 'archive-expired-note', name: 'Archive current expired note' },
			{ id: 'trash-expired-note', name: 'Move current expired note to trash' },
			{ id: 'skip-expired-note', name: 'Skip current expired note' },
			{ id: 'pause-expired-note-review', name: 'Pause expired-note review' },
			{ id: 'close-expired-note-review', name: 'Close expired-note review' },
		],
	);
	assert.equal(
		new Set(EXPIRED_REVIEW_COMMANDS.map(({ id }) => id)).size,
		EXPIRED_REVIEW_COMMANDS.length,
	);
});

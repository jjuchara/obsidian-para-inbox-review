import assert from 'node:assert/strict';
import test from 'node:test';
import { REVIEW_COMMANDS } from '../src/review-commands';

void test('publishes the exact assignable review command surface', () => {
	assert.deepEqual(
		REVIEW_COMMANDS.map(({ id, name }) => ({ id, name })),
		[
			{ id: 'open-inbox-review', name: 'Open inbox review' },
			{ id: 'sort-current-projects', name: 'Sort current note into Projects' },
			{ id: 'sort-current-areas', name: 'Sort current note into Areas' },
			{ id: 'sort-current-resources', name: 'Sort current note into Resources' },
			{ id: 'sort-current-archives', name: 'Sort current note into Archives' },
			{ id: 'skip-current-note', name: 'Skip current note' },
			{ id: 'pause-inbox-review', name: 'Pause inbox review' },
			{ id: 'trash-current-note', name: 'Move current note to trash' },
			{ id: 'close-inbox-review', name: 'Close inbox review' },
		],
	);
	assert.equal(new Set(REVIEW_COMMANDS.map(({ id }) => id)).size, REVIEW_COMMANDS.length);
});

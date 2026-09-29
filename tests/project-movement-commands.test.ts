import assert from 'node:assert/strict';
import test from 'node:test';
import { PROJECT_MOVEMENT_COMMANDS } from '../src/project-movement-commands';

void test('publishes both standalone project movement commands', () => {
	assert.deepEqual(PROJECT_MOVEMENT_COMMANDS.map(({ id, name }) => ({ id, name })), [
		{ id: 'archive-project', name: 'Archive project' },
		{ id: 'return-project-to-work', name: 'Return project to work' },
	]);
});

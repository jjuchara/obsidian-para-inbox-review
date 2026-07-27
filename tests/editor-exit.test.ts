import assert from 'node:assert/strict';
import test from 'node:test';
import {
	applyEditorExitChoice,
	hasUnsavedEditorChanges,
	type EditorExitPort,
} from '../src/editor-exit';

function fixture(current = 'edited', saved = 'saved') {
	const calls: string[] = [];
	const port: EditorExitPort = {
		getCurrentData: () => current,
		getSavedData: () => saved,
		async save() { calls.push('save'); },
		discard() { calls.push('discard'); },
	};
	return { calls, port };
}

void test('detects whether the native editor differs from saved data', () => {
	assert.equal(hasUnsavedEditorChanges(fixture('same', 'same').port), false);
	assert.equal(hasUnsavedEditorChanges(fixture().port), true);
});

void test('save allows close only after awaiting the editor save', async () => {
	const setup = fixture();
	assert.equal(await applyEditorExitChoice(setup.port, 'save'), true);
	assert.deepEqual(setup.calls, ['save']);
});

void test('discard restores saved state and allows close', async () => {
	const setup = fixture();
	assert.equal(await applyEditorExitChoice(setup.port, 'discard'), true);
	assert.deepEqual(setup.calls, ['discard']);
});

void test('cancel keeps the review active without touching the editor', async () => {
	const setup = fixture();
	assert.equal(await applyEditorExitChoice(setup.port, 'cancel'), false);
	assert.deepEqual(setup.calls, []);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { ChoiceSettlement } from '../src/choice-settlement';

void test('a choice wins when modal close fires before onChooseItem', () => {
	const results: Array<string | null> = [];
	const scheduled: Array<() => void> = [];
	const settlement = new ChoiceSettlement<string>(
		(value) => results.push(value),
		(callback) => scheduled.push(callback),
	);

	settlement.close();
	settlement.choose('1. Projects/Alpha');
	assert.deepEqual(results, []);
	scheduled[0]?.();

	assert.deepEqual(results, ['1. Projects/Alpha']);
});

void test('closing without a choice resolves cancellation once', () => {
	const results: Array<string | null> = [];
	const scheduled: Array<() => void> = [];
	const settlement = new ChoiceSettlement<string>(
		(value) => results.push(value),
		(callback) => scheduled.push(callback),
	);

	settlement.close();
	scheduled[0]?.();
	settlement.close();
	scheduled[1]?.();

	assert.deepEqual(results, [null]);
});

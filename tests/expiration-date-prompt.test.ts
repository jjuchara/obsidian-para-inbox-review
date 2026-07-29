import assert from 'node:assert/strict';
import test from 'node:test';
import {
	calendarValueFromManual,
	createExpirationDateDraft,
	formatLocalDateInput,
} from '../src/expiration-date-prompt';

void test('calendar defaults use the current local date without a UTC conversion', () => {
	const now = new Date(2026, 6, 29, 0, 5);
	assert.equal(formatLocalDateInput(now), '2026-07-29');
	assert.deepEqual(createExpirationDateDraft(now), {
		calendarValue: '2026-07-29',
		manualValue: '2026-07-29',
	});
});

void test('manual fallback returns a calendar-compatible ISO value', () => {
	assert.equal(calendarValueFromManual('29.07.2026'), '2026-07-29');
	assert.equal(calendarValueFromManual('2026-07-29'), '2026-07-29');
	assert.equal(calendarValueFromManual('31.02.2026'), null);
});

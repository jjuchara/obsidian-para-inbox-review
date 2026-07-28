import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildParaOperationPlan,
	normalizeParaMetadata,
	type MetadataContext,
	type MetadataRecord,
	type ParaCategory,
} from '../src/domain/operation-plan';

const CONFIG = {
	projectsLink: '[[My Projects]]',
	areasLink: '[[My Areas]]',
};

const CASES: ReadonlyArray<{
	category: ParaCategory;
	context: MetadataContext;
	expected: MetadataRecord;
}> = [
	{
		category: 'projects',
		context: { created: '2026-07-22T10:00:00', area: '[[Work]]' },
		expected: {
			tags: ['existing', 'projects'],
			created: '2026-07-22T10:00:00',
			links: '[[My Projects]]',
			status: 'Планируется',
			area: '[[Work]]',
		},
	},
	{
		category: 'areas',
		context: { created: '2026-07-22T10:00:00' },
		expected: {
			tags: ['existing', 'area'],
			created: '2026-07-22T10:00:00',
			links: '[[My Areas]]',
			listShow: true,
		},
	},
	{
		category: 'resources',
		context: { created: '2026-07-22T10:00:00', area: '[[Work]]' },
		expected: {
			tags: ['existing', 'resources'],
			created: '2026-07-22T10:00:00',
			area: '[[Work]]',
		},
	},
	{
		category: 'archives',
		context: {
			created: '2026-07-22T10:00:00',
			archived: '2026-07-22',
			archiveReason: 'Done',
		},
		expected: {
			tags: ['existing'],
			created: '2026-07-22T10:00:00',
			archived: '2026-07-22',
			archive_reason: 'Done',
		},
	},
];

void test('normalizes every PARA category without changing note bodies', () => {
	for (const testCase of CASES) {
		const result = normalizeParaMetadata(
			testCase.category,
			{ tags: ['existing'] },
			testCase.context,
			CONFIG,
		);

		assert.deepEqual(result.metadata, testCase.expected);
		assert.deepEqual(result.missing, []);
	}
});

void test('preserves every existing non-empty metadata value', () => {
	const existing = {
		tags: ['#projects'],
		created: 'old',
		links: 'custom',
		area: '[[Existing]]',
		status: 'Active',
	};
	const result = normalizeParaMetadata('projects', existing, {}, CONFIG);

	assert.deepEqual(result.metadata, existing);
	assert.deepEqual(result.additions, []);
	assert.deepEqual(result.missing, []);
});

void test('reports every missing value before mutation', () => {
	const project = normalizeParaMetadata(
		'projects',
		{},
		{ created: 'now' },
		CONFIG,
	);
	const archive = normalizeParaMetadata('archives', {}, {}, CONFIG);

	assert.deepEqual(project.missing, ['area']);
	assert.deepEqual(archive.missing, [
		'archive_reason',
		'created',
		'archived',
	]);
});

void test('builds ordered apply, move-last, and reverse compensation steps', () => {
	const plan = buildParaOperationPlan({
		path: '6. Inbox/Note.md',
		destination: '1. Projects/Note.md',
		category: 'projects',
		existing: { tags: ['old'] },
		context: { created: 'now', area: '[[Work]]' },
		config: CONFIG,
	});

	assert.deepEqual(plan.apply.map((step) => step.name), [
		'created',
		'tags',
		'links',
		'status',
		'area',
	]);
	assert.deepEqual(plan.move, {
		path: '6. Inbox/Note.md',
		destination: '1. Projects/Note.md',
	});
	assert.deepEqual(plan.compensate, [
		{ action: 'remove', name: 'area' },
		{ action: 'remove', name: 'status' },
		{ action: 'remove', name: 'links' },
		{ action: 'set', name: 'tags', value: ['old'], type: 'list' },
		{ action: 'remove', name: 'created' },
	]);
});

void test('keeps plan snapshots independent from caller-owned metadata', () => {
	const existing = { tags: ['old'], nested: { value: 1 } };
	const plan = buildParaOperationPlan({
		path: '6. Inbox/Note.md',
		destination: '2. Areas/Note.md',
		category: 'areas',
		existing,
		context: { created: 'now' },
		config: CONFIG,
	});

	existing.tags.push('later');
	existing.nested.value = 2;

	assert.deepEqual(plan.snapshot, { tags: ['old'], nested: { value: 1 } });
	assert.deepEqual(plan.metadata.tags, ['old', 'area']);
});

void test('normalizes string tags and does not duplicate hash-prefixed tags', () => {
	const fromString = normalizeParaMetadata(
		'areas',
		{ tags: 'existing' },
		{ created: 'now' },
		CONFIG,
	);
	const alreadyPresent = normalizeParaMetadata(
		'resources',
		{ tags: ['#resources'], created: 'old', area: '[[Work]]' },
		{},
		CONFIG,
	);

	assert.deepEqual(fromString.metadata.tags, ['existing', 'area']);
	assert.deepEqual(alreadyPresent.additions, []);
});

void test('rejects a malformed non-empty tags property before mutation', () => {
	assert.throws(
		() => normalizeParaMetadata(
			'projects',
			{ tags: 42, created: 'old', area: '[[Work]]' },
			{},
			CONFIG,
		),
		/The tags property must be a string or list/u,
	);
});

void test('restores present empty values instead of deleting them during rollback', () => {
	const plan = buildParaOperationPlan({
		path: '6. Inbox/Note.md',
		destination: '1. Projects/Note.md',
		category: 'projects',
		existing: {
			created: '',
			tags: '',
			links: null,
			area: '[[Work]]',
		},
		context: { created: 'now' },
		config: CONFIG,
	});

	assert.deepEqual(plan.compensate, [
		{ action: 'remove', name: 'status' },
		{ action: 'set', name: 'links', value: null, type: 'text' },
		{ action: 'set', name: 'tags', value: '', type: 'list' },
		{ action: 'set', name: 'created', value: '', type: 'datetime' },
	]);
});

void test('replaces project status as part of the archive transaction', () => {
	const plan = buildParaOperationPlan({
		path: '1. Projects/Done.md',
		destination: '4. Archives/Projects/Done.md',
		category: 'archives',
		existing: { created: 'old', status: 'В работе' },
		context: {
			archived: '2026-07-28',
			archiveReason: 'Complete',
			replacements: { status: { value: 'Завершено', type: 'text' } },
		},
		config: CONFIG,
	});
	assert.equal(plan.metadata.status, 'Завершено');
	assert.deepEqual(plan.apply.at(-1), { name: 'status', value: 'Завершено', type: 'text' });
	assert.deepEqual(plan.compensate[0], {
		action: 'set', name: 'status', value: 'В работе', type: 'text',
	});
});

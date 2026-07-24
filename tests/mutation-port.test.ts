import assert from 'node:assert/strict';
import test from 'node:test';
import type { MetadataRecord } from '../src/domain/operation-plan';
import {
	createObsidianMutationPort,
	normalizeMarkdownPath,
	type ObsidianMutationDependencies,
	type VaultFileLike,
} from '../src/obsidian/mutation-port';

interface FakeFile extends VaultFileLike {
	kind: 'file';
}

function fixture(options: {
	content?: string;
	metadata?: MetadataRecord;
} = {}) {
	const file: FakeFile = {
		kind: 'file',
		path: '6. Inbox/Note.md',
		extension: 'md',
		stat: { mtime: 20, size: 10 },
	};
	const entries = new Map<string, unknown>([[file.path, file]]);
	const calls: string[] = [];
	const frontmatter: MetadataRecord = {};
	const dependencies: ObsidianMutationDependencies = {
		vault: {
			getAbstractFileByPath(path) {
				calls.push(`lookup:${path}`);
				return entries.get(path) ?? null;
			},
			async read(target) {
				calls.push(`read:${target.path}`);
				return options.content ?? 'note';
			},
		},
		fileManager: {
			async processFrontMatter(target, callback) {
				calls.push(`frontmatter:${target.path}`);
				callback(frontmatter);
			},
			async renameFile(target, destination) {
				calls.push(`rename:${target.path}->${destination}`);
			},
			async trashFile(target) {
				calls.push(`trash:${target.path}`);
			},
		},
		normalizePath: (path) => path.replace(/\/+/gu, '/').replace(/^\.\//u, ''),
		isFile: (value): value is FakeFile =>
			typeof value === 'object' && value !== null &&
			(value as Partial<FakeFile>).kind === 'file',
		parseFrontmatter: () => options.metadata ?? { created: '2026-07-24' },
	};

	return {
		calls,
		dependencies,
		entries,
		file,
		frontmatter,
		port: createObsidianMutationPort(dependencies),
	};
}

void test('normalizes safe Markdown paths and rejects unsafe inputs', () => {
	const normalize = (path: string) => path.replace(/\/+/gu, '/');
	assert.equal(normalizeMarkdownPath(' 6. Inbox/Note.md ', normalize), '6. Inbox/Note.md');

	for (const path of [
		'',
		'/tmp/Note.md',
		'C:/tmp/Note.md',
		'../Note.md',
		'6. Inbox/../Note.md',
		'6. Inbox\\Note.md',
		'6. Inbox/Note.txt',
	]) {
		assert.throws(() => normalizeMarkdownPath(path, normalize));
	}
});

void test('inspects fresh note content and returns an immutable snapshot', async () => {
	const metadata = { tags: ['inbox'] };
	const setup = fixture({ metadata });
	const result = await setup.port.inspectSource('./6. Inbox/Note.md');

	assert.deepEqual(result, {
		file: { mtime: 20, size: 10 },
		metadata: { tags: ['inbox'] },
	});
	metadata.tags.push('external');
	assert.deepEqual(result.metadata, { tags: ['inbox'] });
	assert.deepEqual(setup.calls, [
		'lookup:6. Inbox/Note.md',
		'read:6. Inbox/Note.md',
	]);
});

void test('rejects a source that changes while it is being read', async () => {
	const setup = fixture();
	setup.dependencies.vault.read = async () => {
		setup.file.stat.mtime += 1;
		return 'changed';
	};
	const port = createObsidianMutationPort(setup.dependencies);

	await assert.rejects(
		port.inspectSource('6. Inbox/Note.md'),
		/changed during inspection/u,
	);
});

void test('requires a typed Markdown file for source operations', async () => {
	const setup = fixture();
	setup.entries.set('6. Inbox/Folder.md', { kind: 'folder' });

	await assert.rejects(
		setup.port.inspectSource('6. Inbox/Missing.md'),
		/Markdown file not found/u,
	);
	await assert.rejects(
		setup.port.trashFile('6. Inbox/Folder.md'),
		/Markdown file not found/u,
	);
});

void test('checks exact normalized destination conflicts', async () => {
	const setup = fixture();
	setup.entries.set('1. Projects/Note.md', { kind: 'folder' });

	assert.equal(
		await setup.port.destinationExists('./1. Projects/Note.md'),
		true,
	);
	assert.equal(
		await setup.port.destinationExists('1. Projects/New.md'),
		false,
	);
});

void test('sets cloned properties and removes properties through frontmatter API', async () => {
	const setup = fixture();
	const value = ['projects'];
	await setup.port.setProperty('6. Inbox/Note.md', {
		name: 'tags',
		value,
		type: 'list',
	});
	value.push('external');
	assert.deepEqual(setup.frontmatter.tags, ['projects']);

	setup.frontmatter.status = 'Планируется';
	await setup.port.removeProperty('6. Inbox/Note.md', 'status');
	assert.equal('status' in setup.frontmatter, false);
});

void test('moves through renameFile and trashes through the configured trash API', async () => {
	const setup = fixture();
	await setup.port.moveFile(
		'6. Inbox/Note.md',
		'./1. Projects/Note.md',
	);
	await setup.port.trashFile('6. Inbox/Note.md');

	assert.equal(
		setup.calls.includes('rename:6. Inbox/Note.md->1. Projects/Note.md'),
		true,
	);
	assert.equal(setup.calls.includes('trash:6. Inbox/Note.md'), true);
});

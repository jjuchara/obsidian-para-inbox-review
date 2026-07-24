import {
	getFrontMatterInfo,
	normalizePath,
	parseYaml,
	TFile,
	type App,
} from 'obsidian';
import type { MetadataRecord } from '../domain/operation-plan';
import {
	createObsidianMutationPort,
	type ObsidianMutationPort,
} from './mutation-port';

function parseFrontmatter(content: string): MetadataRecord {
	const info = getFrontMatterInfo(content);
	if (!info.exists) return {};

	const parsed: unknown = parseYaml(info.frontmatter);
	if (parsed === null || parsed === undefined) return {};
	if (typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('The note frontmatter must be a YAML mapping');
	}
	return parsed as MetadataRecord;
}

export function createObsidianMutationAdapter(
	app: App,
): ObsidianMutationPort {
	return createObsidianMutationPort<TFile>({
		vault: {
			getAbstractFileByPath: (path) => app.vault.getAbstractFileByPath(path),
			read: (file) => app.vault.read(file),
		},
		fileManager: {
			processFrontMatter: (file, callback) =>
				app.fileManager.processFrontMatter(file, callback),
			renameFile: (file, destination) =>
				app.fileManager.renameFile(file, destination),
			trashFile: (file) => app.fileManager.trashFile(file),
		},
		normalizePath,
		isFile: (value): value is TFile => value instanceof TFile,
		parseFrontmatter,
	});
}

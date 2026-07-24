import { normalizePath, TFile, TFolder, type Vault } from 'obsidian';
import {
	buildInboxQueue,
	type InboxFileSnapshot,
	type InboxQueueItem,
} from '../domain/inbox-queue';

export class InboxFolderError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InboxFolderError';
	}
}

export function loadInboxQueue(
	vault: Vault,
	configuredFolder: string,
): InboxQueueItem[] {
	const rawFolder = configuredFolder.trim();
	if (rawFolder.length === 0) {
		throw new InboxFolderError('Inbox folder is not configured');
	}

	const inboxFolder = normalizePath(rawFolder);
	const abstractFile = vault.getAbstractFileByPath(inboxFolder);
	if (!(abstractFile instanceof TFolder)) {
		throw new InboxFolderError(`Inbox folder does not exist: ${inboxFolder}`);
	}

	const files: InboxFileSnapshot[] = abstractFile.children
		.filter((child): child is TFile => child instanceof TFile)
		.map((file) => ({
			path: file.path,
			parentPath: file.parent?.path ?? '',
			extension: file.extension,
			ctime: file.stat.ctime,
			mtime: file.stat.mtime,
			size: file.stat.size,
		}));

	return buildInboxQueue(files, inboxFolder);
}

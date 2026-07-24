export interface InboxFileSnapshot {
	path: string;
	parentPath: string;
	extension: string;
	ctime: number;
	mtime: number;
	size: number;
}

export interface InboxQueueItem {
	path: string;
	ctime: number;
	snapshot: Readonly<{
		mtime: number;
		size: number;
	}>;
}

function comparePaths(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

export function buildInboxQueue(
	files: readonly InboxFileSnapshot[],
	inboxFolder: string,
): InboxQueueItem[] {
	return files
		.filter(
			(file) =>
				file.parentPath === inboxFolder &&
				file.extension.toLowerCase() === 'md',
		)
		.map((file) => ({
			path: file.path,
			ctime: file.ctime,
			snapshot: {
				mtime: file.mtime,
				size: file.size,
			},
		}))
		.sort((left, right) => {
			const byCreationTime = left.ctime - right.ctime;
			return byCreationTime === 0
				? comparePaths(left.path, right.path)
				: byCreationTime;
		});
}

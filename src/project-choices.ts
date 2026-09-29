export interface ProjectCandidate {
	path: string;
	tags: readonly string[];
}

export function isMainProjectPath(root: string, path: string): boolean {
	const prefix = `${root.replace(/\/+$/u, '')}/`;
	if (!path.startsWith(prefix) || !/\.md$/iu.test(path)) return false;
	const parts = path.slice(prefix.length).split('/');
	if (parts.length === 1) return true;
	if (parts.length !== 2) return false;
	const basename = parts[1]?.replace(/\.md$/iu, '');
	return basename === parts[0] || basename === `00. ${parts[0]}`;
}

export function projectNotePaths(
	root: string,
	candidates: readonly ProjectCandidate[],
): string[] {
	return candidates
		.filter(({ path, tags }) =>
			isMainProjectPath(root, path) &&
			tags.some((tag) => tag.replace(/^#/u, '') === 'projects'),
		)
		.map(({ path }) => path)
		.sort();
}

export function projectChoices(
	root: string,
	candidates: readonly ProjectCandidate[],
): string[] {
	return projectNotePaths(root, candidates)
		.map((path) => `[[${path.replace(/\.md$/iu, '')}]]`)
		.sort();
}

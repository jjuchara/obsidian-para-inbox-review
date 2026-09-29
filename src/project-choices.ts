export interface ProjectCandidate {
	path: string;
	tags: readonly string[];
}

export function projectChoices(
	root: string,
	candidates: readonly ProjectCandidate[],
): string[] {
	const prefix = `${root.replace(/\/+$/u, '')}/`;
	return candidates
		.filter(({ path, tags }) => {
			if (!path.startsWith(prefix) || !/\.md$/iu.test(path)) return false;
			const relative = path.slice(prefix.length);
			const parts = relative.split('/');
			if (parts.length > 2) return false;
			if (parts.length === 2) {
				const basename = parts[1]?.replace(/\.md$/iu, '');
				if (basename !== parts[0] && basename !== `00. ${parts[0]}`) return false;
			}
			return tags.some((tag) => tag.replace(/^#/u, '') === 'projects');
		})
		.map(({ path }) => `[[${path.replace(/\.md$/iu, '')}]]`)
		.sort();
}

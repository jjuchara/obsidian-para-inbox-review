import type { ParaCategory } from './domain/operation-plan';

export type ReviewCommandAction =
	| { kind: 'open' }
	| { kind: 'sort'; category: ParaCategory }
	| { kind: 'skip' }
	| { kind: 'pause' }
	| { kind: 'trash' }
	| { kind: 'close' };

export interface ReviewCommandSpec {
	id: string;
	name: string;
	action: ReviewCommandAction;
}

export const REVIEW_COMMANDS: readonly ReviewCommandSpec[] = [
	{ id: 'open-inbox-review', name: 'Open inbox review', action: { kind: 'open' } },
	{
		id: 'sort-current-projects',
		name: 'Sort current note into Projects',
		action: { kind: 'sort', category: 'projects' },
	},
	{
		id: 'sort-current-areas',
		name: 'Sort current note into Areas',
		action: { kind: 'sort', category: 'areas' },
	},
	{
		id: 'sort-current-resources',
		name: 'Sort current note into Resources',
		action: { kind: 'sort', category: 'resources' },
	},
	{
		id: 'sort-current-archives',
		name: 'Sort current note into Archives',
		action: { kind: 'sort', category: 'archives' },
	},
	{ id: 'skip-current-note', name: 'Skip current note', action: { kind: 'skip' } },
	{ id: 'pause-inbox-review', name: 'Pause inbox review', action: { kind: 'pause' } },
	{
		id: 'trash-current-note',
		name: 'Move current note to trash',
		action: { kind: 'trash' },
	},
	{ id: 'close-inbox-review', name: 'Close inbox review', action: { kind: 'close' } },
];

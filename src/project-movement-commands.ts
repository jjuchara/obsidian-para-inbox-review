import type { ProjectMovementDirection } from './project-movement';

export const PROJECT_MOVEMENT_COMMANDS: readonly {
	id: string;
	name: string;
	direction: ProjectMovementDirection;
}[] = [
	{ id: 'archive-project', name: 'Archive project', direction: 'archive' },
	{ id: 'return-project-to-work', name: 'Return project to work', direction: 'restore' },
];
